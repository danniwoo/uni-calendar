import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import SemesterBoard from "../../components/semester-board";
import {attemptsFixture} from "../fixtures/assessment-attempts";
import "../../app/globals.css";
import "../../app/board.css";
let installed=false;
function AttemptsQA(){const [revision,setRevision]=useState(Number(sessionStorage.getItem("qa-attempts-revision")||1));if(!installed){installed=true;
 const key="qa-attempts-board",native=window.fetch.bind(window);
 if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,JSON.stringify(attemptsFixture));localStorage.setItem("semester-view","assessments");}
 window.fetch=async(input,init)=>{const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url,location.href);
  if(url.origin!==location.origin)throw new Error("Synthetic QA blocked external request");
  if(url.pathname.startsWith("/api/")){
   if(url.pathname!=="/api/semester")throw new Error("Synthetic QA blocked other API");
   const method=init?.method||"GET",rev=Number(sessionStorage.getItem("qa-attempts-revision")||1);
   if(method==="PUT"){const body=JSON.parse(String(init?.body));sessionStorage.setItem(key,JSON.stringify(body.semester));sessionStorage.setItem("qa-attempts-revision",String(rev+1));setRevision(rev+1);return Response.json({revision:rev+1});}
   if(method!=="GET")throw new Error("Synthetic QA blocked write");
   return Response.json({semester:JSON.parse(sessionStorage.getItem(key)!),revision:rev});
  }return native(input,init);
 };
 }
 return <><output aria-label="Synthetic attempts diagnostics" style={{display:"block",padding:8,fontSize:12}}>Synthetic data only · saved revision {revision} · no real account or notifications</output><SemesterBoard/></>;
}
createRoot(document.getElementById("root")!).render(<AttemptsQA/>);
