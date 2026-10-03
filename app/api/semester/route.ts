import { getChatGPTUser } from "../../chatgpt-auth";
import { database } from "@/lib/storage";
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
    return Response.json(
      {
        semester: row ? JSON.parse(row.data) : null,
        revision: row?.revision || 0,
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
    const { semester, revision } = JSON.parse(body);
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
    const result = await database()
      .prepare(
        "INSERT INTO semesters (owner, data, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(owner) DO UPDATE SET data = excluded.data, revision = semesters.revision + 1, updated_at = excluded.updated_at WHERE semesters.revision = ?",
      )
      .bind(
        user.userId,
        JSON.stringify(semester),
        new Date().toISOString(),
        revision,
      )
      .run();
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
