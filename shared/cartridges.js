/* The same real-shaped cartridge and online box artwork across Lae's Playlog and NES Playlog. */
(()=>{'use strict';
const ROOT='https://thumbnails.libretro.com/';
const CDN='Nintendo - Nintendo Entertainment System';
const FDS='Nintendo - Family Computer Disk System';
const STORE_KEY='laes-playlog-cover-index-v1';
const memory=new Map(),failures=new Set();
try{const raw=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');for(const [id,url] of Object.entries(raw))if(typeof url==='string'&&url.startsWith(ROOT))memory.set(id,url);}catch(_){}
const safeName=t=>String(t||'').replace(/[&*/:<>?\\|]/g,'_');
const unique=xs=>[...new Set(xs.filter(Boolean))];
const seed=(g)=>{let x=0;for(const c of (g.id||g.title||''))x=Math.imul(x,31)+c.charCodeAt(0)|0;return ['#b4574f','#587985','#86674d','#6b678b','#4d827c','#ae7f52'][(x>>>0)%6]};
function options(g){
 const dir=g.region==='FDS'?FDS:CDN,base=ROOT+encodeURIComponent(dir)+'/Named_Boxarts/';
 const manifest=window.NES_COVER_MANIFEST||{},verified={'Castlevania III: Dracula\'s Curse':["Castlevania III - Dracula's Curse (USA)"],'Final Fantasy III':['Final Fantasy III (Japan)'],'Kirby\'s Adventure':["Kirby's Adventure (USA)"],'Mega Man 2':['Mega Man 2 (USA)'],'Super Mario Bros.':['Super Mario Bros. (World)'],'Super Mario Bros. 3':['Super Mario Bros. 3 (USA) (Rev 1)']},stems=[...(verified[g.title]||[]),...(manifest[g.title]||[])];
 if(g.prototype||g.region==='HOME')return [];
 const rawNames=[g.title,g.title.replace(/: /g,' - '),g.title.replace(/^The (.+)$/,'$1, The'),...(g.aliases||[]).slice(0,2)];
 for(const raw of rawNames){if(!raw)continue;const name=raw.replace(/^The (.+)$/,'$1, The');
  for(const n of unique([raw,name]))for(const suf of (g.region==='FDS'||g.region==='JP'?['Japan','USA','Europe','World']:['USA','Europe','World','Japan']))stems.push(n+' ('+suf+')');
  stems.push(raw);
 }
 const urls=unique(stems.map(x=>base+encodeURIComponent(safeName(x))+'.png')).slice(0,8);
 if(memory.has(g.id))urls.unshift(memory.get(g.id));
 return unique(urls);
}
function persist(id,url){memory.set(id,url);try{const entries=[...memory].slice(-320);localStorage.setItem(STORE_KEY,JSON.stringify(Object.fromEntries(entries)));}catch(_){}}
function create(g,opts={}){
 const cart=document.createElement('div');cart.className='playlog-cartridge'+(opts.small?' playlog-cartridge-small':'');cart.style.setProperty('--cart-tone',seed(g));cart.title=g.title;
 const lip=document.createElement('div');lip.className='playlog-cart-groove';
 const label=document.createElement('div');label.className='playlog-cart-label';
 const text=document.createElement('div');text.className='playlog-cart-fallback';
 const caption=document.createElement('small');caption.textContent=g.region==='FDS'?'DISK SYSTEM':'GAME PAK';
 const name=document.createElement('strong');name.textContent=g.title;
 const release=document.createElement('small');release.textContent=(g.year||'198X')+' · 8 BIT';text.append(caption,name,release);label.append(text);cart.append(lip,label);
 if(opts.artwork!==false&&navigator.onLine!==false){const sources=options(g),img=document.createElement('img');img.className='playlog-cover-img';img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
 let i=0;function next(){while(i<sources.length&&failures.has(sources[i]))i++;if(i>=sources.length){img.remove();return;}img.src=sources[i];}
 img.addEventListener('load',()=>{if(img.naturalWidth>0){label.classList.add('has-artwork');persist(g.id,sources[i]);}});
 img.addEventListener('error',()=>{if(sources[i])failures.add(sources[i]);i++;next();});
 if(sources.length){label.append(img);next();}}
 return cart;
}
window.PlaylogCartridges={create,options};
})();