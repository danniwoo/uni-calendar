// Standalone local QA: invented board, no account or Canvas access.
import React from "react";
import SemesterBoard from "../../components/semester-board";
import {fixtureBoard} from "../fixtures/canvas-connect";

let installed=false;
export function ConnectionQA(){
  if(!installed){
    installed=true;
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url,location.href);
      if(url.pathname.startsWith("/api/")){
        const method=init?.method||(input instanceof Request?input.method:"GET");
        if(url.pathname!=="/api/semester"||method!=="GET")throw new Error("QA blocked an API write/import");
        const empty=new URLSearchParams(location.search).has("empty");
        return Response.json({semester:empty?null:structuredClone(fixtureBoard),recovery:empty?null:structuredClone(fixtureBoard),revision:1});
      }
      return nativeFetch(input,init);
    };
  }
  return <><p style={{textAlign:"center",fontSize:12}}>Synthetic UI preview · invented data · all API writes blocked</p><SemesterBoard/></>;
}
