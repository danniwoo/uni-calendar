import { createClient } from "@supabase/supabase-js";
import { readConfig, takeAuthCallback } from "./config.js";
import { createApi } from "./api.js";
import { createController } from "./controller.js";
import "./style.css";

const root = document.querySelector("#app");
const config = readConfig(import.meta.env);
let client;
let authBusy = false;
let authMessage = "";
let suppressSessionEvents = false;
let signoutFailed = false;
let authEvents = 0;
const controller = createController(createApi(config.apiUrl), render);

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

function render() {
  const state = controller.getState();
  const main = element("main");
  const header = element("header");
  header.append(element("span", "semester.", "brand"), element("span", "CONNECTION TRIAL", "badge"));
  main.append(header, element("h1", "One account. One test semester."), element("p", "Check the same tasks on the web and your iPhone.", "intro"));
  main.append(element("p", "Synthetic data · Separate from your current Semester website", "caption"));

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

  const account = element("section", undefined, "panel account");
  account.append(element("h2", state.session ? "Your test account" : "Connect your account"));
  if (state.session) {
    account.append(element("p", state.session.user.email || "Signed in", "account-name"));
    account.append(element("p", state.accountId ? "Supabase sign-in and API identity verified for this request." : "Supabase session available · API connection not yet verified", "muted"));
    const actions = element("div", undefined, "actions");
    actions.append(button(state.busy ? "Checking…" : "Refresh test data", () => controller.refresh(), state.busy || authBusy || state.rejected), button("Sign out", signOut, authBusy, "secondary"));
    account.append(actions);
  } else {
    account.append(element("p", "Use the same Google account in the web and phone trials. No new Semester password is needed.", "muted"));
    account.append(button(signoutFailed ? "Retry sign out" : authBusy ? "Connecting…" : "Continue with Google", signoutFailed ? signOut : signIn, authBusy));
  }
  main.append(account);
  if (authMessage) main.append(status(authMessage, "error"));
  if (state.error) main.append(status(state.error, "error"));
  if (state.notice) main.append(status(state.notice));

  if (state.session && state.checked && !state.board && !state.rejected) {
    const empty = element("section", undefined, "panel");
    empty.append(element("h2", "No test semester yet"), element("p", "Create a few sample deadlines and tasks for this account. Existing test data is kept."), button("Create test semester", () => controller.seed(), state.busy || authBusy));
    main.append(empty);
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
    main.append(section);
  }
  main.append(element("footer", "A successful trial means an API read and a saved update appear on both devices. Opening a sign-in page alone is not a successful connection."));
  root.replaceChildren(main);
}

async function signIn() {
  authBusy = true; authMessage = ""; render();
  try {
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/` } });
    if (error) throw error;
  } catch {
    authMessage = "Google sign-in could not start. Check the provider and redirect settings, then try again.";
    authBusy = false; render();
  }
}

async function signOut() {
  authBusy = true; authMessage = ""; suppressSessionEvents = true;
  controller.clear();
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
  const callback = takeAuthCallback(window.location.href);
  window.history.replaceState({}, "", callback.cleanUrl);
  render();
  if (!config.ready) return;
  client = createClient(config.supabaseUrl, config.publishableKey, {
    auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true, storageKey: `semester-staging-auth-${new URL(config.supabaseUrl).hostname}` },
  });
  client.auth.onAuthStateChange((_event, session) => {
    authEvents += 1;
    if (suppressSessionEvents) return;
    const changed = controller.setSession(session);
    // Keep auth callbacks synchronous; run API work outside the SDK auth lock.
    if (changed && session) setTimeout(() => {
      if (controller.getState().session?.user?.id === session.user.id) void controller.refresh();
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
      const changed = controller.setSession(data.session);
      if (changed && data.session) void controller.refresh();
    }
  } catch {
    controller.clear();
    authMessage = "The sign-in session could not be restored. Start Google sign-in again in this browser.";
  } finally { authBusy = false; render(); }
}

void start();
