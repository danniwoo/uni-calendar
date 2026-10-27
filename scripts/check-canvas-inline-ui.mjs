// Synthetic localhost fixture only. Never opens Canvas or a real account.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {onboardingBundle} from "./fixtures/canvas-onboarding.ts";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SEMESTER_PLAYWRIGHT_PACKAGE||"playwright");
const browser=await chromium.launch({headless:true,...(process.env.SEMESTER_BROWSER_CHANNEL?{channel:process.env.SEMESTER_BROWSER_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1280,height:1000}});
const errors=[];page.on("pageerror",e=>errors.push(e.message));
await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
const base="http://127.0.0.1:5184/?onboarding&existing";
const row=()=>page.getByRole("article",{name:"Prepared Assignment 1",exact:true});
const shown=async locator=>locator.waitFor({state:"visible"});
async function openPart(){
  const details=row().locator(".canvas-change-match");
  if(!await details.evaluate(e=>e.open))await details.locator("summary").click();
  await row().getByRole("button",{name:"Only part of an assessment?"}).click();
  await shown(row().getByLabel("Review connection"));
}
try{
  await page.goto(base);
  await shown(page.getByRole("heading",{name:"4 grades ready to import"}));
  await openPart();
  assert.equal(await page.getByLabel("Find a Canvas item").count(),0,"no jump to all-course manager");
  assert.equal(await page.getByRole("article").count(),4,"only prepared cards remain");
  assert.equal(await row().getByLabel("Destination assessment ISYS2120").inputValue(),"root-0","keep current destination");
  assert(await row().getByRole("radio",{name:"One week, attempt or part within this assessment"}).isChecked());
  assert(await page.getByRole("button",{name:"Import 4 grades",exact:true}).isDisabled(),"do not import old choice while editing");
  assert(await row().getByRole("button",{name:"Use this connection · not saved yet"}).isDisabled(),"do not guess calculation");
  await page.screenshot({path:"/private/tmp/semester-inline-part.png",fullPage:true});
  await row().getByRole("button",{name:"Cancel connection",exact:true}).click();
  await page.waitForFunction(()=>document.activeElement?.textContent==="Only part of an assessment?");
  assert(await page.getByRole("button",{name:"Import 4 grades",exact:true}).isEnabled());
  await shown(page.getByText("Test writes: 0",{exact:true}));
  await openPart();
  await row().getByLabel("Calculation for A1: Data model assignment").selectOption("equal");
  await row().getByRole("button",{name:"Use this connection · not saved yet"}).click();
  await shown(row().getByText(/Individual result ·/));
  assert.equal(await row().getByLabel("Review connection").count(),0,"staging closes local editor");
  await shown(page.getByText("Test writes: 0",{exact:true}));
  await page.getByRole("button",{name:"Undo last change",exact:true}).click();
  assert.equal(await row().getByText(/Individual result ·/).count(),0,"undo restores overall proposal");
  await openPart();
  await row().getByLabel("Calculation for A1: Data model assignment").selectOption("special");
  await shown(row().getByLabel("Special rule ISYS2120"));
  assert(await row().getByRole("button",{name:"Use this rule · not saved yet"}).isDisabled(),"explicit rule acknowledgement required");
  await row().getByRole("button",{name:"Cancel connection",exact:true}).click();
  // The full manager is still explicit, and review counts changes, not selections.
  await page.getByText("Unchanged / no numeric result (60) · no action needed",{exact:true}).click();
  await page.getByRole("button",{name:"Manage all connections & rules"}).click();
  await page.getByRole("button",{name:/^Review \d+ changes/}).click();
  await shown(page.getByText("4 changes will be saved when you click Import. Everything else stays unchanged.",{exact:true}));
  assert.equal(await page.getByText(/4 connected \/ staged/).isVisible(),false,"selection count collapsed");
  assert(await page.getByRole("button",{name:"Import 4 changes",exact:true}).isDisabled());
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  await shown(page.getByText("Test writes: 0",{exact:true}));
  // Drop rules must still block plain averaging, even in the single-card editor.
  await page.goto(base);
  await openPart();
  const dropped=structuredClone(onboardingBundle);dropped.exportedAt="2026-10-28T00:00:00Z";
  dropped.courses.forEach(c=>c.fetchedAt=dropped.exportedAt);dropped.courses[0].groups[0].rules.dropLowest=1;
  await page.evaluate(raw=>window.postMessage({type:"semester-connect-inbox-v1",inbox:{raw}},location.origin),JSON.stringify(dropped));
  await page.getByRole("button",{name:"View newer check…"}).click();
  await page.getByRole("button",{name:"Discard draft & open newer batch"}).click();
  assert.equal(await row().getByLabel("Review connection").count(),0,"explicit batch switch discards old inline draft");
  await openPart();
  await row().getByLabel("Calculation for A1: Data model assignment").selectOption("points");
  await shown(row().getByText(/This group has drop rules/));
  assert(await row().getByRole("button",{name:"Use this connection · not saved yet"}).isDisabled());
  await page.getByRole("button",{name:"Simulate concurrent edit"}).click();
  assert(await page.getByRole("button",{name:"Import 4 grades",exact:true}).isDisabled());
  await page.getByRole("button",{name:"Refresh suggestions"}).click();
  assert.equal(await row().getByLabel("Review connection").count(),0,"refresh discards editor draft explicitly");
  await shown(page.getByText("Test writes: 0",{exact:true}));
  // An explicit import creates exactly one child in disposable memory, not an overall grade.
  await page.goto(base);
  await openPart();
  await row().getByLabel("Calculation for A1: Data model assignment").selectOption("equal");
  await row().getByRole("button",{name:"Use this connection · not saved yet"}).click();
  await page.getByRole("button",{name:"Import 4 grades",exact:true}).click();
  await shown(page.getByText("Test writes: 1",{exact:true}));
  await shown(page.getByText("Saved individual records: 1",{exact:true}));
  await page.getByRole("button",{name:"Reopen import"}).click();
  await shown(page.getByRole("heading",{name:"You’re up to date"}));
  assert(await page.getByRole("button",{name:"Nothing to import"}).isDisabled());
  assert.deepEqual(errors,[]);
  console.log("PASS inline part UI: one card, destination retained, no guessed rule, cancel/focus, stage/undo, special/drop-rule guards, concise review, stale refresh; zero writes before explicit in-memory import, one child saved and repeat no-op.");
}finally{await browser.close();}
