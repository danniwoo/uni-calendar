import type { Task, Unit } from "./semester";

// Only explicit, locally attributable statements are promoted to structured rules.
// Keep the verbatim section for rules the deterministic parser cannot interpret.
export function rulesSection(task: Task, unit: Unit): string {
  const summary = unit.summary;
  const start = summary.toLowerCase().indexOf(task.title.toLowerCase());
  if (start < 0) return "";
  const ends = unit.assessments.filter(t => t.id !== task.id)
    .map(t => summary.toLowerCase().indexOf(t.title.toLowerCase(), start + task.title.length))
    .filter(n => n > start);
  return summary.slice(start, ends.length ? Math.min(...ends) : undefined).replace(/<div\s*$/, "").trim();
}
export function enrichAssessment(task: Task, unit: Unit): Task {
  const section = rulesSection(task, unit);
  const text = `${task.sourceText} ${section}`;
  const parts = section.match(/;\s*(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*%/i);
  const verifiedParts = parts && +parts[1] > 1 && Math.abs(+parts[1] * +parts[2] - parseFloat(task.weight)) < 0.001 ? parts : null;
  const per = text.match(/each (?:quiz|task) worth\s*(\d+(?:\.\d+)?)\s*(?:points?|%)/i)
    || text.match(/(\d+(?:\.\d+)?)\s*%\s*per\s+(?:submission|quiz|task)/i);
  const best = text.match(/best\s+(\d+)\s*(?:of|out of|\/)\s*\d+/i);
  const threshold = text.match(/(?:at least|minimum(?: of)?)\s*(\d+)\s*%/i);
  const attempts = text.match(/highest mark of\s*(two|three|\d+)\s*(?:attempts?\s*)?counting/i);
  const coverageText = text.match(/(?:quiz|exam)\s+(?:covers|assesses)[^.]+\./i)?.[0];
  const numbered = text.match(/(?:cover\w*|test\w*|assess\w*)[^.]{0,80}weeks?\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})/i);
  const routine = /weekly|each tutorial|every tutorial|every lecture|ongoing/i.test(task.sourceText)
    || /prework|participation/i.test(task.title);
  const kind = task.kind === "exam" ? "exam" : /quiz/i.test(task.title) ? "quiz"
    : routine || /each task|per submission/i.test(text) ? "recurring" : "assessment";
  const phase = task.title.match(/proposal|progress|final/i)?.[0];
  const activity = /presentation/i.test(task.title) ? "presentation" : /report/i.test(task.title) ? "report" : "";
  const scheduleWeeks = phase && activity ? [...new Set(unit.topics.filter(t => !/lecture/i.test(t.activity)
    && t.topic.split(/\d+\.|;/).some(part => new RegExp(phase,"i").test(part) && part.toLowerCase().includes(activity)
      && !/prepar|prepare|working towards|work on|follow up|feedback|planning/i.test(part))) .map(t=>t.week))] : [];
  let sourceConflict = task.week && scheduleWeeks.length === 1 && scheduleWeeks[0] !== task.week
    ? `Assessment table: W${task.week}. Weekly schedule: W${scheduleWeeks[0]}. Confirm on Canvas/Ed before relying on this date.` : task.sourceConflict;
  const closing = task.sourceText.match(/Closing date\s*:\s*\d+\s+\w+\s+(\d{4})/i);
  if (closing && task.date && closing[1] !== task.date.slice(0,4))
    sourceConflict = "The outline's closing date has a different year to its due date. Check the source.";
  return { ...task, kind, routine, sourceConflict, rules: {
    text: section || task.description,
    perOccurrence: verifiedParts ? +verifiedParts[2] : per ? +per[1] : undefined,
    count: verifiedParts ? +verifiedParts[1] : undefined,
    total: parseFloat(task.weight) || undefined,
    bestOf: best ? +best[1] : undefined,
    threshold: task.hurdle && threshold ? +threshold[1] : undefined,
    attempts: attempts ? ({two:2, three:3}[attempts[1] as "two" | "three"] || +attempts[1]) : undefined,
    coverageText,
    optional: /optional|bonus extension/i.test(text),
  }, coverage: task.coverage || (numbered && +numbered[2] >= +numbered[1] && +numbered[2] <= 13
    ? Array.from({length:+numbered[2] - +numbered[1] + 1}, (_,i) => +numbered[1] + i) : undefined) };
}
