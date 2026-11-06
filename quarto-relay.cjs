"use strict";
const http=require("node:http");
http.createServer((req,res)=>{
 if(!["/health","/render"].includes(req.url)) {res.writeHead(404);return res.end()}
 const upstream=http.request({hostname:"bcstudio-quarto-worker-qa-20261106",port:3000,path:req.url,method:req.method,headers:{...req.headers,host:"bcstudio-quarto-worker-qa-20261106"}},r=>{res.writeHead(r.statusCode||502,r.headers);r.pipe(res)});
 upstream.setTimeout(110000,()=>upstream.destroy());
 upstream.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end("worker unavailable")});
 req.pipe(upstream);
}).listen(3000,"0.0.0.0",()=>console.log("QA relay listening"));
