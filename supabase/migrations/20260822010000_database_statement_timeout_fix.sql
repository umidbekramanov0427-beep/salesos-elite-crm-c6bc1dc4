-- The previous fix (alter role service_role set statement_timeout) had no
-- effect -- confirmed by the exact same "[pipeline stages] canceling
-- statement due to statement timeout" error recurring after it was applied.
-- Root cause: PostgREST (which supabaseAdmin talks to) authenticates its
-- pooled connections as the `authenticator` role and then does `SET ROLE
-- service_role` per request -- and `SET ROLE` does NOT re-apply a target
-- role's `ALTER ROLE ... SET` defaults (those only apply at actual session
-- login, which `SET ROLE` is not). Setting it on `authenticator` (the role
-- that actually logs in) and on the database itself (which applies to every
-- session regardless of role-switching) covers this correctly either way.
alter role authenticator set statement_timeout = '120s';
alter database postgres set statement_timeout = '120s';
