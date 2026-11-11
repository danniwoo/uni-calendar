import { pilotClient } from "./auth.js";
import { readConfig, takeAuthCallback } from "./config.js";
import { createApi } from "./api.js";
import { createController } from "./controller.js";
import { backupCheckPanel } from "./backup-check.js";
import { todayPlanPanel } from "./today-plan.js";
import {captureInvitation,forgetInvitation} from "./invitation.js";
import {analyticsEventId,analyticsVisit} from "./analytics-client.js";
import "./style.css";

const root = document.querySelector("#app");
const config = readConfig(import.meta.env);
let client;
let authBusy = false;
let authMessage = "";
let suppressSessionEvents = false;
let signoutFailed = false;
let authEvents = 0;
const api=createApi(config.apiUrl);
const controller = createController(api, render);
let pendingInvitation=null;
let invitationMessage="";
let invitationKind="";
let invitationBusy=false;
let invitationAttempt="";
let referralOffer=null;
let friendsData=null;
let friendsBusy=false;
let friendsMessage="";
let friendLink=null;
let profilePromptOpen=false;
let profilePromptValue="";
let friendConfirmOpen=false;
let adminAllowed=false;
let analyticsSessionSubject=null;
const analyticsVisitId=analyticsVisit(sessionStorage,config.supabaseUrl);

// Only text nodes receive API/auth content. No remote HTML is inserted.
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, action, disabled = false, kind = "") {
  const node = element("button", text, kind);
  node.type = "button"; node.disabled = disabled;
  node.addEventListener("click", action);
  return node;
}
function status(text, kind = "notice") {
  const node = element("p", text, `status ${kind}`);
  node.setAttribute("role", kind === "error" ? "alert" : "status");
  return node;
}

async function loadFriends(session=controller.getState().session) {
  if(!session||!controller.getState().access?.enrolled)return;
  friendsBusy=true;friendsMessage="";render();
  try{
    friendsData=await api.friends(session);
    if(!friendsData.profile){profilePromptValue="";profilePromptOpen=true;}
    else if(referralOffer)friendConfirmOpen=true;
  }catch(error){friendsMessage=error.message||"Friends could not be loaded.";}
  finally{friendsBusy=false;render();}
}

async function savePromptProfile() {
  const session=controller.getState().session,name=profilePromptValue.trim();
  if(!session)return;
  if(!name){friendsMessage="Choose a name your friends can recognise.";render();return;}
  friendsBusy=true;friendsMessage="";render();
  try{
    await api.saveFriendProfile(session,name,friendsData?.profile?.revision??0);
    friendsData=await api.friends(session);
    profilePromptOpen=false;profilePromptValue="";
    if(referralOffer)friendConfirmOpen=true;
  }catch(error){friendsMessage=error.message||"Your friend name could not be saved.";}
  finally{friendsBusy=false;render();}
}

async function sendReferralRequest() {
  const session=controller.getState().session;if(!session||!pendingInvitation)return;
  friendsBusy=true;friendsMessage="";render();
  try{
    await api.requestFriend(session,pendingInvitation);
    pendingInvitation=null;referralOffer=null;friendConfirmOpen=false;
    forgetInvitation(sessionStorage,config.supabaseUrl);
    friendsMessage="Friend request sent. They still need to accept.";
  }catch(error){friendsMessage=error.message||"The friend request did not succeed.";}
  finally{friendsBusy=false;render();}
}

function friendOnboardingModal() {
  if(!profilePromptOpen&&!friendConfirmOpen)return null;
  const overlay=element("div",undefined,"modal-backdrop");
  overlay.setAttribute("role","presentation");
  const modal=element("section",undefined,"modal");
  modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");
  if(profilePromptOpen){
    modal.append(element("p","Your Profile", "modal-kicker"),element("h2","Set your profile name"),
      element("p","This is how other students will see your name on Semester, including in Friends. You can change it anytime in Account → Profile.","muted"));
    const input=element("input");input.type="text";input.maxLength=60;input.placeholder="e.g. Daniel Wu";input.value=profilePromptValue;input.autocomplete="nickname";
    input.addEventListener("input",()=>{profilePromptValue=input.value;});
    input.addEventListener("keydown",event=>{if(event.key==="Enter")void savePromptProfile();});
    modal.append(input);
    const actions=element("div",undefined,"actions");
    actions.append(button(friendsBusy?"Saving…":"Continue",()=>void savePromptProfile(),friendsBusy));
    modal.append(actions);
  }else{
    const name=referralOffer?.name||"this student";
    modal.append(element("p","Friend invitation","modal-kicker"),element("h2",`Send friend invitation to ${name}`),
      element("p",`Your friend will see your chosen name. Sending a request does not share grades, WAM or private semester data.`,"muted"));
    const actions=element("div",undefined,"actions");
    actions.append(button(friendsBusy?"Sending…":"Send invitation",()=>void sendReferralRequest(),friendsBusy),
      button("Not now",()=>{friendConfirmOpen=false;render();},friendsBusy,"secondary"));
    modal.append(actions);
  }
  overlay.append(modal);return overlay;
}

async function friendMutation(action,success) {
  const session=controller.getState().session;if(!session)return;
  friendsBusy=true;friendsMessage="";render();
  try{await action(session);friendsMessage=success;friendsData=await api.friends(session);}
  catch(error){friendsMessage=error.message||"The friend action did not succeed.";}
  finally{friendsBusy=false;render();}
}

function friendsPanel() {
  const section=element("section",undefined,"panel friends");
  section.append(element("h2","Friends"),element("p","One personal link can enrol a new Semester student or connect someone who already has access. A request is sent only after they confirm, and you must accept it.","muted"));
  if(friendsMessage)section.append(status(friendsMessage,friendsMessage.includes("not")||friendsMessage.includes("invalid")?"error":"notice"));
  if(!friendsData){section.append(button(friendsBusy?"Loading…":"Load friends",()=>loadFriends(),friendsBusy));return section;}
  const profile=element("div",undefined,"friend-profile"),name=element("input");
  name.type="text";name.maxLength=60;name.placeholder="Display name";name.value=friendsData.profile?.name??"";name.disabled=friendsBusy;
  profile.append(name,button(friendsData.profile?"Update name":"Save name",()=>friendMutation(
    session=>api.saveFriendProfile(session,name.value,friendsData.profile?.revision??0),"Display name saved."),friendsBusy));
  section.append(profile);
  if(friendsData.profile){
    const share=element("div",undefined,"friend-share");
    share.append(button(friendsBusy?"Working…":"Create friend link",async()=>{
      const session=controller.getState().session;if(!session)return;friendsBusy=true;friendsMessage="";render();
      try{friendLink=await api.createFriendInvitation(session);friendsData=await api.friends(session);friendsMessage="New link created. Any older link is revoked.";}
      catch(error){friendsMessage=error.message||"The friend link could not be created.";}finally{friendsBusy=false;render();}
    },friendsBusy));
    if(friendsData.invitation?.state==="active")share.append(button("Revoke link",()=>friendMutation(
      session=>api.revokeFriendInvitation(session,friendsData.invitation.id),"Friend link revoked."),friendsBusy,"secondary"));
    section.append(share);
    if(friendLink){const output=element("div",undefined,"friend-link"),field=element("input");field.readOnly=true;field.value=friendLink.url;
      output.append(field,button("Copy",async()=>{try{await navigator.clipboard.writeText(friendLink.url);friendsMessage="Friend link copied.";}catch{friendsMessage="Copy was blocked. Select the link manually.";}render();}));section.append(output);}
  }
  if(!friendsData.friends.length)section.append(element("p","No friend requests yet.","muted"));
  for(const friend of friendsData.friends){const row=element("div",undefined,"friend-row"),detail=element("div");
    detail.append(element("strong",friend.name),element("span",friend.state==="incoming"?"Wants to connect":friend.state==="outgoing"?"Request sent":friend.state==="accepted"?"Friends":"Blocked","muted"));row.append(detail);
    const actions=element("div",undefined,"actions");
    const act=(operation,label)=>actions.append(button(label,()=>friendMutation(session=>api.changeFriendship(session,friend.connectionId,friend.revision,operation),"Friends updated."),friendsBusy,operation==="accept"?"":"secondary"));
    if(friend.state==="incoming"){act("accept","Accept");act("decline","Decline");}
    if(friend.state==="accepted"){act("remove","Remove");act("block","Block");}
    if(friend.state==="blocked"&&friend.canUnblock)act("unblock","Unblock");
    row.append(actions);section.append(row);
  }
  return section;
}

function render() {
  const state = controller.getState();
  if (state.access?.enrolled && !state.rejected && !pendingInvitation && !new URLSearchParams(location.search).has("tools")) {
    location.replace("/board/");
    return;
  }
  const main = element("main");
  const header = element("header");
  header.append(element("span", "semester.", "brand"), element("span", "PRIVATE PILOT", "badge"));
  main.append(header, element("h1", "Your Semester account"), element("p", "Sign in with the Google account you use on iPhone to open your semester.", "intro"));

  if (!config.ready) {
    const section = element("section", undefined, "panel");
    section.append(element("h2", "Setup needed"), element("p", "This trial is not connected yet. Add the public project settings to migration/web/.env.local, then restart the local server."));
    const list = element("ul");
    for (const problem of config.problems) list.append(element("li", problem));
    section.append(list, element("p", "Google OAuth must also be enabled in Supabase. This screen does not sign in or create a test board until configuration is complete.", "muted"));
    main.append(section);
    root.replaceChildren(main);
    return;
  }

  const invitation=element("section",undefined,"panel invitation");
  invitation.append(element("h2",pendingInvitation?(referralOffer?"Friend invitation":"Semester invitation"):"Private pilot access"));
  if(pendingInvitation)invitation.append(element("p",invitationBusy?"Checking and activating this invitation…":invitationMessage||"Invitation ready. Continue with Google to activate Semester access."));
  else invitation.append(element("p",invitationMessage||"Existing pilot students can sign in normally. New students need a private invitation link."));
  if(invitationKind==="error")invitation.classList.add("invitation-error");
  if(state.session && !state.access?.enrolled && pendingInvitation && !invitationBusy)
    invitation.append(button("Retry invitation",()=>completeSession(state.session),state.busy||authBusy));
  if(state.session&&referralOffer&&pendingInvitation&&!invitationBusy&&!friendConfirmOpen){
    invitation.append(element("p",`${referralOffer.name} invited you to connect. Sending a request does not share grades, WAM or private semester data.`,"muted"));
    invitation.append(button(`Send friend request to ${referralOffer.name}`,()=>{friendConfirmOpen=true;render();},friendsBusy));
    invitation.append(button("Not now",()=>{pendingInvitation=null;referralOffer=null;forgetInvitation(sessionStorage,config.supabaseUrl);render();},friendsBusy,"secondary"));
  }
  main.append(invitation);

  const account = element("section", undefined, "panel account");
  account.append(element("h2", state.session ? "Your account" : "Connect your account"));
  if (state.session) {
    account.append(element("p", state.session.user.email || "Signed in", "account-name"));
    account.append(element("p", state.access?.enrolled ? "Google identity verified · Semester access active"
      : state.checked ? "Google identity verified · a valid invitation is still required"
      : "Supabase session available · API identity not yet verified", "muted"));
    const actions = element("div", undefined, "actions");
    actions.append(button(state.busy ? "Checking…" : "Refresh test data", () => controller.refresh(), state.busy || authBusy || state.rejected), button("Sign out", signOut, authBusy, "secondary"));
    if(adminAllowed){const admin=element("a","Admin Dashboard");admin.href="/admin/";actions.append(admin);}
    account.append(actions);
  } else {
    account.append(element("p", "Use the same Google account in the web and phone trials. No new Semester password is needed.", "muted"));
    account.append(button(signoutFailed ? "Retry sign out" : authBusy ? "Connecting…" : "Continue with Google", signoutFailed ? signOut : signIn, authBusy));
  }
  main.append(account);
  if (authMessage) main.append(status(authMessage, "error"));
  if (state.error) main.append(status(state.error, "error"));
  if (state.notice) main.append(status(state.notice));

  const diagnostics=element("details");
  diagnostics.append(element("summary","Connection diagnostics"));
  if (state.session && state.access?.enrolled && state.checked && !state.board && !state.rejected) {
    const empty = element("section", undefined, "panel");
    empty.append(element("h2", "No test semester yet"), element("p", "Create a few sample deadlines and tasks for this account. Existing test data is kept."), button("Create test semester", () => controller.seed(), state.busy || authBusy));
    diagnostics.append(empty);
  }
  if (state.board) {
    const { semester, revision } = state.board;
    const section = element("section", undefined, "panel board");
    const heading = element("div", undefined, "section-heading");
    heading.append(element("h2", semester.title), element("span", `Revision ${revision}`, "revision"));
    section.append(heading, element("p", semester.weekLabel, "muted"));
    section.append(element("h3", "Coming up"));
    for (const item of semester.assessments) {
      const row = element("div", undefined, "deadline");
      const detail = element("div");
      detail.append(element("span", item.unitCode, "unit"), element("strong", item.title));
      const date = new Date(item.dueAt);
      const formatted = Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
      detail.append(element("span", `${formatted} · Sydney`, "muted"));
      row.append(detail, element("span", item.weightLabel, "weight"));
      section.append(row);
    }
    section.append(element("h3", "Preparation"));
    for (const item of semester.tasks) {
      const label = element("label", undefined, "task");
      const input = element("input");
      input.type = "checkbox"; input.checked = item.completed; input.disabled = state.busy || authBusy || state.rejected;
      input.addEventListener("change", () => controller.update(item.id, input.checked));
      const detail = element("span", undefined, item.completed ? "completed" : "");
      detail.append(element("strong", item.title), element("span", item.unitCode, "muted"));
      label.append(input, detail); section.append(label);
    }
    diagnostics.append(section);
  }
  if (state.session && state.accountId && state.access?.enrolled && !state.rejected) {
    const openBoard=element("a","Open my semester board");
    openBoard.href="/board/";
    main.append(openBoard);
    const {accountId, session} = state;
    const signedRequest = async (path, text, method) => {
      const current = controller.getState();
      if (!current.session || current.session.user.id !== session.user.id || current.accountId !== accountId || current.rejected)
        throw new Error("The signed-in account changed. Select the file again.");
      const write = text !== undefined;
      const res = await fetch(`${config.apiUrl}${path}`, {
        method: method ?? (write ? "POST" : "GET"), cache: "no-store", credentials: "omit", redirect: "error",
        headers: { Authorization: `Bearer ${current.session.access_token}`, ...(write ? {"Content-Type":"application/json"} : {}) },
        ...(write ? {body:text} : {}),
      });
      if (!res.ok) throw new Error((await res.json()).error?.message || "The backup request failed.");
      return res;
    };
    const planPanel=()=>todayPlanPanel(async body => (await signedRequest("/v1/today/plan",
      body ? JSON.stringify(body) : undefined, body ? "PATCH" : "GET")).json());
    let plan=planPanel();
    const recoveryUrl=`/v1/recovery/${encodeURIComponent(accountId)}`;
    main.append(backupCheckPanel({ accountId, email: session.user.email || "this account",
      read: async () => (await signedRequest(recoveryUrl)).json(),
      restore: async body => (await signedRequest(recoveryUrl,JSON.stringify(body))).json(),
      original: async () => (await signedRequest(`/v1/backup-trial/${encodeURIComponent(accountId)}`)).text(),
      onRestored: () => {const next=planPanel();plan.replaceWith(next);plan=next;},
    }));
    main.append(plan);
    main.append(friendsPanel());
    main.append(diagnostics);
  }
  const onboarding=friendOnboardingModal();if(onboarding)main.append(onboarding);
  main.append(element("footer", "Changes to test tasks are saved under your signed-in account."));
  root.replaceChildren(main);
}

async function previewPendingInvitation() {
  if(!pendingInvitation)return;
  const token=pendingInvitation;
  invitationBusy=true;invitationMessage="";invitationKind="";render();
  try {
    const value=await api.previewInvitation(token);
    if(pendingInvitation!==token)return;
    await api.trackLanding(token,analyticsVisitId,analyticsEventId()).catch(()=>null);
    const date=new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Sydney",day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value.expiresAt));
    invitationMessage=value.kind==="friend_referral"
      ? `${value.referrer?.name||"A Semester student"} invited you · expires ${date} Sydney. New students can join through this link.`
      : value.kind==="campaign"?`Society invitation ready · expires ${date} Sydney.`:`Invitation ready · expires ${date} Sydney.`;
  } catch(error) {
    if(pendingInvitation!==token)return;
    invitationMessage=error.message||"This invitation could not be checked.";invitationKind="error";
    if(["invitation_invalid","invitation_expired","invitation_revoked","invitation_exhausted"].includes(error.code)) {
      pendingInvitation=null;forgetInvitation(sessionStorage,config.supabaseUrl);
    }
  } finally {invitationBusy=false;render();}
}

async function completeSession(session) {
  if(!session || controller.getState().session?.user.id!==session.user.id)return;
  if(analyticsSessionSubject!==session.user.id){analyticsSessionSubject=session.user.id;await api.trackAnalyticsSession(session,analyticsVisitId).catch(()=>null);}
  const key=`${session.user.id}:${pendingInvitation??"none"}`;
  if(invitationAttempt===key)return;
  invitationAttempt=key;
  if(pendingInvitation) {
    const token=pendingInvitation;invitationBusy=true;invitationMessage="Activating your invitation…";invitationKind="";render();
    try {
      const result=await api.redeem(session,token);
      if(controller.getState().session?.user.id!==session.user.id)return;
      if(result.invitation?.kind==="friend_referral"){
        referralOffer={name:result.invitation.referrer?.name||"this student"};
        invitationMessage=result.alreadyEnrolled?"Semester access already active. Confirm the friend request below.":"Invitation accepted. Semester access is active; confirm the friend request below.";
      }else{
        pendingInvitation=null;forgetInvitation(sessionStorage,config.supabaseUrl);
        invitationMessage=result.alreadyEnrolled?"This account already has Semester access.":"Invitation accepted. Semester access is active.";
      }
    } catch(error) {
      if(controller.getState().session?.user.id!==session.user.id)return;
      invitationMessage=error.message||"This invitation could not be activated.";invitationKind="error";
      if(["invitation_invalid","invitation_expired","invitation_revoked","invitation_exhausted"].includes(error.code)) {
        pendingInvitation=null;forgetInvitation(sessionStorage,config.supabaseUrl);
      }
    } finally {invitationBusy=false;invitationAttempt="";}
  } else invitationAttempt="";
  if(controller.getState().session?.user.id===session.user.id)await controller.refresh();
  if(controller.getState().session?.user.id===session.user.id&&controller.getState().access?.enrolled&&(new URLSearchParams(location.search).has("tools")||referralOffer)&&!friendsData)
    void loadFriends(session);
  if(controller.getState().session?.user.id===session.user.id&&controller.getState().access?.enrolled)
    adminAllowed=await api.adminSession(session).then(()=>true).catch(()=>false);
  render();
}

async function signIn() {
  authBusy = true; authMessage = ""; render();
  try {
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/`, queryParams:{prompt:"select_account"} } });
    if (error) throw error;
  } catch {
    authMessage = "Google sign-in could not start. Check the provider and redirect settings, then try again.";
    authBusy = false; render();
  }
}

async function signOut() {
  authBusy = true; authMessage = ""; suppressSessionEvents = true;
  controller.clear();
  friendsData=null;friendLink=null;referralOffer=null;profilePromptOpen=false;profilePromptValue="";friendConfirmOpen=false;adminAllowed=false;analyticsSessionSubject=null;
  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
    signoutFailed = false; suppressSessionEvents = false;
  } catch {
    signoutFailed = true;
    authMessage = "Your test data is hidden, but sign-out did not finish. Retry when connected.";
  } finally { authBusy = false; render(); }
}

async function start() {
  // Remove any OAuth code/error/token fragment immediately, including on a
  // misconfigured build, before network calls or user interaction.
  const captured=captureInvitation(window.location.href,sessionStorage,config.supabaseUrl);
  pendingInvitation=captured.token;
  if(captured.invalid){invitationMessage="This invitation link is not valid.";invitationKind="error";}
  const callback = takeAuthCallback(new URL(captured.cleanUrl,window.location.origin).toString());
  window.history.replaceState({}, "", callback.cleanUrl);
  render();
  if (!config.ready) return;
  if(pendingInvitation)void previewPendingInvitation();
  client = pilotClient(config);
  client.auth.onAuthStateChange((_event, session) => {
    authEvents += 1;
    if (suppressSessionEvents) return;
    if(session?.user?.id!==controller.getState().session?.user?.id)adminAllowed=false;
    const changed = controller.setSession(session);
    // Keep auth callbacks synchronous; run API work outside the SDK auth lock.
    if (changed && session) setTimeout(() => {
      if (controller.getState().session?.user?.id === session.user.id) void completeSession(session);
    }, 0);
  });
  authBusy = true; render();
  try {
    if (callback.failed) {
      authMessage = "Sign-in was cancelled or could not be completed. Please try again.";
    } else if (callback.code) {
      const { error } = await client.auth.exchangeCodeForSession(callback.code, callback.flowId ? { flowId: callback.flowId } : undefined);
      if (error) throw error;
    }
    const version = authEvents;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (authEvents === version && !suppressSessionEvents) {
      if(data.session?.user?.id!==controller.getState().session?.user?.id)adminAllowed=false;
      const changed = controller.setSession(data.session);
      if (changed && data.session) void completeSession(data.session);
    }
  } catch {
    controller.clear();
    authMessage = "The sign-in session could not be restored. Start Google sign-in again in this browser.";
  } finally { authBusy = false; render(); }
}

void start();
