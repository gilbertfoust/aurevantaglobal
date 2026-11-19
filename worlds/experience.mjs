import {places} from './scene-notes.mjs';
import {performStationAction} from './station-actions.mjs';
import {installResponses} from './responses.mjs';

const base=new URL('./',import.meta.url);
function button(name,style,icon) {
  const el=document.createElement('button');el.type='button';el.className=style;el.textContent=icon||name;
  el.setAttribute('aria-label',name);if(icon)el.title=name;return el;
}
function destination(selector) {
  const el=document.querySelector(selector);if(!el)return false;
  if(!el.matches('a,button,[tabindex]'))el.tabIndex=-1;
  el.focus({preventScroll:true});el.scrollIntoView({block:'start',behavior:'auto'});return true;
}
class ProductWorld extends HTMLElement{
  connectedCallback(){
    if(this.controller)return;
    if(!this.shadowRoot)this.attachShadow({mode:'open'});
    this.controller=new AbortController();const signal=this.controller.signal;
    this.start(signal).catch(e=>{if(!signal.aborted){this.shadowRoot.replaceChildren(document.createElement('slot'));console.warn('The illustrated view is available while the scene is offline.')}});
  }
  disconnectedCallback(){this.controller?.abort();this.controller=null;}
  async start(signal){
    const id=this.dataset.world,mode=this.dataset.mode||'app';
    if(!Object.hasOwn(places,id))throw Error('Unknown scene');
    const dir=new URL(id+'/',base);const meta=await fetch(new URL('scene.json',dir),{signal});
    if(!meta.ok)throw Error('Missing scene');
    const info=await meta.json();if(signal.aborted)return;
    this.style.setProperty('--accent',info.accent);this.style.setProperty('--sky',info.sky);
    const shadow=this.shadowRoot;shadow.innerHTML='<link rel="stylesheet"><section class="frame"><div class="stage"><img class="photo" decoding="async" alt=""><canvas class="surface" tabindex="-1"></canvas><div class="shade"></div><div class="pins"></div><div class="top"><strong class="name"></strong></div><div class="tools"></div><div class="pills" hidden></div><div class="hint" hidden></div></div><div class="dock"><div class="tabs" role="group" aria-label="Scene viewpoints"></div><div class="reading"><p class="caption"></p><button type="button" class="action" hidden></button></div></div><p class="sr" role="status" aria-live="polite"></p></section>';
    const $=s=>shadow.querySelector(s),frame=$('.frame'),stage=$('.stage'),photo=$('.photo'),canvas=$('.surface'),tools=$('.tools'),nav=$('.tabs'),caption=$('.caption'),pills=$('.pills'),hint=$('.hint'),status=$('.sr'),action=$('.action');
    $('link').href=new URL('controls.css',base).href;
    frame.setAttribute('aria-label',info.title+' interactive environment');canvas.setAttribute('aria-label','Drag to look around. Use the arrow keys to rotate, plus and minus to zoom.');canvas.setAttribute('role','img');
    const guide=mode==='cloud'?[['Use the strategy desk to open the business portfolio.','View businesses'],['Use the material library to view filings and documents.','View documents'],['Use the model table to browse the software portfolio.','View apps and games']]:places[id];const marks=[],tabs=[];let current=-1,view=info.home,engine=null,working=false,visible=false,walkMode=false,expanded=false,automatic=0,quiet=matchMedia('(prefers-reduced-motion: reduce)').matches,unavailable=false;
    const live=()=>Boolean(engine);const on=(el,event,listener)=>el.addEventListener(event,listener,{signal});
    function make(label,style,icon,group,fn){const b=button(label,style,icon);group.append(b);on(b,'click',fn);return b}
    const expand=make('Expand scene','iconbutton','⛶',$('.top'),()=>toggleExpand(!expanded));
    const enable=make('Enter 3D','mode enable',null,tools,()=>start3D(true));
    const walking=make('Walk','mode mode-label',null,tools,()=>{if(!engine)return;if(walkMode){select(-1,true);canvas.focus({preventScroll:true});return}engine.walk(view);canvas.focus({preventScroll:true});status.textContent='Walk with W A S D, the arrow keys, or the on-screen movement controls.'});
    const less=make('Zoom out','iconbutton','−',tools,()=>engine?.zoom(1.17)),more=make('Zoom in','iconbutton','+',tools,()=>engine?.zoom(.85));
    const animation=make('Pause scene motion','iconbutton','Ⅱ',tools,()=>{quiet=!quiet;engine?.setMotion(!quiet);setAnimationLabel()});
    function setAnimationLabel(){const label=quiet?'Resume scene motion':'Pause scene motion';animation.textContent=quiet?'▷':'Ⅱ';animation.title=label;animation.setAttribute('aria-label',label);animation.setAttribute('aria-pressed',String(quiet))}
    const moveDefs=[['Turn left','↶',()=>engine?.look(1)],['Move forward','↑',()=>engine?.step(1,0)],['Move backward','↓',()=>engine?.step(-1,0)],['Turn right','↷',()=>engine?.look(-1)]];
    for(const [label,icon,fn] of moveDefs)make(label,'',icon,pills,fn);
    function walkState(active){walkMode=active;walking.textContent=active?'Exit walk':'Walk';walking.setAttribute('aria-pressed',String(active));pills.hidden=!active;hint.hidden=!engine||active;self.dataset.navigating=active?'walk':'view';}
    const self=this;
    function toolbar(){for(const b of [less,more,walking])b.hidden=!engine;animation.hidden=!engine||matchMedia('(prefers-reduced-motion: reduce)').matches;enable.hidden=Boolean(engine)||unavailable;enable.disabled=working;enable.textContent=working?'Opening 3D…':'Enter 3D';hint.hidden=!engine||walkMode;hint.textContent='Drag to look around';setAnimationLabel();}
    function reposition(triples){for(const [i,m] of marks.entries()){const [x,y,front]=triples[i]||[0,0,false];m.hidden=!front||x<.025||x>.975||y<.065||y>.93;m.style.left=x*100+'%';m.style.top=y*100+'%';}}
    function fallbackPins(){if(engine)return;const rect=stage.getBoundingClientRect();if(rect.width<3||rect.height<3)return;const mul=Math.max(rect.width/info.aspect,rect.height),w=mul*info.aspect,h=mul;
      reposition(view.pins.map(([x,y,z])=>[(x*w-(w-rect.width)/2)/rect.width,(y*h-(h-rect.height)/2)/rect.height,z>0]));}
    function select(i,announce=false){
      current=i;view=i<0?info.home:info.stations[i];self.setAttribute('data-view',i<0?'home':view.id);
      $('strong.name').textContent=i<0?info.title:view.label;
      photo.src=new URL((i<0?'home':view.id)+'.webp',dir);photo.alt=i<0?info.title+' in overview':view.label+' in '+info.title;
      engine?.go(view);walkState(false);
      for(const [n,t] of tabs.entries())t.setAttribute('aria-pressed',String(n===i+1));
      for(const [n,m] of marks.entries())m.setAttribute('aria-pressed',String(n===i));
      const local=i>=0?guide[i]:null;
      caption.textContent=local?local[0]:(self.dataset.caption||'Choose a station to look closer.');
      const available=self.dataset.available!=='false';
      const label=i<0?'':mode==='catalog'?(available?'View access options':''):local?.[1];
      action.hidden=!label;action.textContent=label||'';if(announce)status.textContent=(i<0?info.title:view.label)+'. '+caption.textContent;
      fallbackPins();
    }
    tabs.push(make('Overview','home',null,nav,()=>select(-1,true)));
    for(const [i,s] of info.stations.entries()){
      const pin=make(s.label,'pin',null,$('.pins'),()=>select(i,true));pin.replaceChildren(document.createElement('i'),document.createElement('span'));pin.lastChild.textContent=s.label;marks.push(pin);
      tabs.push(make(s.label,'station',null,nav,()=>select(i,true)));
    }
    const syncExpand=()=>{expand.textContent=expanded?'×':'⛶';const label=expanded?'Close expanded scene':'Expand scene';expand.setAttribute('aria-label',label);expand.title=label;expand.setAttribute('aria-expanded',String(expanded));frame.classList.toggle('expanded',expanded);self.toggleAttribute('data-expanded',expanded);if(!engine)requestAnimationFrame(fallbackPins)};
    async function toggleExpand(want){
      expanded=want;syncExpand();
      try{if(want&&frame.requestFullscreen&&!document.fullscreenElement)await frame.requestFullscreen();else if(!want&&document.fullscreenElement)await document.exitFullscreen()}catch{}
      if(!want)expand.focus({preventScroll:true});
    }
    on(document,'fullscreenchange',()=>{if(!document.fullscreenElement&&expanded){expanded=false;syncExpand()}});
    on(shadow,'keydown',e=>{
      if([' ','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key))e.stopPropagation();
      if(e.key==='Escape'&&(walkMode||expanded)){e.preventDefault();if(walkMode)select(-1,true);else toggleExpand(false);return}
      if(expanded&&e.key==='Tab'){
        const focusable=Array.from(shadow.querySelectorAll('button:not([hidden]):not(:disabled),canvas[tabindex="0"]')).filter(el=>el.offsetWidth>0);
        if(!focusable.length)return;
        if(e.shiftKey&&shadow.activeElement===focusable[0]){e.preventDefault();focusable.at(-1).focus()}
        else if(!e.shiftKey&&shadow.activeElement===focusable.at(-1)){e.preventDefault();focusable[0].focus()}
      }
    });
    on(action,'click',()=>{
      if(current<0)return;if(expanded)toggleExpand(false);const v=info.stations[current];let ok=false;
      if(mode==='catalog')ok=destination('#access');
      else if(mode==='studio')ok=destination('#'+v.id);
      else if(mode==='cloud'){
        const page={strategy:'businesses',materials:'filings',packages:'apps'}[v.id];const control=document.querySelector('.av-nav [data-cloud-view="'+page+'"]');if(control){control.click();ok=true}
      }else if(mode==='brand'){const sel={strategy:'#services',materials:'#possibilities, #examples',packages:'#packages'}[v.id];if(sel)ok=destination(sel)}
      else ok=performStationAction(id,v.id,document);
      if(!ok){status.textContent='This station opens from the product’s main screen.';caption.textContent=status.textContent}
    });
    function offline(){engine=null;stage.classList.remove('live');canvas.tabIndex=-1;walkState(false);unavailable=true;toolbar();fallbackPins();hint.hidden=false;hint.textContent='Illustrated views';status.textContent='All three viewpoints are available as illustrations.'}
    async function start3D(manual){
      if(working||engine||unavailable||signal.aborted)return;working=true;toolbar();
      try{
        const {openWorld}=await import('./world-render.mjs');if(signal.aborted)return;
        engine=await openWorld({canvas,info,asset:new URL('environment.glb',dir).href,view,pins:reposition,changed:walkState,failed:offline,signal});
        if(signal.aborted){engine.dispose();return}
        engine.go(view);engine.setVisible(visible);engine.setMotion(!quiet);canvas.tabIndex=0;stage.classList.add('live');status.textContent=manual?'3D view ready. Drag to look around or choose a station.':'';
      }catch(e){if(!signal.aborted)offline()}finally{working=false;if(!signal.aborted)toolbar()}
    }
    const responses=mode==='app'?installResponses(this,info,canvas,()=>{}):null;
    on(this,'world-feedback',e=>engine?.feedback(e.detail?.kind,e.detail?.strength,e.detail?.value));
    on(this.ownerDocument.defaultView,'resonance:output',e=>{if(id==='resonance')engine?.output(e.detail)});
    const requested=info.stations.findIndex(s=>s.id===self.dataset.initial);
    select(requested);toolbar();syncExpand();
    const ro=new ResizeObserver(fallbackPins);ro.observe(stage);
    const io=new IntersectionObserver(([entry])=>{
      visible=entry.isIntersecting;engine?.setVisible(visible);
      clearTimeout(automatic);
      const conserve=navigator.connection?.saveData||window.matchMedia('(prefers-reduced-motion:reduce)').matches;
      if(visible&&!conserve&&!this.hasAttribute('data-intent')&&!engine&&!working)automatic=setTimeout(()=>start3D(false),320);
    },{threshold:.03});io.observe(stage);
    signal.addEventListener('abort',()=>{clearTimeout(automatic);io.disconnect();ro.disconnect();responses?.();engine?.dispose()},{once:true});
  }
}
if(!customElements.get('ri-world'))customElements.define('ri-world',ProductWorld);
