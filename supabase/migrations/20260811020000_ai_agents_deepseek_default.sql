-- The platform's only wired-up LLM provider is DeepSeek (see
-- ai-assistant.chat.ts, which already requires DEEPSEEK_API_KEY) — the
-- ai_agents table was seeded with Anthropic defaults before that was
-- checked. Line the defaults up with what actually runs.
alter table public.ai_agents alter column provider set default 'deepseek';
alter table public.ai_agents alter column model set default 'deepseek-chat';

update public.ai_agents
set provider = 'deepseek', model = 'deepseek-chat'
where provider = 'anthropic';
