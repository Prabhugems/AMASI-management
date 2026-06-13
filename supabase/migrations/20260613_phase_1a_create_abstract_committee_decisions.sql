-- Phase 1a: append-only audit log for committee decisions on abstracts.
-- See build brief Phase 1a. Past-tense column names so we never have to
-- rename after rows land. CHECK widened beyond the 5 committee verbs to
-- cover legitimate override targets (revision_requested, under_review)
-- per the transition matrix. Excludes withdrawn (author-initiated) and
-- redirected (lives on abstracts.redirected_from_category_id).

create table public.abstract_committee_decisions (
  id                          uuid primary key default gen_random_uuid(),
  abstract_id                 uuid not null references public.abstracts(id) on delete cascade,

  decision                    text not null
    check (decision in (
      'accept_oral',
      'accept_poster',
      'accept_video',
      'second_review',
      'reject',
      'revision_requested',
      'under_review'
    )),

  -- Who decided. FK nullable + ON DELETE SET NULL so removing a team member
  -- doesn't destroy the audit; snapshot fields below carry the identity.
  decided_by                  uuid references public.team_members(id) on delete set null,
  decided_by_name             text not null,
  decided_by_email            text,

  review_round                integer not null default 1,

  -- Decision-shape fields
  second_review_reason        text,
  second_review_instructions  text,
  rejection_reason            text,
  feedback_to_author          text,
  notes                       text,

  -- Override / re-decide ledger. The DB enforces that an override carries a
  -- reason; the committee-decision route sets both fields from the same code
  -- path so they can't diverge from the type-level TransitionResult contract.
  is_override                 boolean not null default false,
  override_reason             text,
  constraint abstract_committee_decisions_override_requires_reason
    check (is_override = false or override_reason is not null),

  decided_at                  timestamptz not null default now()
);

create index abstract_committee_decisions_abstract_idx
  on public.abstract_committee_decisions (abstract_id, decided_at desc);

create index abstract_committee_decisions_decided_by_idx
  on public.abstract_committee_decisions (decided_by);

-- Admin client bypasses RLS; restrictive default keeps direct-client reads
-- blocked-by-default until/unless explicit policies are added.
alter table public.abstract_committee_decisions enable row level security;
