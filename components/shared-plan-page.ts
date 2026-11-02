"use client";
import {useEffect,useRef,useState} from "react";
import {sameOffering,type SharedPage,type SharedPlan} from "@/lib/course-plan";
// Each unit's match list has its own query, independent of the friends-page filters.
export function useSharedPlanPage(query:string|null,refreshKey:number) {
  const [state,setState]=useState<{query:string|null;plans:SharedPlan[];next:string|null;loading:boolean;error:string}>({query:null,plans:[],next:null,loading:false,error:""});
  const version=useRef(0),busy=useRef(false),current=useRef(query);current.current=query;
  async function load(after?:string) {
    if(!query||after&&busy.current)return;
    const request=++version.current;busy.current=true;
    setState(old=>({query,plans:after?old.plans:[],next:after?old.next:null,loading:true,error:""}));
    try {
      const response=await fetch(`/api/course-plan?${query}${after?`&after=${encodeURIComponent(after)}`:""}`,{cache:"no-store"});
      const data=await response.json() as SharedPage & {error?:string};
      if(request!==version.current||query!==current.current)return;
      if(!response.ok)throw new Error(data.error||"Could not load matching friends.");
      setState(old=>({query,plans:after?[...old.plans,...data.sharedPlans.filter(p=>!old.plans.some(o=>o.friendId===p.friendId&&sameOffering(o,p)))]:data.sharedPlans,next:data.sharedNext,loading:false,error:""}));
    }catch(e){if(request===version.current&&query===current.current)setState(old=>({...old,loading:false,error:e instanceof Error?e.message:"Could not load matching friends."}));}
    finally{if(request===version.current)busy.current=false;}
  }
  useEffect(()=>{void load();return()=>{version.current++;busy.current=false;};},[query,refreshKey]);
  return {...(state.query===query?state:{plans:[],next:null,loading:!!query,error:""}),more:()=>load(state.next??undefined),reload:()=>load()};
}
