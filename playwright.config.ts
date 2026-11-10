import { defineConfig } from "@playwright/test";
const origin=process.env.TEST_ORIGIN||"http://127.0.0.1:3183";
export default defineConfig({
 testMatch:["dashboard-integration.spec.ts","form-transfer.spec.ts"],
 workers:1,
 use:{
  baseURL:origin,
  launchOptions:process.platform==="win32"?{executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"}:{},
 },
 webServer:process.env.TEST_ORIGIN?undefined:{
  command:"npm run start -- -H 127.0.0.1 -p 3183",
  url:origin+"/api/health",
  reuseExistingServer:false,
  timeout:60_000,
 },
});
