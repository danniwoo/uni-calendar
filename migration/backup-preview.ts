import { backupText, readBackup } from "../lib/backup";

// Both the browser preview and the SQLite rehearsal use the web app's reader.
// Only counts leave this function. The input can contain grades and personal notes.
export function previewBackup(text: string) {
  if (text.length > 1_500_000) throw new Error("This file exceeds the web backup limit.");
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error("Choose a valid JSON file."); }
  if (raw?.format === "semester-course-plan") {
    throw new Error("This is a course-plan export. Choose the saved-semester backup for this check.");
  }
  const board = readBackup(text);
  const expected = JSON.stringify({...raw, feedUrl: ""});
  const restored = JSON.stringify(JSON.parse(backupText(board)));
  if (restored !== expected) throw new Error("The restored board differs from the export. Review before importing.");
  return {
    term: `${board.year} · ${board.session}`,
    units: board.units.length,
    weeks: board.weeks.length,
    classes: board.classes.length,
    outlineAssessments: board.units.reduce((count, unit) => count + unit.assessments.length, 0),
    workItems: board.tasks.length,
    withoutDate: board.tasks.filter(task => !task.date).length,
    withGradesOrPlans: board.tasks.filter(task => task.grade != null || task.gradePlan != null).length,
    completionEntries: Object.keys(board.completed).length,
    canvasMappings: board.canvasImports?.length ?? 0,
    canvasHistoryBatches: board.canvasHistory?.length ?? 0,
  };
}
