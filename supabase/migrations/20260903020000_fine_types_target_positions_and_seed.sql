-- Which job title(s) (profiles.position, e.g. "Pro Sales", "Closer") a fine
-- type applies to -- lets the compute job and the Jarimalar matrix scope a
-- rule to the right roster instead of everyone. Null/empty means "everyone".
alter table public.fine_types add column if not exists target_positions text[];

-- Seeds the real "CRM bilan ishlash bo'yicha jarimalar reglamenti" for the
-- two organizations it applies to. Matched by name (same ilike pattern as
-- the earlier org-structure seed), idempotent per org: skipped entirely if
-- that org already has any fine types (so re-running this after the admin
-- has edited/added their own doesn't stomp on their changes).
do $$
declare
  org record;
  rule record;
  rules jsonb := $jsonrules$[
    {"name": "Ishlanmagan yangi lid", "description": "Kunlik yangi lid etapida ishlanmay qolib ketgan har bir yangi lid uchun jarima.", "amount": 5000, "targets": ["Pro Sales"]},
    {"name": "Bajarilmagan zadacha", "description": "Kunlik CRM dagi bajarilmay qolib ketgan har bir zadacha uchun jarima.", "amount": 3000, "targets": ["Pro Sales"]},
    {"name": "Noto'g'ri LOST", "description": "Lid LOST etapiga sababsiz yoki noto'g'ri sabab bilan o'tkazilgan har bir holat uchun jarima.", "amount": 7000, "targets": ["Pro Sales"]},
    {"name": "Javobsiz kiruvchi aloqa", "description": "Ish vaqtida javobsiz qolgan (ko'tarilmagan) har bir kiruvchi aloqa uchun jarima.", "amount": 5000, "targets": ["Pro Sales"]},
    {"name": "Sotuvdan keyin o'tkazilmagan lid", "description": "Sotuv bo'lgandan keyin lidni Closer CRM ning sotuv etapiga o'tkazmay ushlab tursa, har bir qolib ketgan lid uchun jarima.", "amount": 15000, "targets": ["Closer"]},
    {"name": "So'rovsiz lid olish", "description": "So'rovsiz, hal qilinmagan holda, sotuv bo'lgan lidni o'zlashtirib olish uchun jarima.", "amount": 10000, "targets": ["Closer"]},
    {"name": "Noto'g'ri lid holati", "description": "Har bir etapda lidlar harakati (statusi) to'g'ri kelmasa, har bir lid uchun jarima.", "amount": 2500, "targets": ["Pro Sales", "Closer"]},
    {"name": "CRM ga kiritilmagan tashrif", "description": "Tashrifga kelgan har bir lidni CRM ga kiritmaganlik uchun jarima.", "amount": 10000, "targets": ["Closer"]}
  ]$jsonrules$::jsonb;
  idx integer;
begin
  for org in
    select id from public.organizations
    where name ilike '%Mir Sun%' or name ilike '%Citrus%' or name ilike '%Davo%'
  loop
    if not exists (select 1 from public.fine_types where organization_id = org.id) then
      idx := 0;
      for rule in select * from jsonb_array_elements(rules)
      loop
        insert into public.fine_types
          (organization_id, name, description, default_amount, target_positions, position)
        values (
          org.id,
          rule.value->>'name',
          rule.value->>'description',
          (rule.value->>'amount')::numeric,
          (select array_agg(x) from jsonb_array_elements_text(rule.value->'targets') x),
          idx
        );
        idx := idx + 1;
      end loop;
    end if;
  end loop;
end $$;
