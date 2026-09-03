-- A fine type needs a fixed monetary amount for the daily AI computation to
-- charge -- without it the AI would have to invent a number itself, which
-- is not acceptable for a figure that affects pay. Admins set this once per
-- fine type; the AI only ever decides *whether* a type applies, never the
-- amount.
alter table public.fine_types add column if not exists default_amount numeric;
