export type InvitePreview = {name:string;state:"available"|"self"|"incoming"|"outgoing"|"accepted"};

export function invitationCode(input:string) {
  let value=input.trim();
  if(/^https?:\/\//i.test(value)) {
    try {value=new URLSearchParams(new URL(value).hash.slice(1)).get("invite")??"";}catch{return null;}
  }
  value=value.replace(/[\s-]/g,"").toUpperCase();
  return /^[A-F0-9]{32}$/.test(value)?value:null;
}
export function invitationLink(origin:string,code:string) {
  const normalized=invitationCode(code);
  if(!normalized)throw new Error("Invalid invitation code.");
  const url=new URL("/plan?view=friends",origin);
  url.hash=new URLSearchParams({invite:normalized}).toString();
  return url.toString();
}
export function invitationCodeLabel(input:string) {
  const normalized=invitationCode(input);
  return normalized?normalized.match(/.{1,4}/g)!.join("-"):input;
}
// Remember a view preference only; no identity, invitation or student data is stored.
export function planningYear(sydneyDay:string,saved:string|null) {
  const value=Number(saved);
  if(saved!==null&&/^\d{4}$/.test(saved)&&value>=2000&&value<=2100)return value;
  return Number(sydneyDay.slice(0,4))+(Number(sydneyDay.slice(5,7))>=8?1:0);
}
