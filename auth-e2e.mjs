import {createServer} from "node:net";
import {spawn} from "node:child_process";
import {randomBytes} from "node:crypto";
import {PrismaClient} from "@prisma/client";
const prisma=new PrismaClient({datasources:{db:{url:"postgresql://postgres@127.0.0.1:55439/postgres"}}});
const emails=[];
const smtp=createServer(socket=>{
 socket.write("220 qa-mail.local ESMTP ready\r\n");
 let buffer="", inData=false, data="", login=0;
 socket.on("data",chunk=>{
  buffer+=chunk.toString();
  let end;
  while((end=buffer.indexOf("\n"))!==-1){
   const line=buffer.slice(0,end).replace(/\r$/,"");buffer=buffer.slice(end+1);
   if(inData){if(line==="."){emails.push(data);data="";inData=false;socket.write("250 Accepted\r\n");}else data+=line+"\n";continue;}
   const cmd=line.toUpperCase();
   if(cmd.startsWith("EHLO")||cmd.startsWith("HELO"))socket.write("250-qa-mail.local\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 100000\r\n");
   else if(cmd.startsWith("AUTH PLAIN"))socket.write("235 Authenticated\r\n");
   else if(cmd.startsWith("AUTH LOGIN")){login=1;socket.write("334 VXNlcm5hbWU6\r\n");}
   else if(login===1){login=2;socket.write("334 UGFzc3dvcmQ6\r\n");}
   else if(login===2){login=0;socket.write("235 Authenticated\r\n");}
   else if(cmd.startsWith("MAIL FROM")||cmd.startsWith("RCPT TO"))socket.write("250 OK\r\n");
   else if(cmd==="DATA"){inData=true;socket.write("354 End with <CRLF>.<CRLF>\r\n");}
   else if(cmd==="QUIT"){socket.write("221 Bye\r\n");socket.end();}
   else socket.write("250 OK\r\n");
  }
 });
});
smtp.listen(25257,"127.0.0.1");
const cwd="F:\\bc-book-auth-release-20261106";
const env={...process.env,DATABASE_URL:"postgresql://postgres@127.0.0.1:55439/postgres",SMTP_HOST:"127.0.0.1",SMTP_PORT:"25257",SMTP_SECURE:"false",SMTP_USER:"qa",SMTP_APP_PASSWORD:"qa",SMTP_FROM:"qa@example.test",APP_ORIGIN:"http://localhost:3188"};
const next=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p","3188"],{cwd,env,stdio:"ignore"});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function send(action,data,opts={}){const r=await fetch("http://127.0.0.1:3188/api/auth/"+action,{method:"POST",headers:{"content-type":"application/json",...(opts.cookie?{cookie:opts.cookie}:{})},body:JSON.stringify(data)});return{status:r.status,cookie:r.headers.get("set-cookie"),body:await r.json()}}
async function tokenFromEmail(){for(let i=0;i<30;i++){if(emails.length){const msg=emails.shift().replace(/=\r?\n/g,"").replace(/=3D/g,"=");const m=msg.match(/token=([a-f0-9]{64})/);if(m)return m[1];throw Error("SMTP message had no token")};await wait(100)}throw Error("No SMTP message received")}
const check=(x,message)=>{if(!x)throw Error(message)};
let tests=0;const ok=()=>tests++;
try{
 let ready=false;for(let i=0;i<40;i++){try{const r=await fetch("http://127.0.0.1:3188/login");if(r.ok){ready=true;break}}catch{}await wait(250)}
 check(ready,"App not ready");
 const marker=randomBytes(4).toString("hex");
 const unknown="unknown-"+marker+"@example.test";
 let res=await send("request-activation",{email:unknown});check(res.status===200,"Unknown activation must respond generically");ok();
 check((await prisma.studioUser.count({where:{email:unknown}}))===0,"Unknown created user");ok();
 for(let index=0;index<4;index++){
  const email="qa-"+marker+"-"+index+"@example.test";
  const oldPass="QA-Strong-Old-"+randomBytes(10).toString("hex");
  const newPass="QA-Strong-New-"+randomBytes(10).toString("hex");
  await prisma.studioUser.create({data:{email,name:"QA User "+index,role:"EDITOR"}});
  res=await send("request-activation",{email});check(res.status===200,"Activation request failed "+index);
  const activation=await tokenFromEmail();ok();
  res=await send("activate",{token:activation,password:oldPass});check(res.status===200,"Activation failed "+index);ok();
  res=await send("activate",{token:activation,password:oldPass});check(res.status===400,"Activation reused "+index);ok();
  res=await send("login",{email,password:"bad-pass"});check(res.status===401,"Wrong password accepted "+index);ok();
  res=await send("login",{email,password:oldPass});check(res.status===200&&res.cookie?.includes("HttpOnly")&&res.cookie?.includes("SameSite=lax"),"Login/cookie failed "+index);ok();
  let cookie=res.cookie.split(";")[0];
  const me=await fetch("http://127.0.0.1:3188/api/auth/me",{headers:{cookie}});check(me.status===200&&(await me.json()).authenticated,"Session not active "+index);ok();
  res=await send("forgot-password",{email});check(res.status===200,"Reset request failed "+index);
  const resetToken=await tokenFromEmail();ok();
  res=await send("reset-password",{token:resetToken,password:newPass});check(res.status===200,"Reset failed "+index);ok();
  res=await send("login",{email,password:oldPass});check(res.status===401,"Old password accepted after reset "+index);ok();
  res=await send("login",{email,password:newPass});check(res.status===200,"New password rejected "+index);ok();
  cookie=res.cookie.split(";")[0];
  res=await send("logout",{}, {cookie});check(res.status===200,"Logout failed "+index);ok();
  const after=await fetch("http://127.0.0.1:3188/api/auth/me",{headers:{cookie}});check(!(await after.json()).authenticated,"Logout session not revoked "+index);ok();
 }
 console.log("AUTH_E2E_PASS synthetic_invited_users=4 checks="+tests+" isolated_db=true fake_smtp=true");
}catch(e){console.error("AUTH_E2E_FAIL",e.message);process.exitCode=1}finally{next.kill();await prisma.$disconnect();smtp.close()}
