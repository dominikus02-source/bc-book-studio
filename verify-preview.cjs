(async()=>{
for(const path of ['/','/api/health']){
const r=await fetch('http://127.0.0.1:3181'+path);console.log('DEPLOYED '+path+' HTTP '+r.status);if(r.status!==200)throw Error('health failed');
}
const r=await fetch('https://preview-bookstudio.bahasacerdas.com',{redirect:'manual'});
console.log('EXTERNAL_PREVIEW_HTTP='+r.status);
console.log('ACCESS_REDIRECT_HOST='+new URL(r.headers.get('location')).hostname);
if(r.status!==302)throw Error('Expected Access protection');
})().catch(e=>{console.error(e.message);process.exitCode=1});