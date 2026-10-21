import { getChatGPTUser } from "../../chatgpt-auth";
import { database } from "@/lib/storage";
import { upgradeSemester } from "@/lib/importer";
import { validGrade, validGradePlan, requiresGradeRuleClient } from "@/lib/grade-value";
import {activityError} from "@/lib/assessment-activity";
import {validCanvasMetadata} from "@/lib/canvas-import";
export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to load your semester.", signIn: true },
      { status: 401 },
    );
  try {
    const row = await database()
      .prepare("SELECT data, revision FROM semesters WHERE owner = ?")
      .bind(user.userId)
      .first<{ data: string; revision: number }>();
    const recovery = await database().prepare("SELECT data FROM semester_recovery WHERE owner = ?").bind(user.userId).first<{data:string}>();
    return Response.json(
      {
        semester: row ? upgradeSemester(JSON.parse(row.data)) : null,
        revision: row?.revision || 0,
        recovery: recovery ? JSON.parse(recovery.data) : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "Your saved semester could not be loaded. Please retry before making changes.",
      },
      { status: 503 },
    );
  }
}
export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to save your progress.", signIn: true },
      { status: 401 },
    );
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 1_500_000)
      return Response.json(
        { error: "This semester is too large to save." },
        { status: 400 },
      );
    const { semester, revision, syncVersion } = JSON.parse(body);
    if (
      !semester ||
      !Array.isArray(semester.tasks) ||
      !Array.isArray(semester.units) ||
      !Array.isArray(semester.weeks) ||
      !Array.isArray(semester.classes) ||
      !Number.isInteger(revision) ||
      revision < 0 ||
      semester.tasks.length > 2500 ||
      semester.units.length > 8 ||
      semester.year !== 2026
    )
      return Response.json(
        { error: "Invalid semester backup or data." },
        { status: 400 },
      );
    if ([...semester.tasks,...semester.units.flatMap((u:{assessments?:unknown[]})=>u.assessments||[])].some((t:{grade?:unknown})=>t.grade!=null&&!validGrade(t.grade)))
      return Response.json({error:"Invalid grade. Check marks earned and maximum marks before saving."},{status:400});
    if ([...semester.tasks,...semester.units.flatMap((u:{assessments?:unknown[]})=>u.assessments||[])].some((t:{gradePlan?:unknown})=>t.gradePlan!=null&&!validGradePlan(t.gradePlan)))
      return Response.json({error:"Invalid individual grades. Check the item names, marks and calculation settings."},{status:400});
    if ([...semester.tasks,...semester.units.flatMap((u:{assessments?:unknown[]})=>u.assessments||[])].some((t:{activity?:unknown})=>activityError(t.activity,semester)))
      return Response.json({error:"Invalid activity timing. Check its week or date range."},{status:400});
    // Tabs running a pre-fix bundle must reload before editing a replaced board.
    if (!validCanvasMetadata(semester)) return Response.json({error:"Invalid Canvas import links. No changes saved."},{status:400});
    // They do not understand replacement generations and could otherwise merge it back.
    const saved = await database().prepare("SELECT data, revision FROM semesters WHERE owner = ?").bind(user.userId).first<{data:string;revision:number}>();
    const previous = saved ? JSON.parse(saved.data) : null;
    if (![2,3,4,5,6,7,8].includes(syncVersion) && previous?.boardGeneration)
        return Response.json({error:"This board was restored or switched. Export unsaved edits, then reload this tab before continuing."},{status:409});
    if (![3,4,5,6,7,8].includes(syncVersion) && previous?.tasks?.some((t:{grade?:unknown})=>t.grade!==undefined))
      return Response.json({error:"This board now includes grades. Export unsaved edits, then reload this older tab before saving so grades are preserved."},{status:409});
    if (![4,5,6,7,8].includes(syncVersion) && previous?.tasks?.some((t:{gradePlan?:unknown})=>t.gradePlan!==undefined))
      return Response.json({error:"This board now includes individual grades. Export unsaved edits, then reload this older tab before saving so individual grades are preserved."},{status:409});
    if (![6,7,8].includes(syncVersion) && previous?.canvasAccountId)
      return Response.json({error:"This board includes Canvas imports. Export unsaved edits, then reload this older tab before saving so import links are preserved."},{status:409});
    if (![7,8].includes(syncVersion) && [...(previous?.tasks||[]),...(previous?.units||[]).flatMap((u:{assessments?:unknown[]})=>u.assessments||[])].some((t:{gradePlan?:unknown})=>requiresGradeRuleClient(t.gradePlan)))
      return Response.json({error:"This board includes grading rules. Export unsaved edits, then reload this older tab before saving so attempts and completion results are preserved."},{status:409});
    if (syncVersion !== 8 && previous?.canvasImports?.some((r:{rule?:unknown})=>r.rule))
      return Response.json({error:"This board includes Canvas rule mappings. Export unsaved edits, then reload this older tab so source baselines and manual outcomes are preserved."},{status:409});
    if ((saved?.revision || 0) !== revision)
      return Response.json({error:"The saved board changed. Reload or resolve the conflict before saving."},{status:409});
    const switched = previous && (previous.boardGeneration !== semester.boardGeneration || previous.feedUrl !== semester.feedUrl
      || previous.year !== semester.year || previous.session !== semester.session);
    const updatedAt = new Date().toISOString();
    const save = database()
      .prepare(
        "INSERT INTO semesters (owner, data, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(owner) DO UPDATE SET data = excluded.data, revision = semesters.revision + 1, updated_at = excluded.updated_at WHERE semesters.revision = ?",
      )
      .bind(
        user.userId,
        JSON.stringify(semester),
        updatedAt,
        revision,
      );
    // Both statements run in one D1 transaction. The same revision guard prevents
    // a stale tab from replacing the recovery copy if another save wins first.
    const result = switched ? (await database().batch([
      database().prepare("INSERT INTO semester_recovery (owner, data, updated_at) SELECT owner, data, ? FROM semesters WHERE owner = ? AND revision = ? ON CONFLICT(owner) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
        .bind(updatedAt,user.userId,revision), save,
    ]))[1] : await save.run();
    if (!result.meta.changes)
      return Response.json(
        {
          error:
            "This semester changed in another tab. Export your edits, then reload before continuing.",
        },
        { status: 409 },
      );
    return Response.json({ revision: revision + 1 });
  } catch {
    return Response.json(
      {
        error:
          "Progress was not saved. Keep this tab open and retry, or export a backup.",
      },
      { status: 503 },
    );
  }
}
