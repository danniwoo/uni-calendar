# Canvas matching: user needs and acceptance

Updated 2026-10-26. Implementation reference for [CONNECT-01 / CONNECT-02](../ROADMAP.md#connect-01), not a separate priority list. Web 0.11.0's group-map presentation failed the user's ease-of-use expectation; 0.12.0 replaces it with the task-first flow below. Real-user acceptance remains outstanding.

## Primary flow

Check selected courses → see actual changed results → resolve only uncertain links → review changes → explicitly confirm → revisit saved update history.

JSON and direct checks use the same parser, identity-based matcher and import planner. A Canvas group is a source category, not an additional assessment. Its items retain their original names and independent marks.

| User story | Experience / acceptance | Current status |
| --- | --- | --- |
| As a returning student, I want to see what changed without matching everything again. | Saved account/course/item IDs restore confirmed links; returning preview leads with old → new grades. Unchanged rows and optional matching stay collapsed. No automatic save. | Implemented; synthetic regression and browser checks. |
| As a student checking grades, I want to know whether I need to do anything. | Show changed grades and released results needing a destination; keep old/ungraded backlog under optional connection management. No-change checks do not ask me to review zero changes. | Implemented; synthetic empty/update/new-result checks. |
| As a student comparing Canvas with my assessment list, I want to understand where each result goes. | One course at a time, compact original Canvas item/result rows, then destination assessment plus weight. Group headers are context, not a second matching task. Confirmed links remain inspectable even in the unconnected filter. | Implemented; filtered-context regression. |
| As a first-time importer, I want useful suggestions without silently choosing the wrong demo or report. | Saved links and unique exact matches can be prepared automatically. Similar names are suggestions, with destination weights; other suggestions are collapsed. The user reviews before saving. | Implemented; ambiguous/fuzzy matches remain opt-in. |
| As a student with weekly entries, I want to select several and put them under one assessment. | Choose Connect several, select sources, choose the familiar assessment first, then its calculation method or existing confirmed rule. One result can instead connect to the whole assessment. Only selected sources are staged and remain reversible. | Implemented for new Canvas-owned individual entries and supported saved rules; unsupported averaging stays blocked. |
| As a student with an approved extension, I want new Canvas grades without losing my new deadline. | Grade updates preserve my date, time, notes and other task fields, through JSON and direct checks alike. No write back to Canvas. | Added regression for a manually extended deadline; user reported Week-view editing was smooth, not an end-to-end import acceptance. |
| As a student who already typed a grade, I want to know whether Canvas differs without losing my work. | Show Canvas beside the Semester value and mark the manual value protected. Cancel performs no write. | Protection and preview comparison implemented. Explicit replacement/acceptance workflow is not yet implemented. |
| As a student with an existing manual Week 2 entry, I want to link that exact entry instead of duplicating it. | Choose existing child, retain manual and incoming values, explicitly accept a difference if wanted; future updates follow the confirmed source ID. Repair an accidental whole-assessment link through a reviewed operation. | Not implemented: next design/implementation increment within CONNECT-01, requiring provenance, conflict and persistence tests. Do not silently convert existing links. |
| As a student interrupted during review, I want to undo a choice and find confirmed updates later. | Rows stay visible after selection; Undo restores the choice; “skipped this check” does not delete a saved link. Confirmed imports have bounded update history; pending previews remain temporary with JSON fallback. | Implemented; no history or grade writes on preview/cancel. |

## Group versus individual item

Illustrative structure (not an inferred course policy):

| Canvas group | Independent Semester assessments |
| --- | --- |
| Scope & Proposal · 10% | Presentation · 5%; Report · 5% |
| Final Reports & Demos · 60% | Final report · 40%; client demo · 10%; class demo · 10% |

The actual UI displays full source group/item names, including auxiliary items such as peer review or artifacts. Matching is per item. A group label containing “60%” does not imply that every item has a numeric result or that marks should be merged. A hidden result out of zero is not a confirmed zero grade.

## Safety and non-goals

- Keep names, dates, weights, notes, calendar completion and manual grades unchanged during preview.
- Missing, hidden, not-taken and unlinked results remain unknown; only an explicitly confirmed supported rule may convert an outcome.
- Same-group membership is not evidence for the calculation rule. In particular, do not copy another unit's best-N policy.
- Linking individual grades does not create calendar submissions. Schedule steps and grade entries remain separate concepts; a unified terminology/entry-link design is not delivered by this change.
- No drag-and-drop-only interaction, broad automatic fuzzy matching, automatic confirmation, or notification centre.

## Repeatable developer and user checks

- `node --import tsx scripts/check-canvas-match-view.ts`: distinct targets/weights, auxiliary/missing groups, saved/skipped statuses, future blank → numeric result, JSON/direct parity, idempotence and fuzzy-match caution.
- `npx vite --config scripts/canvas-rules-qa/vite.config.mjs --port 5184`, then `http://127.0.0.1:5184/?matching`: invented in-memory board. Verify one changed grade; inspect group map; skip/restore a saved link; select and Undo a candidate; select two weekly sources; block drop-rule points averaging; stage an explicit rule; cancel with **Test writes: 0**.
- T11 user check: use a fresh four-course preview, inspect independent report/demo destinations and protected values, try one selection and Undo, then cancel. Do not confirm real imports as part of the test.
