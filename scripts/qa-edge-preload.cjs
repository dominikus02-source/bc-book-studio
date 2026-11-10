// Use the installed Edge browser when the test environment explicitly requests it.
const {chromium}=require("playwright");
const launch=chromium.launch.bind(chromium);
chromium.launch=options=>launch({...options,channel:process.env.QA_BROWSER_CHANNEL||"msedge"});
