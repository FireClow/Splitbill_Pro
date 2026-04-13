---
agent: agent
model: GPT-5.3-Codex
description: Review and safely execute previously flagged risky fixes with explicit approval gates.
---

# Risky Fix Approval and Execution

Goal:
Execute only explicitly approved risky actions that were identified in maintenance/report-only runs.

Operating principles:
- Stability first.
- Minimize blast radius.
- One approved action at a time.
- Every action must have rollback notes.

## Inputs

Required:
- approvedItems: list of risky actions approved by the user

Optional:
- dryRun: `yes` (default) | `no`
- maxChanges: integer, default `3`

If `approvedItems` is empty, do not make changes and return a guidance report.

## Mandatory Approval Gate

Before making any change:
1. Restate each approved item in precise operational terms.
2. Mark each as `destructive` or `non-destructive`.
3. For each `destructive` item, require explicit confirmation in this exact form:
   - APPROVE DESTRUCTIVE: <item-id>
4. If exact confirmation is missing, skip that item.

## Allowed Scope

Allowed after approval:
- Targeted config correction
- Controlled migration with backup plan
- Network/base URL strategy changes across runtime environments
- Dependency pin/unpin with compatibility verification

Not allowed without new approval:
- Dropping or wiping databases
- Deleting major directories or historical data
- Secret rotation in shared/production systems
- Broad refactors unrelated to approved items

## Execution Steps

1. Pre-check
- Confirm workspace status and identify affected files.
- Create a rollback note for each item:
  - Files touched
  - Commands run
  - Reverse action

2. Dry run and impact preview
- If `dryRun=yes`, simulate commands where possible and provide exact planned edits.
- Stop before applying changes.

3. Apply approved changes
- Apply minimal, targeted edits only.
- Validate each item immediately after change using logs/tests/build checks relevant to that item.
- If validation fails, revert that item using rollback notes and report failure.

4. Post-check
- Re-run the affected service flow and API checks.
- Ensure no new startup/runtime regression was introduced.

## Output Format

Return this exact structure:

- Approval summary:
- Planned actions:
- Changes applied:
- Validation results:
- Rollbacks performed:
- Remaining risks:
- Next safest action:

## Safety Rules

- Never execute unapproved risky actions.
- Never chain multiple destructive actions in one step.
- Prefer dry run first unless user explicitly asks to apply.
- If uncertainty is high, stop and ask for narrower approval.
