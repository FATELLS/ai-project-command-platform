/**
 * Kysely DB types for AI Project Command Platform V2.
 *
 * Auto-generated from 0001_create_baseline_schema.sql.
 * Every table in the baseline schema has a corresponding interface here.
 *
 * Conventions:
 * - Column names use snake_case (matching SQL).
 * - TypeScript types use the closest native/standard type.
 * - JSONB columns are typed as `Generated<unknown>` to allow flexible payloads
 *   until domain types in packages/domain are finalized.
 * - Nullable columns use `| null`.
 */

import type { Generated } from "kysely";

// ==================== IDENTITY DOMAIN ====================

export interface UsersTable {
  id: string;
  display_name: string;
  login_name: string | null;
  password_salt: string | null;
  password_hash: string | null;
  password_params: Generated<unknown> | null;
  status: Generated<string>;
  is_platform_admin: Generated<boolean>;
  must_reset_password: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SessionsTable {
  id: string;
  token_hash: string;
  user_id: string;
  csrf_token: string;
  created_at: Generated<Date>;
  last_seen_at: Date;
  idle_expires_at: Date;
  absolute_expires_at: Date;
}

export interface RecentProjectAccessTable {
  user_id: string;
  project_id: string;
  last_accessed_at: Date;
}

// ==================== TEMPLATES DOMAIN ====================

export interface TemplatesTable {
  id: string;
  version: string;
  name: string;
  config_json: Generated<unknown>;
  created_at: Generated<Date>;
}

// ==================== PROJECTS DOMAIN ====================

export interface ProjectsTable {
  id: string;
  name: string;
  template_id: string;
  template_version: string;
  status: Generated<string>;
  theme_json: Generated<unknown>;
  terminology_json: Generated<unknown>;
  published_version_id: number | null;
  draft_version_id: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  archived_at: Date | null;
}

export interface ProjectMembersTable {
  project_id: string;
  user_id: string;
  role: string;
  created_at: Generated<Date>;
}

export interface ProjectVersionsTable {
  id: Generated<number>;
  project_id: string;
  layer: string;
  version_label: string;
  source_checksum: Generated<string>;
  metadata_json: Generated<unknown>;
  created_at: Generated<Date>;
}

export interface ProjectModulesTable {
  version_id: number;
  external_id: string;
  module_type: string;
  position: number;
  enabled: Generated<boolean>;
  data_json: Generated<unknown>;
}

// ==================== UNIFIED CARDS DOMAIN ====================

export interface ProjectCardsTable {
  version_id: number;
  external_id: string;
  element_type: string;
  position: Generated<number>;
  title: Generated<string>;
  owner: Generated<string>;
  state: Generated<string>;
  objective: Generated<string>;
  start_date: Generated<string>;
  end_date: Generated<string>;
  progress: number | null;
  health: Generated<string>;
  unit_id: Generated<string>;
  parent_id: string | null;
  depends_on: Generated<unknown>;
  card_attrs: Generated<unknown>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ProjectCardLinksTable {
  version_id: number;
  card_external_id: string;
  depends_on_external_id: string;
  relation_type: Generated<string>;
  position: Generated<number>;
}

// ==================== MATERIALS DOMAIN ====================

export interface ProjectMaterialsTable {
  id: string;
  project_id: string;
  source_kind: Generated<string>;
  display_name: string;
  canonical_extension: string;
  canonical_mime: string;
  sha256: string;
  byte_size: number;
  status: Generated<string>;
  active_extraction_version: number | null;
  original_removed_at: Date | null;
  created_by: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface MaterialArtifactsTable {
  id: string;
  project_id: string;
  material_id: string;
  kind: string;
  storage_key: string;
  byte_size: number;
  sha256: string;
  status: Generated<string>;
  created_at: Generated<Date>;
  removed_at: Date | null;
}

export interface MaterialJobsTable {
  id: string;
  project_id: string;
  material_id: string;
  kind: string;
  state: Generated<string>;
  attempts: Generated<number>;
  lease_owner: string | null;
  lease_expires_at: Date | null;
  timeout_ms: Generated<number>;
  error_code: string | null;
  stats_json: Generated<unknown>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface EvidenceBlocksTable {
  id: Generated<number>;
  external_id: string;
  project_id: string;
  material_id: string;
  extraction_version: number;
  ordinal: number;
  kind: string;
  location_json: unknown;
  text: string;
  summary: Generated<string>;
  content_hash: string;
  created_at: Generated<Date>;
}

export interface MaterialQaGrantsTable {
  project_id: string;
  material_id: string;
  audience: Generated<string>;
  enabled: Generated<boolean>;
  granted_by: string | null;
  granted_at: Date | null;
}

export interface MaterialUpdateSelectionsTable {
  project_id: string;
  material_id: string;
  template_id: string;
  template_version: string;
  selected_by: string;
  selected_at: Generated<Date>;
}

export interface MaterialUploadAttemptsTable {
  id: string;
  project_id: string;
  user_id: string;
  outcome: Generated<string>;
  error_code: string | null;
  created_at: Generated<Date>;
  finished_at: Date | null;
}

export interface MaterialUploadLocksTable {
  project_id: string;
  user_id: string;
  attempt_id: string;
  expires_at: Date;
}

export interface AiUsageEventsTable {
  id: string;
  project_id: string;
  user_id: string;
  capability: string;
  units: Generated<number>;
  request_hash: string;
  status: string;
  created_at: Generated<Date>;
}

// ==================== GENERATION DOMAIN ====================

export interface MaterialGenerationGrantsTable {
  project_id: string;
  material_id: string;
  enabled: Generated<boolean>;
  granted_by: string | null;
  granted_at: Date | null;
}

export interface GenerationJobsTable {
  id: string;
  project_id: string;
  base_version_id: number;
  template_id: string;
  template_version: string;
  schema_version: string;
  state: Generated<string>;
  attempts: Generated<number>;
  lease_owner: string | null;
  lease_expires_at: Date | null;
  idempotency_key: string;
  request_hash: string;
  created_by: string;
  error_code: string | null;
  validation_json: Generated<unknown>;
  proposal_id: string | null;
  retry_of_job_id: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface GenerationJobMaterialsTable {
  project_id: string;
  job_id: string;
  material_id: string;
  extraction_version: number;
  position: number;
  readiness_json: Generated<unknown>;
}

export interface GenerationJobEvidenceTable {
  project_id: string;
  job_id: string;
  evidence_external_id: string;
  material_id: string;
  extraction_version: number;
  content_hash: string;
  position: number;
}

export interface GenerationAttemptsTable {
  id: string;
  project_id: string;
  job_id: string;
  attempt_number: number;
  kind: string;
  outcome: string;
  provider_label: Generated<string>;
  input_tokens: Generated<number>;
  output_tokens: Generated<number>;
  latency_ms: Generated<number>;
  currency: string | null;
  price_version: string | null;
  cost_micros: number | null;
  cost_status: Generated<string>;
  result_code: string | null;
  created_at: Generated<Date>;
  finished_at: Date | null;
}

// ==================== CHANGE PROPOSALS DOMAIN ====================

export interface ChangeProposalsTable {
  id: string;
  project_id: string;
  base_version_id: number;
  status: Generated<string>;
  schema_version: string;
  payload_json: unknown;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ChangeProposalItemsTable {
  project_id: string;
  proposal_id: string;
  change_id: string;
  module_type: string;
  operation: string;
  target_external_id: string;
  semantic_type: string;
  patch_json: unknown;
  confidence: number;
  warnings_json: Generated<unknown>;
  position: number;
}

export interface ChangeProposalEvidenceTable {
  project_id: string;
  proposal_id: string;
  change_id: string;
  evidence_external_id: string;
  position: number;
}

export interface ProposalReviewItemsTable {
  project_id: string;
  proposal_id: string;
  change_id: string;
  decision: Generated<string>;
  edited_patch_json: unknown | null;
  note: Generated<string>;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  updated_at: Generated<Date>;
}

export interface ProposalMergesTable {
  id: string;
  project_id: string;
  proposal_id: string;
  source_draft_version_id: number;
  result_draft_version_id: number;
  accepted_count: number;
  rejected_count: number;
  merged_by: string;
  merged_at: Generated<Date>;
}

// ==================== RELEASE DOMAIN ====================

export interface PublicationEventsTable {
  id: string;
  project_id: string;
  action: string;
  from_published_version_id: number;
  to_published_version_id: number;
  source_draft_version_id: number | null;
  previous_event_id: string | null;
  version_label: string;
  checklist_json: Generated<unknown>;
  created_by: string;
  created_at: Generated<Date>;
}

export interface MaterialReadinessSnapshotsTable {
  id: Generated<number>;
  project_id: string;
  material_id: string;
  extraction_version: number;
  template_id: string;
  template_version: string;
  status: string;
  missing_json: Generated<unknown>;
  warnings_json: Generated<unknown>;
  evidence_json: Generated<unknown>;
  suggestion: Generated<string>;
  created_by: string | null;
  created_at: Generated<Date>;
}

// ==================== OPERATIONS DOMAIN ====================

export interface AuditEventsTable {
  id: Generated<number>;
  user_id: string | null;
  project_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  remote_address: Generated<string>;
  metadata_json: Generated<unknown>;
  created_at: Generated<Date>;
}

export interface OperationTracesTable {
  id: string;
  parent_id: string | null;
  request_id: string;
  project_id: string | null;
  user_id: string | null;
  operation: string;
  target_type: Generated<string>;
  target_id: string | null;
  status: string;
  metadata_json: Generated<unknown>;
  started_at: Date;
  finished_at: Date | null;
}

export interface ErrorEventsTable {
  id: string;
  request_id: string;
  trace_id: string | null;
  project_id: string | null;
  user_id: string | null;
  method: Generated<string>;
  route: Generated<string>;
  status: number;
  code: string;
  message: string;
  stack_fingerprint: string;
  stack_redacted: string;
  context_json: Generated<unknown>;
  created_at: Generated<Date>;
}

export interface ProductTestRunsTable {
  id: string;
  project_id: string | null;
  suite_id: string;
  status: string;
  requested_by: string;
  summary_json: Generated<unknown>;
  created_at: Generated<Date>;
  finished_at: Date | null;
}

export interface ProductTestCaseResultsTable {
  run_id: string;
  case_id: string;
  status: string;
  duration_ms: Generated<number>;
  request_id: string | null;
  message: Generated<string>;
  details_json: Generated<unknown>;
  position: number;
}

// ==================== SETTINGS DOMAIN ====================

export interface PlatformSettingsTable {
  key: string;
  value_json: Generated<unknown>;
  updated_at: Generated<Date>;
  updated_by: string | null;
}

// ==================== Kysely DB Interface ====================

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  recent_project_access: RecentProjectAccessTable;
  templates: TemplatesTable;
  projects: ProjectsTable;
  project_members: ProjectMembersTable;
  project_versions: ProjectVersionsTable;
  project_modules: ProjectModulesTable;
  project_cards: ProjectCardsTable;
  project_card_links: ProjectCardLinksTable;
  project_materials: ProjectMaterialsTable;
  material_artifacts: MaterialArtifactsTable;
  material_jobs: MaterialJobsTable;
  evidence_blocks: EvidenceBlocksTable;
  material_qa_grants: MaterialQaGrantsTable;
  material_update_selections: MaterialUpdateSelectionsTable;
  material_upload_attempts: MaterialUploadAttemptsTable;
  material_upload_locks: MaterialUploadLocksTable;
  ai_usage_events: AiUsageEventsTable;
  material_generation_grants: MaterialGenerationGrantsTable;
  generation_jobs: GenerationJobsTable;
  generation_job_materials: GenerationJobMaterialsTable;
  generation_job_evidence: GenerationJobEvidenceTable;
  generation_attempts: GenerationAttemptsTable;
  change_proposals: ChangeProposalsTable;
  change_proposal_items: ChangeProposalItemsTable;
  change_proposal_evidence: ChangeProposalEvidenceTable;
  proposal_review_items: ProposalReviewItemsTable;
  proposal_merges: ProposalMergesTable;
  publication_events: PublicationEventsTable;
  material_readiness_snapshots: MaterialReadinessSnapshotsTable;
  audit_events: AuditEventsTable;
  operation_traces: OperationTracesTable;
  error_events: ErrorEventsTable;
  product_test_runs: ProductTestRunsTable;
  product_test_case_results: ProductTestCaseResultsTable;
  platform_settings: PlatformSettingsTable;
}
