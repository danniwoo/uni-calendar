import { getChatGPTUser } from "../../chatgpt-auth";
import { importSemester } from "@/lib/importer";
export async function POST(request: Request) {
  if (!(await getChatGPTUser()))
    return Response.json(
      { error: "Sign in to import your timetable.", signIn: true },
      { status: 401 },
    );
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 2000)
      throw new Error("Please paste only the timetable URL.");
    const { url } = JSON.parse(body);
    if (typeof url !== "string") throw new Error("Enter your timetable URL.");
    return Response.json(
      { semester: await importSemester(url) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Import failed. Try again.",
      },
      { status: 400 },
    );
  }
}
