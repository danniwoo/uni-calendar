// Actual board UI with a synthetic, tab-local persistence substitute. No API traffic.
import React from "react";
import SemesterBoard from "../../components/semester-board";
import {fixtureBoard,fixtureBundle,fixtureChoices} from "../fixtures/canvas-connect";
import {confirmCanvasImport} from "../../lib/canvas-history";

let installed=false;
export function HistoryQA(){
  if(!installed){
    installed=true;
    const nativeFetch=window.fetch.bind(window);
    const seed=confirmCanvasImport(structuredClone(fixtureBoard),fixtureBundle,[fixtureChoices[0],fixtureChoices[2]],"synthetic-history").semester;
    if(!sessionStorage.getItem("qa-history-board"))sessionStorage.setItem("qa-history-board",JSON.stringify(seed));
    window.fetch=async(input,init)=>{
      const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url,location.href);
      if(url.pathname.startsWith("/api/")){
        const method=init?.method||(input instanceof Request?input.method:"GET");
        if(url.pathname!=="/api/semester")throw new Error("QA blocked an API call");
        if(method==="PUT"){
          const next=JSON.parse(String(init?.body)).semester;
          const old=JSON.parse(sessionStorage.getItem("qa-history-board")!);
          const withoutHistory=({canvasHistory,...rest}:typeof seed)=>rest;
          if(JSON.stringify(withoutHistory(next))!==JSON.stringify(withoutHistory(old)))throw new Error("Read action modified board data");
          sessionStorage.setItem("qa-history-board",JSON.stringify(next));
          sessionStorage.setItem("qa-history-writes",String(Number(sessionStorage.getItem("qa-history-writes")||0)+1));
          return Response.json({revision:2});
        }
        if(method!=="GET")throw new Error("QA blocked an API write");
        return Response.json({semester:JSON.parse(sessionStorage.getItem("qa-history-board")!),revision:1});
      }
      return nativeFetch(input,init);
    };
  }
  return <><p>Synthetic history QA · tab-local saves only</p><SemesterBoard/></>;
}
