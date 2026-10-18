# Changelog

Semester Connect uses Semantic Versioning independently of Semester Web. During 0.x, incompatible changes increment the minor version and are documented. Bug fixes increment patch. Published build numbers are not reused.

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
