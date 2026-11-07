import {test} from "@playwright/test";
import {spawn} from "node:child_process";
import {join} from "node:path";
test("XLSX/Markdown import, draft CRUD, owner isolation and no credential import",async()=>{
 test.setTimeout(90_000);
 await new Promise<void>((resolve,reject)=>{
  const child=spawn(process.execPath,[join(process.cwd(),"tests","form-transfer-e2e.cjs")],{
   cwd:process.cwd(),env:{...process.env,TEST_ORIGIN:process.env.TEST_ORIGIN||"http://127.0.0.1:3183"},stdio:["ignore","pipe","pipe"]
  });
  let output="";
  child.stdout.on("data",x=>output+=String(x).slice(-8000));
  child.stderr.on("data",x=>output+=String(x).slice(-8000));
  child.on("error",reject);
  child.on("exit",code=>code===0&&output.includes("FORM_TRANSFER_E2E_PASS")?resolve():reject(new Error("Transfer E2E failed: "+output.slice(-3500))));
 });
});
