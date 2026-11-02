import {getChatGPTUser} from "../../chatgpt-auth";
import {database} from "@/lib/storage";
import {coursePlanResponse} from "@/lib/course-plan-api";

async function handle(request:Request) {
  const user=await getChatGPTUser();
  return coursePlanResponse(request,user?.userId??null,database);
}
export const GET=handle;
export const POST=handle;
