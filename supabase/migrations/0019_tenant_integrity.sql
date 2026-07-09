-- 0019_tenant_integrity.sql
--
-- Defense-in-depth tenant integrity (P0):
--
-- 1. `unique (tenant_id, id)` on every tenant-owned parent table so children
--    can reference the pair.
-- 2. Composite foreign keys `(tenant_id, <parent>_id)` on all child tables so
--    it is IMPOSSIBLE at the database level to link a row to a parent in
--    another tenant — even if the service-role client is used with buggy or
--    malicious application code.
-- 3. `tenant_id` added to the four join tables that lacked it
--    (critical_service_systems, system_segment_memberships,
--    protected_information_systems, legal_hold_items) with backfill,
--    composite FKs on both sides and direct tenant RLS policies.
-- 4. Missing FK on recipients.recipient_group_id.
--
-- The original single-column FKs are kept: they carry the on-delete
-- behaviour and remain valid; the composite FKs add the tenant-match
-- guarantee. `on delete set null (col)` (PostgreSQL 15+) is used for nullable
-- references so tenant_id itself is never nulled.
--
-- Idempotent: constraints are only added when absent.

create or replace function pg_temp.add_constraint_if_absent(cname text, ddl text)
returns void language plpgsql as $$
begin
  if not exists (select 1 from pg_constraint where conname = cname) then
    execute ddl;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. unique (tenant_id, id) on tenant-owned parent tables
-- ---------------------------------------------------------------------------

select pg_temp.add_constraint_if_absent('controls_tenant_id_id_key', 'alter table public.controls add constraint controls_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('critical_services_tenant_id_id_key', 'alter table public.critical_services add constraint critical_services_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('customer_contract_reporting_requirements_tenant_id_id_key', 'alter table public.customer_contract_reporting_requirements add constraint customer_contract_reporting_requirements_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('digital_environments_tenant_id_id_key', 'alter table public.digital_environments add constraint digital_environments_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('evidence_tenant_id_id_key', 'alter table public.evidence add constraint evidence_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('incident_reports_tenant_id_id_key', 'alter table public.incident_reports add constraint incident_reports_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('incident_war_rooms_tenant_id_id_key', 'alter table public.incident_war_rooms add constraint incident_war_rooms_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('incidents_tenant_id_id_key', 'alter table public.incidents add constraint incidents_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('information_assets_tenant_id_id_key', 'alter table public.information_assets add constraint information_assets_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('insurance_policies_tenant_id_id_key', 'alter table public.insurance_policies add constraint insurance_policies_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('lathund_runs_tenant_id_id_key', 'alter table public.lathund_runs add constraint lathund_runs_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('legal_entities_tenant_id_id_key', 'alter table public.legal_entities add constraint legal_entities_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('legal_holds_tenant_id_id_key', 'alter table public.legal_holds add constraint legal_holds_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('management_members_tenant_id_id_key', 'alter table public.management_members add constraint management_members_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('protected_information_assets_tenant_id_id_key', 'alter table public.protected_information_assets add constraint protected_information_assets_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('recipient_groups_tenant_id_id_key', 'alter table public.recipient_groups add constraint recipient_groups_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('registration_records_tenant_id_id_key', 'alter table public.registration_records add constraint registration_records_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('risk_assessments_tenant_id_id_key', 'alter table public.risk_assessments add constraint risk_assessments_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('risks_tenant_id_id_key', 'alter table public.risks add constraint risks_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('scope_assessments_tenant_id_id_key', 'alter table public.scope_assessments add constraint scope_assessments_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('system_segments_tenant_id_id_key', 'alter table public.system_segments add constraint system_segments_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('systems_tenant_id_id_key', 'alter table public.systems add constraint systems_tenant_id_id_key unique (tenant_id, id)');
select pg_temp.add_constraint_if_absent('vendors_tenant_id_id_key', 'alter table public.vendors add constraint vendors_tenant_id_id_key unique (tenant_id, id)');

-- ---------------------------------------------------------------------------
-- 2. tenant_id on join tables that lacked it (backfill + not null + FKs + RLS)
-- ---------------------------------------------------------------------------

-- critical_service_systems --------------------------------------------------
alter table public.critical_service_systems add column if not exists tenant_id uuid;

update public.critical_service_systems css
set tenant_id = cs.tenant_id
from public.critical_services cs
where css.critical_service_id = cs.id and css.tenant_id is null;

alter table public.critical_service_systems alter column tenant_id set not null;

select pg_temp.add_constraint_if_absent('critical_service_systems_tenant_id_fkey',
  'alter table public.critical_service_systems add constraint critical_service_systems_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade');
select pg_temp.add_constraint_if_absent('critical_service_systems_service_tfk',
  'alter table public.critical_service_systems add constraint critical_service_systems_service_tfk foreign key (tenant_id, critical_service_id) references public.critical_services (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('critical_service_systems_system_tfk',
  'alter table public.critical_service_systems add constraint critical_service_systems_system_tfk foreign key (tenant_id, system_id) references public.systems (tenant_id, id) on delete cascade');

create index if not exists critical_service_systems_tenant_idx
  on public.critical_service_systems (tenant_id);

drop policy if exists critical_service_systems_select on public.critical_service_systems;
create policy critical_service_systems_select on public.critical_service_systems
  for select using (app.can_access_tenant(tenant_id));

-- system_segment_memberships ------------------------------------------------
alter table public.system_segment_memberships add column if not exists tenant_id uuid;

update public.system_segment_memberships ssm
set tenant_id = s.tenant_id
from public.systems s
where ssm.system_id = s.id and ssm.tenant_id is null;

alter table public.system_segment_memberships alter column tenant_id set not null;

select pg_temp.add_constraint_if_absent('system_segment_memberships_tenant_id_fkey',
  'alter table public.system_segment_memberships add constraint system_segment_memberships_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade');
select pg_temp.add_constraint_if_absent('system_segment_memberships_system_tfk',
  'alter table public.system_segment_memberships add constraint system_segment_memberships_system_tfk foreign key (tenant_id, system_id) references public.systems (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('system_segment_memberships_segment_tfk',
  'alter table public.system_segment_memberships add constraint system_segment_memberships_segment_tfk foreign key (tenant_id, segment_id) references public.system_segments (tenant_id, id) on delete cascade');

create index if not exists system_segment_memberships_tenant_idx
  on public.system_segment_memberships (tenant_id);

drop policy if exists system_segment_memberships_select on public.system_segment_memberships;
create policy system_segment_memberships_select on public.system_segment_memberships
  for select using (app.can_access_tenant(tenant_id));

-- protected_information_systems ----------------------------------------------
alter table public.protected_information_systems add column if not exists tenant_id uuid;

update public.protected_information_systems pis
set tenant_id = pia.tenant_id
from public.protected_information_assets pia
where pis.protected_information_asset_id = pia.id and pis.tenant_id is null;

alter table public.protected_information_systems alter column tenant_id set not null;

select pg_temp.add_constraint_if_absent('protected_information_systems_tenant_id_fkey',
  'alter table public.protected_information_systems add constraint protected_information_systems_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade');
select pg_temp.add_constraint_if_absent('protected_information_systems_asset_tfk',
  'alter table public.protected_information_systems add constraint protected_information_systems_asset_tfk foreign key (tenant_id, protected_information_asset_id) references public.protected_information_assets (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('protected_information_systems_system_tfk',
  'alter table public.protected_information_systems add constraint protected_information_systems_system_tfk foreign key (tenant_id, system_id) references public.systems (tenant_id, id) on delete cascade');

create index if not exists protected_information_systems_tenant_idx
  on public.protected_information_systems (tenant_id);

drop policy if exists protected_information_systems_select on public.protected_information_systems;
create policy protected_information_systems_select on public.protected_information_systems
  for select using (app.can_access_tenant(tenant_id));

-- legal_hold_items ------------------------------------------------------------
alter table public.legal_hold_items add column if not exists tenant_id uuid;

update public.legal_hold_items lhi
set tenant_id = lh.tenant_id
from public.legal_holds lh
where lhi.legal_hold_id = lh.id and lhi.tenant_id is null;

alter table public.legal_hold_items alter column tenant_id set not null;

select pg_temp.add_constraint_if_absent('legal_hold_items_tenant_id_fkey',
  'alter table public.legal_hold_items add constraint legal_hold_items_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade');
select pg_temp.add_constraint_if_absent('legal_hold_items_hold_tfk',
  'alter table public.legal_hold_items add constraint legal_hold_items_hold_tfk foreign key (tenant_id, legal_hold_id) references public.legal_holds (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('legal_hold_items_evidence_tfk',
  'alter table public.legal_hold_items add constraint legal_hold_items_evidence_tfk foreign key (tenant_id, evidence_id) references public.evidence (tenant_id, id) on delete cascade');

create index if not exists legal_hold_items_tenant_idx
  on public.legal_hold_items (tenant_id);

drop policy if exists legal_hold_items_select on public.legal_hold_items;
create policy legal_hold_items_select on public.legal_hold_items
  for select using (app.can_access_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- 3. Missing FK: recipients.recipient_group_id
-- ---------------------------------------------------------------------------

select pg_temp.add_constraint_if_absent('recipients_recipient_group_tfk',
  'alter table public.recipients add constraint recipients_recipient_group_tfk foreign key (tenant_id, recipient_group_id) references public.recipient_groups (tenant_id, id) on delete set null (recipient_group_id)');

-- ---------------------------------------------------------------------------
-- 4. Composite tenant FKs on all child tables (generated from live schema)
-- ---------------------------------------------------------------------------

select pg_temp.add_constraint_if_absent('control_assignments_control_id_84d174_tfk', 'alter table public.control_assignments add constraint control_assignments_control_id_84d174_tfk foreign key (tenant_id, control_id) references public.controls (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('control_evidence_control_id_390603_tfk', 'alter table public.control_evidence add constraint control_evidence_control_id_390603_tfk foreign key (tenant_id, control_id) references public.controls (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('evidence_control_id_d89911_tfk', 'alter table public.evidence add constraint evidence_control_id_d89911_tfk foreign key (tenant_id, control_id) references public.controls (tenant_id, id) on delete set null (control_id)');
select pg_temp.add_constraint_if_absent('risk_acceptances_control_id_9bee85_tfk', 'alter table public.risk_acceptances add constraint risk_acceptances_control_id_9bee85_tfk foreign key (tenant_id, control_id) references public.controls (tenant_id, id) on delete set null (control_id)');
select pg_temp.add_constraint_if_absent('risks_linked_control_id_2f7d7c_tfk', 'alter table public.risks add constraint risks_linked_control_id_2f7d7c_tfk foreign key (tenant_id, linked_control_id) references public.controls (tenant_id, id) on delete set null (linked_control_id)');
select pg_temp.add_constraint_if_absent('business_continuity_plans_critical_servi_542492_tfk', 'alter table public.business_continuity_plans add constraint business_continuity_plans_critical_servi_542492_tfk foreign key (tenant_id, critical_service_id) references public.critical_services (tenant_id, id) on delete set null (critical_service_id)');
select pg_temp.add_constraint_if_absent('incident_service_impacts_critical_servic_6d39fa_tfk', 'alter table public.incident_service_impacts add constraint incident_service_impacts_critical_servic_6d39fa_tfk foreign key (tenant_id, critical_service_id) references public.critical_services (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('manual_workarounds_critical_service_id_10b04e_tfk', 'alter table public.manual_workarounds add constraint manual_workarounds_critical_service_id_10b04e_tfk foreign key (tenant_id, critical_service_id) references public.critical_services (tenant_id, id) on delete set null (critical_service_id)');
select pg_temp.add_constraint_if_absent('recipient_groups_critical_service_id_e3fe37_tfk', 'alter table public.recipient_groups add constraint recipient_groups_critical_service_id_e3fe37_tfk foreign key (tenant_id, critical_service_id) references public.critical_services (tenant_id, id) on delete set null (critical_service_id)');
select pg_temp.add_constraint_if_absent('vendor_services_critical_service_id_4366a0_tfk', 'alter table public.vendor_services add constraint vendor_services_critical_service_id_4366a0_tfk foreign key (tenant_id, critical_service_id) references public.critical_services (tenant_id, id) on delete set null (critical_service_id)');
select pg_temp.add_constraint_if_absent('contractual_notification_deadlines_requi_98c64d_tfk', 'alter table public.contractual_notification_deadlines add constraint contractual_notification_deadlines_requi_98c64d_tfk foreign key (tenant_id, requirement_id) references public.customer_contract_reporting_requirements (tenant_id, id) on delete set null (requirement_id)');
select pg_temp.add_constraint_if_absent('systems_digital_environment_id_9ccc03_tfk', 'alter table public.systems add constraint systems_digital_environment_id_9ccc03_tfk foreign key (tenant_id, digital_environment_id) references public.digital_environments (tenant_id, id) on delete set null (digital_environment_id)');
select pg_temp.add_constraint_if_absent('control_evidence_evidence_id_af0956_tfk', 'alter table public.control_evidence add constraint control_evidence_evidence_id_af0956_tfk foreign key (tenant_id, evidence_id) references public.evidence (tenant_id, id) on delete set null (evidence_id)');
select pg_temp.add_constraint_if_absent('evidence_access_logs_evidence_id_c1cadf_tfk', 'alter table public.evidence_access_logs add constraint evidence_access_logs_evidence_id_c1cadf_tfk foreign key (tenant_id, evidence_id) references public.evidence (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('evidence_chain_of_custody_evidence_id_ce32fa_tfk', 'alter table public.evidence_chain_of_custody add constraint evidence_chain_of_custody_evidence_id_ce32fa_tfk foreign key (tenant_id, evidence_id) references public.evidence (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('evidence_hashes_evidence_id_74418e_tfk', 'alter table public.evidence_hashes add constraint evidence_hashes_evidence_id_74418e_tfk foreign key (tenant_id, evidence_id) references public.evidence (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('evidence_versions_evidence_id_ce3652_tfk', 'alter table public.evidence_versions add constraint evidence_versions_evidence_id_ce3652_tfk foreign key (tenant_id, evidence_id) references public.evidence (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('war_room_decisions_linked_evidence_id_bd6906_tfk', 'alter table public.war_room_decisions add constraint war_room_decisions_linked_evidence_id_bd6906_tfk foreign key (tenant_id, linked_evidence_id) references public.evidence (tenant_id, id) on delete set null (linked_evidence_id)');
select pg_temp.add_constraint_if_absent('cyberportal_incident_ids_report_id_03fc50_tfk', 'alter table public.cyberportal_incident_ids add constraint cyberportal_incident_ids_report_id_03fc50_tfk foreign key (tenant_id, report_id) references public.incident_reports (tenant_id, id) on delete set null (report_id)');
select pg_temp.add_constraint_if_absent('incident_report_fields_report_id_8a5056_tfk', 'alter table public.incident_report_fields add constraint incident_report_fields_report_id_8a5056_tfk foreign key (tenant_id, report_id) references public.incident_reports (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_report_submissions_report_id_9e7e49_tfk', 'alter table public.incident_report_submissions add constraint incident_report_submissions_report_id_9e7e49_tfk foreign key (tenant_id, report_id) references public.incident_reports (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('report_receipts_report_id_1a6bbe_tfk', 'alter table public.report_receipts add constraint report_receipts_report_id_1a6bbe_tfk foreign key (tenant_id, report_id) references public.incident_reports (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('reserve_procedure_records_report_id_70d714_tfk', 'alter table public.reserve_procedure_records add constraint reserve_procedure_records_report_id_70d714_tfk foreign key (tenant_id, report_id) references public.incident_reports (tenant_id, id) on delete set null (report_id)');
select pg_temp.add_constraint_if_absent('war_room_decisions_linked_report_id_f2413c_tfk', 'alter table public.war_room_decisions add constraint war_room_decisions_linked_report_id_f2413c_tfk foreign key (tenant_id, linked_report_id) references public.incident_reports (tenant_id, id) on delete set null (linked_report_id)');
select pg_temp.add_constraint_if_absent('war_room_decisions_war_room_id_13b6f6_tfk', 'alter table public.war_room_decisions add constraint war_room_decisions_war_room_id_13b6f6_tfk foreign key (tenant_id, war_room_id) references public.incident_war_rooms (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('war_room_members_war_room_id_8a305e_tfk', 'alter table public.war_room_members add constraint war_room_members_war_room_id_8a305e_tfk foreign key (tenant_id, war_room_id) references public.incident_war_rooms (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('war_room_messages_war_room_id_4ab7cb_tfk', 'alter table public.war_room_messages add constraint war_room_messages_war_room_id_4ab7cb_tfk foreign key (tenant_id, war_room_id) references public.incident_war_rooms (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('war_room_tasks_war_room_id_2f9321_tfk', 'alter table public.war_room_tasks add constraint war_room_tasks_war_room_id_2f9321_tfk foreign key (tenant_id, war_room_id) references public.incident_war_rooms (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('contractual_notification_deadlines_incid_f7c05a_tfk', 'alter table public.contractual_notification_deadlines add constraint contractual_notification_deadlines_incid_f7c05a_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('cyberportal_incident_ids_incident_id_478aa3_tfk', 'alter table public.cyberportal_incident_ids add constraint cyberportal_incident_ids_incident_id_478aa3_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('eidas_reports_incident_id_5ce6dd_tfk', 'alter table public.eidas_reports add constraint eidas_reports_incident_id_5ce6dd_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('evidence_incident_id_95739a_tfk', 'alter table public.evidence add constraint evidence_incident_id_95739a_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete set null (incident_id)');
select pg_temp.add_constraint_if_absent('gdpr_reports_incident_id_1f6ac5_tfk', 'alter table public.gdpr_reports add constraint gdpr_reports_incident_id_1f6ac5_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('imy_submission_records_incident_id_677587_tfk', 'alter table public.imy_submission_records add constraint imy_submission_records_incident_id_677587_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_comments_incident_id_694889_tfk', 'alter table public.incident_comments add constraint incident_comments_incident_id_694889_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_deadlines_incident_id_500e0b_tfk', 'alter table public.incident_deadlines add constraint incident_deadlines_incident_id_500e0b_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_decision_logs_incident_id_59c0ad_tfk', 'alter table public.incident_decision_logs add constraint incident_decision_logs_incident_id_59c0ad_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_events_incident_id_27bf8e_tfk', 'alter table public.incident_events add constraint incident_events_incident_id_27bf8e_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_impact_assessments_incident_id_3a49c6_tfk', 'alter table public.incident_impact_assessments add constraint incident_impact_assessments_incident_id_3a49c6_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_personal_data_assessments_incid_037a78_tfk', 'alter table public.incident_personal_data_assessments add constraint incident_personal_data_assessments_incid_037a78_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_protected_information_impacts_i_5f9857_tfk', 'alter table public.incident_protected_information_impacts add constraint incident_protected_information_impacts_i_5f9857_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_regulatory_tracks_incident_id_b3ad99_tfk', 'alter table public.incident_regulatory_tracks add constraint incident_regulatory_tracks_incident_id_b3ad99_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_reports_incident_id_a02a01_tfk', 'alter table public.incident_reports add constraint incident_reports_incident_id_a02a01_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_service_impacts_incident_id_6972e2_tfk', 'alter table public.incident_service_impacts add constraint incident_service_impacts_incident_id_6972e2_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_significance_assessments_incide_5bbc45_tfk', 'alter table public.incident_significance_assessments add constraint incident_significance_assessments_incide_5bbc45_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_statuses_incident_id_4acb6d_tfk', 'alter table public.incident_statuses add constraint incident_statuses_incident_id_4acb6d_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_system_impacts_incident_id_f849ec_tfk', 'alter table public.incident_system_impacts add constraint incident_system_impacts_incident_id_f849ec_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_tasks_incident_id_2d9ccf_tfk', 'alter table public.incident_tasks add constraint incident_tasks_incident_id_2d9ccf_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_vendor_impacts_incident_id_f98544_tfk', 'alter table public.incident_vendor_impacts add constraint incident_vendor_impacts_incident_id_f98544_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_war_rooms_incident_id_aca8a6_tfk', 'alter table public.incident_war_rooms add constraint incident_war_rooms_incident_id_aca8a6_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('insurance_notification_requirements_inci_80754d_tfk', 'alter table public.insurance_notification_requirements add constraint insurance_notification_requirements_inci_80754d_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('late_reporting_records_incident_id_acd30b_tfk', 'alter table public.late_reporting_records add constraint late_reporting_records_incident_id_acd30b_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('lathund_runs_incident_id_0b5725_tfk', 'alter table public.lathund_runs add constraint lathund_runs_incident_id_0b5725_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete set null (incident_id)');
select pg_temp.add_constraint_if_absent('legal_holds_incident_id_49dfcf_tfk', 'alter table public.legal_holds add constraint legal_holds_incident_id_49dfcf_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete set null (incident_id)');
select pg_temp.add_constraint_if_absent('pts_submission_records_incident_id_0db8f2_tfk', 'alter table public.pts_submission_records add constraint pts_submission_records_incident_id_0db8f2_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('recipient_notifications_incident_id_9373fe_tfk', 'alter table public.recipient_notifications add constraint recipient_notifications_incident_id_9373fe_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('reserve_procedure_records_incident_id_c05deb_tfk', 'alter table public.reserve_procedure_records add constraint reserve_procedure_records_incident_id_c05deb_tfk foreign key (tenant_id, incident_id) references public.incidents (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('information_flows_information_asset_id_de0271_tfk', 'alter table public.information_flows add constraint information_flows_information_asset_id_de0271_tfk foreign key (tenant_id, information_asset_id) references public.information_assets (tenant_id, id) on delete set null (information_asset_id)');
select pg_temp.add_constraint_if_absent('protected_information_assets_information_11a987_tfk', 'alter table public.protected_information_assets add constraint protected_information_assets_information_11a987_tfk foreign key (tenant_id, information_asset_id) references public.information_assets (tenant_id, id) on delete set null (information_asset_id)');
select pg_temp.add_constraint_if_absent('insurance_notification_requirements_poli_158a37_tfk', 'alter table public.insurance_notification_requirements add constraint insurance_notification_requirements_poli_158a37_tfk foreign key (tenant_id, policy_id) references public.insurance_policies (tenant_id, id) on delete set null (policy_id)');
select pg_temp.add_constraint_if_absent('lathund_run_steps_run_id_bd65e2_tfk', 'alter table public.lathund_run_steps add constraint lathund_run_steps_run_id_bd65e2_tfk foreign key (tenant_id, run_id) references public.lathund_runs (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('entity_size_assessments_legal_entity_id_0e252d_tfk', 'alter table public.entity_size_assessments add constraint entity_size_assessments_legal_entity_id_0e252d_tfk foreign key (tenant_id, legal_entity_id) references public.legal_entities (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('essential_important_classifications_lega_e960fd_tfk', 'alter table public.essential_important_classifications add constraint essential_important_classifications_lega_e960fd_tfk foreign key (tenant_id, legal_entity_id) references public.legal_entities (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incidents_legal_entity_id_008d07_tfk', 'alter table public.incidents add constraint incidents_legal_entity_id_008d07_tfk foreign key (tenant_id, legal_entity_id) references public.legal_entities (tenant_id, id) on delete set null (legal_entity_id)');
select pg_temp.add_constraint_if_absent('jurisdiction_assessments_legal_entity_id_ea1214_tfk', 'alter table public.jurisdiction_assessments add constraint jurisdiction_assessments_legal_entity_id_ea1214_tfk foreign key (tenant_id, legal_entity_id) references public.legal_entities (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('registration_records_legal_entity_id_7b847e_tfk', 'alter table public.registration_records add constraint registration_records_legal_entity_id_7b847e_tfk foreign key (tenant_id, legal_entity_id) references public.legal_entities (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('role_assignments_legal_entity_id_8ccc7f_tfk', 'alter table public.role_assignments add constraint role_assignments_legal_entity_id_8ccc7f_tfk foreign key (tenant_id, legal_entity_id) references public.legal_entities (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('scope_assessments_legal_entity_id_031a3d_tfk', 'alter table public.scope_assessments add constraint scope_assessments_legal_entity_id_031a3d_tfk foreign key (tenant_id, legal_entity_id) references public.legal_entities (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('management_training_records_management_m_867684_tfk', 'alter table public.management_training_records add constraint management_training_records_management_m_867684_tfk foreign key (tenant_id, management_member_id) references public.management_members (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('incident_protected_information_impacts_p_f6fa45_tfk', 'alter table public.incident_protected_information_impacts add constraint incident_protected_information_impacts_p_f6fa45_tfk foreign key (tenant_id, protected_information_asset_id) references public.protected_information_assets (tenant_id, id) on delete set null (protected_information_asset_id)');
select pg_temp.add_constraint_if_absent('registration_change_logs_registration_re_a7670d_tfk', 'alter table public.registration_change_logs add constraint registration_change_logs_registration_re_a7670d_tfk foreign key (tenant_id, registration_record_id) references public.registration_records (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('registration_receipts_registration_recor_574099_tfk', 'alter table public.registration_receipts add constraint registration_receipts_registration_recor_574099_tfk foreign key (tenant_id, registration_record_id) references public.registration_records (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('risks_risk_assessment_id_1a9553_tfk', 'alter table public.risks add constraint risks_risk_assessment_id_1a9553_tfk foreign key (tenant_id, risk_assessment_id) references public.risk_assessments (tenant_id, id) on delete set null (risk_assessment_id)');
select pg_temp.add_constraint_if_absent('risk_acceptances_risk_id_6fb6bd_tfk', 'alter table public.risk_acceptances add constraint risk_acceptances_risk_id_6fb6bd_tfk foreign key (tenant_id, risk_id) references public.risks (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('risk_treatments_risk_id_86dc41_tfk', 'alter table public.risk_treatments add constraint risk_treatments_risk_id_86dc41_tfk foreign key (tenant_id, risk_id) references public.risks (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('scope_answers_assessment_id_02b273_tfk', 'alter table public.scope_answers add constraint scope_answers_assessment_id_02b273_tfk foreign key (tenant_id, assessment_id) references public.scope_assessments (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('scope_results_assessment_id_4b9dd1_tfk', 'alter table public.scope_results add constraint scope_results_assessment_id_4b9dd1_tfk foreign key (tenant_id, assessment_id) references public.scope_assessments (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('it_segments_segment_id_516fd1_tfk', 'alter table public.it_segments add constraint it_segments_segment_id_516fd1_tfk foreign key (tenant_id, segment_id) references public.system_segments (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('ot_segments_segment_id_fada56_tfk', 'alter table public.ot_segments add constraint ot_segments_segment_id_fada56_tfk foreign key (tenant_id, segment_id) references public.system_segments (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('backup_tests_system_id_078cb9_tfk', 'alter table public.backup_tests add constraint backup_tests_system_id_078cb9_tfk foreign key (tenant_id, system_id) references public.systems (tenant_id, id) on delete set null (system_id)');
select pg_temp.add_constraint_if_absent('disaster_recovery_plans_system_id_0b72e2_tfk', 'alter table public.disaster_recovery_plans add constraint disaster_recovery_plans_system_id_0b72e2_tfk foreign key (tenant_id, system_id) references public.systems (tenant_id, id) on delete set null (system_id)');
select pg_temp.add_constraint_if_absent('incident_system_impacts_system_id_121512_tfk', 'alter table public.incident_system_impacts add constraint incident_system_impacts_system_id_121512_tfk foreign key (tenant_id, system_id) references public.systems (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('information_flows_from_system_id_c8d801_tfk', 'alter table public.information_flows add constraint information_flows_from_system_id_c8d801_tfk foreign key (tenant_id, from_system_id) references public.systems (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('information_flows_to_system_id_a659da_tfk', 'alter table public.information_flows add constraint information_flows_to_system_id_a659da_tfk foreign key (tenant_id, to_system_id) references public.systems (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('restore_tests_system_id_56b94f_tfk', 'alter table public.restore_tests add constraint restore_tests_system_id_56b94f_tfk foreign key (tenant_id, system_id) references public.systems (tenant_id, id) on delete set null (system_id)');
select pg_temp.add_constraint_if_absent('risks_linked_system_id_b66d9e_tfk', 'alter table public.risks add constraint risks_linked_system_id_b66d9e_tfk foreign key (tenant_id, linked_system_id) references public.systems (tenant_id, id) on delete set null (linked_system_id)');
select pg_temp.add_constraint_if_absent('sector_critical_systems_system_id_297b9c_tfk', 'alter table public.sector_critical_systems add constraint sector_critical_systems_system_id_297b9c_tfk foreign key (tenant_id, system_id) references public.systems (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('system_dependencies_depends_on_system_id_2b2b6f_tfk', 'alter table public.system_dependencies add constraint system_dependencies_depends_on_system_id_2b2b6f_tfk foreign key (tenant_id, depends_on_system_id) references public.systems (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('system_dependencies_system_id_340f57_tfk', 'alter table public.system_dependencies add constraint system_dependencies_system_id_340f57_tfk foreign key (tenant_id, system_id) references public.systems (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('vendor_services_system_id_d5d78e_tfk', 'alter table public.vendor_services add constraint vendor_services_system_id_d5d78e_tfk foreign key (tenant_id, system_id) references public.systems (tenant_id, id) on delete set null (system_id)');
select pg_temp.add_constraint_if_absent('customer_contract_reporting_requirements_a995dc_tfk', 'alter table public.customer_contract_reporting_requirements add constraint customer_contract_reporting_requirements_a995dc_tfk foreign key (tenant_id, vendor_id) references public.vendors (tenant_id, id) on delete set null (vendor_id)');
select pg_temp.add_constraint_if_absent('incident_vendor_impacts_vendor_id_e0a135_tfk', 'alter table public.incident_vendor_impacts add constraint incident_vendor_impacts_vendor_id_e0a135_tfk foreign key (tenant_id, vendor_id) references public.vendors (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('outsourced_processing_records_vendor_id_a2efe9_tfk', 'alter table public.outsourced_processing_records add constraint outsourced_processing_records_vendor_id_a2efe9_tfk foreign key (tenant_id, vendor_id) references public.vendors (tenant_id, id) on delete set null (vendor_id)');
select pg_temp.add_constraint_if_absent('risks_linked_vendor_id_d67277_tfk', 'alter table public.risks add constraint risks_linked_vendor_id_d67277_tfk foreign key (tenant_id, linked_vendor_id) references public.vendors (tenant_id, id) on delete set null (linked_vendor_id)');
select pg_temp.add_constraint_if_absent('subcontractors_vendor_id_633188_tfk', 'alter table public.subcontractors add constraint subcontractors_vendor_id_633188_tfk foreign key (tenant_id, vendor_id) references public.vendors (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('systems_vendor_id_cc5278_tfk', 'alter table public.systems add constraint systems_vendor_id_cc5278_tfk foreign key (tenant_id, vendor_id) references public.vendors (tenant_id, id) on delete set null (vendor_id)');
select pg_temp.add_constraint_if_absent('vendor_contacts_vendor_id_2124f6_tfk', 'alter table public.vendor_contacts add constraint vendor_contacts_vendor_id_2124f6_tfk foreign key (tenant_id, vendor_id) references public.vendors (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('vendor_contracts_vendor_id_1829da_tfk', 'alter table public.vendor_contracts add constraint vendor_contracts_vendor_id_1829da_tfk foreign key (tenant_id, vendor_id) references public.vendors (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('vendor_risk_assessments_vendor_id_94af35_tfk', 'alter table public.vendor_risk_assessments add constraint vendor_risk_assessments_vendor_id_94af35_tfk foreign key (tenant_id, vendor_id) references public.vendors (tenant_id, id) on delete cascade');
select pg_temp.add_constraint_if_absent('vendor_services_vendor_id_1b74e7_tfk', 'alter table public.vendor_services add constraint vendor_services_vendor_id_1b74e7_tfk foreign key (tenant_id, vendor_id) references public.vendors (tenant_id, id) on delete cascade');

drop function if exists pg_temp.add_constraint_if_absent(text, text);
