import { previewBackup } from "../../backup-preview.ts";

const labels = {
  units: "Units", weeks: "Weeks", classes: "Classes", outlineAssessments: "Unit outline assessments",
  workItems: "Work items", withoutDate: "Work items without an exact date", withGradesOrPlans: "Work items with marks or a grade plan",
  completionEntries: "Completion entries", canvasMappings: "Canvas mappings", canvasHistoryBatches: "Reviewed Canvas import batches",
};

export function backupCheckPanel({ accountId, email, request }) {
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
  const view = document.createElement("button");
  view.type = "button";
  view.textContent = "Check my staging restore point";
  const saved = document.createElement("p");
  saved.setAttribute("aria-live", "polite");
  view.onclick = async () => {
    view.disabled = true;
    try {
      const data = await request();
      if (!panel.isConnected) return;
      const summary = previewBackup(data);
      saved.textContent = `Saved in D1 · ${summary.term} · ${summary.workItems} work items, ${summary.withoutDate} without an exact date, ${summary.withGradesOrPlans} with grades or plans, ${summary.completionEntries} completion entries.`;
    } catch (error) { if (panel.isConnected) saved.textContent = error.message; }
    finally { view.disabled = false; }
  };
  const download = document.createElement("button");
  download.type = "button";
  download.textContent = "Download my staging re-export";
  download.onclick = async () => {
    download.disabled = true;
    try {
      const data = await request();
      if (!panel.isConnected) return;
      const url = URL.createObjectURL(new Blob([data], {type: "application/json"}));
      const a = document.createElement("a");
      a.href = url; a.download = "semester-staging-reexport.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { if (panel.isConnected) result.textContent = error.message; }
    finally { download.disabled = false; }
  };
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    result.replaceChildren();
    if (!file) return;
    try {
      if (file.size > 6_000_000) throw new Error("This file exceeds the web backup limit.");
      const text = await file.text();
      const summary = previewBackup(text);
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
      const submit = document.createElement("button");
      submit.type = "button";
      submit.textContent = `Import into ${email} · staging`;
      const note = document.createElement("p");
      note.textContent = `Account ${accountId.slice(0, 8)}… · This saves one private restore point. Your sample semester stays separate.`;
      submit.onclick = async () => {
        if (!panel.isConnected || input.files?.[0] !== file) return;
        submit.disabled = input.disabled = true;
        try {
          const receipt = await request(text);
          if (!panel.isConnected) return;
          const exported = await request();
          if (!panel.isConnected) return;
          if (text !== exported) throw new Error("The re-export differs from the selected file. Keep the original.");
          note.textContent = `${receipt.created ? "Imported" : "Already imported"} · fresh D1 re-export matches the selected file. SHA-256 ${receipt.sha256.slice(0, 12)}…`;
        } catch (error) { if (panel.isConnected) note.textContent = error.message; }
        finally { submit.disabled = input.disabled = false; }
      };
      result.append(note, submit);
    } catch (error) {
      if (input.files?.[0] === file && panel.isConnected) result.textContent = error.message || "Could not read this backup.";
    }
  });
  panel.append(heading, help, input, result, view, saved, download);
  return panel;
}
