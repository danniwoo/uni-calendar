import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";
import {coursePlanTestDb} from "../course-plan-test-db.ts";
import {changeCoursePlan} from "../../lib/course-plan-store.ts";
import {coursePlanResponse} from "../../lib/course-plan-api.ts";
import {accountResponse} from "../../lib/account.ts";
import {calendarFixture} from "../fixtures/calendar-visibility.ts";
const repo=fileURLToPath(new URL("../../",import.meta.url));
const {db,sqlite}=coursePlanTestDb();
for(const owner of ["alice","bob"])await changeCoursePlan(db,owner,{action:"save-profile",name:`Sample ${owner}`,sharing:owner==="bob",revision:0});
for(const [owner,code,name] of [["alice","ISYS2120","Data and Information Management"],["alice","COMP2022","Models of Computation"],["bob","ISYS2120","Data and Information Management"],["bob","COMP3027","Algorithm Design"]])await changeCoursePlan(db,owner,{action:"save-plan",id:null,revision:0,plan:{university:"usyd",code,name,year:2027,session:"S1C",status:"planned",credits:6}});
for(const [owner,code,credits,finalMark,finalGrade] of [["alice","COMP1001",6,80,"DI"],["alice","COMP1002",12,70,"CR"],["bob","ELEC1001",6,92,"HD"]])await changeCoursePlan(db,owner,{action:"save-plan",id:null,revision:0,plan:{university:"usyd",code,name:"Synthetic completed unit",year:2026,session:"S1C",status:"completed",credits,finalMark,finalGrade,wamExcluded:false}});
// Opt-in disposable larger dataset for pagination QA; never connects to hosted storage.
if(process.env.SEMESTER_QA_SCALE==="1") {
  for(let i=0;i<55;i++) {
    const owner=`scale-${String(i).padStart(2,"0")}`;
    await changeCoursePlan(db,owner,{action:"save-profile",name:`Sample friend ${String(i).padStart(2,"0")}`,sharing:true,revision:0});
    sqlite.prepare("INSERT INTO friendships(id,a,b,requester,status,revision) VALUES(?, 'alice', ?, ?, 'accepted', 1)").run(crypto.randomUUID(),owner,owner);
    for(const session of ["S1C","S2C"])for(const code of ["ISYS2120","COMP3027"])await changeCoursePlan(db,owner,{action:"save-plan",id:null,revision:0,plan:{university:"usyd",code,name:"Synthetic shared unit",year:2027,session,status:"planned",credits:6}});
  }
}
export default defineConfig({root:fileURLToPath(new URL("./",import.meta.url)),plugins:[react(),{
  name:"synthetic-course-plan-api",
  configureServer(server){
    server.httpServer?.once("close",()=>sqlite.close());
    server.middlewares.use(async(req,res,next)=>{
      const path=new URL(req.url,"http://localhost").pathname;
      if(!["/api/course-plan","/api/account","/api/semester"].includes(path))return next();
      try {
        const chunks=[];for await(const chunk of req)chunks.push(chunk);
        const owner=req.headers.cookie?.match(/(?:^|; )qa_actor=(alice|bob|eve)/)?.[1]??"alice";
        const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,...(req.method==="POST"?{body:Buffer.concat(chunks)}:{})});
        const response=path==="/api/semester"?(req.method==="GET"?Response.json({semester:calendarFixture,revision:1,recovery:null}):Response.json({error:"This sample board is read-only."},{status:403})):path==="/api/account"?await accountResponse({owner,email:`${owner}@example.test`},()=>db,new URL(request.url).searchParams.get("after")??""):await coursePlanResponse(request,owner,()=>db);
        res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(await response.text());
      }catch(error){res.statusCode=500;res.end(JSON.stringify({error:"Synthetic QA server failed."}));console.error(error);}
    });
  },
}],resolve:{alias:{"@":repo}},server:{host:"127.0.0.1",fs:{allow:[repo]},watch:{ignored:["**/mobile/**","**/dist/**","**/.wrangler/**","**/.git/**"]}}});
