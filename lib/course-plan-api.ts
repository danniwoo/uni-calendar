import {PlanError} from "./course-plan";
import {changeCoursePlan,readCoursePlan} from "./course-plan-store";

export async function coursePlanResponse(request:Request,owner:string|null,getDatabase:()=>D1Database) {
  const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","Vary":"Cookie"}});
  if(!owner)return reply({error:"Sign in to use course plans and friends.",signIn:true},401);
  try {
    if(request.method==="GET")return reply(await readCoursePlan(getDatabase(),owner));
    if(request.method!=="POST")return reply({error:"Method not allowed."},405);
    if(request.headers.get("sec-fetch-site")==="cross-site" || request.headers.get("origin") && request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Invalid origin."},403);
    if(!request.headers.get("content-type")?.split(";")[0].trim().match(/^application\/json$/i))return reply({error:"Expected JSON."},415);
    const text=await request.text();
    if(text.length>12000)return reply({error:"This request is too large."},413);
    let body:unknown;
    try {body=JSON.parse(text);}catch{return reply({error:"Invalid request."},400);}
    return reply(await changeCoursePlan(getDatabase(),owner,body));
  } catch(error) {
    return error instanceof PlanError?reply({error:error.message},error.status):reply({error:"Course plans are temporarily unavailable. Retry without closing your edits."},503);
  }
}
