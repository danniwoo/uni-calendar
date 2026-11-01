"use client";
import {createContext,useContext,useEffect,useMemo,useState} from "react";
import type {Semester} from "@/lib/semester";
import {reminderJobs} from "@/lib/reminders";
export type SavedReminders={owner:string;revision:number;semester:Semester|null};
type Device={available:boolean;enabled:boolean;count:number;error?:string;owner?:string;revision?:number};
type Delivery=Device&{settings:()=>void;checking:boolean;pending:boolean};
export const ReminderDeliveryContext=createContext<Delivery>({available:false,enabled:false,count:0,checking:true,pending:false,settings:()=>{}});
export function useReminderDelivery(saved:SavedReminders|null,pending:boolean):Delivery {
  const [device,setDevice]=useState<Device>({available:false,enabled:false,count:0}),[checking,setChecking]=useState(true);
  const snapshot=useMemo(()=>saved?{owner:saved.owner,revision:saved.revision,jobs:reminderJobs(saved.semester)}:null,[saved]);
  const send=(action:string)=>window.postMessage({type:"semester-reminders-v1",action,...(action==="sync"&&snapshot?{snapshot}:{})},location.origin);
  useEffect(()=>{
    const receive=(e:MessageEvent)=>{if(e.source!==window||e.origin!==location.origin||e.data?.type!=="semester-reminders-state-v1")return;const s=e.data.state;if(!s||typeof s.available!=="boolean")return;
      setDevice({available:s.available,enabled:s.enabled===true,count:Number.isSafeInteger(s.count)?s.count:0,owner:s.owner,revision:s.revision,error:typeof s.error==="string"?s.error:undefined});setChecking(false);
    };
    window.addEventListener("message",receive);send("status");const timer=setTimeout(()=>setChecking(false),1500);
    return()=>{clearTimeout(timer);window.removeEventListener("message",receive);};
  },[]);
  useEffect(()=>{if(snapshot&&device.available)send("sync");},[snapshot,device.available]);
  useEffect(()=>{const refresh=()=>{send("status");if(snapshot)send("sync");};window.addEventListener("focus",refresh);return()=>window.removeEventListener("focus",refresh);},[snapshot]);
  const synchronized=!!snapshot&&device.owner===snapshot.owner&&device.revision===snapshot.revision;
  return {...device,enabled:device.enabled&&synchronized,checking,pending:pending||(device.enabled&&!synchronized),settings:()=>send("settings")};
}
export function ReminderDeliveryStatus(){const d=useContext(ReminderDeliveryContext);
  return <div className="reminder-delivery" role="status">
    <span>{d.checking?"Checking desktop notifications…":d.error||(!d.available?"Desktop notifications need Semester Connect 0.5.0 in Chrome.":d.pending?"Reminder changes are not scheduled yet. Wait for Saved.":d.enabled?"Desktop notifications on this Chrome profile.":"Desktop notifications are off on this Chrome profile.")}</span>
    {d.available?<button type="button" onClick={d.settings}>{d.enabled?"Settings / test":"Enable desktop notifications"}</button>:!d.checking&&<><a href="/downloads/semester-connect-0.5.0.zip" download>Download Connect 0.5.0</a><small>Update Connect, open its Notification settings, then reload Semester.</small></>}
    <small>Keep Chrome running. Sleep or Focus mode can delay alerts. Changes from another device apply when you reopen Semester here.</small>
  </div>;
}
