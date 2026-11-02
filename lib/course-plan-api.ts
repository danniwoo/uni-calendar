import {PlanError,type SharedFilter} from "./course-plan";
import {changeCoursePlan,readCoursePlan,readFriends,readSharedPlans} from "./course-plan-store";

import {planningYear} from "./friend-invitation";
import {sydneyDate} from "./semester";

export async function coursePlanResponse(request:Request,owner:string|null,getDatabase:()=>D1Database) {
  const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","Vary":"Cookie"}});
  if(!owner)return reply({error:"Sign in to use course plans and friends.",signIn:true},401);
  try {
    if(request.method==="GET") {
      const params=new URL(request.url).searchParams,scope=params.get("scope"),after=params.get("after")??"";
      if(scope&&scope!=="friends"&&scope!=="shared")throw new PlanError("Invalid course-plan view.");
      if(scope==="friends")return reply(await readFriends(getDatabase(),owner,after));
      const year=params.has("year")?Number(params.get("year")):planningYear(sydneyDate(new Date()),null);
      if(!Number.isInteger(year)||year<2000||year>2100)throw new PlanError("Choose a year between 2000 and 2100.");
      const filter:SharedFilter={year};
      const session=params.get("session"),friend=params.get("friend"),code=params.get("code");
      if(session){if(session!=="S1C"&&session!=="S2C")throw new PlanError("Choose Semester 1 or 2.");filter.session=session;}
      if(friend){if(!/^[a-f0-9-]{36}$/.test(friend))throw new PlanError("Choose a valid friend.");filter.friend=friend;}
      if(code){if(!/^[A-Z]{4}\d{4}$/.test(code))throw new PlanError("Choose a valid unit.");filter.code=code;}
      return reply(scope==="shared"?await readSharedPlans(getDatabase(),owner,filter,after):await readCoursePlan(getDatabase(),owner,filter));
    }
    if(request.method!=="POST")return reply({error:"Method not allowed."},405);
    if(request.headers.get("sec-fetch-site")==="cross-site" || request.headers.get("origin") && request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Invalid origin."},403);
    if(!request.headers.get("content-type")?.split(";")[0].trim().match(/^application\/json$/i))return reply({error:"Expected JSON."},415);
    const text=await request.text();
    if(text.length>12000)return reply({error:"This request is too large."},413);
    let body:unknown;
    try {body=JSON.parse(text);}catch{return reply({error:"Invalid request."},400);}
    return reply(await changeCoursePlan(getDatabase(),owner,body));
  } catch(error) {
    if(error instanceof PlanError){const response=reply({error:error.message},error.status);if(error.retryAfter)response.headers.set("Retry-After",String(error.retryAfter));return response;}
    return reply({error:"Course plans are temporarily unavailable. Retry without closing your edits."},503);
  }
}
