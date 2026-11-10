export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function validBoard(value) {
  const s = value?.semester;
  const string = x => typeof x === "string";
  return Number.isSafeInteger(value?.revision) && value.revision > 0 && s &&
    string(s.id) && string(s.title) && string(s.weekLabel) &&
    Array.isArray(s.assessments) && s.assessments.every(a => a && [a.id, a.unitCode, a.title, a.dueAt, a.weightLabel].every(string)) &&
    Array.isArray(s.tasks) && s.tasks.every(t => t && [t.id, t.title, t.unitCode].every(string) && typeof t.completed === "boolean");
}

export function createApi(baseUrl, fetcher = fetch) {
  const request = async (path, session, { method = "GET", body, signal } = {}) => {
    if (!session?.access_token || !session?.user?.id) throw new ApiError(401, "signed_out", "Sign in to continue.");
    const response = await fetcher(`${baseUrl}${path}`, {
      method, signal, cache: "no-store", credentials: "omit", redirect: "error",
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let payload;
    try { payload = await response.json(); } catch { throw new ApiError(response.status, "invalid_response", "The API returned an unreadable response."); }
    if (!response.ok) {
      const code=payload?.error?.code || "request_failed";
      throw new ApiError(response.status,code,safeMessage(response.status,code));
    }
    return payload;
  };
  const boardRequest = async (...args) => {
    const value = await request(...args);
    if (!validBoard(value)) throw new ApiError(502, "invalid_board", "The API returned an unexpected semester format.");
    return value;
  };
  return {
    async session(session, signal) {
      const value = await request("/v1/session", session, { signal });
      if (typeof value?.accountId !== "string" || !value.accountId || !["none","active","suspended","deletion_pending","deleted"].includes(value?.access?.state)
          || typeof value.access.enrolled!=="boolean") throw new ApiError(502, "invalid_account", "The API returned an unexpected account format.");
      return value;
    },
    async previewInvitation(token,signal) {
      const response=await fetcher(`${baseUrl}/v1/access/invitation`,{method:"POST",signal,cache:"no-store",credentials:"omit",redirect:"error",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
      let value;try{value=await response.json();}catch{throw new ApiError(response.status,"invalid_response","The invitation service returned an unreadable response.");}
      if(!response.ok){const code=value?.error?.code||"request_failed";throw new ApiError(response.status,code,safeMessage(response.status,code));}
      if(value?.valid!==true||!["private","campaign","friend_referral"].includes(value.kind)||typeof value.expiresAt!=="string"||!Number.isSafeInteger(value.remaining)||value.remaining<0)
        throw new ApiError(502,"invalid_response","The invitation service returned an unexpected response.");
      return value;
    },
    async trackLanding(token,visitId,eventId) {
      const response=await fetcher(`${baseUrl}/v1/analytics/landing`,{method:"POST",cache:"no-store",credentials:"omit",redirect:"error",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({token,visitId,eventId})});
      if(!response.ok)throw new ApiError(response.status,"analytics_unavailable","Analytics tracking is temporarily unavailable.");
      return response.json();
    },
    trackAnalyticsSession:(session,visitId)=>request("/v1/analytics/session",session,{method:"POST",body:{visitId}}),
    redeem: (session,token,signal)=>request("/v1/access/redeem",session,{method:"POST",body:{token},signal}),
    friends: session=>request("/v1/friends",session),
    saveFriendProfile: (session,name,expectedRevision)=>request("/v1/friends/profile",session,{method:"PATCH",body:{name,expectedRevision}}),
    createFriendInvitation: session=>request("/v1/friends/invitation",session,{method:"POST",body:{}}),
    revokeFriendInvitation: (session,id)=>request("/v1/friends/invitation",session,{method:"DELETE",body:{id}}),
    requestFriend: (session,token)=>request("/v1/friends/request",session,{method:"POST",body:{token}}),
    changeFriendship: (session,connectionId,expectedRevision,operation)=>request("/v1/friends/action",session,{method:"POST",body:{connectionId,expectedRevision,operation}}),
    adminSession: (session,signal)=>request("/v1/admin/session",session,{signal}),
    adminDashboard: (session,signal)=>request("/v1/admin",session,{signal}),
    adminAnalytics: (session,filters={},signal)=>request(`/v1/admin/analytics?${new URLSearchParams(Object.entries(filters).filter(([,value])=>value!==null&&value!==undefined&&value!=="")).toString()}`,session,{signal}),
    savePolicyDraft: (session,body)=>request("/v1/admin/policy/draft",session,{method:"PATCH",body}),
    publishPolicy: (session,body)=>request("/v1/admin/policy/publish",session,{method:"POST",body}),
    createAdminInvitation: (session,body)=>request("/v1/admin/invitations",session,{method:"POST",body}),
    revokeAdminInvitation: (session,id)=>request("/v1/admin/invitations/revoke",session,{method:"POST",body:{id}}),
    createCampaign: (session,body)=>request("/v1/admin/campaigns",session,{method:"POST",body}),
    createCampaignLink: (session,body)=>request("/v1/admin/campaign-links",session,{method:"POST",body}),
    revokeCampaign: (session,id)=>request("/v1/admin/campaigns/revoke",session,{method:"POST",body:{id}}),
    changeAccountAccess: (session,body)=>request("/v1/admin/users/access",session,{method:"POST",body}),
    get: (session, signal) => boardRequest("/v1/semester", session, { signal }),
    seed: (session, signal) => boardRequest("/v1/semester/sample", session, { method: "POST", signal }),
    update: (session, taskId, completed, expectedRevision, signal) => boardRequest(`/v1/tasks/${encodeURIComponent(taskId)}`, session, { method: "PATCH", body: { completed, expectedRevision }, signal }),
  };
}

function safeMessage(status,code="") {
  const invitation={invitation_invalid:"This invitation link is not valid.",invitation_expired:"This invitation has expired.",
    invitation_revoked:"This invitation has been revoked.",invitation_exhausted:"This invitation has already been used.",
    invitation_required:"A valid Semester invitation is required for this account.",access_disabled:"Semester access is currently disabled for this account.",
    invitation_unavailable:"This invitation is no longer available.",self_referral:"You cannot use your own friend invitation.",
    profile_required:"Choose a display name before sending the friend request.",friend_unavailable:"This friend invitation is unavailable."};
  Object.assign(invitation,{admin_required:"Administrator access is required.",revision_conflict:"This changed in another session. Refresh before trying again.",
    admin_target_protected:"Administrator access must be changed through the operator procedure.",
    policy_invalid:"Review the growth-policy values.",public_enrolment_unavailable:"Public Semester enrolment is not safely available yet.",
    publish_confirmation_required:"Review and confirm the policy before publishing.",admin_input_invalid:"Review the admin form values.",
    enrolments_paused:"New Semester enrolments are paused.",enrolment_channel_disabled:"This enrolment channel is disabled by the published policy."});
  if(invitation[code])return invitation[code];
  if (status === 401) return "Your API session was rejected. Sign out and sign in again.";
  if (status === 403) return "This account is not allowed to use the test API.";
  if (status === 404) return "No test semester was found.";
  if (status === 409) return "This semester changed on another device.";
  if (status === 429) return "Too many requests. Please try again shortly.";
  return "The request did not succeed. Please try again.";
}
