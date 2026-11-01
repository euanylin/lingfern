# Material-based reading and listening practice

This document describes current generation, persistence and workspace behavior. User steps are in [the user guide](user-guide.md); layout rules are in [Interface_Design.md](../Interface_Design.md). Current release status belongs to [the handoff](../DEVELOPMENT_HANDOFF.md).

## Generation and source limits

`src/core/practiceOrganization.ts` organizes eligible ordinary practice into a saved `organization: material-v1` snapshot. Test uses that same material/question/scoring snapshot through `asTestLesson`; it does not generate a replacement. Saved lessons are not rewritten merely to change their presentation. Strict independent checks keep their original organization and restrictions.

Organization follows existing rights, exclusions, holds, source eligibility, history, seed, two-root and focus selection. Stable source-coordinate question IDs and final schema validation preserve exact evidence. Additional candidates use existing reviewed completion, choice, evidence, date-table and sequencing rules; unsupported inference templates are not invented.

`src/shared/practiceQuantity.ts` owns the current quantity bands and listening spacing. Counts are **answer points**, including gaps, rows and matching pairs, rather than question groups. Reading budgets derive from usable word count; listening budgets derive from actual recording duration. Session limits are 12 reading or 20 listening answer points. Selection distributes usable points, avoids repeated evidence, respects requested types and keeps whole groups intact. Unsupported types, sparse evidence, complexity, timing or the session budget can reduce the result; the snapshot's quantity report records those reasons. These are effort heuristics, not calibrated CEFR or examination scores.

Listening reuses installed, qualified audio and its exact hashes/duration. Matching clip transcripts and retained segments supply alignment when available. Other sentence ranges use bounded proportional estimates explicitly labelled `audioTiming: estimated`, with extra spacing allowance; they are not word-level timestamps. Overlapping groups, missing slot timing and insufficient response spacing are rejected. Aligned multi-gap extracts require valid source/audio segment bounds and reconstruct their source text when answers are substituted. No new recordings, padding or time-stretching are introduced to fill a question target.

## Answers, scoring and recovery

`gap-fill` stores source-preserving `{{g1}}` markers, stable gap IDs, accepted forms, word limits and exact text evidence with optional audio bounds. Validation checks marker uniqueness, reconstruction, answer/source references and bounded timing. Other question types retain their schemas and scoring rules. `scoreParts` reports individual gap/row/pair results; original whole-group correctness remains available to record consumers. Open responses are unscored. Feedback distinguishes question groups, blanks and answer points without converting them to proficiency scores.

`Session.workspace` stores per-question drafts, selection, skipped open responses and material-level assistance. Shared operations in `src/data/db.ts` validate question ownership and references. Queued writes and per-question revisions prevent late saves from replacing newer input. Navigation does not submit an answer; skipping retains drafts without creating a scored attempt. The final transaction validates responses and required listening exposure, writes deterministic attempts and local sync events, then marks completion. Failed writes retain recoverable drafts and retries do not duplicate records. Remote synchronization cannot roll back that local transaction.

Backup/import validates workspace shape and references and retains old snapshots. Record deletion removes associated drafts and annotations. Legacy sequential data APIs reject material-workspace sessions to prevent partial completion; their remaining compatibility and strict-check guards must not be removed as unused UI code.

## Shared responsive interaction

`Learning.tsx` opens the shared `MaterialWorkspace.tsx` after session ownership and strict-check entry guards. `QuestionInputs.tsx` reuses shared fields, options and `SettingsPicker`. Existing saved lessons use this workspace without changing their material, answers or scoring.

- **Desktop Reading:** the article follows document scrolling. The sticky answer card has its own internal scroll area; the article is not a second internal scroller. Card height uses the grid's document coordinate and shared bottom clearance, so ordinary scrolling does not resize it. Short desktop screens use document flow.
- **Narrow Reading:** the bottom peek expands into the answer sheet. Its initial height is approximately 70% of the available viewport; the handle permits resizing within measured bounds below the session header. Material, Escape and outside actions close it. Collapsed answer content is inert. Keyboard/zoom bounds and reserved peek clearance keep content reachable without chasing focus during native scrolling.
- **Listening:** a maximum-760px normal page column shows all groups for the current recording, with a sticky player above them. Short screens let the player flow naturally. Numbered navigation scrolls a noneditable target below the player and preserves the native audio node. Replay/seeking remain available, while completed-playback acceptance follows the saved mode's rules.

Both skills keep freely selectable numbered navigation, 44px controls, visible keyboard focus, reduced-motion behavior, autosaved drafts and atomic submission. Selecting a navigation number locates the question without opening an input; selecting its answer area activates editing. Saved material positions survive navigation.

Practice exposes permitted dictionary support and the three goal/clue/language hints, while teaching examples remain in the guidance disclosure. Test withholds dictionary, hints, examples, self-assessment and AI. Answers and explanations appear only after completion; Practice may then offer self-assessment and AI handoff. Strict independent-check snapshots preserve their original no-assistance, unfamiliarity, original-device and delayed-feedback constraints.

## Verification references

Current regressions cover organization/quantity/spacing, schema validation, scoring, workspace persistence, backup/import, mode restrictions, navigation and responsive layout. Follow [AGENT_WORKFLOW.md](../AGENT_WORKFLOW.md) to choose checks for a change. The full local audit (local evidence: `docs/history/2026-11-01-full-local-audit.md`) records its actual environment and failure corrections; editing this document does not rerun those tests or establish new device/provider acceptance.
