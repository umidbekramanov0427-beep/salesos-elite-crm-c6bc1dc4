"""Port of src/lib/daily-report-builder.server.ts.

Builds the full, fully-configurable "Kunlik hisobot" content -- every
section gated by its daily_report_settings.*_enabled flag, numeric
aggregates plus one Gemini-narrated pass for manager strengths/attention and
anketa-savollari summaries. Shared (in the original, and here) by the
"Hisobot namunasi" preview, the real scheduled Telegram send, and the
per-ROP team-scoped send, so all three can never drift apart.

Note on concurrency: the original fires its ~10 independent selects via
Promise.all. supabase-py's synchronous client (used here, matching db.py)
has no direct equivalent -- they run sequentially instead. Functionally
identical; only wall-clock time differs. Switch to supabase-py's async
client (`create_async_client`) and `asyncio.gather` if that matters later.
"""

from __future__ import annotations

import json
import os
import time
from datetime import date, datetime, timedelta
from typing import Any

import httpx

from app.db import get_supabase_admin


def _day_bounds(days_ago: int) -> tuple[str, str]:
    start = datetime.combine(date.today() - timedelta(days=days_ago), datetime.min.time())
    end = start + timedelta(days=1)
    return start.isoformat(), end.isoformat()


def _fmt_duration(total_seconds: float) -> str:
    h = int(total_seconds // 3600)
    m = round((total_seconds % 3600) / 60)
    if h == 0:
        return f"{m} daqiqa"
    return f"{h} soat {m} daqiqa"


def _fmt_pct(part: int, total: int) -> str:
    if total == 0:
        return "0.0%"
    return f"{(part / total) * 100:.1f}%"


def _scope_ids(configured: list[str] | None, all_ids: list[str]) -> set[str]:
    return set(all_ids if configured is None else configured)


async def _generate_narrative(
    stats_block: str,
    managers: list[dict[str, Any]],
    intake_questions: list[dict[str, Any]],
) -> dict[str, Any]:
    """Port of generateNarrative -- one Gemini call for manager strengths/
    attention items and intake-question summaries, all in one JSON-mode
    request so the daily report doesn't need N separate AI calls."""
    empty = {"managers": [], "intakeSummaries": [], "recommendations": [], "summary": ""}
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return empty
    if not managers and not intake_questions and not stats_block.strip():
        return empty

    def _manager_block_line(m: dict[str, Any]) -> str:
        strengths = "; ".join(m["strengthsRaw"][:15]) or "yo'q"
        improvements = "; ".join(m["improvementsRaw"][:15]) or "yo'q"
        return (
            f"Menejer {m['n']} ({m['name']}):\n"
            f"Kuchli tomonlar (xom): {strengths}\n"
            f"Yaxshilash kerak (xom): {improvements}"
        )

    manager_block = "\n\n".join(_manager_block_line(m) for m in managers)
    question_block = "\n\n".join(
        f"Savol {q['n']} ({q['label']}) — {len(q['answers'])} ta javob:\n"
        + "\n".join(f"- {a}" for a in q["answers"][:20])
        for q in intake_questions
    )

    prompt = (
        "Siz sotuv bo'limi rahbari uchun kunlik hisobot yozuvchisisiz. Quyidagi "
        "bugungi statistika va xom ma'lumotlar asosida FAQAT quyidagi JSON "
        "formatida javob ber, boshqa hech qanday matn yozma:\n"
        '{"managers": [{"n": <menejer raqami>, "strengths": ["qisqa band", ...max 3], '
        '"attention": ["qisqa band", ...max 3]}, ...], '
        '"intake_summaries": [{"n": <savol raqami>, "count": <shu mazmunga mos javoblar soni>, '
        '"summary": "eng ko\'p uchragan javob mazmuni, 1 jumla"}, ...], '
        '"recommendations": ["ertangi kun uchun aniq harakat", ... 3 ta], '
        '"summary": "hisobot uchun 1-2 jumlali yakuniy xulosa"}\n\n'
        "Bugungi statistika:\n" + stats_block
        + (f"\n\nMenejerlar bo'yicha xom ma'lumot:\n{manager_block}" if manager_block else "")
        + (f"\n\nAnketa savollari bo'yicha xom javoblar:\n{question_block}" if question_block else "")
    )

    try:
        async with httpx.AsyncClient(timeout=25) as client:
            res = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-3.6-flash:generateContent?key={api_key}",
                json={
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.4, "responseMimeType": "application/json"},
                },
            )
        if res.status_code >= 400:
            return empty
        candidates = res.json().get("candidates") or []
        content = (
            (candidates[0].get("content", {}).get("parts", [{}])[0].get("text") or "").strip()
            if candidates
            else ""
        )
        parsed = json.loads(content)
        return {
            "managers": [
                {
                    "n": m["n"],
                    "strengths": [s for s in m.get("strengths", []) if isinstance(s, str)],
                    "attention": [s for s in m.get("attention", []) if isinstance(s, str)],
                }
                for m in parsed.get("managers", [])
                if isinstance(m.get("n"), (int, float))
            ],
            "intakeSummaries": [
                {"n": q["n"], "count": int(q.get("count") or 0), "summary": q.get("summary") or ""}
                for q in parsed.get("intake_summaries", [])
                if isinstance(q.get("n"), (int, float))
            ],
            "recommendations": [r for r in parsed.get("recommendations", []) if isinstance(r, str)],
            "summary": parsed.get("summary") if isinstance(parsed.get("summary"), str) else "",
        }
    except Exception:
        return empty


async def build_full_daily_report(
    organization_id: str,
    owner_scope: list[str] | None = None,
    include_marketing_section: bool = False,
) -> dict[str, Any]:
    """Port of buildFullDailyReport. Returns {"text": str, "override": bool}.

    `owner_scope`, when given, restricts every section to leads/calls/tasks
    owned by those profile ids (a ROP's report). Left None (Super Admin), it's
    the company-wide report. `include_marketing_section` adds the per-source
    qualified/unqualified breakdown -- Super Admin only.
    """
    admin = get_supabase_admin()

    settings_res = (
        admin.table("daily_report_settings")
        .select("*")
        .eq("organization_id", organization_id)
        .maybe_single()
        .execute()
    )
    s = settings_res.data or {}
    if s.get("report_sample_override"):
        return {"text": s["report_sample_override"], "override": True}

    today_start, today_end = _day_bounds(0)
    yday_start, yday_end = _day_bounds(1)

    profiles = (
        admin.table("profiles")
        .select("id, full_name, email, role")
        .eq("organization_id", organization_id)
        .execute()
        .data
        or []
    )
    calls_today_raw = (
        admin.table("amocrm_calls")
        .select(
            "id, lead_id, connected, duration_seconds, recording_url, analyzed_at, "
            "score, service_line_id, intake_answers, analysis"
        )
        .eq("organization_id", organization_id)
        .gte("occurred_at", today_start)
        .lt("occurred_at", today_end)
        .execute()
        .data
        or []
    )
    calls_yesterday_raw = (
        admin.table("amocrm_calls")
        .select("id, lead_id, connected")
        .eq("organization_id", organization_id)
        .gte("occurred_at", yday_start)
        .lt("occurred_at", yday_end)
        .execute()
        .data
        or []
    )
    tasks_raw = (
        admin.table("tasks")
        .select("id, status, assignee_id, due_date, updated_at")
        .eq("organization_id", organization_id)
        .execute()
        .data
        or []
    )
    all_leads_raw = (
        admin.table("leads")
        .select(
            "id, owner_id, funnel, stage_id, expected_revenue, created_at, "
            "updated_at, lead_quality_stage_id, source"
        )
        .eq("organization_id", organization_id)
        .execute()
        .data
        or []
    )
    stages = (
        admin.table("pipeline_stages")
        .select("id, name, is_won, is_lost")
        .eq("organization_id", organization_id)
        .execute()
        .data
        or []
    )
    lead_quality_stages = (
        admin.table("lead_quality_stages")
        .select("id, title, qualified")
        .eq("organization_id", organization_id)
        .order("position")
        .execute()
        .data
        or []
    )
    service_lines = (
        admin.table("service_lines")
        .select("id, name")
        .eq("organization_id", organization_id)
        .order("position")
        .execute()
        .data
        or []
    )
    intake_questions = (
        admin.table("intake_questions")
        .select("id, label")
        .eq("organization_id", organization_id)
        .order("position")
        .execute()
        .data
        or []
    )
    transition_rules = (
        admin.table("daily_report_stage_transition_rules")
        .select("id, manager_scope, manager_id, funnel, from_stage_id, to_stage_id")
        .eq("organization_id", organization_id)
        .order("position")
        .execute()
        .data
        or []
    )

    scope_set = set(owner_scope) if owner_scope is not None else None

    def in_scope(owner_id: str | None) -> bool:
        return scope_set is None or (owner_id is not None and owner_id in scope_set)

    lead_owner_by_id = {l["id"]: l.get("owner_id") for l in all_leads_raw}
    calls_today = [c for c in calls_today_raw if in_scope(lead_owner_by_id.get(c.get("lead_id")))]
    calls_yesterday = [
        c for c in calls_yesterday_raw if in_scope(lead_owner_by_id.get(c.get("lead_id")))
    ]
    tasks = [t for t in tasks_raw if in_scope(t.get("assignee_id"))]
    all_leads = [l for l in all_leads_raw if in_scope(l.get("owner_id"))]
    managers = [p for p in profiles if p.get("role") == "sotuv_menejeri" and in_scope(p["id"])]
    leads_created_today = [l for l in all_leads if l["created_at"] >= today_start]
    won_stage_ids = {s["id"] for s in stages if s.get("is_won")}
    lost_stage_ids = {s["id"] for s in stages if s.get("is_lost")}

    sections: list[str] = []

    # --- CRM faolligi ---
    if s.get("crm_activity_enabled", True):
        total = len(calls_today)
        connected = sum(1 for c in calls_today if c.get("connected"))
        total_seconds = sum(c.get("duration_seconds", 0) for c in calls_today)
        y_total = len(calls_yesterday)
        y_connected = sum(1 for c in calls_yesterday if c.get("connected"))
        sections.append(
            "\n".join(
                [
                    "CRM faolligi",
                    f"- Jami qo'ng'iroqlar: {total}",
                    f"- Bog'langan qo'ng'iroqlar: {connected}",
                    f"- Mijozga yetib borilmagan qo'ng'iroqlar: {total - connected}",
                    f"- Bog'lanish darajasi: {_fmt_pct(connected, total)}",
                    f"- Umumiy suhbat vaqti: {_fmt_duration(total_seconds)}",
                    f"- Oldingi ish kuni: jami qo'ng'iroqlar {y_total}, bog'langan qo'ng'iroqlar "
                    f"{y_connected}, bog'lanish darajasi {_fmt_pct(y_connected, y_total)}",
                ]
            )
        )

    # --- Vazifalar rejasi ---
    manager_scope = _scope_ids(s.get("managers_activity_manager_ids"), [m["id"] for m in managers])
    if s.get("tasks_plan_enabled", True):
        due_today = [
            t for t in tasks if t.get("due_date") and today_start <= t["due_date"] < today_end
        ]
        done_of_due = [t for t in due_today if t.get("status") == "Done"]
        done_today = [
            t
            for t in tasks
            if t.get("status") == "Done" and today_start <= t.get("updated_at", "") < today_end
        ]
        per_manager = []
        for m in managers:
            if m["id"] not in manager_scope:
                continue
            mine = [t for t in due_today if t.get("assignee_id") == m["id"]]
            mine_done = [t for t in mine if t.get("status") == "Done"]
            label = m.get("full_name") or m.get("email")
            per_manager.append(
                f"- {label}: {len(mine_done)} / {len(mine)}, qoldi "
                f"{len(mine) - len(mine_done)}, jami {len(mine)}"
            )
        lines = [
            "Vazifalar rejasi",
            f"- Bugungi reja vazifalaridan bajarilgani: {len(done_of_due)} / {len(due_today)}",
            f"- Bugungi reja vazifalaridan qolgani: {len(due_today) - len(done_of_due)}",
            f"- Bugun yakunlangan vazifalar: {len(done_today)}",
        ]
        if per_manager:
            lines += ["", "Menejerlar bo'yicha (bajarildi/reja, qoldi, jami):", *per_manager]
        sections.append("\n".join(lines))

    # --- Qo'ng'iroqlar sifati ---
    if s.get("call_quality_enabled", True):
        analyzed = [c for c in calls_today if c.get("analyzed_at")]
        with_checklist = [
            c for c in analyzed if isinstance((c.get("analysis") or {}).get("checklist"), list)
            and len((c.get("analysis") or {}).get("checklist") or []) > 0
        ]
        operational = len(analyzed) - len(with_checklist)
        unconnected = sum(1 for c in calls_today if not c.get("connected"))
        scores = [c["score"] for c in analyzed if c.get("score") is not None]
        avg_score = sum(scores) / len(scores) if scores else 0
        no_audio = sum(1 for c in calls_today if not c.get("recording_url"))
        sections.append(
            "\n".join(
                [
                    "Qo'ng'iroqlar sifati",
                    f"- Tahlil qilingan qo'ng'iroqlar: {len(analyzed)}",
                    f"- Savdo ssenariysi asosidagi qo'ng'iroqlar: {len(with_checklist)} "
                    f"({_fmt_pct(len(with_checklist), len(analyzed))})",
                    f"- Operatsion yoki chiqarilgan qo'ng'iroqlar: {operational}",
                    f"- Bog'lanilmagan holatlar: {unconnected}",
                    f"- O'rtacha ball: {avg_score:.1f}",
                    f"- Material audio muammolari: no_audio: {no_audio}",
                ]
            )
        )

    # --- Menejerlar faoliyati (+ AI narrative) ---
    scoped_managers = [m for m in managers if m["id"] in manager_scope]
    manager_stats = []
    for i, m in enumerate(scoped_managers):
        mine = [c for c in calls_today if lead_owner_by_id.get(c.get("lead_id")) == m["id"]]
        connected = sum(1 for c in mine if c.get("connected"))
        seconds = sum(c.get("duration_seconds", 0) for c in mine)
        scores = [c["score"] for c in mine if c.get("score") is not None]
        avg_score = sum(scores) / len(scores) if scores else 0
        strengths_raw: list[str] = []
        improvements_raw: list[str] = []
        for c in mine:
            a = c.get("analysis") or {}
            strengths_raw += a.get("strengths") or []
            improvements_raw += a.get("improvements") or []
        manager_stats.append(
            {
                "n": i + 1,
                "manager": m,
                "total": len(mine),
                "connected": connected,
                "seconds": seconds,
                "avgScore": avg_score,
                "strengthsRaw": strengths_raw,
                "improvementsRaw": improvements_raw,
            }
        )

    # --- Lidlar harakati ---
    funnel_scope = _scope_ids(
        s.get("leads_movement_funnels"),
        sorted({l["funnel"] for l in all_leads if l.get("funnel")}),
    )
    leads_in_scope = [l for l in leads_created_today if l.get("funnel") in funnel_scope]
    if s.get("leads_movement_enabled", True):
        won_today = [
            l
            for l in all_leads
            if l.get("funnel") in funnel_scope
            and l.get("stage_id") in won_stage_ids
            and l["updated_at"] >= today_start
        ]
        lost_today = [
            l
            for l in all_leads
            if l.get("funnel") in funnel_scope
            and l.get("stage_id") in lost_stage_ids
            and l["updated_at"] >= today_start
        ]
        won_revenue = sum(float(l.get("expected_revenue") or 0) for l in won_today)
        sections.append(
            "\n".join(
                [
                    "Lidlar harakati",
                    f"- Yangi lidlar: {len(leads_in_scope)}",
                    f"- Yutilgan bitimlar: {len(won_today)}",
                    f"- Yo'qotilgan lidlar: {len(lost_today)}",
                    f"- Yutilgan qiymat: {won_revenue:,.0f}",
                    f"- Kiritilgan voronkalar: {', '.join(funnel_scope)}",
                    f"Bugun tizimga {len(leads_in_scope)} ta yangi lid qo'shildi va "
                    f"{len(won_today)} ta muvaffaqiyatli kelishuv qayd etildi.",
                ]
            )
        )

    # --- Voronka bosqichlari harakati ---
    if transition_rules:
        stage_name_by_id = {st["id"]: st["name"] for st in stages}
        manager_label_by_id = {p["id"]: p.get("full_name") or p.get("email") for p in profiles}
        lead_audit_rows = (
            admin.table("audit_logs")
            .select("meta")
            .eq("organization_id", organization_id)
            .eq("entity_type", "leads")
            .eq("action", "update")
            .gte("created_at", today_start)
            .lt("created_at", today_end)
            .execute()
            .data
            or []
        )
        transitions_today = []
        for row in lead_audit_rows:
            meta = row.get("meta") or {}
            old = meta.get("old") or {}
            new = meta.get("new") or {}
            t = {
                "fromStageId": old.get("stage_id"),
                "toStageId": new.get("stage_id"),
                "funnel": new.get("funnel"),
                "ownerId": new.get("owner_id"),
            }
            if t["toStageId"] and t["fromStageId"] != t["toStageId"]:
                transitions_today.append(t)

        rule_lines = []
        for rule in transition_rules:
            count = sum(
                1
                for t in transitions_today
                if t["funnel"] == rule["funnel"]
                and t["toStageId"] == rule["to_stage_id"]
                and (rule.get("from_stage_id") is None or t["fromStageId"] == rule["from_stage_id"])
                and (rule["manager_scope"] == "all" or t["ownerId"] == rule.get("manager_id"))
            )
            manager_label = (
                manager_label_by_id.get(rule.get("manager_id"), "Noma'lum menejer")
                if rule["manager_scope"] == "specific"
                else "Barcha menejerlar"
            )
            from_label = (
                stage_name_by_id.get(rule.get("from_stage_id"), "?")
                if rule.get("from_stage_id")
                else "Hamma bosqichdan"
            )
            to_label = stage_name_by_id.get(rule["to_stage_id"], "?")
            rule_lines.append(f"- {manager_label} | {rule['funnel']}: {from_label} → {to_label}: {count} ta")
        sections.append("\n".join(["Voronka bosqichlari harakati", *rule_lines]))

    # --- Lid sifati ---
    quality_scope = _scope_ids(
        s.get("lead_quality_stage_ids"), [q["id"] for q in lead_quality_stages]
    )
    if s.get("lead_quality_enabled", True):
        call_lead_ids = {c.get("lead_id") for c in calls_today}
        worked = [l for l in leads_created_today if l["id"] in call_lead_ids]
        unreachable = [l for l in leads_created_today if l["id"] not in call_lead_ids]
        stage_by_id = {q["id"]: q for q in lead_quality_stages}
        qualified = [
            l
            for l in leads_created_today
            if stage_by_id.get(l.get("lead_quality_stage_id"), {}).get("qualified") is True
        ]
        unqualified = [
            l
            for l in leads_created_today
            if l.get("lead_quality_stage_id") in stage_by_id
            and stage_by_id[l["lead_quality_stage_id"]].get("qualified") is False
        ]
        group_lines = [
            f"- {q['title']}: {sum(1 for l in leads_created_today if l.get('lead_quality_stage_id') == q['id'])}"
            for q in lead_quality_stages
            if q["id"] in quality_scope
        ]
        lines = [
            "Lid sifati",
            f"- Jami yangi lidlar: {len(leads_created_today)}",
            f"- Ishlangan lidlar: {len(worked)}",
            f"- Sifatli: {len(qualified)}",
            f"- Sifatsiz: {len(unqualified)}",
            f"- Bog'lana olinmagan: {len(unreachable)}",
        ]
        if group_lines:
            lines += ["Guruhlar:", *group_lines]
        sections.append("\n".join(lines))

    # --- Marketing uchun lid tahlili (Super Admin only) ---
    if include_marketing_section:
        stage_by_id = {q["id"]: q for q in lead_quality_stages}
        by_source: dict[str, dict[str, int]] = {}
        for l in leads_created_today:
            src = l.get("source") or "—"
            bucket = by_source.setdefault(
                src, {"total": 0, "qualified": 0, "unqualified": 0, "unscored": 0}
            )
            bucket["total"] += 1
            stage = stage_by_id.get(l.get("lead_quality_stage_id"))
            if stage and stage.get("qualified") is True:
                bucket["qualified"] += 1
            elif stage is not None and stage.get("qualified") is False:
                bucket["unqualified"] += 1
            else:
                bucket["unscored"] += 1
        source_lines = [
            f"- {src}: jami {b['total']}, sifatli {b['qualified']}, sifatsiz {b['unqualified']}, "
            f"hali baholanmagan {b['unscored']}"
            for src, b in sorted(by_source.items(), key=lambda kv: kv[1]["total"], reverse=True)
        ]
        sections.append(
            "\n".join(
                [
                    "Marketing uchun lid tahlili",
                    "Sun'iy intellekt menejer-mijoz suhbatini tinglab baholagan holat bo'yicha, "
                    "manba kesimida:",
                    *(source_lines or ["Bugun manbasi ko'rsatilgan lid kelmadi."]),
                ]
            )
        )

    # --- Xizmat yo'nalishlari ---
    if s.get("service_lines_enabled", True):
        lines = [
            f"- {line['name']}: {sum(1 for c in calls_today if c.get('service_line_id') == line['id'])}"
            for line in service_lines
        ]
        sections.append(
            "\n".join(
                [
                    "Xizmat yo'nalishlari",
                    *lines,
                    "Muloqotlarning asosiy qismi sozlangan shu sotuv yo'nalishlariga to'g'ri "
                    "kelgani ko'rsatiladi.",
                ]
            )
        )

    # --- Anketa savollari ---
    question_scope = _scope_ids(s.get("intake_question_ids"), [q["id"] for q in intake_questions])
    scoped_questions = []
    for i, q in enumerate(intake_questions):
        if q["id"] not in question_scope:
            continue
        answers = [
            (c.get("intake_answers") or {}).get(q["id"], "").strip()
            for c in calls_today
        ]
        answers = [a for a in answers if a != ""]
        scoped_questions.append({"n": i + 1, "id": q["id"], "label": q["label"], "answers": answers})

    narrative = await _generate_narrative(
        "\n\n".join(sections),
        [
            {
                "n": m["n"],
                "name": m["manager"].get("full_name") or m["manager"].get("email"),
                "strengthsRaw": m["strengthsRaw"],
                "improvementsRaw": m["improvementsRaw"],
            }
            for m in manager_stats
        ],
        [{"n": q["n"], "label": q["label"], "answers": q["answers"]} for q in scoped_questions],
    )

    if s.get("managers_activity_enabled", True):
        narrative_by_n = {m["n"]: m for m in narrative["managers"]}
        manager_lines = []
        for m in manager_stats:
            nar = narrative_by_n.get(m["n"])
            label = m["manager"].get("full_name") or m["manager"].get("email")
            lines = [
                label,
                f"- Ko'rsatkichlar: Jami qo'ng'iroqlar: {m['total']}; Bog'langan qo'ng'iroqlar: "
                f"{m['connected']}; Bog'lanish darajasi: {_fmt_pct(m['connected'], m['total'])}; "
                f"Umumiy suhbat vaqti: {_fmt_duration(m['seconds'])}; O'rtacha ball: "
                f"{m['avgScore']:.1f}",
            ]
            if nar and nar["strengths"]:
                lines.append(f"- Kuchli tomonlar: {'; '.join(nar['strengths'])}")
            if nar and nar["attention"]:
                lines.append(f"- E'tibor kerak bo'lgan jihatlar: {'; '.join(nar['attention'])}")
            manager_lines.append("\n".join(lines))
        insert_at = next(
            (i for i, sec in enumerate(sections) if sec.startswith("Lidlar harakati")), len(sections)
        )
        sections.insert(insert_at, "\n\n".join(["Menejerlar faoliyati", *manager_lines]))

    if scoped_questions and s.get("intake_questions_enabled", True):
        narrative_by_n = {q["n"]: q for q in narrative["intakeSummaries"]}
        lines = []
        for q in scoped_questions:
            nar = narrative_by_n.get(q["n"])
            header = f"- {q['label']}"
            body = (
                f"Bugungi holat: {len(q['answers'])} ta javobdan eng ko'p uchragan mazmun: "
                f"{nar['summary']} ({nar['count']} ta suhbat)."
                if nar and nar.get("summary")
                else f"Bugungi holat: {len(q['answers'])} ta javob olindi."
            )
            lines.append(f"{header}\n{body}")
        sections.append("\n".join(["Anketa savollari", *lines]))

    if s.get("recommendations_enabled", True):
        recs = narrative["recommendations"] or ["Hozircha tavsiya generatsiya qilinmadi."]
        sections.append(
            "\n".join(["Tavsiyalar", *[f"{i + 1}. {r}" for i, r in enumerate(recs)]])
        )

    if s.get("summary_enabled", True):
        sections.append(
            "\n".join(["Xulosa", narrative["summary"] or "Hozircha xulosa generatsiya qilinmadi."])
        )

    return {"text": "\n\n".join(sections), "override": False}


async def build_personal_daily_report(organization_id: str, manager_id: str) -> str:
    """Port of buildPersonalDailyReport -- a self-scoped report for one
    sotuv_menejeri: their own numbers only, no AI narrative, no transition
    rules, no company-wide sections."""
    admin = get_supabase_admin()
    today_start, today_end = _day_bounds(0)

    profile = (
        admin.table("profiles")
        .select("full_name, email")
        .eq("id", manager_id)
        .maybe_single()
        .execute()
        .data
        or {}
    )
    calls_today_raw = (
        admin.table("amocrm_calls")
        .select("id, lead_id, connected, duration_seconds, score, analyzed_at")
        .eq("organization_id", organization_id)
        .gte("occurred_at", today_start)
        .lt("occurred_at", today_end)
        .execute()
        .data
        or []
    )
    tasks = (
        admin.table("tasks")
        .select("id, status, assignee_id, due_date")
        .eq("organization_id", organization_id)
        .eq("assignee_id", manager_id)
        .execute()
        .data
        or []
    )
    leads = (
        admin.table("leads")
        .select("id, owner_id, stage_id, expected_revenue, created_at, updated_at")
        .eq("organization_id", organization_id)
        .eq("owner_id", manager_id)
        .execute()
        .data
        or []
    )
    stages = (
        admin.table("pipeline_stages")
        .select("id, is_won, is_lost")
        .eq("organization_id", organization_id)
        .execute()
        .data
        or []
    )

    name = profile.get("full_name") or profile.get("email") or "Menejer"
    won_stage_ids = {s["id"] for s in stages if s.get("is_won")}
    lost_stage_ids = {s["id"] for s in stages if s.get("is_lost")}

    my_lead_ids = {l["id"] for l in leads}
    my_calls = [c for c in calls_today_raw if c.get("lead_id") in my_lead_ids]
    total = len(my_calls)
    connected = sum(1 for c in my_calls if c.get("connected"))
    seconds = sum(c.get("duration_seconds", 0) for c in my_calls)
    scores = [c["score"] for c in my_calls if c.get("score") is not None]
    avg_score = sum(scores) / len(scores) if scores else 0

    due_today = [t for t in tasks if t.get("due_date") and today_start <= t["due_date"] < today_end]
    done_of_due = [t for t in due_today if t.get("status") == "Done"]

    new_leads_today = [l for l in leads if l["created_at"] >= today_start]
    won_today = [
        l for l in leads if l.get("stage_id") in won_stage_ids and l["updated_at"] >= today_start
    ]
    lost_today = [
        l for l in leads if l.get("stage_id") in lost_stage_ids and l["updated_at"] >= today_start
    ]
    won_revenue = sum(float(l.get("expected_revenue") or 0) for l in won_today)

    date_label = date.today().strftime("%d %B %Y")

    lines = [
        f"📊 <b>Shaxsiy kunlik hisobot — {date_label}</b>",
        f"👤 {name}",
        "",
        f"📞 Bugungi qo'ng'iroqlar: <b>{total}</b> (bog'langan: {connected}, "
        f"{_fmt_pct(connected, total)})",
        f"⏱ Umumiy suhbat vaqti: <b>{_fmt_duration(seconds)}</b>",
        f"⭐ O'rtacha ball: <b>{avg_score:.1f}</b>" if scores else "",
        f"✅ Bugungi vazifalar: <b>{len(done_of_due)}/{len(due_today)}</b> bajarildi",
        f"🆕 Yangi lidlar: <b>{len(new_leads_today)}</b>",
        f"🏆 Yutilgan bitimlar: <b>{len(won_today)}</b> ({won_revenue:,.0f})",
        f"❌ Yo'qotilgan lidlar: <b>{len(lost_today)}</b>",
    ]
    return "\n".join(line for line in lines if line)
