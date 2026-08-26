-- super@admin.com (Umidbek Ramanov, role=super_admin) is the platform
-- owner's own personal/test login, not a real employee of any customer
-- organization. It ended up under the "SalesOS Elite" org (which is also
-- Fulfil's real, live organization) purely as a side effect of the earlier
-- org-merge fix, which made it show up in Fulfil's employee list. Detach it
-- from every organization per explicit instruction: keep the account (do
-- not delete it), but never attach it to a customer org again.
update public.profiles
set organization_id = null
where id = 'e340014e-37a5-44bd-8512-899d1cdf3169'; -- super@admin.com
