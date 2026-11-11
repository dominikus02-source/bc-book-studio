import assert from "node:assert/strict";
import test from "node:test";
import {formatActiveModel,parseActiveAiPayload,type ActiveAiModel} from "../lib/active-ai-model.ts";

test("parses the ai-form GET payload without treating the provider string as an object",()=>{
  const parsed=parseActiveAiPayload({
    configured:true,
    provider:{provider:"deepseek",label:"DeepSeek Flash",model:"deepseek-flash"}
  });
  assert.equal(parsed.configured,true);
  assert.equal(parsed.label,"DeepSeek Flash");
  assert.equal(parsed.model,"deepseek-flash");
  assert.equal(parsed.provider,"deepseek");
  assert.equal(formatActiveModel({status:"ready",...parsed}),"DeepSeek Flash · deepseek-flash");
});

test("falls back to studio status payload used by Pengaturan",()=>{
  const parsed=parseActiveAiPayload({
    database:"connected",
    ai:{configured:true,provider:"deepseek",label:"DeepSeek Flash",model:"deepseek-flash"}
  });
  assert.equal(parsed.configured,true);
  assert.equal(parsed.model,"deepseek-flash");
  assert.equal(formatActiveModel({status:"ready",...parsed}),"DeepSeek Flash · deepseek-flash");
});

test("does not claim the model is missing while status is still loading",()=>{
  const loading:ActiveAiModel={status:"loading",configured:false,label:"",model:"",provider:""};
  assert.equal(formatActiveModel(loading),"Memuat model aktif…");
  assert.equal(formatActiveModel(loading).includes("Belum dikonfigurasi"),false);
});

test("ignores empty or unconfigured payloads and never exposes a key field",()=>{
  assert.equal(parseActiveAiPayload({configured:false,provider:null}).configured,false);
  const raw={configured:true,provider:{label:"X",model:"y",encryptedKey:"secret",apiKey:"secret"}};
  const parsed=parseActiveAiPayload(raw);
  assert.equal(JSON.stringify(parsed).includes("secret"),false);
  assert.equal(formatActiveModel({status:"missing",configured:false,label:"",model:"",provider:""}),"Belum dikonfigurasi / periksa Pengaturan");
});
