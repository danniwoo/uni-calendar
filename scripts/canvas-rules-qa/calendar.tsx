// Actual board, with invented data and a tab-local save substitute. No account APIs.
import React from "react";
import SemesterBoard from "../../components/semester-board";
import {calendarFixture} from "../fixtures/calendar-visibility";
import type {Semester} from "../../lib/semester";
let installed=false;
export function CalendarQA(){
 if(!installed){installed=true;
  const nativeFetch=window.fetch.bind(window);
  const key="qa-calendar-board";
  if(!sessionStorage.getItem(key))sessionStorage.setItem(key,JSON.stringify(calendarFixture));
  window.fetch=async(input,init)=>{
   const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url,location.href);
   if(url.origin!==location.origin)throw new Error("Synthetic QA blocked an external request");
   if(url.pathname.startsWith("/api/")){
    const method=init?.method||(input instanceof Request?input.method:"GET");
    if(url.pathname!=="/api/semester")throw new Error("Synthetic QA blocked another API");
    if(method==="PUT"){
     const next=JSON.parse(String(init?.body)).semester as Semester,old=JSON.parse(sessionStorage.getItem(key)!);
     const immutable=(s:Semester)=>({...s,completed:{},tasks:s.tasks.map(({done,...t})=>t)});
     if(JSON.stringify(immutable(next))!==JSON.stringify(immutable(old)))throw new Error("Calendar interaction changed data beyond completion");
     sessionStorage.setItem(key,JSON.stringify(next));
     sessionStorage.setItem("qa-calendar-writes",String(Number(sessionStorage.getItem("qa-calendar-writes")||0)+1));
     return Response.json({revision:Number(sessionStorage.getItem("qa-calendar-writes"))+1});
    }
    if(method!=="GET")throw new Error("Synthetic QA blocked an API write");
    return Response.json({semester:JSON.parse(sessionStorage.getItem(key)!),revision:Number(sessionStorage.getItem("qa-calendar-writes")||0)+1});
   }
   return nativeFetch(input,init);
  };
 }
 return <SemesterBoard/>;
}
