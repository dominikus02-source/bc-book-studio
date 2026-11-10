"use strict";const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
const js=ts.transpileModule(fs.readFileSync("lib/ai-usage.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandboxModule={exports:{}};vm.runInNewContext(js,{exports:sandboxModule.exports,module:sandboxModule,require(id){if(id==="./db")return {db:{}};return require(id)}});
const parse=sandboxModule.exports.parseProviderUsage;
test("OpenAI and OpenRouter usage reported",()=>{const p=parse("openai",{usage:{prompt_tokens:123,completion_tokens:45,total_tokens:168}});assert.deepEqual({...p},{inputTokens:123,outputTokens:45,totalTokens:168,reported:true})});
test("Anthropic usage input output",()=>{const p=parse("anthropic",{usage:{input_tokens:100,output_tokens:20}});assert.deepEqual({...p},{inputTokens:100,outputTokens:20,totalTokens:120,reported:true})});
test("Gemini usageMetadata",()=>{const p=parse("gemini",{usageMetadata:{promptTokenCount:310,candidatesTokenCount:90,totalTokenCount:400}});assert.deepEqual({...p},{inputTokens:310,outputTokens:90,totalTokens:400,reported:true})});
test("Unreported tokens never guessed",()=>{const p=parse("openai",{choices:[{message:{content:"ok"}}]});assert.deepEqual({...p},{inputTokens:null,outputTokens:null,totalTokens:null,reported:false})});
test("Invalid and negative values excluded",()=>{const p=parse("openai",{usage:{prompt_tokens:-50,completion_tokens:"25",total_tokens:1e30}});assert.equal(p.reported,false)});
