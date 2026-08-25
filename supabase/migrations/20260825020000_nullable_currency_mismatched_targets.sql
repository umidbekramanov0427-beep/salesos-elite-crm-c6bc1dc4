-- profiles.daily_target/monthly_target defaulted to 3000/63000 -- values
-- sized for the original mock dataset's USD figures. Auto-provisioned
-- AmoCRM reps (see syncUserMapping in client.server.ts) never get a real
-- target set by anyone, so every one of them permanently carries this
-- stale default forward. For an org whose real revenue is denominated in
-- a larger-unit currency (e.g. UZS, ~12000:1 vs USD), dividing real
-- revenue by 63000 produces a nonsensical percentage -- seen in
-- production on the Dashboard's Reyting widget as "7,399,960%" for a rep
-- whose target was still sitting on the untouched default.
--
-- Make both nullable with no default: "no target set yet" is the honest
-- state until an admin sets a real one, and every reader already treats
-- <= 0 (now: null) as "no target" rather than crashing or dividing.
alter table public.profiles
  alter column daily_target drop not null,
  alter column daily_target drop default,
  alter column monthly_target drop not null,
  alter column monthly_target drop default;

-- Reset only rows still sitting on the exact untouched default -- a
-- profile an admin deliberately set to this same number keeps it.
update public.profiles set daily_target = null where daily_target = 3000;
update public.profiles set monthly_target = null where monthly_target = 63000;
