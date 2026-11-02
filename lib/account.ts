import type {FriendProfile,PlanFriend} from "./course-plan";

export type AccountData = {email:string;profile:FriendProfile|null;incoming:number;blocked:PlanFriend[]};

// Account-only projection. This endpoint never serves another student's identity.
export async function accountResponse(user:{owner:string;email:string}|null,getDatabase:()=>D1Database) {
  const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","Vary":"Cookie"}});
  if(!user)return reply({error:"Sign in to manage your profile.",signIn:true},401);
  try {
    const db=getDatabase();
    const [profile,incoming,blocked]=await Promise.all([
      db.prepare("SELECT id,name,sharing,revision FROM friend_profiles WHERE owner=?").bind(user.owner).first<{id:string;name:string;sharing:number;revision:number}>(),
      db.prepare("SELECT COUNT(*) AS count FROM friendships WHERE (a=? OR b=?) AND status='pending' AND requester!=?").bind(user.owner,user.owner,user.owner).first<{count:number}>(),
      db.prepare("SELECT p.id,p.name,f.id AS connectionId,f.revision FROM friendships f JOIN friend_profiles p ON p.owner=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE (f.a=? OR f.b=?) AND f.status='blocked' AND f.blocked_by=? ORDER BY p.name").bind(user.owner,user.owner,user.owner,user.owner).all<Omit<PlanFriend,"state">>(),
    ]);
    return reply({email:user.email,profile:profile?{...profile,sharing:!!profile.sharing}:null,incoming:incoming?.count??0,blocked:blocked.results.map(p=>({...p,state:"blocked"}))} satisfies AccountData);
  }catch{return reply({error:"Could not load your profile. Retry before making changes."},503);}
}
