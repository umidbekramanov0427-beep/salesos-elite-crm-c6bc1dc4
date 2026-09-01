-- Deleting an interview question from Kadrlar bo'limi settings silently
-- failed whenever any candidate had already answered it, because
-- hr_candidate_answers.question_id referenced hr_questions(id) with no
-- ON DELETE action (defaults to NO ACTION -- Postgres blocks the delete).
-- Since these are org-wide intake questions asked to every candidate,
-- almost every question accumulates answers quickly, so the delete button
-- was effectively broken for anything but a brand-new, unanswered question.
-- Deleting a question now cascades to the historical answers for it too --
-- consistent with removing the question from the record entirely, which is
-- what "delete" is expected to mean here.
alter table public.hr_candidate_answers
  drop constraint if exists hr_candidate_answers_question_id_fkey;

alter table public.hr_candidate_answers
  add constraint hr_candidate_answers_question_id_fkey
  foreign key (question_id) references public.hr_questions(id) on delete cascade;
