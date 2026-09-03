"""Port of the core logic in src/routes/audio-analytics.analyze.ts --
analyze_call_by_id() is the "listen to the call and score it" work, used by
both the manual "Tahlil qilish" button (app/routers/audio_analytics.py)
and the analyze-pending cron sweep, exactly mirroring how the original
extracts analyzeCallById out of its route handler for the same reason.

Depends on app/amocrm_client.py's create_amo_task/create_amo_note/
has_human_note_since (the AmoCRM "client core" ported alongside this --
see that module's docstring for what of the full AmoCRM subsystem is and
isn't ported).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import httpx

from app.amocrm_client import create_amo_note, create_amo_task, has_human_note_since
from app.db import get_supabase_admin


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}. Add it in Settings -> Secrets.")
    return value


# A fixed baseline set of conduct rules every call is checked against,
# separate from the org's own configurable stage/step rubric -- these
# don't vary funnel to funnel or org to org, so they aren't backed by a
# settings table.
SERVICE_STANDARDS = [
    "Vakolatdan tashqari va'da bermaslik",
    "Mijozni bo'lmaslik",
    "Mijozga ismi bilan murojaat qilish",
    "Hurmatli va xushmuomala ohang",
    "Mijoz bilan bahslashmaslik",
]


async def _transcribe_audio(recording_url: str) -> str:
    """Whisper does the ear (audio -> text); Gemini (in _analyze_transcript)
    does the reading (text -> structured scoring)."""
    api_key = _require_env("OPENAI_API_KEY")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            audio_res = await client.get(recording_url)
    except httpx.HTTPError as err:
        raise RuntimeError(f"Ovoz yozuvini yuklab bo'lmadi -- ulanish xatosi: {err}") from err
    if audio_res.status_code >= 400:
        body_snippet = audio_res.text[:300] if audio_res.text else ""
        suffix = f": {body_snippet}" if body_snippet else ""
        raise RuntimeError(f"Ovoz yozuvini yuklab bo'lmadi (HTTP {audio_res.status_code}){suffix}")
    audio_bytes = audio_res.content

    # recording_url is captured once, at sync time, and never refreshed --
    # many telephony providers behind AmoCRM issue signed links that expire.
    # An expired link often still answers HTTP 200 with an HTML/JSON
    # placeholder instead of real audio, which Whisper would otherwise
    # silently "transcribe" as garbage.
    content_type = audio_res.headers.get("content-type", "")
    if "text/html" in content_type or "application/json" in content_type:
        raise RuntimeError(
            "Bu qo'ng'iroq yozuvi havolasi endi ishlamaydi (eskirgan/muddati o'tgan bo'lishi mumkin)."
        )
    if len(audio_bytes) < 2000:
        raise RuntimeError(
            "Ovoz yozuvi juda kichik yoki bo'sh -- havola eskirgan yoki yozuv saqlanmagan bo'lishi mumkin."
        )

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"authorization": f"Bearer {api_key}"},
            files={"file": ("call.mp3", audio_bytes, "audio/mpeg")},
            data={"model": "whisper-1", "language": "uz"},
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Whisper transcription error ({res.status_code}): {res.text}")
    return (res.json().get("text") or "").strip()


async def _load_rubric(organization_id: str) -> list[dict[str, Any]]:
    admin = get_supabase_admin()
    stages = (
        admin.table("call_stages")
        .select("id, name, position, weight_percent")
        .eq("organization_id", organization_id)
        .order("position")
        .execute()
        .data
        or []
    )
    if not stages:
        return []

    steps = (
        admin.table("call_stage_steps")
        .select(
            "stage_id, name, code, skill_id, points, position, level_0_desc, level_1_desc, level_2_desc, level_3_desc"
        )
        .eq("organization_id", organization_id)
        .order("position")
        .execute()
        .data
        or []
    )
    skills = (
        admin.table("call_skills").select("id, name").eq("organization_id", organization_id).execute().data
        or []
    )
    skill_name_by_id = {s["id"]: s["name"] for s in skills}

    rubric: list[dict[str, Any]] = []
    n = 1
    for stage in stages:
        stage_steps = [s for s in steps if s["stage_id"] == stage["id"]]
        for step in stage_steps:
            rubric.append(
                {
                    "n": n,
                    "stageId": stage["id"],
                    "stageWeight": float(stage.get("weight_percent") or 0),
                    "stage": stage["name"],
                    "step": step["name"],
                    "code": step.get("code"),
                    "skill": skill_name_by_id.get(step.get("skill_id")) if step.get("skill_id") else None,
                    "points": float(step.get("points") or 0),
                    "level0": step.get("level_0_desc"),
                    "level1": step.get("level_1_desc"),
                    "level2": step.get("level_2_desc"),
                    "level3": step.get("level_3_desc"),
                }
            )
            n += 1
    return rubric


def _compute_weighted_score(rubric: list[dict[str, Any]], met_by_n: dict[int, bool]) -> float | None:
    """A configured weighted rubric (call_stages.weight_percent) always beats
    the simple flat point ratio. Returns None when no stage has a weight
    configured yet, so the caller falls back to the flat points formula."""
    stage_weight: dict[str, float] = {}
    stage_total_points: dict[str, float] = {}
    stage_earned_points: dict[str, float] = {}
    for r in rubric:
        stage_weight[r["stageId"]] = r["stageWeight"]
        stage_total_points[r["stageId"]] = stage_total_points.get(r["stageId"], 0) + r["points"]
        if met_by_n.get(r["n"]):
            stage_earned_points[r["stageId"]] = stage_earned_points.get(r["stageId"], 0) + r["points"]

    total_weight = sum(stage_weight.values())
    if total_weight <= 0:
        return None

    weighted_score = 0.0
    for stage_id, weight in stage_weight.items():
        total = stage_total_points.get(stage_id, 0)
        earned = stage_earned_points.get(stage_id, 0)
        ratio = (earned / total) if total > 0 else 0
        weighted_score += ratio * weight
    return round((weighted_score / total_weight) * 100)


def _as_record(v: Any) -> dict[str, Any]:
    return v if isinstance(v, dict) else {}


def _as_string_array_loose(v: Any) -> list[str]:
    return [x for x in v if isinstance(x, str)] if isinstance(v, list) else []


def _as_str(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def _build_call_instructions_block(call_instructions: Any) -> str:
    root = _as_record(call_instructions)
    ai = _as_record(root.get("aiInstructions"))
    lead_analytics = _as_record(root.get("leadAnalytics"))

    transcript_terms = _as_string_array_loose(ai.get("transcriptTerms"))
    transcript_guidance = _as_str(ai.get("transcriptGuidance"))
    company_context = _as_str(ai.get("companyContext"))
    extraction_guidance = _as_str(ai.get("extractionGuidance"))
    task_creation_guidance = _as_str(ai.get("taskCreationGuidance"))
    violation_guidance = _as_str(ai.get("violationGuidance"))
    coaching_guidance = _as_str(ai.get("coachingGuidance"))
    scoring_focus_guidance = _as_str(ai.get("scoringFocusGuidance"))
    qualified_lead_guidance = _as_str(ai.get("qualifiedLeadGuidance"))

    business_context = _as_str(lead_analytics.get("businessContext"))
    loss_analysis_guidance = _as_str(lead_analytics.get("lossAnalysisGuidance"))
    recommendation_guidance = _as_str(lead_analytics.get("recommendationGuidance"))

    parts: list[str] = []
    if transcript_terms:
        parts.append(
            "Quyidagi atamalarni transkripsiyada aynan shu ko'rinishda yozing: " + ", ".join(transcript_terms)
        )
    if transcript_guidance:
        parts.append(f"Transkripsiya bo'yicha ko'rsatma: {transcript_guidance}")
    if company_context:
        parts.append(f"Kompaniya haqida: {company_context}")
    if extraction_guidance:
        parts.append(f"Qo'ng'iroqdan ajratib olinadigan ma'lumotlar: {extraction_guidance}")
    if task_creation_guidance:
        parts.append(f"Vazifa yaratish qoidasi: {task_creation_guidance}")
    if violation_guidance:
        parts.append(f"Qoida buzilishi hisoblanadigan holatlar: {violation_guidance}")
    if coaching_guidance:
        parts.append(f"Menejerga tavsiyalar berishda: {coaching_guidance}")
    if scoring_focus_guidance:
        parts.append(f"Baholashda e'tibor: {scoring_focus_guidance}")
    if qualified_lead_guidance:
        parts.append(f"Sifatli lid ta'rifi: {qualified_lead_guidance}")
    if business_context:
        parts.append(f"Biznes konteksti: {business_context}")
    if loss_analysis_guidance:
        parts.append(f"Yo'qotilgan lidni tahlil qilishda: {loss_analysis_guidance}")
    if recommendation_guidance:
        parts.append(f"Menejer uchun tavsiyalarda: {recommendation_guidance}")

    return ("\n\n" + "\n\n".join(parts)) if parts else ""


async def _build_playbook_block(organization_id: str) -> dict[str, Any]:
    admin = get_supabase_admin()
    lines = (
        admin.table("service_lines")
        .select("id, name, description")
        .eq("organization_id", organization_id)
        .order("position")
        .execute()
        .data
        or []
    )
    stages = (
        admin.table("lead_quality_stages")
        .select("id, title, conditions, qualified")
        .eq("organization_id", organization_id)
        .order("position")
        .execute()
        .data
        or []
    )
    questions = (
        admin.table("intake_questions")
        .select("id, label")
        .eq("organization_id", organization_id)
        .order("position")
        .execute()
        .data
        or []
    )

    service_lines = [{"id": l["id"], "label": l["name"]} for l in lines]
    lead_quality_stages = [{"id": s["id"], "label": s["title"]} for s in stages]
    intake_questions = [{"id": q["id"], "label": q["label"]} for q in questions]

    def _line_line(i: int, l: dict[str, Any]) -> str:
        suffix = f": {l['description']}" if l.get("description") else ""
        return f"{i + 1}. {l['name']}{suffix}"

    def _stage_line(i: int, s: dict[str, Any]) -> str:
        qualified = "sifatli" if s.get("qualified") else "sifatsiz"
        conditions = "; ".join(s["conditions"]) if s.get("conditions") else ""
        suffix = f": {conditions}" if conditions else ""
        return f"{i + 1}. {s['title']} ({qualified}){suffix}"

    parts: list[str] = []
    if lines:
        parts.append(
            "Kompaniyaning xizmat yo'nalishlari (raqami bilan, mijoz qaysi biri haqida gapirayotganini aniqlang):\n"
            + "\n".join(_line_line(i, l) for i, l in enumerate(lines))
        )
    if stages:
        parts.append(
            "Lid sifati bosqichlari (raqami bilan, mos kelganini aniqlashga harakat qiling):\n"
            + "\n".join(_stage_line(i, s) for i, s in enumerate(stages))
        )
    if questions:
        parts.append(
            "Anketa savollari (raqami bilan, suhbatdan javob topa olsangiz ajratib bering):\n"
            + "\n".join(f"{i + 1}. {q['label']}" for i, q in enumerate(questions))
        )

    return {
        "text": ("\n\n" + "\n\n".join(parts)) if parts else "",
        "serviceLines": service_lines,
        "leadQualityStages": lead_quality_stages,
        "intakeQuestions": intake_questions,
    }


def _build_json_instruction(
    rubric: list[dict[str, Any]],
    service_lines: list[dict[str, Any]],
    lead_quality_stages: list[dict[str, Any]],
    intake_questions: list[dict[str, Any]],
) -> str:
    base = (
        '{"summary": "qo\'ng\'iroq mavzusi va mijoz kayfiyati haqida qisqa xulosa", '
        '"next_step": "menejer keyin aniq nima qilishi kerak — bitta lo\'nda jumla", '
        '"mood": "mijozning umumiy kayfiyati — bir-ikki so\'z (masalan: qiziqgan, betaraf, norozi)", '
        '"talk_ratio": "menejerning gapirish vaqti foizda taxminiy baho, 0 dan 100 gacha butun son", '
        '"strengths": ["menejer yaxshi qilgan narsalar ro\'yxati"], '
        '"improvements": ["yaxshilash kerak bo\'lgan narsalar ro\'yxati"], '
        "\"warnings\": [\"ogohlantirishga arziydigan holatlar ro'yxati, bo'lmasa bo'sh ro'yxat\"], "
        "\"risks\": [\"bitim yo'qolish xavfi bilan bog'liq holatlar, bo'lmasa bo'sh ro'yxat\"], "
        '"agreements": ["tomonlar kelishib olgan narsalar, bo\'lmasa bo\'sh ro\'yxat"], '
        '"key_quotes": ["suhbatdan 2-4 ta muhim, so\'zma-so\'z iqtibos"], '
        "\"top_objections\": [\"mijoz bildirgan e'tirozlar, bo'lmasa bo'sh ro'yxat\"], "
        '"service_standards": [{"n": 1, "violated": false, "evidence": "buzilgan bo\'lsa qisqa dalil/iqtibos, aks holda bo\'sh matn"}, ...]'
    )

    standards_lines = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(SERVICE_STANDARDS))
    standards_instruction = (
        "\n\nQuyidagi xizmat standartlari ro'yxatini ham tekshir — har biri buzilganmi yoki yo'qmi "
        "(violated: true/false) va buzilgan bo'lsa qisqa dalil (evidence):\n"
        + standards_lines
        + '\n\n"service_standards" massivida yuqoridagi RO\'YXATDAGI HAR BIR band uchun aynan bitta yozuv bo\'lishi kerak, "n" band raqamiga mos kelishi kerak.'
    )

    extra_fields: list[str] = []
    extra_instruction = ""
    if service_lines:
        extra_fields.append(
            '"service_line_n": "yuqoridagi xizmat yo\'nalishlari ro\'yxatidan mos kelgan raqam, aniqlab bo\'lmasa null"'
        )
    if lead_quality_stages:
        extra_fields.append(
            '"lead_quality_stage_n": "yuqoridagi lid sifati bosqichlari ro\'yxatidan mos kelgan raqam, aniqlab bo\'lmasa null"'
        )
    if intake_questions:
        extra_fields.append(
            '"intake_answers": [{"n": "yuqoridagi anketa savollari ro\'yxatidagi savol raqami", "answer": "suhbatdan topilgan javob, topilmasa bo\'sh matn"}, ...]'
        )
        extra_instruction = (
            '\n\n"intake_answers" massivida yuqoridagi anketa savollari RO\'YXATIDAGI HAR BIR savol uchun '
            "aynan bitta yozuv bo'lishi kerak (javob topilmasa ham, \"answer\" bo'sh matn bilan)."
        )
    extra = (", " + ", ".join(extra_fields)) if extra_fields else ""

    if not rubric:
        return (
            standards_instruction
            + extra_instruction
            + "\n\nJavobni faqat quyidagi JSON formatida qaytar, boshqa hech qanday matn yozma:\n{"
            + base[1:]
            + ', "score": "qo\'ng\'iroqqa umumiy baho, 0 dan 100 gacha butun son"'
            + extra
            + "}"
        )

    checklist_lines = []
    for r in rubric:
        label = f"{r['n']}. [{r['stage']}]" + (f" ({r['code']})" if r.get("code") else "") + f" {r['step']}"
        if r.get("skill"):
            label += f" (ko'nikma: {r['skill']})"
        hints = []
        if r.get("level3"):
            hints.append(f"to'liq bajarilgan: {r['level3']}")
        if r.get("level0"):
            hints.append(f"bajarilmagan: {r['level0']}")
        checklist_lines.append(f"{label} — {'; '.join(hints)}" if hints else label)

    return (
        standards_instruction
        + extra_instruction
        + "\n\nQuyidagi tekshiruv ro'yxati (checklist) asosida qo'ng'iroqni bahola. Har bir band uchun "
        "menejer buni bajarganmi yoki yo'qmi (met: true/false) va qisqa izoh (note) ber:\n"
        + "\n".join(checklist_lines)
        + "\n\nJavobni faqat quyidagi JSON formatida qaytar, boshqa hech qanday matn yozma:\n{"
        + base[1:]
        + ', "checklist": [{"n": 1, "met": true, "note": "qisqa izoh"}, ...] — checklist massivida yuqoridagi '
        'RO\'YXATDAGI HAR BIR band uchun aynan bitta yozuv bo\'lishi kerak, "n" band raqamiga mos kelishi kerak'
        + extra
        + "}"
    )


async def _analyze_transcript(
    transcript: str,
    system_prompt: str,
    rubric: list[dict[str, Any]],
    service_lines: list[dict[str, Any]],
    lead_quality_stages: list[dict[str, Any]],
    intake_questions: list[dict[str, Any]],
) -> dict[str, Any]:
    import json as _json

    api_key = _require_env("GEMINI_API_KEY")

    full_prompt = system_prompt + _build_json_instruction(
        rubric, service_lines, lead_quality_stages, intake_questions
    )
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={api_key}",
            json={
                "systemInstruction": {"parts": [{"text": full_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": transcript}]}],
                "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"},
            },
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Gemini error ({res.status_code}): {res.text}")
    json_res = res.json()
    content = (
        (((json_res.get("candidates") or [{}])[0]).get("content") or {}).get("parts") or [{}]
    )[0].get("text", "").strip()

    def as_string_array(v: Any) -> list[str]:
        return [x.strip() for x in v if isinstance(x, str) and x.strip()] if isinstance(v, list) else []

    empty_result = {
        "summary": content,
        "nextStep": None,
        "mood": None,
        "talkRatio": None,
        "score": None,
        "checklist": [],
        "strengths": [],
        "improvements": [],
        "warnings": [],
        "risks": [],
        "agreements": [],
        "keyQuotes": [],
        "topObjections": [],
        "serviceStandards": [],
        "serviceLineN": None,
        "leadQualityStageN": None,
        "intakeAnswers": [],
    }
    try:
        parsed = _json.loads(content)
    except (_json.JSONDecodeError, TypeError):
        return empty_result
    if not parsed.get("summary"):
        return empty_result

    def as_finite_int(v: Any) -> int | None:
        try:
            f = float(v)
        except (TypeError, ValueError):
            return None
        return round(f) if f == f and f not in (float("inf"), float("-inf")) else None

    talk_ratio = as_finite_int(parsed.get("talk_ratio"))
    score = as_finite_int(parsed.get("score"))
    service_line_n = as_finite_int(parsed.get("service_line_n"))
    lead_quality_stage_n = as_finite_int(parsed.get("lead_quality_stage_n"))

    checklist = [
        {"n": c["n"], "met": c["met"], "note": c.get("note", "")}
        for c in (parsed.get("checklist") or [])
        if isinstance(c, dict) and isinstance(c.get("n"), (int, float)) and isinstance(c.get("met"), bool)
    ]
    service_standards = [
        {"n": s["n"], "violated": s["violated"], "evidence": s.get("evidence", "")}
        for s in (parsed.get("service_standards") or [])
        if isinstance(s, dict) and isinstance(s.get("n"), (int, float)) and isinstance(s.get("violated"), bool)
    ]
    intake_answers = [
        {"n": a["n"], "answer": (a.get("answer") or "").strip()}
        for a in (parsed.get("intake_answers") or [])
        if isinstance(a, dict) and isinstance(a.get("n"), (int, float))
    ]

    return {
        "summary": parsed["summary"].strip(),
        "nextStep": (parsed.get("next_step") or "").strip() or None,
        "mood": (parsed.get("mood") or "").strip() or None,
        "talkRatio": min(100, max(0, talk_ratio)) if talk_ratio is not None else None,
        "score": min(100, max(0, score)) if score is not None else None,
        "checklist": checklist,
        "strengths": as_string_array(parsed.get("strengths")),
        "improvements": as_string_array(parsed.get("improvements")),
        "warnings": as_string_array(parsed.get("warnings")),
        "risks": as_string_array(parsed.get("risks")),
        "agreements": as_string_array(parsed.get("agreements")),
        "keyQuotes": as_string_array(parsed.get("key_quotes")),
        "topObjections": as_string_array(parsed.get("top_objections")),
        "serviceStandards": service_standards,
        "serviceLineN": service_line_n,
        "leadQualityStageN": lead_quality_stage_n,
        "intakeAnswers": intake_answers,
    }


def _temperature_from_score(score: float) -> str:
    """AmoCRM has no real "lead temperature" concept -- this is the only
    place a lead's score/temperature ever gets set to something other than
    the column defaults, rolling up whatever the AI call-analysis engine
    just found for its most recent call."""
    if score >= 76:
        return "VeryHot"
    if score >= 51:
        return "Hot"
    if score >= 26:
        return "Warm"
    return "Cold"


async def analyze_call_by_id(organization_id: str, call_id: str) -> dict[str, Any]:
    admin = get_supabase_admin()
    call = (
        admin.table("amocrm_calls")
        .select(
            "id, lead_id, recording_url, source, amocrm_task_id, occurred_at, leads:lead_id(amocrm_id, owner_id)"
        )
        .eq("id", call_id)
        .eq("organization_id", organization_id)
        .maybe_single()
        .execute()
        .data
    )
    if not call:
        raise RuntimeError("Call not found.")
    if not call.get("recording_url"):
        raise RuntimeError("Bu qo'ng'iroqda ovoz yozuvi yo'q.")

    agent = (
        admin.table("ai_agents")
        .select("system_prompt, active, call_instructions")
        .eq("organization_id", organization_id)
        .eq("kind", "call")
        .maybe_single()
        .execute()
        .data
    )
    if agent and agent.get("active") is False:
        raise RuntimeError("Qo'ng'iroq tahlili AI agenti o'chirilgan. Admin panelidan yoqing.")
    base_system_prompt = (
        (agent or {}).get("system_prompt") or ""
    ).strip() or (
        "Siz qo'ng'iroq yozuvini tahlil qiluvchi tajribali sotuv nazoratchisisiz. Asosiy mavzuni, "
        "mijoz kayfiyatini, menejerning kuchli va zaif tomonlarini xolisona baholang."
    )

    transcript = await _transcribe_audio(call["recording_url"])
    if not transcript:
        raise RuntimeError("Ovozdan matn chiqmadi (bo'sh yozuv).")

    rubric = await _load_rubric(organization_id)
    playbook = await _build_playbook_block(organization_id)
    system_prompt = (
        base_system_prompt
        + _build_call_instructions_block((agent or {}).get("call_instructions"))
        + playbook["text"]
    )
    result = await _analyze_transcript(
        transcript,
        system_prompt,
        rubric,
        playbook["serviceLines"],
        playbook["leadQualityStages"],
        playbook["intakeQuestions"],
    )

    # A configured rubric always wins over the AI's own holistic guess.
    score = result["score"]
    total_points = sum(r["points"] for r in rubric)
    if rubric and total_points > 0:
        met_by_n = {c["n"]: c["met"] for c in result["checklist"]}
        weighted = _compute_weighted_score(rubric, met_by_n)
        if weighted is not None:
            score = weighted
        else:
            matched_points = sum(r["points"] for r in rubric if met_by_n.get(r["n"]))
            score = round((matched_points / total_points) * 100)

    note_by_n = {c["n"]: c.get("note", "") for c in result["checklist"]}
    met_by_n = {c["n"]: c["met"] for c in result["checklist"]}
    standard_by_n = {
        s["n"]: {"violated": s["violated"], "evidence": s.get("evidence", "")}
        for s in result["serviceStandards"]
    }
    analysis = {
        "checklist": [
            {
                "stage": r["stage"],
                "step": r["step"],
                "skill": r["skill"],
                "points": r["points"],
                "met": met_by_n.get(r["n"], False),
                "note": note_by_n.get(r["n"], ""),
            }
            for r in rubric
        ],
        "strengths": result["strengths"],
        "improvements": result["improvements"],
        "warnings": result["warnings"],
        "risks": result["risks"],
        "agreements": result["agreements"],
        "keyQuotes": result["keyQuotes"],
        "topObjections": result["topObjections"],
        "serviceStandards": [
            {
                "name": name,
                "violated": standard_by_n.get(i + 1, {}).get("violated", False),
                "evidence": standard_by_n.get(i + 1, {}).get("evidence", ""),
            }
            for i, name in enumerate(SERVICE_STANDARDS)
        ],
    }

    service_line_id = None
    if result["serviceLineN"] is not None and 1 <= result["serviceLineN"] <= len(playbook["serviceLines"]):
        service_line_id = playbook["serviceLines"][result["serviceLineN"] - 1]["id"]
    lead_quality_stage_id = None
    if (
        result["leadQualityStageN"] is not None
        and 1 <= result["leadQualityStageN"] <= len(playbook["leadQualityStages"])
    ):
        lead_quality_stage_id = playbook["leadQualityStages"][result["leadQualityStageN"] - 1]["id"]
    intake_answers: dict[str, str] = {}
    for a in result["intakeAnswers"]:
        if 1 <= a["n"] <= len(playbook["intakeQuestions"]) and a["answer"]:
            intake_answers[playbook["intakeQuestions"][a["n"] - 1]["id"]] = a["answer"]

    admin.table("amocrm_calls").update(
        {
            "transcript": transcript,
            "ai_summary": result["summary"],
            "next_step": result["nextStep"],
            "score": score,
            "mood": result["mood"],
            "talk_ratio": result["talkRatio"],
            "analysis": analysis,
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
            "service_line_id": service_line_id,
            "intake_answers": intake_answers,
        }
    ).eq("id", call["id"]).execute()

    if call.get("lead_id") and (score is not None or lead_quality_stage_id):
        update: dict[str, Any] = {}
        if score is not None:
            update["score"] = score
            update["temperature"] = _temperature_from_score(score)
        if lead_quality_stage_id:
            update["lead_quality_stage_id"] = lead_quality_stage_id
        admin.table("leads").update(update).eq("id", call["lead_id"]).execute()

    # Hand the AI-suggested next step to the responsible manager as a
    # reminder inside AmoCRM, and log the AI's own summary as a note --
    # only as a backstop for whatever the rep didn't already do themselves.
    # Best-effort throughout; skipped for manually uploaded calls.
    task_warning: str | None = None
    leads_embed = call.get("leads") or {}
    lead_amo_id = leads_embed.get("amocrm_id")
    call_started_at = (
        datetime.fromisoformat(call["occurred_at"].replace("Z", "+00:00")) if call.get("occurred_at") else None
    )

    if result["nextStep"] and call.get("source") == "amocrm" and lead_amo_id and not call.get("amocrm_task_id"):
        try:
            rep_already_created_task = False
            if call.get("lead_id") and call_started_at:
                existing_task = (
                    admin.table("tasks")
                    .select("id")
                    .eq("lead_id", call["lead_id"])
                    .gte("created_at", call_started_at.isoformat())
                    .limit(1)
                    .maybe_single()
                    .execute()
                    .data
                )
                rep_already_created_task = bool(existing_task)
            if not rep_already_created_task:
                responsible_amo_user_id = None
                if leads_embed.get("owner_id"):
                    owner = (
                        admin.table("profiles")
                        .select("amocrm_user_id")
                        .eq("id", leads_embed["owner_id"])
                        .maybe_single()
                        .execute()
                        .data
                    )
                    responsible_amo_user_id = (owner or {}).get("amocrm_user_id")
                complete_till = int(datetime.now(timezone.utc).timestamp()) + 24 * 60 * 60
                task_id = await create_amo_task(
                    organization_id, lead_amo_id, result["nextStep"], complete_till, responsible_amo_user_id
                )
                if task_id:
                    admin.table("amocrm_calls").update(
                        {"amocrm_task_id": task_id, "task_created_at": datetime.now(timezone.utc).isoformat()}
                    ).eq("id", call["id"]).execute()
        except Exception as task_err:
            task_warning = str(task_err) or "AmoCRM'da vazifa yaratib bo'lmadi."

    if lead_amo_id and call.get("source") == "amocrm" and call_started_at:
        try:
            since_unix = int(call_started_at.timestamp())
            rep_already_wrote_note = await has_human_note_since(organization_id, lead_amo_id, since_unix)
            if not rep_already_wrote_note:
                note_lines = [f"🤖 AI xulosa: {result['summary']}"]
                if result["nextStep"]:
                    note_lines.append(f"Kelishuv/keyingi qadam: {result['nextStep']}")
                note_id = await create_amo_note(organization_id, lead_amo_id, "\n".join(note_lines))
                if note_id:
                    admin.table("amocrm_calls").update(
                        {"ai_note_id": note_id, "ai_note_created_at": datetime.now(timezone.utc).isoformat()}
                    ).eq("id", call["id"]).execute()
        except Exception:
            pass

    return {
        "transcript": transcript,
        "summary": result["summary"],
        "nextStep": result["nextStep"],
        "score": score,
        "mood": result["mood"],
        "talkRatio": result["talkRatio"],
        "analysis": analysis,
        "taskWarning": task_warning,
    }
