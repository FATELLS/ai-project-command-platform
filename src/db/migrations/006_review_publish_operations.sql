CREATE TABLE proposal_review_items (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  change_id TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','accepted','rejected')),
  edited_patch_json TEXT CHECK (edited_patch_json IS NULL OR (json_valid(edited_patch_json) AND json_type(edited_patch_json)='object')),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, proposal_id, change_id),
  FOREIGN KEY (project_id, proposal_id, change_id)
    REFERENCES change_proposal_items(project_id, proposal_id, change_id) ON DELETE CASCADE,
  CHECK ((decision='pending') = (reviewed_by IS NULL AND reviewed_at IS NULL)),
  CHECK (decision!='rejected' OR edited_patch_json IS NULL)
) STRICT;

INSERT INTO proposal_review_items (project_id,proposal_id,change_id,updated_at)
SELECT project_id,proposal_id,change_id,'2026-07-18T00:00:00.000Z'
FROM change_proposal_items;

CREATE TRIGGER create_pending_review_item
AFTER INSERT ON change_proposal_items
BEGIN
  INSERT INTO proposal_review_items (project_id,proposal_id,change_id,updated_at)
  VALUES (NEW.project_id,NEW.proposal_id,NEW.change_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

CREATE TABLE proposal_merges (
  id TEXT NOT NULL CHECK (length(id) BETWEEN 16 AND 128),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL,
  source_draft_version_id INTEGER NOT NULL,
  result_draft_version_id INTEGER NOT NULL,
  accepted_count INTEGER NOT NULL CHECK (accepted_count BETWEEN 1 AND 100),
  rejected_count INTEGER NOT NULL CHECK (rejected_count BETWEEN 0 AND 100),
  merged_by TEXT NOT NULL REFERENCES users(id),
  merged_at TEXT NOT NULL,
  PRIMARY KEY (project_id,id),
  UNIQUE (project_id,proposal_id),
  FOREIGN KEY (project_id,proposal_id) REFERENCES change_proposals(project_id,id),
  FOREIGN KEY (project_id,source_draft_version_id) REFERENCES project_versions(project_id,id),
  FOREIGN KEY (project_id,result_draft_version_id) REFERENCES project_versions(project_id,id)
) STRICT;

CREATE TABLE publication_events (
  id TEXT NOT NULL CHECK (length(id) BETWEEN 16 AND 128),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('publish','rollback')),
  from_published_version_id INTEGER NOT NULL,
  to_published_version_id INTEGER NOT NULL,
  source_draft_version_id INTEGER,
  previous_event_id TEXT,
  version_label TEXT NOT NULL CHECK (length(version_label) BETWEEN 1 AND 80),
  checklist_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(checklist_json)),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id,id),
  FOREIGN KEY (project_id,from_published_version_id) REFERENCES project_versions(project_id,id),
  FOREIGN KEY (project_id,to_published_version_id) REFERENCES project_versions(project_id,id),
  FOREIGN KEY (project_id,source_draft_version_id) REFERENCES project_versions(project_id,id),
  FOREIGN KEY (project_id,previous_event_id) REFERENCES publication_events(project_id,id)
) STRICT;

CREATE INDEX idx_review_items_proposal ON proposal_review_items(project_id,proposal_id,decision,change_id);
CREATE INDEX idx_proposal_merges_project ON proposal_merges(project_id,merged_at DESC);
CREATE INDEX idx_publication_events_project ON publication_events(project_id,created_at DESC,id DESC);

CREATE TRIGGER review_item_proposal_must_be_pending
BEFORE UPDATE OF decision,edited_patch_json ON proposal_review_items
BEGIN
  SELECT RAISE(ABORT,'only pending proposals can be reviewed')
  WHERE NOT EXISTS (
    SELECT 1 FROM change_proposals p
    WHERE p.project_id=NEW.project_id AND p.id=NEW.proposal_id AND p.status='pending'
  );
END;

CREATE TRIGGER proposal_merge_versions_must_be_drafts
BEFORE INSERT ON proposal_merges
BEGIN
  SELECT RAISE(ABORT,'proposal merge versions must be project drafts')
  WHERE NOT EXISTS (SELECT 1 FROM project_versions WHERE project_id=NEW.project_id AND id=NEW.source_draft_version_id AND layer='draft')
     OR NOT EXISTS (SELECT 1 FROM project_versions WHERE project_id=NEW.project_id AND id=NEW.result_draft_version_id AND layer='draft');
END;

CREATE TRIGGER publication_event_versions_must_match_layers
BEFORE INSERT ON publication_events
BEGIN
  SELECT RAISE(ABORT,'publication event versions must match project layers')
  WHERE NOT EXISTS (SELECT 1 FROM project_versions WHERE project_id=NEW.project_id AND id=NEW.from_published_version_id AND layer='published')
     OR NOT EXISTS (SELECT 1 FROM project_versions WHERE project_id=NEW.project_id AND id=NEW.to_published_version_id AND layer='published')
     OR (NEW.source_draft_version_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM project_versions WHERE project_id=NEW.project_id AND id=NEW.source_draft_version_id AND layer='draft'
     ));
END;
