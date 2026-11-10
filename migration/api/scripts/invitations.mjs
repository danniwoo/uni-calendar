import {randomBytes,randomUUID,createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("..",import.meta.url));
const wrangler=fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js",import.meta.url));
const args=process.argv.slice(2),command=args.shift();
const option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const remote=args.includes("--remote");
const fail=message=>{process.stderr.write(message+"\n");process.exit(1);};
const sqlText=value=>`'${value.replaceAll("'","''")}'`;

function run(sql) {
  const result=spawnSync(process.execPath,[wrangler,"d1","execute","semester-staging","--config","wrangler.local.jsonc",remote?"--remote":"--local","--command",sql],{
    cwd:root,stdio:["ignore","pipe","pipe"],encoding:"utf8",
  });
  if(result.status!==0)fail(result.stderr.trim()||result.stdout.trim()||"The D1 command failed.");
}

if(command==="create") {
  const hours=Number(option("--hours")??168),uses=Number(option("--uses")??1);
  const label=option("--label")??"Private beta";
  const base=option("--base-url")??"http://localhost:4174/";
  if(!Number.isInteger(hours)||hours<1||hours>24*90)fail("--hours must be an integer from 1 to 2160.");
  if(!Number.isInteger(uses)||uses<1||uses>1000)fail("--uses must be an integer from 1 to 1000.");
  if(!/^[A-Za-z0-9 ._-]{1,80}$/.test(label))fail("--label must be 1-80 plain characters.");
  let url;
  try {url=new URL(base);} catch {fail("--base-url must be a valid URL.");}
  const local=["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  if((url.protocol!=="https:"&&!(url.protocol==="http:"&&local))||url.username||url.password)fail("--base-url must use HTTPS, or local HTTP.");
  const token=randomBytes(32).toString("base64url"),hash=createHash("sha256").update(token).digest("hex");
  const id=randomUUID(),created=new Date(),expires=new Date(created.getTime()+hours*3600000);
  run(`INSERT INTO access_invitations(id,kind,token_hash,label,max_redemptions,redemption_count,expires_at,created_at) VALUES(${sqlText(id)},'private',${sqlText(hash)},${sqlText(label)},${uses},0,${sqlText(expires.toISOString())},${sqlText(created.toISOString())})`);
  url.pathname="/";url.search="";url.hash=new URLSearchParams({invite:token}).toString();
  // The raw token is printed once to the operator's terminal. D1 stores only
  // its hash; neither Wrangler output nor application logs receive the token.
  process.stdout.write(`Invitation ID: ${id}\nExpires: ${expires.toISOString()}\nUses: ${uses}\nLink (shown once): ${url.toString()}\n`);
} else if(command==="revoke") {
  const id=option("--id");
  if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))fail("Provide the invitation UUID with --id.");
  run(`UPDATE access_invitations SET revoked_at=${sqlText(new Date().toISOString())} WHERE id=${sqlText(id)} AND revoked_at IS NULL`);
  process.stdout.write(`Revocation requested for invitation ${id}.\n`);
} else {
  fail("Use: invitations.mjs create [--hours 168] [--uses 1] [--label 'Pilot'] [--base-url URL] [--remote]\n  or: invitations.mjs revoke --id UUID [--remote]");
}
