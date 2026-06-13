-- Phase 1b: lift the previously-phantom committee/registration columns onto
-- abstracts, and centralise the decision-vocabulary CHECK in a single
-- function so the two CHECKs (audit log + abstracts) can never drift.
--
-- IMPORTANT: when adding/removing a decision verb, change ONLY the
-- is_valid_committee_decision() function below. Both CHECK constraints
-- (abstract_committee_decisions.decision and abstracts.committee_decision)
-- delegate to it. Do not inline the list anywhere else.

-- 1. Single-source vocabulary -------------------------------------------------
create or replace function public.is_valid_committee_decision(d text)
returns boolean
language sql
immutable
as $$
  select d in (
    'accept_oral',
    'accept_poster',
    'accept_video',
    'second_review',
    'reject',
    'revision_requested',
    'under_review'
  )
$$;

comment on function public.is_valid_committee_decision(text) is
  'Source of truth for the committee decision vocabulary. Both '
  'abstracts.committee_decision and abstract_committee_decisions.decision '
  'CHECK against this. Adding a verb here updates both columns atomically.';

-- 2. Repoint the audit-log CHECK at the shared function ----------------------
alter table public.abstract_committee_decisions
  drop constraint abstract_committee_decisions_decision_check;

alter table public.abstract_committee_decisions
  add constraint abstract_committee_decisions_decision_check
    check (public.is_valid_committee_decision(decision));

-- 3. Add the previously-phantom columns on abstracts -------------------------
-- review_round is read with `(abstract.review_round || 1)` in multiple routes;
-- NOT NULL DEFAULT 1 matches that intent so existing rows are valid.
alter table public.abstracts
  add column review_round integer not null default 1;

-- registration_verified: NOT NULL DEFAULT false + backfilled below from the
-- existing semantic signal (registration_id IS NOT NULL means the
-- committee-decision route already linked a confirmed registration).
alter table public.abstracts
  add column registration_verified    boolean     not null default false,
  add column registration_verified_at timestamptz;

-- committee_decision_* mirror the audit-log shape but at the row-state level
-- so reads (committee-queue) don't need a join. CHECK delegates to the
-- shared function. NULL until a decision is made.
alter table public.abstracts
  add column committee_decision    text
    check (committee_decision is null
           or public.is_valid_committee_decision(committee_decision)),
  add column committee_decision_by  uuid references public.team_members(id)
                                   on delete set null,
  add column committee_decision_at  timestamptz;

-- second_review_reason: stored at the row level so the queue can show
-- "second-review pending: <reason>" without a join.
alter table public.abstracts
  add column second_review_reason text;

-- 4. Backfill registration_verified from the existing signal -----------------
-- Narrow + correct: only flip rows where registration_id was previously
-- populated (which is the committee-decision route's own write). Anything
-- not linked stays false; future accepts will set both fields together.
update public.abstracts
   set registration_verified    = true,
       registration_verified_at = coalesce(updated_at, now())
 where registration_id is not null
   and registration_verified = false;
