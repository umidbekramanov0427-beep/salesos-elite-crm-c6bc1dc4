-- Replace the placeholder "Baholash mezoni" starter content (previous
-- migration) with the real content the admin already configured on the
-- reference platform, transcribed exactly from their screenshots. Deletes
-- by matching the old placeholder names specifically (all differ from the
-- real names below), so this is safe whether or not the previous seed ever
-- actually ran, and never touches anything the admin has since edited by
-- hand under a different name.

-- Two schema additions the real content needs that the previous config
-- migration didn't anticipate:
alter table public.call_categories add column if not exists description text not null default '';
alter table public.pipeline_stages add column if not exists counts_as_won_override boolean not null default false;
alter table public.pipeline_stages add column if not exists counts_as_lost_override boolean not null default false;

-- --- Clean up the old placeholder rows (idempotent: matches nothing once
-- --- already cleaned up, or if the placeholder seed never ran). ---
delete from public.call_stage_steps where stage_id in (
  select id from public.call_stages where name in (
    'Salomlashish va tanishuv', 'Ehtiyojni aniqlash', 'Taklif taqdimoti',
    'E''tirozlar bilan ishlash', 'Bitim yakunlash', 'Nutq va muloqot sifati'
  )
);
delete from public.call_stages where name in (
  'Salomlashish va tanishuv', 'Ehtiyojni aniqlash', 'Taklif taqdimoti',
  'E''tirozlar bilan ishlash', 'Bitim yakunlash', 'Nutq va muloqot sifati'
);
delete from public.call_categories where name in (
  'Sotuv qo''ng''irog''i', 'Qo''llab-quvvatlash', 'Ichki qo''ng''iroq', 'Spam / noto''g''ri raqam'
);
delete from public.service_lines where name in ('Asosiy mahsulot/xizmat', 'Premium paket');
delete from public.intake_questions where label in (
  'Qaysi mahsulot/xizmat haqida qiziqasiz?', 'Byudjetingiz taxminan qancha?',
  'Qachongacha qaror qabul qilishni rejalashtiryapsiz?', 'Bizni qayerdan bilib oldingiz?'
);
delete from public.lead_quality_stages where title in ('Qizigan lid', 'O''ylab ko''rmoqchi', 'Sovuq lid');

-- --- Real content, per organization, guarded so re-running never          ---
-- --- duplicates and never overwrites anything the admin has since added. ---

-- Tab 1: Baholash mezonlari -- 6 weighted stages (12/23/18/12/20/15 = 100%).
-- "Muloqot sifati" only has 2 of its 3 criteria transcribed (the reference
-- screenshot cut off before the 3rd) -- left at 2 rather than inventing one.
with new_stages as (
  insert into public.call_stages (organization_id, name, position, weight_percent)
  select o.id, s.name, s.position, s.weight_percent
  from public.organizations o
  cross join (
    values
      ('Salomlashish', 0, 12),
      ('Ehtiyojlar', 1, 23),
      ('Qiymat', 2, 18),
      ('E''tirozlar', 3, 12),
      ('Yakunlash', 4, 20),
      ('Muloqot sifati', 5, 15)
  ) as s(name, position, weight_percent)
  where not exists (select 1 from public.call_stages cs where cs.organization_id = o.id)
  returning id, organization_id, name
)
insert into public.call_stage_steps (
  organization_id, stage_id, code, name, position, points,
  level_0_desc, level_1_desc, level_2_desc, level_3_desc
)
select ns.organization_id, ns.id, st.code, st.name, st.position, 5,
  st.level0, st.level1, st.level2, st.level3
from new_stages ns
join (
  values
    ('Salomlashish', 'A1', 'Kompaniya va menejer tanishtiruvi', 0,
      'Menejer o''zini ham, kompaniyani ham tanishtirmadi.',
      'Faqat ismini yoki faqat kompaniyani aytdi.',
      'O''zini va kompaniyasini aniq tanishtirdi.',
      'O''zini, kompaniyasini va suhbatdagi rolini ishonchli tarzda tanishtirdi.'),
    ('Salomlashish', 'A2', 'Murojaat sababi aytildi', 1,
      'Nima sababdan aloqaga chiqqani aytilmadi.',
      'Sabab juda umumiy yoki noaniq aytildi.',
      'Qo''ng''iroq sababi yoki mijoz so''rovi aniq aytildi.',
      'Sabab mijozning oldingi qiziqishi yoki holati bilan bog''lab, aniq kontekst bilan tushuntirildi.'),
    ('Salomlashish', 'A3', 'Suhbatga qulaylik tekshirildi', 2,
      'Mijozning gaplashishga qulayligi so''ralmadi.',
      'So''raldi, lekin javobi hisobga olinmadi.',
      'Hozir gaplashishga qulayligi aniq so''raldi.',
      'Qulay vaqt tekshirilib, noqulay bo''lsa keyingi aloqa vaqti ham kelishib olindi.'),
    ('Ehtiyojlar', 'B1', 'Mijoz vaziyati ochildi', 0,
      'Mijozning hozirgi holati yoki muammosi so''ralmadi.',
      'Yuzaki bitta savol berildi.',
      'Jarayon, muammo yoki maqsadni aniqlash uchun yetarli savollar berildi.',
      'Vaziyat chuqur ochilib, muammo sababi va oqibati ham aniq tushunildi.'),
    ('Ehtiyojlar', 'B2', 'Qaysi yo''nalish kerakligi aniqlandi', 1,
      'Mijozga qaysi xizmat yoki yechim kerakligi aniqlanmadi.',
      'Yo''nalish taxmin qilindi, lekin aniqlashtirilmadi.',
      'Kerak bo''lgan xizmat yoki yechim aniq ajratildi.',
      'Bir nechta variant orasidan eng mos yo''nalish mijoz ehtiyojiga qarab aniqlab olindi.'),
    ('Ehtiyojlar', 'B3', 'Qaror va resurs holati aniqlashtirildi', 2,
      'Qaror beruvchi yoki resurs holati so''ralmadi.',
      'Faqat bitta kontekst savoli berildi.',
      'Qaror beruvchi, jamoa yoki joriy tizim bo''yicha asosiy kontekst aniqlandi.',
      'Qaror jarayoni, jamoa imkoniyati va mavjud resurslar to''liq tushunib olindi.'),
    ('Qiymat', 'C1', 'Taklif ehtiyojga bog''landi', 0,
      'Taklif mijoz ehtiyojiga bog''lanmadi.',
      'Umumiy foydalar aytildi, lekin muammoga ulanmagan.',
      'Taklif mijoz aytgan ehtiyoj yoki muammoga bog''lab tushuntirildi.',
      'Taklifning aynan qaysi qismi qaysi muammoni hal qilishi aniq ko''rsatildi.'),
    ('Qiymat', 'C2', 'Aniq foyda ko''rsatildi', 1,
      'Hech qanday aniq foyda aytilmadi.',
      'Faqat umumiy va''dalar berildi.',
      'Xizmat yoki yechim qanday natija berishi biznes tili bilan tushuntirildi.',
      'Foyda o''lchab bo''ladigan natija yoki amaliy ta''sir bilan ishonchli ko''rsatildi.'),
    ('Qiymat', 'C3', 'Mos format tavsiya qilindi', 2,
      'Keyingi mos format tavsiya qilinmadi.',
      'Demo, audit yoki taklif varianti aytildi, lekin mosligi tushuntirilmadi.',
      'Mijoz holatiga mos format tavsiya qilindi.',
      'Bir nechta variant orasidan eng mos format sabab bilan tanlab berildi.'),
    ('E''tirozlar', 'D1', 'E''tiroz sababi ochildi', 0,
      'E''tiroz sababi so''ralmadi.',
      'E''tiroz yuzaki qabul qilindi.',
      'E''tiroz ortidagi haqiqiy sabab aniqlashtirildi.',
      'Sabab chuqur ochilib, qaror yoki xavotir manbasi aniq tushunildi.'),
    ('E''tirozlar', 'D2', 'Dalil bilan javob berildi', 1,
      'E''tirozga javob berilmadi.',
      'Faqat umumiy gap bilan javob berildi.',
      'E''tirozga aniq dalil, izoh yoki misol bilan javob berildi.',
      'Dalil mijoz holatiga moslab, e''tirozni susaytiradigan tarzda tushuntirildi.'),
    ('E''tirozlar', 'D3', 'Ishonch va risklarni boshqarish', 2,
      'Ishonch, xavotir yoki risk savollari javobsiz qoldi.',
      'Yuzaki tinchlantirish bilan cheklanildi.',
      'Risk va xavotirlarga aniq, rasmiy va ishonchli javob berildi.',
      'Risk sababi ochilib, uni kamaytirish yo''li va keyingi ishonch beruvchi dalillar aniq tushuntirildi.'),
    ('Yakunlash', 'E1', 'Keyingi qadam kelishildi', 0,
      'Keyingi qadam umuman kelishilmadi.',
      'Umumiy davom varianti aytildi, lekin aniq emas edi.',
      'Qo''ng''iroq oxirida keyingi aniq qadam kelishib olindi.',
      'Keyingi qadam, javobgarlik va natija aniq kelishib, mijoz tasdig''i olindi.'),
    ('Yakunlash', 'E2', 'Vaqt va format belgilandi', 1,
      'Keyingi aloqa vaqti yoki formati belgilanmadi.',
      'Faqat taxminiy vaqt aytildi.',
      'Keyingi aloqa vaqti, formati yoki javob muddati aniq belgilandi.',
      'Vaqt, format va aloqa egasi qat''iy kelishib olindi.'),
    ('Yakunlash', 'E3', 'Kelishuv yakunlab qaytarildi', 2,
      'Suhbat xulosasiz tugadi.',
      'Faqat qisqa xayrlashuv bo''ldi.',
      'Kelishilgan narsalar qisqacha qayta aytildi yoki tasdiqlandi.',
      'Yakunda barcha kelishuvlar tizimli qaytarilib, mijozdan aniq tasdiq olindi.'),
    ('Muloqot sifati', 'F1', 'Professional ohang', 0,
      'Ohang qo''pol, beparvo yoki noo''rin edi.',
      'Ohang juda sust yoki ishonchsiz edi.',
      'Suhbat professional, hurmatli va tartibli ohangda olib borildi.',
      'Professional ohang butun suhbat davomida ishonchli va ishchan tarzda saqlandi.'),
    ('Muloqot sifati', 'F2', 'Faol tinglash', 1,
      'Mijozning gapi tinglanmadi yoki bo''lindi.',
      'Tinglandi, lekin reaksiyalar sust bo''ldi.',
      'Mijozning gaplari tinglanib, javoblar mantiqan davom ettirildi.',
      'Menejer mijoz fikrlariga moslashib, faol tinglash orqali suhbatni samarali boshqardi.')
) as st(stage_name, code, name, position, level0, level1, level2, level3)
  on st.stage_name = ns.name;

-- Tab 3: Xizmat yo'nalishlari.
insert into public.service_lines (organization_id, name, description, aliases, sample_phrases, position)
select o.id, s.name, s.description, s.aliases, s.sample_phrases, s.position
from public.organizations o
cross join (
  values
    (
      'Rus tili kursi',
      'Zarina Ismayilovna metodikasi bo''yicha onlayn rus tili o''rgatish darslari.',
      array['rus', 'kursi', 'rus tili', 'til o''rganish', 'tili', 'Zarina Ismayilovna', 'rus_tili_kursi'],
      array['Rus tili kursi', 'Zarina Ismayilovnaning rus tili kurslari', 'rus tilini o''rganish bo''yicha aloqaga chiqayotgandim'],
      0
    ),
    (
      'IT kursi',
      'Zamonaviy IT mutaxassisliklari va kompyuter savodxonligi bo''yicha onlayn ta''lim.',
      array['kompyuter kursi', 'dasturlash', 'IT sohasida o''qish', 'kursi', 'it_kursi'],
      array['IT kursi', 'ITda o''qiysiz', 'kompyuter sohasi bo''yicha o''rganmoqchi edim'],
      1
    )
) as s(name, description, aliases, sample_phrases, position)
where not exists (select 1 from public.service_lines sl where sl.organization_id = o.id);

-- Tab 2: Anketa savollari (Asosiy + a per-service-line question).
insert into public.intake_questions (organization_id, service_line_id, label, position)
select o.id, null, 'Lid necha yoshda ekan?', 0
from public.organizations o
where not exists (select 1 from public.intake_questions iq where iq.organization_id = o.id);

insert into public.intake_questions (organization_id, service_line_id, label, position)
select sl.organization_id, sl.id, 'Lid rus tilini qanday darajada biladi?', 0
from public.service_lines sl
where sl.name = 'Rus tili kursi'
  and not exists (
    select 1 from public.intake_questions iq
    where iq.organization_id = sl.organization_id and iq.service_line_id = sl.id
  );

-- Tab 4: Qo'ng'iroq oilalari -- 5 scored + 2 excluded, matching the exact
-- classification, workflow/domain labels and lock state from the reference.
insert into public.call_categories (
  organization_id, name, description, position, scored, system_family,
  workflow_family, conversation_domain, temporary, exclusion_reason
)
select o.id, c.name, c.description, c.position, c.scored, c.system_family,
  c.workflow_family, c.conversation_domain, c.temporary, c.exclusion_reason
from public.organizations o
cross join (
  values
    ('Yechim taqdimoti', 'O''quv dasturi, dars o''tish uslubi va kutilayotgan natijalarni tushuntirish.',
      0, true, true, 'Taklif va yechim taqdimoti', 'Sotuv', false, null),
    ('Qayta faollashtirish', 'Avval qiziqish bildirgan lekin to''xtab qolgan o''quvchilarni qayta jalb qilish.',
      1, true, true, 'Qayta faollashtirish', 'Sotuv', false, null),
    ('Lidni aniqlashtirish', 'Mijozning til o''rganish maqsadi, darajasi va kursga mosligini aniqlash.',
      2, true, true, 'Lidni aniqlashtirish', 'Sotuv', true, null),
    ('Mijoz bo''yicha qayta aloqa', 'Telegramga yuborilgan ma''lumotlardan so''ng qarorni aniqlash uchun qayta bog''lanish.',
      3, true, true, 'Qayta aloqa', 'Sotuv', true, null),
    ('Yopish / muzokara', 'Narx bo''yicha kelishish, ''qimmat'' yoki ''ishonchsizlik'' kabi e''tirozlar bilan ishlash.',
      4, true, true, 'Yopish va muzokara', 'Sotuv', true, null),
    ('Ulanmagan aloqa', 'Go''shak ko''tarilmagan, band yoki xizmat doirasidan tashqaridagi qo''ng''iroqlar.',
      5, false, true, 'Bog''lanilmagan aloqa', null, false, 'Bog''lanib bo''lmadi'),
    ('To''lov bo''yicha aloqa', 'Birlamchi to''lov (predoplata), to''liq to''lov bilan kelishuv',
      6, false, false, 'Moliya va hujjatlar', 'Sotuvdan keyingi jarayon', true, 'Sotuv Jarayoni Bo''Lmaydi')
) as c(name, description, position, scored, system_family, workflow_family, conversation_domain, temporary, exclusion_reason)
where not exists (select 1 from public.call_categories cc where cc.organization_id = o.id);

-- Tab 5: Lid sifati bosqichlari -- 5 ranked stages before the mandatory
-- locked "Yaroqsiz lid" catch-all (already seeded by the schema migration).
insert into public.lead_quality_stages (organization_id, position, title, conditions, qualified, system_locked)
select o.id, q.position, q.title, q.conditions, q.qualified, false
from public.organizations o
cross join (
  values
    (0, 'To''lov qilingan, chek yuborilgan, darsga kirishga tayyor', array[
      'To''lov amalga oshirilganligi haqida ma''lumot berildi',
      'To''lov cheki botga yoki menejerga yuborildi',
      'Bonuslar va asosiy dars kanallariga kirish huquqi berilmoqda'
    ], true),
    (1, 'Motivatsiya yuqori, to''lov kuni aniq belgilangan', array[
      'Bepul dars ko''rilganligi tasdiqlandi',
      'To''lov miqdori va muddati (masalan, 5-sana yoki 10-sana) kelishildi',
      'Mijoz darslar boshlanish sanasidan xabardor va qo''shilishga tayyor'
    ], true),
    (2, 'Ehtiyoj aniq, oila a''zolari bilan maslahatlashadi', array[
      'Nega o''rganmoqchiligi va motivatsiyasi aniqlandi',
      'Turmush o''rtog''i yoki ota-onasi bilan maslahatlashishini aytdi',
      'Qaror qabul qiluvchi shaxsning roziligi kutilmoqda'
    ], true),
    (3, 'O''rganish istagi bor, vaqt yoki mablag'' yetishmaydi', array[
      'Mijoz kurs haqida ma''lumot oldi',
      'Hozirda puli yo''qligini yoki oylik kutayotganini bildirdi',
      'Vaqti yo''qligi sababli keyingi oylarda o''qishini aytdi'
    ], true),
    (4, 'Aloqa yo''q, noto''g''ri raqam, qiziqish bildirmadi', array[
      'Mijoz qo''ng''iroqqa javob bermadi',
      'Raqam noto''g''ri tushgan',
      'Mijoz kursga qiziqmasligini va boshqa bezovta qilmaslikni so''radi'
    ], false)
) as q(position, title, conditions, qualified)
where not exists (
  select 1 from public.lead_quality_stages lqs
  where lqs.organization_id = o.id and lqs.system_locked = false
);

-- Tab 6 + 7: AI ko'rsatmalari / Lid analitikasi -- real structured content
-- for the former (transcript/anketa/coaching guidance), matching the
-- reference's empty placeholders for the latter (never filled in there).
insert into public.ai_agents (organization_id, kind, call_instructions)
select o.id, 'call', $tpl${
  "aiInstructions": {
    "transcriptTerms": ["rus tili kursi", "it kursi", "amocrm"],
    "transcriptGuidance": "Xizmat yo'nalishlarini aralashtirmang: Rus tili kursi, IT kursi alohida ma'noga ega. Transkriptda qaysi yo'nalish aytilgan bo'lsa, o'shani saqlang; boshqa yo'nalishga umumlashtirmang.",
    "companyContext": "Rus tili va IT bo'yicha onlayn kurslar sotuvi. Asosiy xizmat yo'nalishlari: Rus tili kursi, IT kursi. Lid manbalari: Telegram kanal.",
    "extractionGuidance": "Suhbat qaysi yo'nalish bilan bog'liqligini ajrating: Rus tili kursi, IT kursi. Transcriptda aytilsa albatta ajrating: Nega o'rganmoqchiligi, Qanchadan beri o'rganmoqchiligi, Nimalar qilib ko'rgani, O'rgansa nimalar o'zgarishi. Team size ma'lumoti transcriptdan doim chiqmaydi; bu maydon bo'yicha taxmin qilmang. CRM savollari uchun faqat transcriptda aniq aytilgan kontekstni to'ldiring; taxmin qilmang.",
    "taskCreationGuidance": "Ixtiyoriy. Masalan: faqat mijoz bilan kelishilgan keyingi qadamlar uchun vazifa yaratsin, qayta qo'ng'iroq uchun esa qo'ng'iroq vazifasini tanlasin. Standart qoidalar uchun bo'sh qoldiring.",
    "violationGuidance": "Bo'lmasligi kerak: 100% natija kafolatini berish, Dars yoqmasa pulingiz qaytariladi deb va'da berish.",
    "coachingGuidance": "Yaxshi suhbat belgilari: Ehtiyojni chuqur aniqlash, E'tirozlarga to'g'ri yechim berish, Sotuvni yopish. Zaif suhbat belgilari: E'tiroziga yechim berolmaslik, Ehtiyojlarni chuqur aniqlamaslik, Mijozga xato javob berish.",
    "scoringFocusGuidance": "Quyidagi yo'nalish/oilalarni savdo bahosidan chiqarish kerak: Muammoli mijozlar bilan ishlash (servis qo'ng'iroqlari). Aralash xizmat biznesi: qo'ng'iroqda tilga olingan yo'nalish bo'yicha baholang; boshqa xizmat tilga olinmagan bo'lsa penalti bermang.",
    "qualifiedLeadGuidance": "Sifatli lid ta'rifi: Bepul darsni ko'rgan va aniq o'rganish motivatsiyasiga ega bo'lgan shaxslar."
  },
  "leadAnalytics": {
    "businessContext": "",
    "lossAnalysisGuidance": "",
    "recommendationGuidance": ""
  }
}$tpl$::jsonb
from public.organizations o
on conflict (organization_id, kind) do update
  set call_instructions = excluded.call_instructions
  where ai_agents.call_instructions = '{}'::jsonb
     or (ai_agents.call_instructions -> 'instructions' ? 'mainGoal');
