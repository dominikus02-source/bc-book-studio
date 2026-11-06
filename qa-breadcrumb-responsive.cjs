const { chromium } = require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const sizes=[320,375,390,768,1024,1440];
 let errors=0;
 for(const width of sizes){
  const page=await browser.newPage({viewport:{width,height:800}});
  const consoleErrors=[];
  page.on('pageerror',e=>consoleErrors.push(e.message));
  const response=await page.goto('http://127.0.0.1:3199/login',{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForTimeout(250);
  const check=await page.evaluate(()=>({breadcrumbCount:document.querySelectorAll('[data-breadcrumb-host]').length,ariaNavCount:document.querySelectorAll('nav[aria-label="Jejak navigasi"]').length,overflow:document.documentElement.scrollWidth>innerWidth,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,loginForm:document.querySelectorAll('input[type=password]').length}));
  const ok=response.status()===200 && check.breadcrumbCount===1 && check.ariaNavCount===1 && !check.overflow && check.loginForm>=1 && consoleErrors.length===0;
  if(!ok)errors++;
  console.log(JSON.stringify({width,status:response.status(),...check,errors:consoleErrors,pass:ok}));
  await page.close();
 }
 await browser.close();process.exit(errors?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
