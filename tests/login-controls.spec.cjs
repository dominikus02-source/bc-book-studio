const {test,expect}=require("@playwright/test");
test.use({baseURL:process.env.LOGIN_TEST_ORIGIN||"http://127.0.0.1:3194"});
test("password visibility, autofill, remembered email, and responsive themes",async({page})=>{
 await page.goto("/login");
 const email=page.getByLabel("Alamat email"),password=page.getByLabel("Kata sandi",{exact:true});
 await expect(email).toHaveAttribute("autocomplete","username");
 await expect(password).toHaveAttribute("autocomplete","current-password");
 await email.fill("login-test@example.test");await password.fill("UI-only-test-password");
 await page.getByRole("button",{name:"Tampilkan kata sandi"}).click();
 await expect(password).toHaveAttribute("type","text");await expect(password).toHaveValue("UI-only-test-password");
 await page.getByRole("button",{name:"Sembunyikan kata sandi"}).click();
 await expect(password).toHaveAttribute("type","password");
 let payload;
 await page.route("**/api/auth/login",async route=>{payload=route.request().postDataJSON();await route.fulfill({status:401,json:{error:"Uji login ditolak"}})});
 await page.getByLabel("Ingat email saya di perangkat ini").check();
 await page.getByRole("button",{name:"Masuk ke Studio"}).click();
 await expect(page.locator(".form-error[role=alert]")).toHaveText("Uji login ditolak");
 expect(await page.evaluate(()=>localStorage.getItem("bcstudio.login.email"))).toBeNull();
 expect(payload).toEqual({email:"login-test@example.test",password:"UI-only-test-password"});
 await page.unroute("**/api/auth/login");
 await page.route("**/api/auth/login",route=>route.fulfill({status:200,json:{success:true}}));
 await page.route("**/studio",route=>route.fulfill({contentType:"text/html",body:"<h1>Mock studio</h1>"}));
 await page.getByRole("button",{name:"Masuk ke Studio"}).click();await page.waitForURL("**/studio");
 expect(await page.evaluate(()=>localStorage.getItem("bcstudio.login.email"))).toBe("login-test@example.test");
 expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain("UI-only-test-password");
 await page.goto("/login");await expect(email).toHaveValue("login-test@example.test");
 await expect(password).toHaveValue("");await expect(page.getByLabel("Ingat email saya di perangkat ini")).toBeChecked();
 await page.getByLabel("Ingat email saya di perangkat ini").uncheck();await page.reload();await expect(email).toHaveValue("");
 for(const width of [320,375,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const theme of ["light","dark"]){
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
   const toggle=page.getByRole("button",{name:"Tampilkan kata sandi"});
   const box=await toggle.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
   await toggle.focus();await page.keyboard.press("Enter");await expect(password).toHaveAttribute("type","text");
   await page.keyboard.press("Enter");await expect(password).toHaveAttribute("type","password");
  }
 }
 await page.screenshot({path:"test-results/login-controls.png",fullPage:true});
 await page.goto("/reset-password?token=ui-test");await expect(page.getByLabel("Kata sandi",{exact:true})).toHaveAttribute("autocomplete","new-password");
 await page.getByRole("button",{name:"Tampilkan kata sandi"}).click();await expect(page.getByLabel("Kata sandi",{exact:true})).toHaveAttribute("type","text");
 await page.goto("/activate?token=ui-test");await expect(page.getByLabel("Kata sandi",{exact:true})).toHaveAttribute("autocomplete","new-password");
});
