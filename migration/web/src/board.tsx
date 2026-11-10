import {createRoot} from "react-dom/client";
import {CalendarDays} from "lucide-react";
import SemesterBoard from "../../../components/semester-board";
import {pilotClient} from "./auth.js";
import {readConfig} from "./config.js";
import {createApi} from "./api.js";
import "../../../app/globals.css";
import "../../../app/board.css";
import "../../../app/navigation.css";

const root=createRoot(document.getElementById("app")!);
const config=readConfig(import.meta.env);
if (!config.ready) {
  root.render(<main>Semester is not configured. <a href="/">Open account setup</a></main>);
} else {
  const client=pilotClient(config);
  const api=createApi(config.apiUrl);
  let subject:string|undefined;
  let active:AbortController|undefined;
  root.render(<main>Opening your semester…</main>);
  client.auth.onAuthStateChange((_event,session)=>{
    if (!session) {
      active?.abort();
      subject=undefined;
      root.render(null);
      location.replace("/");
      return;
    }
    if (subject===session.user.id) return;
    active?.abort();
    const controller=new AbortController();
    active=controller;
    subject=session.user.id;
    const owner=subject;
    const request=async (init?:RequestInit)=>{
      const {data,error}=await client.auth.getSession();
      if (error || data.session?.user.id!==owner || controller.signal.aborted) throw new Error("Your account changed. Open your semester again.");
      const response=await fetch(config.apiUrl+"/v1/imported/board",{
        ...init,signal:controller.signal,redirect:"error",cache:"no-store",credentials:"omit",
        headers:{...init?.headers,Authorization:`Bearer ${data.session.access_token}`},
      });
      if (response.ok) return response;
      const problem=await response.json();
      return Response.json({error:problem.error?.message ?? "Could not access this semester."},{status:response.status});
    };
    void api.session(session,controller.signal).then(async status=>{
      if(controller.signal.aborted||subject!==owner)return;
      if(!status.access.enrolled){root.render(<main>Opening your invitation page…</main>);location.replace("/");return;}
      const isAdmin=await api.adminSession(session,controller.signal).then(()=>true).catch(()=>false);
      if(controller.signal.aborted||subject!==owner)return;
      const header=<header className="app-header">
        <a className="app-brand" href="/board/"><CalendarDays aria-hidden="true"/><span>semester</span></a>
        <span>My semester</span>{isAdmin&&<a href="/admin/" style={{marginLeft:"auto"}}>Admin</a>}<a href="/?tools=1" style={isAdmin?undefined:{marginLeft:"auto"}}>Account &amp; backups</a>
      </header>;
      root.render(<SemesterBoard key={owner} staging={{request,header}}/>);
    }).catch(()=>{if(!controller.signal.aborted&&subject===owner){root.render(<main>Semester access could not be verified. <a href="/">Return to your account</a></main>);}});
  });
}
