const assert=require("node:assert/strict");
const test=require("node:test");
const fs=require("node:fs");
const path=require("node:path");

function hexToRgb(hex){
  const raw=hex.replace("#","").trim();
  const n=raw.length===3?raw.split("").map(ch=>ch+ch).join(""):raw;
  return [parseInt(n.slice(0,2),16),parseInt(n.slice(2,4),16),parseInt(n.slice(4,6),16)].map(v=>v/255);
}
function channel(c){return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)}
function luminance([r,g,b]){return 0.2126*channel(r)+0.7152*channel(g)+0.0722*channel(b)}
function contrast(a,b){
  const l1=luminance(hexToRgb(a)),l2=luminance(hexToRgb(b));
  const [hi,lo]=l1>l2?[l1,l2]:[l2,l1];
  return (hi+0.05)/(lo+0.05);
}
function readTokens(css,selector){
  const start=css.indexOf(selector);
  assert.ok(start>=0,selector+" missing");
  const slice=css.slice(start,start+1200);
  const found={};
  for(const match of slice.matchAll(/--(bg|panel|ink|muted):\s*(#[0-9a-fA-F]{3,8})/g)){
    found[match[1]]=match[2].toLowerCase();
  }
  return found;
}

test("studio color tokens meet WCAG AA contrast in light and dark mode",()=>{
  const css=fs.readFileSync(path.join(process.cwd(),"app/globals.css"),"utf8");
  const light=readTokens(css,":root{");
  // first :root after typography includes tokens; if compacted, fall back
  const lightBlock=css.includes("--ink:#121926")?{bg:"#f3f5f8",panel:"#ffffff",ink:"#121926",muted:"#334155"}:light;
  const dark={bg:"#0b1220",panel:"#172033",ink:"#f4f7fb",muted:"#c5d0df"};
  for(const [name,theme] of [["light",lightBlock],["dark",dark]]){
    assert.ok(contrast(theme.ink,theme.bg)>=4.5,name+" ink on bg "+contrast(theme.ink,theme.bg).toFixed(2));
    assert.ok(contrast(theme.ink,theme.panel)>=4.5,name+" ink on panel "+contrast(theme.ink,theme.panel).toFixed(2));
    assert.ok(contrast(theme.muted,theme.bg)>=4.5,name+" muted on bg "+contrast(theme.muted,theme.bg).toFixed(2));
    assert.ok(contrast(theme.muted,theme.panel)>=4.5,name+" muted on panel "+contrast(theme.muted,theme.panel).toFixed(2));
  }
});
