# Changelog

## 0.4.0 — 2026-10-24 (unpacked; live batch acceptance pending)

- Accept the fixed Semester website's **Check all N courses** request, restricted to the account/course IDs already explicitly enabled in Connect. One existing Canvas course tab is enough; no new tabs, arbitrary URLs, new permissions or automatic confirmation.
- Serialize the batch, coalesce concurrent requests, persist a one-minute batch throttle and publish a snapshot only when all selected courses succeed. Failure, interruption, account/permission changes or closing/navigating the source tab abort the batch without offering partial results.
- Keep single-course reload checks and JSON downloads. Explain why Enable is disabled. Queue bridge refreshes so a busy delivery cannot swallow the completion notification.
- Reader, lifecycle/security and four-course batch tests pass using synthetic inputs. Real installed-extension testing still requires reload and a fresh read; no live grades were imported in development.

## 0.3.0 — 2026-10-24 (unpacked; live acceptance pending)

- Add explicit opt-in reload checks for 1–8 selected USYD courses. Opening/reloading a selected course checks only that course; serialized reads and a one-minute/course throttle bound requests. No timers or Canvas writes.
- Request optional access only to USYD Canvas and the fixed Semester origin. Store consent/account/course IDs locally and pending source snapshots in session storage; expire snapshots after 24 hours, clear on disable/permission loss/account mismatch/read failure, and ignore in-flight results after navigation or disabling.
- Use a fixed-origin, top-frame bridge to Web 0.8.0's pending review. No credentials transferred, external messaging, generic URLs, automatic import or cloud grade writes. JSON export remains available without optional site access.
- Developer verification: reader and mocked lifecycle/security tests, synthetic web UI checks. Actual Chrome permission prompts and four-live-course reload delivery must still be tested by the user after deploying Web 0.8.0 and reloading Connect.

## 0.2.3 — 2026-10-20

- Require an actual numeric/text result as well as release evidence. A posted timestamp alone no longer marks an empty result as released.
- Unsubmitted work remains unsubmitted; blank pass/fail results are never inferred from numeric fallback scores or turned into zero.
- 35 Node tests and 89 browser DOMParser assertions pass, including posted-but-empty numeric/pass-fail cases.
- Existing 0.2.2 downloads still work with Semester Web 0.5.0. Reload/read/download again only to refresh the corrected release metadata; no timetable restore is needed.

## 0.2.2 — 2026-10-20

- Stop treating deprecated assignment-level `muted` as a student grade-release flag. Posted API grades and freshly confirmed Marks results can now be read even when that notification flag is true. Fresh Marks row visibility, pending-quiz, `grade_hidden` and excused checks still take priority.
- Read visible Complete/Incomplete icons and their accessibility labels as text results. Do not fabricate numerical scores or percentages; Semester Web's current calculator still imports only numeric marks.
- Distinguish numeric grades from text results in batch summaries, and explicitly label results withheld by Canvas.
- Check reader/preview/installed-manifest versions before reading and exporting; show reload/reopen instructions for mixed builds.
- Developer verification: 34 Node tests, 81 real-DOM browser assertions across four synthetic courses, preview selection/batch/filter/version-error checks and website import-protection regressions. No real account data was changed. Full installed-extension/four-live-course acceptance still requires reload and fresh comparison; restricted extension URLs prevented automated live-preview access.

## 0.2.1 — 2026-10-20

- Fix zero released grades caused by treating Canvas's initially hidden `grade-summary-content` loading wrapper as an unpublished-score signal. Actual muted/pending/hidden cells and What-If values remain excluded.
- Align course checkboxes horizontally with labels; add selected/focus states and larger clickable rows.
- Reload the unpacked extension, close old preview tabs, and read/download again. An older exported file cannot recover scores that were omitted at read time.

Semester Connect uses Semantic Versioning independently of Semester Web. During 0.x, incompatible changes increment the minor version and are documented. Bug fixes increment patch. Published build numbers are not reused.

## 0.2.0 — 2026-10-20

- Read up to eight explicitly selected teaching courses, retain successful previews, retry failed courses and download a versioned private import file for Semester Web 0.3.0.
- Verify student-course membership with the active student course list when single-course responses omit enrollment fields.
- Cross-check released numeric scores against a freshly fetched student Marks page. Ignore hidden, pending-review and What-If values; unsupported layouts are clearly reported.
- Canvas remains read-only with the same activeTab+scripting permissions. No automatic upload, background sync, cookies, token collection or extra host access.
- Website import requires mapping and confirmation and never overwrites existing manual data. Refresh the unpacked extension and reopen its preview to update.
- Synthetic tests cover four courses, failure/retry, release visibility, file export, import confirmation and existing-data protection. Live four-unit comparison remains required after reload.

## 0.1.0 — 2026-10-18

First local-only, manual read-only preview; not a Chrome Web Store release.

- USYD Canvas student course discovery and explicit single-course preview.
- Assignments, independent due/open/close dates, released marks and submission status.
- Assignment-group weights and drop rules shown as source facts, without grade forecasts.
- Sydney timezone, search, grade filter and Canvas source links.
- Active-tab permission only; no persistent grades, uploads or Semester writes.
- Safe GET allowlist, pagination, account checks, timeouts and conservative hidden-grade handling.
- SemVer shown in the extension UI; local loading and comparison guide.

Known limits: active enrollments only; no automatic syncing/import; release metadata can vary by Canvas installation. User comparison against live USYD Canvas is still required.
