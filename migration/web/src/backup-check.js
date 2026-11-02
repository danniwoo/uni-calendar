import { previewBackup } from "../../backup-preview.ts";

const labels = {
  units: "Units", weeks: "Weeks", classes: "Classes", outlineAssessments: "Unit outline assessments",
  workItems: "Work items", withoutDate: "Work items without an exact date", withGradesOrPlans: "Work items with marks or a grade plan",
  completionEntries: "Completion entries", canvasMappings: "Canvas mappings", canvasHistoryBatches: "Reviewed Canvas import batches",
};

export function backupCheckPanel() {
  const panel = document.createElement("section");
  panel.className = "panel";
  const heading = document.createElement("h2");
  heading.textContent = "Check a website backup";
  const help = document.createElement("p");
  help.textContent = "Choose a saved-semester JSON to check its contents on this device. Previewing it leaves your cloud semester as it is.";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.setAttribute("aria-label", "Choose a saved-semester JSON for local preview");
  const result = document.createElement("div");
  result.setAttribute("aria-live", "polite");
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    result.replaceChildren();
    if (!file) return;
    try {
      if (file.size > 6_000_000) throw new Error("This file exceeds the web backup limit.");
      const summary = previewBackup(await file.text());
      if (input.files?.[0] !== file || !panel.isConnected) return;
      const title = document.createElement("p");
      title.textContent = `Semester ${summary.term} passed the web restore check.`;
      const list = document.createElement("ul");
      for (const [key, label] of Object.entries(labels)) {
        const item = document.createElement("li");
        item.textContent = `${label} · ${summary[key]}`;
        list.append(item);
      }
      result.append(title, list);
    } catch (error) {
      if (input.files?.[0] === file && panel.isConnected) result.textContent = error.message || "Could not read this backup.";
    }
  });
  panel.append(heading, help, input, result);
  return panel;
}
