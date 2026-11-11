const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const crypto = require("node:crypto");

function loadProviders() {
  const source = fs.readFileSync("lib/providers.ts", "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }}).outputText;
  const module = { exports: {} };
  const context = {
    exports: module.exports, module, process, Buffer, AbortSignal, URL, console,
    require: id => id === "./db" ? { db: {} } : require(id),
    fetch: () => { throw Error("MOCK_NOT_INSTALLED"); }
  };
  vm.runInNewContext(output, context);
  return { api: module.exports, context };
}
test("AES-256-GCM vault roundtrip with bound record ID and no plaintext", () => {
  const old = process.env.STUDIO_SECRET_ENCRYPTION_KEY;
  process.env.STUDIO_SECRET_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  try {
    const { api } = loadProviders();
    const id = crypto.randomUUID(), secret = "a-secret-key-for-test-only-12345";
    const ciphertext = api.encryptCredential(secret, id);
    assert.ok(!ciphertext.includes(secret));
    assert.equal(api.decryptCredential(ciphertext,id), secret);
    assert.throws(()=>api.decryptCredential(ciphertext,crypto.randomUUID()));
    assert.equal(api.encryptionReady(), true);
  } finally {
    if (old===undefined) delete process.env.STUDIO_SECRET_ENCRYPTION_KEY;
    else process.env.STUDIO_SECRET_ENCRYPTION_KEY=old;
  }
});
test("provider allowlist contains nine fixed HTTPS endpoints", () => {
  const { api } = loadProviders();
  assert.equal(Object.keys(api.providerEndpoints).length, 9);
  for (const endpoint of Object.values(api.providerEndpoints)) {
    assert.ok(endpoint.startsWith("https://"));
    assert.ok(!endpoint.includes("localhost"));
  }
  assert.equal(api.credentialInput.safeParse({provider:"unknown",label:"XYZ",model:"test-model",apiKey:"long-secret-12345678",active:false}).success,false);
});
test("provider adapter matches HTTP authentication and response formats", async () => {
  const { api, context } = loadProviders();
  const models = {
    deepseek:"deepseek-flash",openai:"gpt-4.1-mini",qwen:"qwen-plus",groq:"openai/gpt-oss-120b",
    gemini:"gemini-2.5-flash",anthropic:"claude-sonnet-4-5",openrouter:"openai/gpt-4.1-mini",
    mistral:"mistral-small-latest",xai:"grok-4"
  };
  for (const [provider, model] of Object.entries(models)) {
    let called = false;
    context.fetch=async(url,init)=>{
      called=true;
      assert.ok(url.startsWith("https://"));
      assert.equal(init.method,"POST");
      assert.equal(init.redirect,"error");
      const body=JSON.parse(init.body);
      if(provider==="gemini"){
        assert.equal(init.headers["x-goog-api-key"],"fake-test-key");
        assert.ok(!init.headers.Authorization);
        assert.ok(body.contents[0].parts[0].text);
        return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:"OK"}]}}]})};
      }
      if(provider==="anthropic"){
        assert.equal(init.headers["x-api-key"],"fake-test-key");
        assert.ok(init.headers["anthropic-version"]);
        assert.equal(body.messages[0].role,"user");
        return {ok:true,json:async()=>({content:[{type:"text",text:"OK"}]})};
      }
      assert.equal(init.headers.Authorization,"Bearer fake-test-key");
      assert.equal(body.model,model);
      if(provider==="deepseek") assert.equal(body.thinking.type,"disabled");
      return {ok:true,json:async()=>({choices:[{message:{content:"OK"}}]})};
    };
    const content=await api.invokeProvider(provider,model,"fake-test-key",
      [{role:"system",content:"You are a test."},{role:"user",content:"Say OK"}],{maxTokens:32});
    assert.equal(content,"OK",provider);
    assert.equal(called,true,provider);
  }
});
test("provider errors do not echo raw response bodies or credentials", async () => {
  const { api, context } = loadProviders();
  context.fetch=async()=>({ok:false,status:403,text:async()=>"secret-from-provider"});
  await assert.rejects(api.invokeProvider("groq","openai/gpt-oss-120b","fake-test-key",[{role:"user",content:"hi"}]),error=>{
    assert.equal(error.message,"PROVIDER_HTTP_403");return true;
  });
});
test("allowedRequestOrigin accepts APP_ORIGIN when STUDIO_PUBLIC_ORIGIN is unset", () => {
  const oldPublic=process.env.STUDIO_PUBLIC_ORIGIN, oldApp=process.env.APP_ORIGIN, oldNode=process.env.NODE_ENV;
  delete process.env.STUDIO_PUBLIC_ORIGIN;
  process.env.APP_ORIGIN="https://bcbookstudio.bahasacerdas.com";
  process.env.NODE_ENV="production";
  try {
    const { api } = loadProviders();
    const publicOrigin="https://bcbookstudio.bahasacerdas.com";
    const internal="http://0.0.0.0:3000/api/settings/providers";
    const ok=new Request(internal,{method:"POST",headers:{origin:publicOrigin,"content-type":"application/json"}});
    const bad=new Request(internal,{method:"POST",headers:{origin:"https://evil.example","content-type":"application/json"}});
    const same=new Request(publicOrigin+"/api/settings/providers",{method:"POST",headers:{origin:publicOrigin,"content-type":"application/json"}});
    assert.equal(api.allowedRequestOrigin(ok),true);
    assert.equal(api.safeMutation(ok),true);
    assert.equal(api.allowedRequestOrigin(bad),false);
    assert.equal(api.safeMutation(bad),false);
    assert.equal(api.safeMutation(same),true);
  } finally {
    if(oldPublic===undefined) delete process.env.STUDIO_PUBLIC_ORIGIN; else process.env.STUDIO_PUBLIC_ORIGIN=oldPublic;
    if(oldApp===undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN=oldApp;
    if(oldNode===undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV=oldNode;
  }
});
test("DeepSeek endpoint and example model match the current official IDs", () => {
  const { api } = loadProviders();
  assert.equal(api.providerEndpoints.deepseek,"https://api.deepseek.com/chat/completions");
  assert.equal(api.providerExamples.deepseek,"deepseek-flash");
});
