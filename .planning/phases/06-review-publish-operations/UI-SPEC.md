# Phase 6 UI Contract

状态：`accepted`

## Surfaces

- Proposal detail becomes the review surface: module index, original value, proposed/edited value, evidence, semantic/confidence/warnings, decision badge, accept/reject/edit controls for admins, and module accept.
- Materials local navigation adds “审核发布”. It shows draft-vs-published preview, validation checklist, pending review counts, current/previous release and auditable publish/rollback actions.
- Xugu uses 作战审核 / 发布作战版本; standard projects use 变更审核 / 发布项目版本. Project names, banner, title and terms remain template-driven.

## Interaction gates

- Destructive/high-impact decisions require explicit controls and inline errors; publish requires all checklist acknowledgements and typed version label.
- Non-admins see the same factual differences but no mutation buttons. Buttons use server capability envelopes, never client role assumptions alone.
- Editing is field-bound JSON-safe form input; no code editor, raw proposal JSON, prompt, provider, key, SQL or component control.
- Desktop follows the Xugu top-nav/warm-canvas skeleton. Tablet uses stacked review index/detail; mobile uses local horizontal module tabs and single-column decision cards.
