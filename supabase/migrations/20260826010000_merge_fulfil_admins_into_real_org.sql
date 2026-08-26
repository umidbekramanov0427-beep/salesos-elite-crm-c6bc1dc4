-- One-time data fix: Suhrob (super_admin) and Ilhomjon (ROP) were created in
-- a separate, empty "Fulfil" organization (b127c93f-1eef-4f45-ba8f-
-- 5cb1750fd754) via the Platform panel, while the actual Fulfil AmoCRM
-- connection and its 20 synced sales managers ended up under the
-- "SalesOS Elite" organization (601b9e11-1892-43e2-99bc-96ef6fcb1862)
-- instead -- confirmed live via diagnostic queries showing 21 profiles + 1
-- amocrm_connection under SalesOS Elite, vs 2 profiles and no connection
-- under the standalone "Fulfil" org.
--
-- Moving the connection and 20 synced profiles would also require moving
-- every leads/deals/contacts/companies/calls/etc row they own. Moving just
-- these 2 admin profiles into the org that already holds the real business
-- data is far smaller in scope and equally correct.
update public.profiles
set organization_id = '601b9e11-1892-43e2-99bc-96ef6fcb1862'
where id in (
  'da4af403-54b3-4bf8-86d2-7e1966562b6f', -- Suhrob Abduaxatov (super_admin)
  '99bce8c3-fa6a-495a-b89c-61ceaccab2f9'  -- Ortiqov Ilhomjon (rop)
);
