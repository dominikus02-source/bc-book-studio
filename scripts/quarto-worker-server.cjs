"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),crypto=require("node:crypto"),ts=require("typescript");
require.extensions[".ts"]=function(mod,file){const src=fs.readFileSync(file,"utf8"),result=ts.transpileModule(src,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,moduleResolution:ts.ModuleResolutionKind.Node10}});mod._compile(result.outputText,file)};
const base=path.resolve(__dirname,"..");
if(!process.env.NODE_ENV)process.env.NODE_ENV="development";
if(process.env.NODE_ENV!=="production"&&!process.env.QUARTO_BIN&&fs.existsSync(path.join(base,".env.local")))process.loadEnvFile(path.join(base,".env.local"));
const secret=process.env.QUARTO_WORKER_TOKEN||"";
if(secret.length<32)throw Error("QUARTO_WORKER_TOKEN must be at least 32 characters");
if(!process.env.QUARTO_BIN)throw Error("QUARTO_BIN is required for isolated renderer");
const host=process.env.QUARTO_WORKER_BIND||"127.0.0.1";
if(host!=="127.0.0.1"&&!(host==="0.0.0.0"&&process.env.QUARTO_WORKER_ALLOW_PRIVATE_BIND==="1"))throw Error("Worker must bind loopback unless explicitly deployed on isolated private network");
const port=Number(process.env.QUARTO_WORKER_PORT||"39319");
if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Invalid worker port");
process.env.QUARTO_ISOLATED_WORKER="1";
delete process.env.QUARTO_WORKER_URL;
const {z}=require("zod");
const {paperSizes}=require(path.join(base,"lib","paper-sizes.ts"));
const {quartoExport}=require(path.join(base,"lib","quarto.ts"));
const validIds=new Set(paperSizes.map(p=>p.id));
const src=z.object({
 contractVersion:z.literal(2),
 format:z.enum(["pdf","docx","epub"]),
 book:z.object({
  title:z.string().min(1).max(300),subject:z.string().max(300).default(""),
  pageSize:z.string().refine(x=>validIds.has(x),"Unsupported size"),
  bookType:z.string().optional(),genre:z.string().optional(),author:z.string().max(300).optional(),
  grade:z.string().default(""),publishingLayout:z.boolean(),
  chapters:z.array(z.object({title:z.string().min(1).max(300),content:z.string().max(250000)})).min(1).max(200),
  assets:z.array(z.object({id:z.string().regex(/^[a-z0-9]{6,100}$/),mime:z.enum(["image/png","image/jpeg"]),data:z.string().max(800000),altText:z.string().min(1).max(300)})).max(20).default([])
 })
}).strict();
const secretHash=crypto.createHash("sha256").update(secret).digest();
function authorized(request){const supplied=request.headers["x-worker-key"];if(typeof supplied!=="string")return false;const digest=crypto.createHash("sha256").update(supplied).digest();return crypto.timingSafeEqual(secretHash,digest)}
function json(res,status,data){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(data))}
let busy=false;
const server=http.createServer(async(req,res)=>{
 if(!authorized(req))return json(res,401,{error:"Unauthorized"});
 if(req.method==="GET"&&req.url==="/capabilities")return json(res,200,{contractVersion:2,publishingLayout:true,formats:["pdf","docx","epub"],paperSizes:paperSizes.map(p=>p.id)});
 if(req.method!=="POST"||req.url!=="/")return json(res,404,{error:"Not found"});
 if(busy)return json(res,429,{error:"Worker busy; retry with job queue"});
 busy=true;
 try{
  const chunks=[];let length=0;
  for await(const chunk of req){length+=chunk.length;if(length>14500000){json(res,413,{error:"Input too large"});return}chunks.push(chunk)}
  const parsed=src.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  if(!parsed.success)return json(res,400,{error:"Worker schema v2 mismatch"});
  const {book,format}=parsed.data;
  const bytes=Buffer.from(await quartoExport(book,format));
  if(bytes.length<500||bytes.length>20000000)throw Error("Output too large");
  const mime={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",epub:"application/epub+zip"}[format];
  res.writeHead(200,{"content-type":mime,"content-length":bytes.length,"cache-control":"no-store","x-content-type-options":"nosniff"});
  res.end(bytes);
 }catch(e){if(!res.headersSent)json(res,503,{error:"Renderer rejected manuscript"});console.error("Isolated render failed:",e instanceof Error?e.message:"unknown")}
 finally{busy=false}
});
server.requestTimeout=115000;server.headersTimeout=15000;server.keepAliveTimeout=3000;
server.listen(port,host,()=>console.log("Quarto worker v2 listening on",host+":"+port,"(token protected)"));
for(const signal of ["SIGTERM","SIGINT"])process.on(signal,()=>server.close(()=>process.exit(0)));
