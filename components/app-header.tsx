"use client";
import {useState} from "react";
import {CalendarDays,ChevronDown,Users,BookOpen,Check} from "lucide-react";
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from "@/components/ui/dropdown-menu";
import AccountMenu from "./account-menu";

type Area="semester"|"plan"|"friends";
export default function AppHeader({active,onNavigate}:{active:Area;onNavigate?:(area:"plan"|"friends")=>void}) {
  const [open,setOpen]=useState(false);
  const areas=[{id:"semester",label:"My semester",href:"/",icon:CalendarDays},{id:"plan",label:"Course plan",href:"/plan",icon:BookOpen},{id:"friends",label:"Friends",href:"/plan?view=friends",icon:Users}] as const;
  return <header className="app-header">
    <a className="app-brand" href="/" aria-label="Semester home"><CalendarDays aria-hidden="true"/><span>semester</span></a>
    <DropdownMenu open={open} onOpenChange={setOpen}><DropdownMenuTrigger className="app-area-trigger" aria-label={`Navigate · ${areas.find(a=>a.id===active)!.label}`}>
      {areas.find(a=>a.id===active)!.label}<ChevronDown size={14} aria-hidden="true"/>
    </DropdownMenuTrigger><DropdownMenuContent className="app-options-menu" align="start">
      {areas.map(area=><DropdownMenuItem key={area.id} asChild><a href={area.href} aria-current={active===area.id?"page":undefined} onClick={e=>{if(onNavigate&&area.id!=="semester"&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();setOpen(false);onNavigate(area.id);}}}><area.icon size={16}/>{area.label}{active===area.id&&<Check className="app-nav-check" size={14}/>}</a></DropdownMenuItem>)}
    </DropdownMenuContent></DropdownMenu>
    <AccountMenu/>
  </header>;
}
