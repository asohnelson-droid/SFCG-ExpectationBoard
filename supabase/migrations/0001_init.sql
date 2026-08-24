-- ExpectationBoard — initial schema, ported from the Firestore data model.
-- Run this once against a fresh Supabase project (SQL Editor, or `supabase db push`).

create extension if not exists "pgcrypto";

-- ============================================================
-- users
-- Mirrors the Firestore `users` collection. One row per person who has
-- ever signed in (facilitators via Google, participants via anonymous auth).
-- ============================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  photo_url text,
  role text not null default 'facilitator' check (role in ('facilitator', 'admin')),
  last_login timestamptz,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users_select_self_or_admin" on public.users
  for select using (id = auth.uid() or exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
  ));

create policy "users_upsert_self" on public.users
  for insert with check (id = auth.uid());

create policy "users_update_self_or_admin" on public.users
  for update using (id = auth.uid() or exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
  ));

-- Bootstrap: after you sign in once, promote yourself in the SQL Editor:
--   update public.users set role = 'admin' where email = 'you@example.com';

-- ============================================================
-- events
-- ============================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  event_code text not null check (char_length(event_code) = 6),
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create index events_created_by_idx on public.events (created_by, created_at desc);
create index events_event_code_idx on public.events (event_code);

alter table public.events enable row level security;

create policy "events_select_public" on public.events for select using (true);

create policy "events_insert_own" on public.events
  for insert with check (created_by = auth.uid());

create policy "events_update_own" on public.events
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "events_delete_own" on public.events
  for delete using (created_by = auth.uid());

-- ============================================================
-- submissions (expectations)
-- ============================================================
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  expectation text not null check (char_length(expectation) between 1 and 500),
  category text check (category is null or char_length(category) <= 50),
  participant_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index submissions_event_id_idx on public.submissions (event_id, created_at desc);

alter table public.submissions enable row level security;

create policy "submissions_select_public" on public.submissions for select using (true);

create policy "submissions_insert_authenticated" on public.submissions
  for insert with check (
    auth.uid() is not null and (participant_id is null or participant_id = auth.uid())
  );

create policy "submissions_delete_own_or_admin" on public.submissions
  for delete using (
    participant_id = auth.uid() or exists (
      select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- ============================================================
-- tests
-- ============================================================
create table public.tests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  type text not null check (type in ('pre_test', 'post_test')),
  title text not null check (char_length(title) between 1 and 200),
  instructions text,
  status text not null default 'draft' check (status in ('draft', 'live', 'closed')),
  scoring_mode text not null default 'auto' check (scoring_mode in ('auto', 'ai', 'hybrid')),
  pass_mark numeric default 0,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tests_event_id_idx on public.tests (event_id, created_at desc);

alter table public.tests enable row level security;

-- Tightened vs. the original Firestore rule (which read `true` despite its
-- "publicly readable if live" comment): drafts/closed tests are owner/admin only.
create policy "tests_select_live_or_owner" on public.tests
  for select using (
    status = 'live'
    or created_by = auth.uid()
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "tests_insert_own" on public.tests
  for insert with check (created_by = auth.uid());

create policy "tests_update_own_or_admin" on public.tests
  for update using (
    created_by = auth.uid()
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "tests_delete_own_or_admin" on public.tests
  for delete using (
    created_by = auth.uid()
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- ============================================================
-- test_questions
-- Contains correct_answer / acceptable_answers / rubric — never exposed
-- directly to participants. See `test_questions_public` view below.
-- ============================================================
create table public.test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  type text not null check (type in ('multiple_choice', 'multiple_select', 'short_answer', 'paragraph', 'true_false')),
  text text not null check (char_length(text) > 0),
  help_text text,
  is_required boolean not null default true,
  weight numeric not null default 1 check (weight >= 0),
  order_index integer not null default 0,
  options text[],
  correct_answer jsonb,
  acceptable_answers text[],
  rubric text
);

create index test_questions_test_id_idx on public.test_questions (test_id, order_index);

alter table public.test_questions enable row level security;

create policy "test_questions_select_owner_or_admin" on public.test_questions
  for select using (
    exists (
      select 1 from public.tests t
      where t.id = test_questions.test_id
        and (t.created_by = auth.uid() or exists (
          select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        ))
    )
  );

create policy "test_questions_insert_owner" on public.test_questions
  for insert with check (
    exists (select 1 from public.tests t where t.id = test_questions.test_id and t.created_by = auth.uid())
  );

create policy "test_questions_update_owner" on public.test_questions
  for update using (
    exists (select 1 from public.tests t where t.id = test_questions.test_id and t.created_by = auth.uid())
  );

create policy "test_questions_delete_owner" on public.test_questions
  for delete using (
    exists (select 1 from public.tests t where t.id = test_questions.test_id and t.created_by = auth.uid())
  );

-- Safe, participant-facing subset of test_questions (no answer key).
-- Views run with the OWNER's privileges by default (security_invoker = false,
-- the Postgres default), so this can read past the RLS policy above as long
-- as it's owned by a privileged role and only SELECTs safe columns. This is
-- what actually closes the "answer key visible in devtools" gap flagged in
-- the original DEPLOYMENT.md.
create view public.test_questions_public
  with (security_invoker = false) as
  select tq.id, tq.test_id, tq.type, tq.text, tq.help_text, tq.is_required,
         tq.weight, tq.order_index, tq.options
  from public.test_questions tq
  join public.tests t on t.id = tq.test_id
  where t.status = 'live';

grant select on public.test_questions_public to anon, authenticated;

-- ============================================================
-- test_submissions
-- access_token is the participant's Supabase auth uid (anonymous or
-- signed-in). Unlike the original Firestore rules, we require it to match
-- auth.uid() exactly — the original's "no-auth" branch trusted an
-- unauthenticated client-supplied token, which we don't replicate.
-- ============================================================
create table public.test_submissions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  participant_name text not null check (char_length(participant_name) > 0),
  organization text,
  role text,
  access_token uuid not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status text not null default 'started' check (status in ('started', 'submitted')),
  total_score numeric,
  ai_score_status text check (ai_score_status in ('pending', 'completed', 'failed')),
  requires_manual_review boolean default false
);

create index test_submissions_test_id_idx on public.test_submissions (test_id, submitted_at desc);
create index test_submissions_test_status_idx on public.test_submissions (test_id, status, submitted_at);

alter table public.test_submissions enable row level security;

create policy "test_submissions_select_owner_admin_or_self" on public.test_submissions
  for select using (
    access_token = auth.uid()
    or exists (
      select 1 from public.tests t
      where t.id = test_submissions.test_id
        and (t.created_by = auth.uid() or exists (
          select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        ))
    )
  );

-- Normal submissions are written by the score-test Edge Function with the
-- service role (which bypasses RLS). This policy exists as a fallback for
-- direct client writes and enforces the token can't be spoofed.
create policy "test_submissions_insert_self" on public.test_submissions
  for insert with check (access_token = auth.uid());

create policy "test_submissions_update_owner_or_admin" on public.test_submissions
  for update using (
    exists (
      select 1 from public.tests t
      where t.id = test_submissions.test_id
        and (t.created_by = auth.uid() or exists (
          select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        ))
    )
  );

create policy "test_submissions_delete_admin" on public.test_submissions
  for delete using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- ============================================================
-- test_submission_answers
-- Written exclusively by the score-test Edge Function (service role).
-- Facilitators/admins can update scores during manual review.
-- ============================================================
create table public.test_submission_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.test_submissions(id) on delete cascade,
  question_id uuid not null references public.test_questions(id) on delete cascade,
  answer_text text,
  selected_options text[],
  awarded_score numeric,
  ai_feedback text,
  confidence_score numeric,
  final_reviewed_score numeric,
  final_review_status text check (final_review_status in ('pending', 'approved'))
);

create index test_submission_answers_submission_id_idx on public.test_submission_answers (submission_id);

alter table public.test_submission_answers enable row level security;

create policy "test_submission_answers_select_owner_admin_or_self" on public.test_submission_answers
  for select using (
    exists (
      select 1 from public.test_submissions s
      where s.id = test_submission_answers.submission_id and s.access_token = auth.uid()
    )
    or exists (
      select 1 from public.test_submissions s
      join public.tests t on t.id = s.test_id
      where s.id = test_submission_answers.submission_id
        and (t.created_by = auth.uid() or exists (
          select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        ))
    )
  );

create policy "test_submission_answers_update_owner_or_admin" on public.test_submission_answers
  for update using (
    exists (
      select 1 from public.test_submissions s
      join public.tests t on t.id = s.test_id
      where s.id = test_submission_answers.submission_id
        and (t.created_by = auth.uid() or exists (
          select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        ))
    )
  );

create policy "test_submission_answers_delete_admin" on public.test_submission_answers
  for delete using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- ============================================================
-- Realtime — matches the collections the app used onSnapshot() on.
-- ============================================================
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.tests;
