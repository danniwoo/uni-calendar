const tokenPattern=/^[A-Za-z0-9_-]{43}$/;

export function invitationStorageKey(supabaseUrl) {
  let host="unconfigured";
  try {host=new URL(supabaseUrl).hostname;} catch {}
  return `semester-invitation-${host}`;
}

export function captureInvitation(href,storage,supabaseUrl) {
  const url=new URL(href),fragment=new URLSearchParams(url.hash.slice(1));
  const supplied=fragment.has("invite"),raw=fragment.get("invite")??"";
  let token=null,invalid=false;
  if(supplied) {
    fragment.delete("invite");
    url.hash=fragment.toString();
    if(tokenPattern.test(raw)) {
      token=raw;
      try {storage.setItem(invitationStorageKey(supabaseUrl),raw);} catch {}
    } else invalid=true;
  } else {
    try {const remembered=storage.getItem(invitationStorageKey(supabaseUrl));if(remembered&&tokenPattern.test(remembered))token=remembered;} catch {}
  }
  return {token,invalid,cleanUrl:url.pathname+url.search+url.hash};
}

export function forgetInvitation(storage,supabaseUrl) {
  try {storage.removeItem(invitationStorageKey(supabaseUrl));} catch {}
}
