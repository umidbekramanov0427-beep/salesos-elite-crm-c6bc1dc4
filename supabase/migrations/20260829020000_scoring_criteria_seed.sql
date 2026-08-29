-- Starter "Baholash mezoni" content for every existing organization -- a
-- reasonable default Uzbek sales-call scoring template covering all 8 tabs,
-- editable afterward from the /scoring-criteria UI. Guarded so it never
-- overwrites data an org has already configured (each block skips orgs that
-- already have any rows in that table), so it's safe to re-run.

-- Tab 1: Baholash mezonlari -- 6 weighted stages summing to 100%, each with
-- a couple of 0-3 level graded criteria.
with new_stages as (
  insert into public.call_stages (organization_id, name, position, weight_percent)
  select o.id, s.name, s.position, s.weight_percent
  from public.organizations o
  cross join (
    values
      ('Salomlashish va tanishuv', 0, 10),
      ('Ehtiyojni aniqlash', 1, 20),
      ('Taklif taqdimoti', 2, 20),
      ('E''tirozlar bilan ishlash', 3, 15),
      ('Bitim yakunlash', 4, 15),
      ('Nutq va muloqot sifati', 5, 20)
  ) as s(name, position, weight_percent)
  where not exists (select 1 from public.call_stages cs where cs.organization_id = o.id)
  returning id, organization_id, name
)
insert into public.call_stage_steps (
  organization_id, stage_id, code, name, position, points,
  level_0_desc, level_1_desc, level_2_desc, level_3_desc
)
select ns.organization_id, ns.id, st.code, st.name, st.position, st.points,
  st.level0, st.level1, st.level2, st.level3
from new_stages ns
join (
  values
    ('Salomlashish va tanishuv', 'A1', 'Kompaniya nomini va o''z ismini aytish', 0, 5,
      'Tanishtirmadi', 'Faqat ismini aytdi', 'Kompaniya va ismini aytdi',
      'Kompaniya, ism va qo''ng''iroq maqsadini aniq aytdi'),
    ('Salomlashish va tanishuv', 'A2', 'Mijoz ismini so''rab, undan foydalanish', 1, 5,
      'Ismini so''ramadi', 'So''radi, lekin foydalanmadi', 'Bir marta ismidan foydalandi',
      'Suhbat davomida bir necha marta ismidan foydalandi'),
    ('Ehtiyojni aniqlash', 'B1', 'Ochiq savollar berish', 0, 5,
      'Savol bermadi', 'Faqat ha/yo''q savollari berdi', 'Bir nechta ochiq savol berdi',
      'Mijozni gapirishga undovchi ochiq savollar ketma-ketligini berdi'),
    ('Ehtiyojni aniqlash', 'B2', 'Mijoz muammosi/maqsadini aniqlash', 1, 5,
      'Aniqlamadi', 'Yuzaki aniqladi', 'Asosiy ehtiyojni aniqladi',
      'Ehtiyoj va uning sababini chuqur aniqladi'),
    ('Ehtiyojni aniqlash', 'B3', 'Byudjet yoki qaror muddatini bilib olish', 2, 5,
      'So''ramadi', 'Yon-atrofdan taxmin qildi', 'To''g''ridan-to''g''ri so''radi',
      'Byudjet va qaror muddatini aniq bilib oldi'),
    ('Taklif taqdimoti', 'C1', 'Mahsulot/xizmatni mijoz ehtiyojiga moslab taqdim etish', 0, 5,
      'Umumiy taqdimot qildi', 'Qisman moslashtirdi', 'Ehtiyojga mos taqdim etdi',
      'Har bir aytilgan ehtiyojga aniq javob beruvchi taqdimot qildi'),
    ('Taklif taqdimoti', 'C2', 'Aniq foyda va afzalliklarni ko''rsatish', 1, 5,
      'Faqat xususiyatlarni sanadi', 'Ba''zi foydalarni aytdi', 'Asosiy foydalarni tushuntirdi',
      'Har bir xususiyatni mijoz uchun aniq foydaga bog''lab tushuntirdi'),
    ('E''tirozlar bilan ishlash', 'D1', 'E''tirozni tinglash va tan olish', 0, 5,
      'E''tirozni e''tiborsiz qoldirdi', 'Bo''ldi va shoshildi', 'Tingladi, lekin tan olmadi',
      'To''liq tingladi va e''tirozni tan olib javob berdi'),
    ('E''tirozlar bilan ishlash', 'D2', 'Dalil/argument bilan javob berish', 1, 5,
      'Javob bermadi', 'Zaif javob berdi', 'Asosli javob berdi',
      'Dalil, misol yoki raqamlar bilan ishonarli javob berdi'),
    ('Bitim yakunlash', 'E1', 'Keyingi qadamni aniq taklif qilish', 0, 5,
      'Taklif qilmadi', 'Noaniq aytdi', 'Keyingi qadamni aytdi',
      'Keyingi qadamni aniq sana/vaqt bilan taklif qildi'),
    ('Bitim yakunlash', 'E2', 'Aniq kelishuvga erishish', 1, 5,
      'Kelishuvga erishmadi', 'Noaniq rozilik oldi', 'Aniq rozilik oldi',
      'Aniq kelishuv va keyingi aloqa vaqtini tasdiqlatdi'),
    ('Nutq va muloqot sifati', 'F1', 'Ravon va tushunarli nutq', 0, 5,
      'Chalkash va tushunarsiz', 'Ko''p to''xtalishlar bilan', 'Asosan ravon',
      'Ravon, ishonchli va tushunarli gapirdi'),
    ('Nutq va muloqot sifati', 'F2', 'Faol tinglash, mijozni bo''lmaslik', 1, 5,
      'Doim bo''ldi', 'Bir necha marta bo''ldi', 'Kamdan-kam bo''ldi',
      'Mijozni hech qachon bo''lmadi, faol tingladi'),
    ('Nutq va muloqot sifati', 'F3', 'Tushunarli va tartibli nutq', 2, 5,
      'Tartibsiz va sakrab-sakrab gapirdi', 'Qisman tartibli', 'Asosan tartibli',
      'Suhbatni mantiqiy va tartibli olib bordi')
) as st(stage_name, code, name, position, points, level0, level1, level2, level3)
  on st.stage_name = ns.name;

-- Tab 4: Qo'ng'iroq oilalari -- which call types actually feed the weighted
-- rubric above (scored) vs. which are excluded from it.
insert into public.call_categories (
  organization_id, name, position, scored, system_family, workflow_family,
  conversation_domain, temporary, exclusion_reason
)
select o.id, c.name, c.position, c.scored, c.system_family, c.workflow_family,
  c.conversation_domain, c.temporary, c.exclusion_reason
from public.organizations o
cross join (
  values
    ('Sotuv qo''ng''irog''i', 0, true, false, 'sotuv', 'yangi yoki mavjud mijoz bilan sotuv suhbati', false, null),
    ('Qo''llab-quvvatlash', 1, false, false, 'support', 'mavjud mijozga texnik/servis yordami', false, 'Texnik yordam qo''ng''irog''i, sotuv mezoniga kirmaydi'),
    ('Ichki qo''ng''iroq', 2, false, true, null, null, false, 'Xodimlar orasidagi ichki suhbat'),
    ('Spam / noto''g''ri raqam', 3, false, true, null, null, true, 'Mijoz emas yoki xato terilgan raqam')
) as c(name, position, scored, system_family, workflow_family, conversation_domain, temporary, exclusion_reason)
where not exists (select 1 from public.call_categories cc where cc.organization_id = o.id);

-- Tab 3: Xizmat yo'nalishlari -- starter product/service lines.
insert into public.service_lines (organization_id, name, description, position)
select o.id, s.name, s.description, s.position
from public.organizations o
cross join (
  values
    ('Asosiy mahsulot/xizmat', 'Kompaniyaning eng ko''p sotiladigan mahsuloti yoki xizmati.', 0),
    ('Premium paket', 'Kengaytirilgan imkoniyatlar bilan qimmatroq taklif.', 1)
) as s(name, description, position)
where not exists (select 1 from public.service_lines sl where sl.organization_id = o.id);

-- Tab 2: Anketa savollari -- general intake questions (no service line tie).
insert into public.intake_questions (organization_id, label, position)
select o.id, q.label, q.position
from public.organizations o
cross join (
  values
    ('Qaysi mahsulot/xizmat haqida qiziqasiz?', 0),
    ('Byudjetingiz taxminan qancha?', 1),
    ('Qachongacha qaror qabul qilishni rejalashtiryapsiz?', 2),
    ('Bizni qayerdan bilib oldingiz?', 3)
) as q(label, position)
where not exists (select 1 from public.intake_questions iq where iq.organization_id = o.id);

-- Tab 5: Lid sifati bosqichlari -- qualified/unqualified ladder, positioned
-- before the mandatory locked "Yaroqsiz lid" catch-all seeded earlier.
insert into public.lead_quality_stages (organization_id, position, title, conditions, qualified, system_locked)
select o.id, q.position, q.title, q.conditions, q.qualified, false
from public.organizations o
cross join (
  values
    (0, 'Qizigan lid', array['Narx yoki shartlar haqida batafsil so''radi', 'Mahsulot haqida qo''shimcha savollar berdi'], true),
    (1, 'O''ylab ko''rmoqchi', array['Taklifni ko''rib chiqishga vaqt so''radi', 'Boshqalar bilan maslahatlashmoqchi bo''ldi'], true),
    (2, 'Sovuq lid', array['Qiziqish bildirmadi', 'Qo''ng''iroqni tezda tugatishga harakat qildi'], false)
) as q(position, title, conditions, qualified)
where not exists (
  select 1 from public.lead_quality_stages lqs
  where lqs.organization_id = o.id and lqs.system_locked = false
);

-- Tab 6 + 7: AI ko'rsatmalari / Lid analitikasi -- structured prompt fields
-- for the call-analysis agent. Only fills orgs that haven't set any yet.
insert into public.ai_agents (organization_id, kind, call_instructions)
select o.id, 'call', $tpl${
  "instructions": {
    "mainGoal": "Menejer sotuv skriptiga qanchalik amal qilganini, mijoz bilan muloqot sifatini va bitimni yopish ehtimolini xolisona baholash.",
    "keyBehaviors": [
      "Mijozni ismi bilan chaqirish",
      "Faol tinglash va mijozni bo'lmaslik",
      "Aniq va tushunarli gapirish",
      "Keyingi qadamni aniq taklif qilish"
    ],
    "redFlags": [
      "Mijozga asossiz va'da berish",
      "Mijoz bilan bahslashish",
      "Qo'pol yoki beparvo ohang",
      "Narxni yashirish yoki chalg'itish"
    ],
    "extraNotes": "Agar qo'ng'iroq juda qisqa (1 daqiqadan kam) bo'lsa yoki mijoz javob bermagan bo'lsa, buni alohida qayd eting."
  },
  "leadAnalytics": {
    "questions": [
      "Mijoz nima uchun sotib olmadi yoki ikkilanmoqda?",
      "Mijozning asosiy ehtiyoji/muammosi nima?",
      "Mijoz qaysi xizmat/mahsulotga qiziqdi?",
      "Keyingi aloqa uchun eng yaxshi vaqt qachon?"
    ],
    "qualificationHints": [
      "Byudjet va qaror qabul qilish vakolati bor-yo'qligi",
      "Muammoning dolzarbligi (shoshilinchmi)",
      "Raqobatchilar bilan solishtiryaptimi"
    ]
  }
}$tpl$::jsonb
from public.organizations o
on conflict (organization_id, kind) do update
  set call_instructions = excluded.call_instructions
  where ai_agents.call_instructions = '{}'::jsonb;
