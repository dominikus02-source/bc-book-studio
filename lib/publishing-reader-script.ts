export const readerScript = String.raw`
(function(){
 "use strict";
 var root=document.documentElement;
 var pages=Array.prototype.slice.call(document.querySelectorAll(".book-page"));
 var flip=root.dataset.reader==="flipbook";
 var view=document.getElementById("book-view");
 var counter=document.getElementById("page-counter");
 var status=document.getElementById("reader-status");
 var index=0, perView=1, zoom=100, orientation="portrait", sound=false;
 var utterance=null, playing=false, audioContext=null;
 var paperFormats={
  a3:[297,420],a4:[210,297],a5:[148,210],a6:[105,148],
  b4:[250,353],b5:[176,250],b6:[125,176],"jis-b5":[182,257],
  letter:[215.9,279.4],legal:[215.9,355.6],"trade-6x9":[152.4,228.6],
  "id-14x21":[140,210],"id-15x23":[150,230]
 };
 var requestedPaper=(root.dataset.paper||"a4").toLowerCase();var currentPaper=paperFormats[requestedPaper]?requestedPaper:"a4";
 var sizeDetails=document.getElementById("paper-size-info");
 function updatePaper(){
  var size=paperFormats[currentPaper]||paperFormats.a4;
  var ratio=size[1]/size[0];
  var shape=orientation==="landscape"?1/ratio:ratio;
  if(view)view.style.setProperty("--paper-ratio",String(shape));
  if(sizeDetails)sizeDetails.textContent=currentPaper.toUpperCase()+" | "+size[0]+" x "+size[1]+" mm";
  var selector=document.getElementById("paper-size");if(selector)selector.value=currentPaper;
  if(!flip&&view){var stage=document.querySelector(".reader-stage");var avail=stage?stage.clientWidth:innerWidth;var paperW=Math.max(220,Math.min(avail-32,840,shape>1?840:900));view.style.setProperty("--html-paper-width",paperW+"px")}
  if(flip)draw();
 }
 function fitPaper(){
  if(!flip||!view)return;
  var stage=document.querySelector(".reader-stage");if(!stage)return;
  var stageTop=stage.getBoundingClientRect().top;
  var maxHeight=Math.max(180,innerHeight-stageTop-10);
  stage.style.setProperty("--reader-height",maxHeight+"px");
  var cols=perView===1?1:perView===2?2:perView===4?2:perView===6?3:4;
  var rows=Math.ceil(perView/cols);
  var gap=12,padding=12;
  var pw=paperFormats[currentPaper]||paperFormats.a4;
  var ratio=orientation==="landscape"?pw[0]/pw[1]:pw[1]/pw[0];
  var availableWidth=Math.max(160,stage.clientWidth-42);
  var widthPerPage=Math.max(120,(availableWidth-2*padding-(cols-1)*gap)/cols);
  var heightPerPage=Math.max(150,(maxHeight-2*padding-(rows-1)*gap)/rows);
  var fittedWidth=Math.max(110,Math.min(widthPerPage,heightPerPage/ratio));
  var actualWidth=fittedWidth*(zoom/100);
  var actualHeight=actualWidth*ratio;
  view.style.setProperty("--columns",String(cols));
  view.style.setProperty("--page-zoom",String(zoom/100));
  view.style.setProperty("--page-width",actualWidth+"px");
  view.style.setProperty("--page-height",actualHeight+"px");
  view.style.setProperty("--spread-width",(cols*actualWidth+(cols-1)*gap+padding*2)+"px");
  view.style.setProperty("--paper-ratio",String(ratio));
  view.dataset.orientation=orientation;
  stage.dataset.fit=zoom===100?"true":"false";
  requestAnimationFrame(function(){pages.forEach(function(page){page.dataset.overflow=String(page.scrollHeight>page.clientHeight+3)})});
 }
 function safeStorageGet(key){try{return localStorage.getItem(key)}catch(e){return null}}
 function safeStorageSet(key,val){try{localStorage.setItem(key,val)}catch(e){}}
 function applyTheme(mode){
  var theme=mode==="dark"?"dark":"light";root.dataset.theme=theme;
  var control=document.getElementById("theme-toggle");if(control){control.textContent=theme==="dark"?"Mode terang":"Mode gelap";control.setAttribute("aria-pressed",String(theme==="dark"))}
  safeStorageSet("bcbook:reader:theme",theme);
 }
 function announce(msg){if(status)status.textContent=msg}
 function stopSpeech(){
  if("speechSynthesis" in window)window.speechSynthesis.cancel();
  playing=false;utterance=null;
  var btn=document.getElementById("reader-speak");if(btn){btn.textContent="Bacakan";btn.setAttribute("aria-pressed","false")}
 }
 function speak(){
  if(!("speechSynthesis" in window)||typeof SpeechSynthesisUtterance==="undefined"){announce("Pembacaan suara belum didukung oleh browser ini.");return}
  if(playing){stopSpeech();announce("Pembacaan dihentikan.");return}
  var selected=pages.slice(index,index+perView);
  var text=selected.map(function(page){return page.innerText}).join(". ");
  if(!text.trim())return;
  window.speechSynthesis.cancel();
  utterance=new SpeechSynthesisUtterance(text);
  utterance.lang="id-ID";utterance.rate=1;
  utterance.onend=function(){playing=false;announce("Pembacaan selesai.");var btn=document.getElementById("reader-speak");if(btn){btn.textContent="Bacakan";btn.setAttribute("aria-pressed","false")}};
  utterance.onerror=function(){playing=false;announce("Layanan suara tidak tersedia atau diblokir.");var btn=document.getElementById("reader-speak");if(btn){btn.textContent="Bacakan";btn.setAttribute("aria-pressed","false")}};
  window.speechSynthesis.speak(utterance);playing=true;
  var btn=document.getElementById("reader-speak");if(btn){btn.textContent="Hentikan suara";btn.setAttribute("aria-pressed","true")}
  announce("Membacakan halaman "+(index+1)+".");
 }
 function pageSound(direction){
  if(!sound)return;
  try{
   var Ctor=window.AudioContext||window.webkitAudioContext;if(!Ctor)return;
   if(!audioContext)audioContext=new Ctor();
   if(audioContext.state==="suspended")audioContext.resume();
   var rate=audioContext.sampleRate,duration=direction>0?0.24:0.19;
   var len=Math.floor(rate*duration),buffer=audioContext.createBuffer(1,len,rate),data=buffer.getChannelData(0);
   // Original synthesized paper rustle: direction changes the attack and filtered noise.
   var seed=direction>0?7937:1597,previous=0;
   for(var n=0;n<len;n++){
    seed=(seed*1664525+1013904223)>>>0;
    var white=(seed/4294967295)*2-1;
    var progress=n/len,envelope=Math.pow(Math.sin(Math.PI*progress),direction>0?1.35:0.82);
    previous=previous*.42+white*.58;
    data[n]=previous*envelope*(direction>0?.24:.19);
   }
   var source=audioContext.createBufferSource();source.buffer=buffer;
   var filter=audioContext.createBiquadFilter();filter.type="bandpass";
   filter.frequency.value=direction>0?1600:900;filter.Q.value=.45;
   var gain=audioContext.createGain();gain.gain.value=.38;
   source.connect(filter);filter.connect(gain);gain.connect(audioContext.destination);source.start();
  }catch(e){announce("Efek suara tidak tersedia pada perangkat ini.")}
 }
 function animateTurn(direction,previousIndex){
  if(!view||!flip||root.classList.contains("reduce-motion"))return;
  if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  var stage=document.querySelector(".reader-stage");
  if(!stage)return;
  var oldPage=pages[direction>0?Math.min(previousIndex+perView-1,pages.length-1):previousIndex];
  if(!oldPage)return;
  var target=pages[index],rect=(target||oldPage).getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  var stageRect=stage.getBoundingClientRect();
  var sheet=document.createElement("div");sheet.className="page-turn-ghost "+(direction>0?"turn-forward":"turn-backward");
  sheet.setAttribute("aria-hidden","true");sheet.style.width=rect.width+"px";sheet.style.height=rect.height+"px";
  sheet.style.left=(rect.left-stageRect.left+stage.scrollLeft)+"px";
  sheet.style.top=(rect.top-stageRect.top+stage.scrollTop)+"px";
  var contents=document.createElement("div");contents.className="turn-paper-face";
  contents.innerHTML=oldPage.innerHTML;
  contents.querySelectorAll("[id]").forEach(function(el){el.removeAttribute("id")});
  sheet.appendChild(contents);stage.appendChild(sheet);
  sheet.addEventListener("animationend",function(){sheet.remove()},{once:true});
  setTimeout(function(){sheet.remove()},750);
 }
 function draw(){
  if(!flip)return;
  if(index>Math.max(0,pages.length-perView))index=Math.max(0,Math.ceil((pages.length-perView)/perView)*perView);
  pages.forEach(function(page,i){var shown=i>=index&&i<index+perView;page.hidden=!shown;page.setAttribute("aria-hidden",String(!shown));});
  fitPaper();
  var last=Math.min(index+perView,pages.length);
  if(typeof syncSidebarCurrent==="function")syncSidebarCurrent();
  if(counter)counter.textContent="Halaman "+(index+1)+"–"+last+" dari "+pages.length;
  var prev=document.getElementById("reader-prev"),next=document.getElementById("reader-next");
  if(prev)prev.disabled=index===0;
  if(next)next.disabled=index+perView>=pages.length;
  var edgePrev=document.getElementById("edge-prev"),edgeNext=document.getElementById("edge-next");
  if(edgePrev)edgePrev.disabled=index===0;
  if(edgeNext)edgeNext.disabled=index+perView>=pages.length;

 }
 function navigate(next){
  if(!flip)return;
  var target=Math.min(Math.max(0,next),Math.max(0,pages.length-1));
  target=Math.floor(target/perView)*perView;
  if(target===index)return;
  var previousIndex=index;stopSpeech();index=target;draw();animateTurn(target>previousIndex?1:-1,previousIndex);pageSound(target>previousIndex?1:-1);
  announce("Menampilkan halaman "+(index+1)+" sampai "+Math.min(index+perView,pages.length)+".");
  if(view)view.scrollIntoView({block:"start",behavior:"instant"});
 }
 function setPageCount(count){
  var n=Number(count);if([1,2,4,6,8].indexOf(n)<0)return;
  perView=n;index=Math.floor(index/perView)*perView;stopSpeech();draw();
  announce("Mode "+perView+" halaman aktif.");
 }
 function setOrientation(value){
  orientation=value==="landscape"?"landscape":"portrait";draw();
  announce("Orientasi "+orientation+" aktif.");
 }
 function setZoom(value){
  zoom=Math.min(200,Math.max(60,Number(value)||100));
  zoom=Math.round(zoom/10)*10;draw();
  var label=document.getElementById("zoom-value");if(label)label.textContent=zoom+"%";
  var smallLabel=document.getElementById("zoom-value-secondary");if(smallLabel)smallLabel.textContent=zoom+"%";
 }

 var sidebar=document.getElementById('reader-sidebar');
 var sideToggle=document.getElementById('sidebar-toggle');
 var sideClose=document.getElementById('sidebar-close');
 var backdrop=document.getElementById('sidebar-backdrop');
 var sideLinks=sidebar?Array.prototype.slice.call(sidebar.querySelectorAll('[data-page]')):[];
 var mobile=window.matchMedia('(max-width: 1023px)');
 function sidebarOpened(){return root.dataset.sidebar==='open'}
 function toggleSidebar(open,restoreFocus){
  var enabled=Boolean(open);root.dataset.sidebar=enabled?'open':'closed';
  if(sidebar){sidebar.inert=!enabled;sidebar.setAttribute('aria-hidden',String(!enabled))}
  if(sideToggle){sideToggle.setAttribute('aria-expanded',String(enabled));sideToggle.setAttribute('aria-label',enabled?'Sembunyikan daftar isi':'Tampilkan daftar isi');sideToggle.textContent=enabled?'☰ Tutup daftar isi':'☰ Daftar isi'}
  if(backdrop)backdrop.hidden=!enabled||!mobile.matches;
  if(mobile.matches)document.body.classList.toggle('sidebar-modal-open',enabled);else document.body.classList.remove('sidebar-modal-open');
  if(enabled&&mobile.matches&&sideClose)sideClose.focus();
  else if(!enabled&&restoreFocus&&sideToggle)sideToggle.focus();
  if(!mobile.matches)safeStorageSet('bcbook:reader:sidebar',enabled?'open':'closed');
  requestAnimationFrame(function(){updatePaper()});
 }
 function syncSidebarCurrent(){
  var chosen=index;
  if(!flip){var best=0,delta=Infinity;pages.forEach(function(page,i){var distance=Math.abs(page.getBoundingClientRect().top-140);if(distance<delta){delta=distance;best=i}});chosen=best}
  sideLinks.forEach(function(link,i){if(i===chosen)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')});
 }
 if(sideToggle)sideToggle.addEventListener('click',function(){toggleSidebar(!sidebarOpened(),false)});
 if(sideClose)sideClose.addEventListener('click',function(){toggleSidebar(false,true)});
 if(backdrop)backdrop.addEventListener('click',function(){toggleSidebar(false,true)});
 sideLinks.forEach(function(link){link.addEventListener('click',function(event){
  var n=Number(link.getAttribute('data-page'));if(!Number.isInteger(n)||n<0||n>=pages.length)return;
  event.preventDefault();
  if(mobile.matches)toggleSidebar(false,false);
  if(flip)navigate(n);
  else {pages[n].setAttribute('tabindex','-1');pages[n].focus({preventScroll:true});pages[n].scrollIntoView({block:'start',behavior:'instant'});}
  syncSidebarCurrent();
 })});
 document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&sidebarOpened()){ev.preventDefault();toggleSidebar(false,true)}});
 window.addEventListener('resize',function(){if(mobile.matches&&sidebarOpened())toggleSidebar(false,false);else if(sidebarOpened()&&backdrop)backdrop.hidden=true});
 if(!flip){var sidebarScrollPending=false;window.addEventListener('scroll',function(){if(sidebarScrollPending)return;sidebarScrollPending=true;requestAnimationFrame(function(){sidebarScrollPending=false;syncSidebarCurrent()})},{passive:true})}
 toggleSidebar(!mobile.matches&&safeStorageGet('bcbook:reader:sidebar')==='open',false);
 syncSidebarCurrent();
 
 var settingsPanel=document.getElementById("reader-settings");
 var settingsToggle=document.getElementById("reader-settings-toggle");
 var settingsClose=document.getElementById("reader-settings-close");
 function setSettingsOpen(open,focusBack){
  if(!settingsPanel||!settingsToggle)return;
  settingsPanel.hidden=!open;
  settingsToggle.setAttribute("aria-expanded",String(open));
  settingsToggle.setAttribute("aria-label",open?"Tutup pengaturan pembaca":"Buka pengaturan pembaca");
  if(open&&settingsClose)settingsClose.focus();
  if(!open&&focusBack)settingsToggle.focus();
  if(flip)requestAnimationFrame(fitPaper);
 }
 if(settingsToggle)settingsToggle.addEventListener("click",function(){setSettingsOpen(Boolean(settingsPanel&&settingsPanel.hidden),false)});
 if(settingsClose)settingsClose.addEventListener("click",function(){setSettingsOpen(false,true)});
 document.addEventListener("pointerdown",function(ev){
  if(settingsPanel&&!settingsPanel.hidden&&settingsToggle&&!settingsPanel.contains(ev.target)&&!settingsToggle.contains(ev.target))setSettingsOpen(false,false);
 });
 document.addEventListener("keydown",function(ev){
  if(ev.key==="Escape"&&settingsPanel&&!settingsPanel.hidden){ev.preventDefault();setSettingsOpen(false,true)}
 });
 var toggle=document.getElementById("theme-toggle");
 if(toggle)toggle.addEventListener("click",function(){applyTheme(root.dataset.theme==="dark"?"light":"dark")});
 applyTheme(safeStorageGet("bcbook:reader:theme")||(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"));
 var speakButton=document.getElementById("reader-speak");if(speakButton)speakButton.addEventListener("click",speak);
 var prev=document.getElementById("reader-prev"),next=document.getElementById("reader-next");
 if(prev)prev.addEventListener("click",function(){navigate(index-perView)});
 if(next)next.addEventListener("click",function(){navigate(index+perView)});
 var edgePrev=document.getElementById("edge-prev"),edgeNext=document.getElementById("edge-next");
 if(edgePrev)edgePrev.addEventListener("click",function(){navigate(index-perView)});
 if(edgeNext)edgeNext.addEventListener("click",function(){navigate(index+perView)});

 var paperSelect=document.getElementById("paper-size");if(paperSelect)paperSelect.addEventListener("change",function(){if(paperFormats[paperSelect.value]){currentPaper=paperSelect.value;updatePaper();announce("Ukuran buku "+paperSelect.options[paperSelect.selectedIndex].text+". Pratinjau tidak mengubah ukuran ekspor cetak.");}});
 var count=document.getElementById("page-layout");if(count)count.addEventListener("change",function(){setPageCount(count.value)});
 var orient=document.getElementById("page-orientation");if(orient)orient.addEventListener("change",function(){setOrientation(orient.value)});
 var zoomIn=document.getElementById("zoom-in"),zoomOut=document.getElementById("zoom-out");
 if(zoomIn)zoomIn.addEventListener("click",function(){setZoom(zoom+10)});
 if(zoomOut)zoomOut.addEventListener("click",function(){setZoom(zoom-10)});
 var miniZoomIn=document.getElementById("zoom-in-secondary"),miniZoomOut=document.getElementById("zoom-out-secondary");
 if(miniZoomIn)miniZoomIn.addEventListener("click",function(){setZoom(zoom+10)});
 if(miniZoomOut)miniZoomOut.addEventListener("click",function(){setZoom(zoom-10)});
 sound=safeStorageGet("bcbook:reader:turn-sound")==="on";
 var soundButton=document.getElementById("turn-sound");
 if(soundButton){function refreshSound(){soundButton.setAttribute("aria-pressed",String(sound));soundButton.textContent=sound?"Suara halaman: nyala":"Suara halaman: mute";soundButton.setAttribute("aria-label",sound?"Mute suara membalik halaman":"Unmute suara membalik halaman");}refreshSound();soundButton.addEventListener("click",function(){sound=!sound;safeStorageSet("bcbook:reader:turn-sound",sound?"on":"off");refreshSound();announce(sound?"Suara membalik halaman dinyalakan.":"Suara membalik halaman dimute.");});}

 if(flip){
  pages.forEach(function(page){
   page.addEventListener("pointermove",function(ev){
    if(page.hidden||ev.pointerType==="touch")return;
    var box=page.getBoundingClientRect(),distRight=box.right-ev.clientX,distLeft=ev.clientX-box.left,distBottom=box.bottom-ev.clientY;
    var next=distRight>=0&&distRight<74&&distBottom>=0&&distBottom<78&&index+perView<pages.length;
    var previous=distLeft>=0&&distLeft<74&&distBottom>=0&&distBottom<78&&index>0;
    page.classList.toggle("corner-peek-next",next);
    page.classList.toggle("corner-peek-prev",previous);
   });
   page.addEventListener("pointerleave",function(){page.classList.remove("corner-peek-next","corner-peek-prev")});
   page.addEventListener("click",function(ev){
    if(ev.target.closest("a,button,input,select,textarea"))return;
    var box=page.getBoundingClientRect(),bottom=box.bottom-ev.clientY;
    if(bottom<0||bottom>78)return;
    if(box.right-ev.clientX>=0&&box.right-ev.clientX<74&&index+perView<pages.length){navigate(index+perView)}
    else if(ev.clientX-box.left>=0&&ev.clientX-box.left<74&&index>0){navigate(index-perView)}
   });
  });
 }
 document.querySelectorAll(".book-toc a").forEach(function(link){link.addEventListener("click",function(event){var id=link.getAttribute("href");if(!id||id.charAt(0)!=="#")return;var target=document.getElementById(id.slice(1));if(!target)return;if(flip){event.preventDefault();var n=pages.indexOf(target);if(n>=0)navigate(n)}})});
 document.addEventListener("keydown",function(event){if(!flip||event.altKey||event.ctrlKey||event.metaKey||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement&&document.activeElement.tagName||""))return;if(event.key==="ArrowRight"||event.key==="PageDown"){event.preventDefault();navigate(index+perView)}else if(event.key==="ArrowLeft"||event.key==="PageUp"){event.preventDefault();navigate(index-perView)}});
 window.addEventListener("resize",function(){updatePaper();if(flip)draw()});
 window.addEventListener("pagehide",function(){stopSpeech();if(audioContext)audioContext.close()});
 updatePaper();
 if(flip){draw();announce("Pembaca siap. Gunakan panah kiri dan kanan untuk berpindah halaman.")}
})();
`;

