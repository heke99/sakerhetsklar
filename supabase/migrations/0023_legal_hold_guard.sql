-- 0023_legal_hold_guard.sql
--
-- Batch 10/18: legal hold blocks deletion at the DATABASE level, so no
-- service-layer bug, retention job or manual SQL can remove held evidence.
-- Both hard deletes and soft deletes (setting deleted_at) are blocked while
-- evidence.legal_hold is true or the evidence is part of an active legal hold.

create or replace function app.evidence_is_held(p_evidence_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.legal_hold_items lhi
    join public.legal_holds lh on lh.id = lhi.legal_hold_id
    where lhi.evidence_id = p_evidence_id
      and lh.status = 'active'
  );
$$;

create or replace function app.prevent_held_evidence_deletion()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.legal_hold or app.evidence_is_held(old.id) then
      raise exception 'Evidence % is under legal hold and cannot be deleted', old.id
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  -- Soft delete: transitioning deleted_at from null to a value.
  if new.deleted_at is not null and old.deleted_at is null then
    if old.legal_hold or app.evidence_is_held(old.id) then
      raise exception 'Evidence % is under legal hold and cannot be deleted', old.id
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists evidence_legal_hold_delete_guard on public.evidence;
create trigger evidence_legal_hold_delete_guard
  before delete on public.evidence
  for each row execute function app.prevent_held_evidence_deletion();

drop trigger if exists evidence_legal_hold_soft_delete_guard on public.evidence;
create trigger evidence_legal_hold_soft_delete_guard
  before update of deleted_at on public.evidence
  for each row execute function app.prevent_held_evidence_deletion();
