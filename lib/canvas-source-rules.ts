import type {CanvasCourse} from "./canvas-import";

export const canvasSourceRules=(course:CanvasCourse,groupId:string|null)=>JSON.stringify({unavailable:course.groupsUnavailable,group:course.groups.find(g=>g.id===groupId)||null});
type Snapshot={unavailable:boolean;group:CanvasCourse["groups"][number]|null};
export type SourceRuleReview={snapshot:string;changes:{label:string;before:string;after:string}[];canKeep:boolean};
// Compare calculation-relevant fields, not display names or set ordering.
// Unknown is not zero; loss of source information must never be accepted as a new rule.
export function canvasSourceRuleReview(previous:string,current:string):SourceRuleReview|null {
  if(previous===current)return null;
  let before:Snapshot,after:Snapshot;
  try{
    before=JSON.parse(previous);after=JSON.parse(current);
    for(const value of [before,after])if(!value||typeof value.unavailable!=="boolean"||value.group!==null&&(!value.group?.rules||!Array.isArray(value.group.rules.neverDrop)))throw new Error("Invalid snapshot");
  }catch{return {snapshot:current,changes:[{label:"Source settings",before:"Unreadable saved settings",after:"Check Canvas"}],canKeep:false};}
  const changes:SourceRuleReview["changes"]=[];
  const add=(label:string,a:unknown,b:unknown)=>{if(JSON.stringify(a)!==JSON.stringify(b))changes.push({label,before:String(a??"Unknown"),after:String(b??"Unknown")});};
  if(before.unavailable||after.unavailable||!before.group||!after.group){
    changes.push({label:"Canvas group information",before:before.unavailable||!before.group?"Unavailable":"Available",after:after.unavailable||!after.group?"Unavailable":"Available"});
  }else{
    add("Canvas group",before.group.id,after.group.id);
    add("Group weight (%)",before.group.weight,after.group.weight);
    add("Drop lowest",before.group.rules.dropLowest,after.group.rules.dropLowest);
    add("Drop highest",before.group.rules.dropHighest,after.group.rules.dropHighest);
    add("Never-drop items",[...new Set(before.group.rules.neverDrop)].sort().join(", ")||"None",[...new Set(after.group.rules.neverDrop)].sort().join(", ")||"None");
  }
  return changes.length?{snapshot:current,changes,canKeep:!after.unavailable&&!!after.group}:null;
}
