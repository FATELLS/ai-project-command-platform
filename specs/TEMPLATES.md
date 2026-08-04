# Spec Kit Goal Templates

> Use these templates when starting a new Goal. Copy to `specs/<goal-id>-<slug>/`.

---

## spec.md Template

```markdown
# <Goal ID> Spec: <Goal Name>

## Objective

<One sentence describing what this Goal achieves.>

## Success Criteria

1. <Measurable criterion with evidence>
2. <Measurable criterion with evidence>
3. ...

## Failure

- <What constitutes failure>
- <Hard fails that block completion>

## Forbidden

- <What cannot be modified in this Goal>
```

---

## plan.md Template

```markdown
# <Goal ID> Plan: <Goal Name>

## Approach

1. <Step 1>
2. <Step 2>
3. ...

## Allowed Modifications

- <Files/directories that can be modified>

## Forbidden

- <Files/directories that cannot be modified>

## Key Decisions

- <Any decisions made during planning>
```

---

## tasks.md Template

```markdown
# <Goal ID> Tasks

## T001: <Task name>
- Status: pending | in_progress | done
- Owner: agent | user
- Action: <What to do>
- Result: <What was produced, filled when done>

## T002: <Task name>
- Status: pending
...
```

---

## VERIFICATION.md Template

```markdown
# <Goal ID> Verification

## Result: PASS | FAIL

## Exit Criteria Evidence

| Criterion | Evidence | Status |
|---|---|---|
| <Success criterion> | <Command/output/link> | ✅/❌ |

## Commands Run

\`\`\`bash
<command 1>
<output summary>

<command 2>
<output summary>
\`\`\`

## Scope Check

- Allowed modifications respected: ✅/❌
- No forbidden files touched: ✅/❌
- git diff --check passes: ✅/❌
- No artifacts in git: ✅/❌

## Documentation Updated

- [ ] DESIGN-CHANGELOG.md appended
- [ ] EXECUTION-STATE.md updated
- [ ] HANDOFF.md updated
```

---

## Goal Workflow

```
1. Read mandatory context (AGENTS.md reading order)
2. Create specs/<goal-id>-<slug>/ with spec.md, plan.md, tasks.md
3. Execute tasks one by one
4. Write VERIFICATION.md
5. Update docs/changes/ (DESIGN-CHANGELOG, EXECUTION-STATE, HANDOFF)
6. Commit with Goal ID in message
7. User confirms → unlock next Goal
```
