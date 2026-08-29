-- The reference's "Mezon qo'shish" dialog has a short "Tavsif" (what good
-- execution generally looks like) field on every criterion, separate from
-- the 4 graded rubric levels -- missed when the rubric schema was first
-- designed. Backfills the exact text transcribed from the reference for
-- the 14 real criteria already seeded; guarded to never overwrite text an
-- admin has since edited by hand.

alter table public.call_stage_steps add column if not exists description text not null default '';

update public.call_stage_steps css
set description = d.description
from (
  values
    ('Salomlashish', 'A1', 'O''zini va kompaniyasini aniq tanishtirdi.'),
    ('Salomlashish', 'A2', 'Qo''ng''iroq sababi yoki mijoz so''rovi aniq aytildi.'),
    ('Salomlashish', 'A3', 'Hozir gaplashishga qulayligi aniq so''raldi.'),
    ('Ehtiyojlar', 'B1', 'Jarayon, muammo yoki maqsadni aniqlash uchun yetarli savollar berildi.'),
    ('Ehtiyojlar', 'B2', 'Kerak bo''lgan xizmat yoki yechim aniq ajratildi.'),
    ('Ehtiyojlar', 'B3', 'Qaror beruvchi, jamoa yoki joriy tizim bo''yicha asosiy kontekst aniqlandi.'),
    ('Qiymat', 'C1', 'Taklif mijoz aytgan ehtiyoj yoki muammoga bog''lab tushuntirildi.'),
    ('Qiymat', 'C2', 'Xizmat yoki yechim qanday natija berishi biznes tili bilan tushuntirildi.'),
    ('Qiymat', 'C3', 'Mijoz holatiga mos format tavsiya qilindi.'),
    ('E''tirozlar', 'D1', 'E''tiroz ortidagi haqiqiy sabab aniqlashtirildi.'),
    ('E''tirozlar', 'D2', 'E''tirozga aniq dalil, izoh yoki misol bilan javob berildi.'),
    ('E''tirozlar', 'D3', 'Risk va xavotirlarga aniq, rasmiy va ishonchli javob berildi.'),
    ('Yakunlash', 'E1', 'Qo''ng''iroq oxirida keyingi aniq qadam kelishib olindi.'),
    ('Yakunlash', 'E2', 'Keyingi aloqa vaqti, formati yoki javob muddati aniq belgilandi.'),
    ('Yakunlash', 'E3', 'Kelishilgan narsalar qisqacha qayta aytildi yoki tasdiqlandi.'),
    ('Muloqot sifati', 'F1', 'Suhbat professional, hurmatli va tartibli ohangda olib borildi.'),
    ('Muloqot sifati', 'F2', 'Mijozning gaplari tinglanib, javoblar mantiqan davom ettirildi.')
) as d(stage_name, code, description)
join public.call_stages cs on cs.name = d.stage_name
where css.stage_id = cs.id
  and css.code = d.code
  and css.description = '';
