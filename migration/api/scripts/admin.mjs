import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("..",import.meta.url));
const wrangler=fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js",import.meta.url));
const args=process.argv.slice(2),command=args.shift(),remote=args.includes("--remote");
const option=name=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const fail=message=>{process.stderr.write(message+"\n");process.exit(1);};
const sql=value=>`'${value.replaceAll("'","''")}'`;

function run(commandText) {
  const result=spawnSync(process.execPath,[wrangler,"d1","execute","semester-staging","--config","wrangler.local.jsonc",remote?"--remote":"--local","--command",commandText],{
    cwd:root,stdio:["ignore","pipe","pipe"],encoding:"utf8",
  });
  if(result.status!==0)fail(result.stderr.trim()||result.stdout.trim()||"The D1 command failed.");
  return result.stdout;
}

if(command!=="provision")fail("Use: admin.mjs provision --issuer SUPABASE_ISSUER --subject VERIFIED_AUTH_UUID [--remote]");
const issuer=option("--issuer"),subject=option("--subject");
let issuerUrl;
try{issuerUrl=new URL(issuer);}catch{fail("--issuer must be the exact Supabase JWT issuer URL.");}
if(issuerUrl.protocol!=="https:"||issuerUrl.username||issuerUrl.password||issuerUrl.search||issuerUrl.hash||!issuerUrl.pathname.endsWith("/auth/v1"))
  fail("--issuer must be an HTTPS Supabase issuer ending in /auth/v1.");
if(!subject||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subject))
  fail("--subject must be the verified Supabase Auth user UUID, not an email.");
const timestamp=new Date().toISOString(),auditId=randomUUID();
run(`INSERT INTO admin_roles(account_id,role,granted_by_account_id,granted_at,revoked_at)
  SELECT i.account_id,'owner',NULL,${sql(timestamp)},NULL FROM pilot_identities i
  JOIN account_access a ON a.account_id=i.account_id AND a.state='active'
  WHERE i.issuer=${sql(issuerUrl.toString().replace(/\/$/,""))} AND i.subject=${sql(subject)}
  ON CONFLICT(account_id) DO UPDATE SET role='owner',granted_by_account_id=NULL,granted_at=excluded.granted_at,revoked_at=NULL;
INSERT INTO admin_audit_log(id,admin_account_id,action,target_type,target_id,before_json,after_json,result,created_at)
  SELECT ${sql(auditId)},i.account_id,'admin.bootstrap_provisioned','admin_role',i.account_id,NULL,'{"role":"owner","method":"verified_identity_operator"}','success',${sql(timestamp)}
  FROM pilot_identities i JOIN account_access a ON a.account_id=i.account_id AND a.state='active'
  WHERE i.issuer=${sql(issuerUrl.toString().replace(/\/$/,""))} AND i.subject=${sql(subject)};`);
const verification=run(`SELECT r.account_id,r.role,r.granted_at FROM admin_roles r JOIN pilot_identities i ON i.account_id=r.account_id
  WHERE i.issuer=${sql(issuerUrl.toString().replace(/\/$/,""))} AND i.subject=${sql(subject)} AND r.revoked_at IS NULL`);
if(!verification.includes("owner"))fail("No active mapped account matched that verified identity. Sign in and enrol first, then retry.");
process.stdout.write(`Provisioned one owner through the verified (issuer, subject) mapping in ${remote?"remote staging":"local D1"}.\n`);
