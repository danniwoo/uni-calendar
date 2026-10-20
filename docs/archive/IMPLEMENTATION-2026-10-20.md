# Historical implementation digest — through 2026-10-20

**Archive, not a current plan or acceptance record.** Earlier checkpoints mixed implementation, synthetic QA, pending publication and user-test requests. Later work superseded some exclusions and defects. Use [ROADMAP](../../ROADMAP.md) for what to resume and [PROGRESS](../../PROGRESS.md) for current engineering context.

The [complete former checkpoint log is preserved verbatim here](PROGRESS-2026-10-20-full.md), including implementation details, caveats and test evidence. This digest supplements that full snapshot; it does not replace it. The original is also available in Git:

```sh
git show 0374e9c:PROGRESS.md
```

This digest provides a shorter overview; session-specific details and superseded instructions remain in the full snapshot for historical reference only. Historical `vNN` labels were deployment/checkpoint labels, not the current Web/Connect SemVer sequence. They do not prove that a user accepted a workflow.

| Period / checkpoint | What was built or changed | Carry-forward lesson |
| --- | --- | --- |
| Initial MVP / October 4 | Timetable → matching outline import, teaching weeks, assessment rules, class-linked tasks, manual edits, completion and account-scoped D1. Backup restore and concurrent-save recovery added. | Preserve source/manual distinctions; unknown schedules remain visible. |
| Early October / A/B, multi-part | Alternative semester layouts, source-rule/scope inspection, lecture preparation, recurring and multi-submission schedules. | Multiple parts need individual timing without guessed equal weights or duplicated parent totals. |
| October 13 / Month and Week | Calendar projections, daily details, sticky weekly due area, class overlap, date/location presentation, shared display preferences. | Due dates are not fake time blocks; unfinished child tasks must remain reachable. |
| October 13 / restore isolation | Full-board restore preview, explicit different-feed switch, board generations, guarded saves and one-slot recovery. | Old “no restore” / “board isolation not implemented” notes became obsolete. |
| October 14 / Subject and preparation | Subject Up next / Learning record / Assessments & requirements, preparation links into scope-linked lectures. | Developer verification is not a completed real-Quiz trial. |
| October 14 / personal items | Task / Event / Assessment entry, personal item persistence, type distinction through icons/labels/tints. | Personal tasks/events belong in Week/Month, not the semester assessment inventory. |
| October 14–15 / assessment steps | Generic demos/submissions, protected sequential-week defaults, availability, parent editing, child navigation, add submission deadline, cancellation and undo. | “Sprint” is not a universal concept; keep activity and deadline meanings separate. |
| October 18 / assessment inventory | Search/filter/sort table, week grouping in schedule mode, compact Overview, hide recurring, per-unit context. | Inventory/editing and calendar scheduling are different jobs over shared records. |
| October 18 / grades | Overall grades, single-unit statistics/targets; subsequent source includes individual-part grade plans. | Old “grades deferred” notes are superseded. Blank scores are not zero; statistical meaning needs user validation. |
| October 18 / Connect 0.1.0 | Manual, read-only single-course Chrome preview with restricted permissions and conservative grade handling. | Not an automatic sync or Web Store release. |
| October 20 / Web 0.2.0 | Optional activity week/date/range independent from submission due. | No forced split or duplicate grade. |
| October 20 / Web 0.3.0 + Connect 0.2.0 | Multi-course export and explicit reviewed import, mapping, protected manual fields and provisional group grades. | Real four-course comparison remained required. |
| October 20 / Web 0.4.0 + Connect 0.2.1 | Remembered mappings, source-owned grade updates, stale/manual/delete protection; checkbox fixes and Canvas loading-wrapper score fix. | Reload extension and read afresh; synthetic success does not prove live-course acceptance. |

The current roadmap keeps unresolved user trials visible rather than silently treating all these implementation milestones as “done”.
