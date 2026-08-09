-- Per-manager KPI rate: the % of the revenue they personally close that
-- they earn monthly. Used by the real (non-simulated) Leaderboard rebuild.
alter table public.profiles
  add column if not exists kpi_percent numeric not null default 5;
