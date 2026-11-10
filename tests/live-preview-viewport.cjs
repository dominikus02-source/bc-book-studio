const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const origin=process.env.PREVIEW_QA_ORIGIN||'http://127.0.0.1:3106';
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const book='qa-live-viewport',chapter='qa-live-chapter';
await page.goto(origin+'/studio/live-preview?bookId='+book+'&chapterId='+chapter);
await page.getByRole('heading',{name:'Menunggu editor aktif'}).waitFor({timeout:45000});
await page.evaluate(({book,chapter})=>{
const ch=new BroadcastChannel('bcstudio:live-preview:'+book+':'+chapter);
window.qaChannel=ch;
const snapshot={type:'snapshot',bookId:book,chapterId:chapter,title:'Uji ruang baca',html:'<article class="book-chapter"><h1>Uji ruang baca</h1>'+Array.from({length:60},(_,i)=>'<p>Paragraf '+i+'. Pratinjau mengikuti ukuran jendela dan mempertahankan naskah saat area baca digulir.</p>').join('')+'</article>',dirty:false,scope:'chapter',font:'serif',size:'medium',updatedAt:Date.now()};
ch.onmessage=()=>ch.postMessage(snapshot);ch.postMessage(snapshot);
},{book,chapter});
await page.getByRole('article',{name:'Pratinjau Uji ruang baca'}).waitFor();
fs.mkdirSync('test-results/live-preview-viewport',{recursive:true});
for(const theme of ['light','dark'])for(const [width,height] of [[320,700],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080],[900,450]]){
 await page.setViewportSize({width,height});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
 const m=await page.evaluate(()=>{const shell=document.querySelector('.live-book-preview-shell'),paper=document.querySelector('.writing-preview-paper'),chapter=paper.querySelector('.book-chapter'),footer=document.querySelector('.live-book-preview-footer');const s=shell.getBoundingClientRect(),p=paper.getBoundingClientRect(),c=chapter.getBoundingClientRect(),f=footer.getBoundingClientRect();return {shellWidth:s.width,shellHeight:s.height,paperWidth:p.width,paperHeight:p.height,chapterWidth:c.width,footerBottom:f.bottom,overflow:document.documentElement.scrollWidth>innerWidth+1,pageScroll:document.documentElement.scrollHeight>innerHeight+1,scrollable:paper.scrollHeight>paper.clientHeight,available:innerHeight-p.top-(innerHeight-f.top)}});
 assert(!m.overflow,'horizontal overflow '+width);assert(!m.pageScroll,'document scrollbar '+width);
 assert(m.paperWidth>=width-42,'canvas too narrow '+width);
 assert(m.chapterWidth>=m.paperWidth-125,'chapter still capped '+width);
 assert(m.paperHeight>=m.available-15,'canvas height underfilled '+width);
 assert(m.footerBottom<=height+1,'footer outside window');
 assert(m.scrollable,'canvas must scroll long manuscript');
 const themeClear=await page.evaluate(()=>{const t=document.querySelector('.public-theme-switch').getBoundingClientRect();return [...document.querySelectorAll('.live-book-preview-actions button,.writing-preview-paper')].every(el=>{const r=el.getBoundingClientRect();return t.right<=r.left||t.left>=r.right||t.bottom<=r.top||t.top>=r.bottom})});if(!themeClear)console.log('OVERLAP',await page.evaluate(()=>[...document.querySelectorAll('.public-theme-switch,.live-book-preview-header,.live-book-preview-actions button,.writing-preview-paper')].map(e=>({cls:e.className,rect:e.getBoundingClientRect().toJSON(),padding:getComputedStyle(e).padding,top:getComputedStyle(e).top}))));assert(themeClear,'theme switch overlaps content or actions');
 console.log('PASS',theme,width+'x'+height,JSON.stringify(m));
 if([390,1440].includes(width))await page.screenshot({path:'test-results/live-preview-viewport/'+theme+'-'+width+'.png'});
}
await page.getByRole('article',{name:'Pratinjau Uji ruang baca'}).focus();
await page.keyboard.press('PageDown');
await page.waitForFunction(()=>document.querySelector('.writing-preview-paper').scrollTop>0);
await page.getByRole('button',{name:'Sambungkan ulang'}).click();
await page.getByText('Tersinkronisasi',{exact:true}).waitFor();
assert.deepEqual(errors,[]);console.log('PASS keyboard scrolling and reconnect; no JavaScript errors');
}finally{await browser.close()}})().catch(e=>{console.error(e.stack);process.exitCode=1});
