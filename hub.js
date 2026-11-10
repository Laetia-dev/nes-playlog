/* Lae's Playlog v9. Account-free multi-console shell. NES data stays in the historical nes-playlog-v2 key. */
(()=>{'use strict';
const KEY='nes-playlog-v2',PROFILE_KEY='laes-playlog-profile-v1',VERSION=9;
const $=id=>document.getElementById(id);
const statCodes=['unplayed','tried','played','finished','mastered'];
const statusName={unplayed:'NOT PLAYED',tried:'TRIED',played:'PLAYED',finished:'FINISHED',mastered:'MASTERED'};
const defaultProfile=()=>({name:'PLAYER 1',bio:'',motto:'THE CARTRIDGE REMEMBERS',avatar:'P1',accent:'red',featured:[],pinnedAchievement:''});
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const unique=arr=>[...new Set(arr.filter(Boolean))];
const slug=t=>String(t).normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const titleKey=t=>slug(t||'');
const catalog=window.NES_CATALOG||[],museum=window.NES_MUSEUM||{extraGames:[],series:[],exhibitions:[]};
const credits=window.NES_CREDITS||{},taxonomy=window.NES_TAXONOMY||{};
const builtIn=[...catalog.map(g=>({...g,id:`nes:${slug(g.title)}:${g.year}`,aliases:museum.aliases?.[g.title]||[],genres:unique([...(museum.gameGenre?.[g.title]||[]),...(taxonomy[g.title]?.genres||[])]),tags:taxonomy[g.title]?.tags||[],developer:g.developer||credits[g.title]?.developer||'',console:'nes'})),...(museum.extraGames||[]).map(g=>({...g,id:`nes-extra:${slug(g.title)}:${g.year}`,console:'nes'}))];
const nameIndex=new Map();for(const g of builtIn)for(const name of [g.title,...(g.aliases||[])]){const key=titleKey(name);if(!nameIndex.has(key))nameIndex.set(key,g);}
const byName=t=>nameIndex.get(titleKey(t));
const SERIES=museum.series||[],EXHIBITIONS=museum.exhibitions||[];
const palette=['#bb6250','#647d83','#8c6848','#716ca5','#528480','#9e6a77'];
const getColor=g=>{let n=0;for(const c of g.id)n=(Math.imul(31,n)+c.charCodeAt(0))|0;return palette[(n>>>0)%palette.length];};
const ACCENTS={red:'#e77b79',gold:'#e4be75',teal:'#82cab9',purple:'#b9a5d9',blue:'#91bfea'};
let toastTimer,viewFilter='all',query='',visitor=null,visitorFilter='all';
function notify(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('on'),3200);}
function readNES(){try{const parsed=JSON.parse(localStorage.getItem(KEY)||'null');if(isObj(parsed))return{...parsed,records:isObj(parsed.records)?parsed.records:{},unlocks:isObj(parsed.unlocks)?parsed.unlocks:{},custom:Array.isArray(parsed.custom)?parsed.custom:[],profile:isObj(parsed.profile)?parsed.profile:defaultProfile()};}catch(e){console.warn('NES data could not be loaded',e);}return{version:VERSION,records:{},unlocks:{},custom:[],settings:{theme:'nes',coverArt:true},profile:defaultProfile()};}
function saveNES(data){try{localStorage.setItem(KEY,JSON.stringify(data));return true;}catch(e){notify('Browser storage unavailable, export your data.');return false;}}
function cleanProfile(p){const base=defaultProfile();if(!isObj(p))return base;return {name:typeof p.name==='string'?(p.name.trim().slice(0,32)||base.name):base.name,bio:typeof p.bio==='string'?p.bio.slice(0,180):'',motto:typeof p.motto==='string'?p.motto.slice(0,60):base.motto,avatar:['P1','✦','★','◆','☾','♡','♟'].includes(p.avatar)?p.avatar:'P1',accent:Object.hasOwn(ACCENTS,p.accent)?p.accent:'red',featured:Array.isArray(p.featured)?unique(p.featured.filter(x=>typeof x==='string')).slice(0,3):[],pinnedAchievement:typeof p.pinnedAchievement==='string'?p.pinnedAchievement:''};}
function readProfile(){try{const hub=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');if(hub)return cleanProfile(hub);}catch(e){}return cleanProfile(readNES().profile);}
function saveProfile(p){const profile=cleanProfile(p);try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));}catch(e){notify('Unable to save passport locally.');return;}
 // Mirror display profile into the old NES file so Version 8 backups and the NES museum still understand it.
 const nes=readNES();nes.profile=profile;saveNES(nes);notify('Your Playlog passport has been saved.');render();}
function allGames(nes=readNES()){return [...builtIn,...nes.custom.filter(g=>g&&typeof g.id==='string'&&g.id.startsWith('custom:')&&typeof g.title==='string').map(g=>({...g,console:'nes'}))];}
function state(id,nes=readNES()){const r=nes.records[id];return isObj(r)?r:{status:'unplayed'};}
function status(r){return statCodes.includes(r?.status)?r.status:r?.played===true?'played':'unplayed';}
function hasPlayed(r){return status(r)!=='unplayed';}
function isFinished(r){return ['finished','mastered'].includes(status(r));}
function metrics(nes=readNES(),games=allGames(nes)){
 let tried=0,played=0,finished=0,mastered=0,want=0,fav=0,notes=0,rated=0,yearSet=new Set(),genres=new Set(),goals=0,goalsMet=0,simGoal=0;
 for(const g of games){const r=state(g.id,nes),s=status(r);if(s==='tried')tried++;if(s==='played')played++;if(s==='finished')finished++;if(s==='mastered')mastered++;if(r.wantToPlay)want++;if(r.favorite)fav++;if(r.note?.trim())notes++;if(r.rating)rated++;if(r.goal?.trim()){goals++;if(isFinished(r)){goalsMet++;if((g.genres||[]).some(t=>/strategy|simulat|management/i.test(t)))simGoal++;}}if(hasPlayed(r)){if(g.year)yearSet.add(g.year);for(const tag of g.genres||[])genres.add(tag);}}
 return{tried,played,finished,mastered,seen:tried+played+finished+mastered,fin:finished+mastered,fav,want,notes,rated,years:yearSet.size,genreCount:genres.size,goals,goalsMet,simGoal,total:games.length,custom:nes.custom.length};}
function seriesGames(series){return unique((series.titles||[]).map(n=>byName(n)?.id)).map(id=>builtIn.find(g=>g.id===id)).filter(Boolean);}
function seriesAwards(series,nes){const games=seriesGames(series),played=games.filter(g=>hasPlayed(state(g.id,nes))).length,finished=games.filter(g=>isFinished(state(g.id,nes))).length,mainlineIds=new Set((series.mainline||series.titles||[]).map(n=>byName(n)?.id).filter(Boolean)),core=games.filter(g=>mainlineIds.has(g.id)),coreDone=core.filter(g=>isFinished(state(g.id,nes))).length,threshold=games.length>=3?3:1;
 let arr=[{id:series.id==='mario'?'mario-collector':`series-${series.id}-explore`,name:`${series.name}: First Steps`,desc:`Experience ${threshold} game${threshold>1?'s':''} in the NES series.`,target:threshold,value:played,stage:'Explore'}];
 if(core.length>1&&core.length<games.length)arr.push({id:`series-${series.id}-mainline`,name:`${series.name}: Mainline Master`,desc:`Finish all ${core.length} mainline NES games. Spin-offs are optional.`,target:core.length,value:coreDone,stage:'Mainline'});
 arr.push({id:`series-${series.id}-complete`,name:`${series.name}: Complete Set`,desc:`Finish all ${games.length} NES and Famicom entries in the series, including spin-offs.`,target:games.length,value:finished,stage:'Complete'});
 return arr.map(a=>({...a,kind:'series',seriesId:series.id,earned:Boolean(nes.unlocks[a.id])||(a.target>0&&a.value>=a.target)}));}
function exhibitionCount(id,nes){const x=EXHIBITIONS.find(e=>e.id===id);if(!x)return 0;const games=x.games||x.groups?.flatMap(g=>g.games)||[];return unique(games.map(pair=>byName(pair[0])?.id)).filter(g=>hasPlayed(state(g,nes))).length;}
function generalAwards(nes,m){const vals=[
 ['hello','First Contact','Play or try your first NES game.',1,m.seen],
 ['eight','Eight Bits of History','Explore 8 different NES games.',8,m.seen],
 ['twentyfive','Shelf Starter','Explore 25 different games.',25,m.seen],
 ['fifty','Seasoned Explorer','Explore 50 different games.',50,m.seen],
 ['hundred','The Hundred Club','Explore 100 different games.',100,m.seen],
 ['quarter','Quarter of the Archive','Explore a quarter of the NES catalog.',25,m.total?m.seen/m.total*100:0],
 ['credits','Roll the Credits','Finish your first NES game.',1,m.fin],
 ['fin10','Boss Slayer','Finish 10 NES games.',10,m.fin],
 ['master','Beyond the Ending','Master a game completely.',1,m.mastered],
 ['masters5','Perfectionist','Master 5 games completely.',5,m.mastered],
 ['favs3','A Few Beloved Worlds','Favorite 3 games.',3,m.fav],
 ['favs10','The Heart Collection','Favorite 10 games.',10,m.fav],
 ['memory','Memory Keeper','Write a game memory.',1,m.notes],
 ['diary10','Dear Diary','Write memories for 10 games.',10,m.notes],
 ['timetravel','Time Traveler','Explore 5 different release years.',5,m.years],
 ['curator','Guest Curator','Add a custom NES or Famicom title.',1,m.custom],
 ['backlog','Next Cartridge','Add your first Want to Play game.',1,m.want],
 ['backlog10','The Backlog Shelf','Save 10 games you want to play.',10,m.want],
 ['essential-scout','Through the Door','Try 5 NES Essentials.',5,exhibitionCount('essentials',nes)],
 ['essential-expert','Essential Historian','Experience all 20 NES Essentials.',20,exhibitionCount('essentials',nes)],
 ['gem-seeker','Gem Seeker','Explore 5 hidden gems.',5,exhibitionCount('gems',nes)],
 ['pal-traveler','Cartridge Hunter','Explore 5 Cartridge Treasures.',5,exhibitionCount('europe',nes)],
 ['jrpg-pioneer','JRPG Pioneer','Experience 5 games from JRPG Origins.',5,exhibitionCount('jrpg',nes)],
 ['strategist','Master Planner','Experience 5 simulation and strategy games.',5,exhibitionCount('strategy',nes)],
 ['personal-goal','My Own Victory','Write a personal completion goal.',1,m.goals],
 ['personal-goals-five','Five Roads to Victory','Finish five of your personal goals.',5,m.goalsMet],
 ['genre-five','Genre Wanderer','Explore five tagged genres.',5,m.genreCount],
 ['genre-ten','8-bit Omnivore','Explore ten tagged genres.',10,m.genreCount],
 ['sim-goal','Master of Systems','Finish a personal strategy or simulation goal.',1,m.simGoal],
 ['archive-diary','Field Researcher','Rate 20 NES games.',20,m.rated]
 ];return vals.map(([id,name,desc,target,value])=>({id,name,desc,target,value,kind:'general',earned:Boolean(nes.unlocks[id])||(value>=target)}));}
function awards(nes=readNES(),m=metrics(nes)){return [...generalAwards(nes,m),...SERIES.flatMap(s=>seriesAwards(s,nes))];}
function unlockEarned(nes){const list=awards(nes),now=Date.now();let count=0;for(const a of list)if(a.earned&&!nes.unlocks[a.id]){nes.unlocks[a.id]=now;count++;}return count;}
function setStatus(id,value){if(!statCodes.includes(value))return;const nes=readNES(),games=allGames(nes);if(!games.some(g=>g.id===id))return;const old=isObj(nes.records[id])?nes.records[id]:{};nes.records[id]={...old,status:value,updatedAt:Date.now()};if(value!=='unplayed')nes.records[id].wantToPlay=false;unlockEarned(nes);saveNES(nes);notify('Your game progress is saved locally.');render();}
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function link(href,cls,text){const a=node('a',cls,text);a.href=href;return a;}
function openGameURL(g){return './nes/archive.html?game='+encodeURIComponent(g.id);}
function cartridge(g){const p=node('div','mini-pak'),label=node('div','pak-label');label.style.setProperty('--pak-color',getColor(g));label.append(node('small','',g.console==='nes'?'NES':'GAME'),node('strong','',g.title.slice(0,35)),node('small','',String(g.year||'8 BIT')));p.append(label);return p;}
function gameTile(g,nes,allowEdit=false){const r=state(g.id,nes),s=status(r),el=node('article',allowEdit?'game-tile':'shelf-card'),a=link(openGameURL(g),'');a.append(cartridge(g));const copy=node('div','shelf-text');copy.append(node('strong','',g.title),node('span','',`NES · ${g.year||'UNKNOWN'}`),node('small','',statusName[s]+(r.otherVersionStatus&&r.otherVersionStatus!=='none'?' · OTHER VERSION':'')));a.append(copy);el.append(a);
 if(allowEdit){const bottom=node('div','tile-controls'),badge=node('span','status-badge',r.favorite?'★ FAVORITE':'GAME RECORD'),sel=node('select');sel.setAttribute('aria-label',`Progress for ${g.title}`);for(const v of statCodes){const opt=new Option(statusName[v],v);sel.add(opt);}sel.value=s;sel.addEventListener('change',()=>setStatus(g.id,sel.value));bottom.append(badge,sel);el.append(bottom);}return el;}
function renderHome(){const nes=readNES(),profile=readProfile(),gs=allGames(nes),m=metrics(nes,gs),a=awards(nes,m),earned=a.filter(x=>x.earned).length;
 const put=(id,value)=>{if($(id))$(id).textContent=String(value)};
 put('homeName',profile.name);put('homeAvatar',profile.avatar);put('homeMotto',profile.motto);put('homeBio',profile.bio||'Every game is another little piece of your story.');put('homePlayed',m.seen);put('homeFinished',m.fin);put('homeMastered',m.mastered);put('homeStars',earned);put('nesGames',gs.length);put('nesExperienced',m.seen);put('homeTrophyFraction',`${earned}/${a.length}`);
 const recent=gs.filter(g=>hasPlayed(state(g.id,nes))).sort((x,y)=>(state(y.id,nes).updatedAt||0)-(state(x.id,nes).updatedAt||0)).slice(0,6),root=$('recentGames');root.replaceChildren(...(recent.length?recent.map(g=>gameTile(g,nes)):[node('div','empty','Your collection begins with one cartridge. Visit the NES archive and record your first game.')]));
 const starred=SERIES.map(s=>({series:s,stars:seriesAwards(s,nes)})).sort((a,b)=>b.stars.filter(x=>x.earned).length-a.stars.filter(x=>x.earned).length).slice(0,6);renderSeriesGrid($('homeSeriesStars'),starred);
 const preview=$('homeStarRow');preview.replaceChildren(...a.slice(0,5).map(x=>node('span','star '+(x.earned?'full':'locked'),x.earned?'★':'☆')));
}
function renderCollection(){const nes=readNES(),gs=allGames(nes),m=metrics(nes,gs);for(const [id,n] of [['colTried',m.tried],['colPlayed',m.played],['colFinished',m.finished],['colMastered',m.mastered]]){if($(id))$(id).textContent=String(n);}
 const selection=gs.filter(g=>{const r=state(g.id,nes),s=status(r);if(query&&!([g.title,...(g.aliases||[]),r.otherVersionName||''].join(' ').toLowerCase().includes(query)))return false;if(viewFilter==='all')return s!=='unplayed';if(viewFilter==='other')return ['played','finished'].includes(r.otherVersionStatus);if(viewFilter==='want')return r.wantToPlay===true;if(viewFilter==='favorite')return r.favorite===true;return s===viewFilter;}).sort((a,b)=>(state(b.id,nes).updatedAt||0)-(state(a.id,nes).updatedAt||0)||a.title.localeCompare(b.title));
 $('collectionResult').textContent=`${selection.length} GAMES ON THIS SHELF`;const limit=250;$('collectionCards').replaceChildren(...selection.slice(0,limit).map(g=>gameTile(g,nes,true)));
 $('collectionEmpty').hidden=selection.length>0;$('collectionLimit').textContent=selection.length>limit?`Showing the most recent ${limit} games. Use search to find older entries.`:'';
 document.querySelectorAll('[data-collection]').forEach(btn=>{const active=btn.dataset.collection===viewFilter;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
}
function renderSeriesGrid(root,rows,explicitEarned=null){root.replaceChildren(...rows.map(({series,stars})=>{const item=node('div','series-row'),info=node('div','series-info');info.append(link(`./nes/index.html#series/${encodeURIComponent(series.id)}`,'',series.name),node('small','',`${stars.filter(s=>explicitEarned?explicitEarned.has(s.id):s.earned).length} / ${stars.length} STARS`));const track=node('div','series-stars');for(const award of stars){const yes=explicitEarned?explicitEarned.has(award.id):award.earned,star=node('span','star '+(yes?'full':'locked'),yes?'★':'☆');star.title=`${award.stage}: ${award.desc}${yes?' · earned':` · ${Math.min(award.value,award.target)}/${award.target}`}`;star.setAttribute('role','img');star.setAttribute('aria-label',`${series.name} ${award.stage}: ${yes?'earned':'locked'}`);track.append(star);}item.append(info,track);return item;}));}
function renderPassport(){const nes=readNES(),p=readProfile(),games=allGames(nes),m=metrics(nes,games),all=awards(nes,m),earned=all.filter(x=>x.earned);$('passportName').textContent=p.name;$('passportMotto').textContent=p.motto;$('passportBio').textContent=p.bio||'A lifetime of games, one memory at a time.';$('passportAvatar').textContent=p.avatar;$('passportAvatar').style.background=ACCENTS[p.accent];$('passportBadgeCount').textContent=`${earned.length} / ${all.length}`;
 $('passportTotals').textContent=`${m.seen} VISITED · ${m.fin} FINISHED · ${m.mastered} MASTERED`;
 const featured=p.featured.map(id=>games.find(g=>g.id===id)).filter(Boolean);const list=featured.length?featured:games.filter(g=>state(g.id,nes).favorite).slice(0,3);$('featuredGames').replaceChildren(...(list.length?list.map(g=>node('span','featured-pill',g.title)):[node('span','featured-pill','Your favorites belong here')]));
 const pin=all.find(x=>x.id===p.pinnedAchievement&&x.earned);$('pinnedBadge').textContent=pin?`★ ${pin.name}`:earned.length?`★ ${earned.at(-1).name}`:'☆ First achievement waiting';
 const src=SERIES.map(series=>({series,stars:seriesAwards(series,nes)}));renderSeriesGrid($('seriesStarGrid'),src);
 $('generalTrophies').replaceChildren(...all.filter(x=>x.kind==='general').map(a=>{const box=node('article','trophy'+(a.earned?' earned':'')),icon=node('div','trophy-icon',a.earned?'★':'☆'),copy=node('div');copy.append(node('strong','',a.name),node('small','',a.desc),node('span','earned-label',a.earned?'UNLOCKED':`${Math.floor(Math.min(a.value,a.target)*10)/10} / ${a.target}`));box.append(icon,copy);return box;}));
 const form=$('profileForm');if(!form.dataset.dirty){$('profileAlias').value=p.name;$('profileBio').value=p.bio;$('profileMottoInput').value=p.motto;$('profileAvatarInput').value=p.avatar;$('profileColor').value=p.accent;}
 const playedGames=games.filter(g=>hasPlayed(state(g.id,nes))||state(g.id,nes).favorite).sort((a,b)=>a.title.localeCompare(b.title));
 for(let i=1;i<=3;i++){const select=$('feature'+i),current=form.dataset.dirty?select.value:p.featured[i-1]||'';select.replaceChildren(new Option('Not selected',''),...playedGames.map(g=>new Option(`${g.title} · NES`,g.id)));select.value=playedGames.some(g=>g.id===current)?current:'';}
 const pinEl=$('pinAchievement'),pinCurrent=form.dataset.dirty?pinEl.value:p.pinnedAchievement;pinEl.replaceChildren(new Option('Use latest achievement',''),...earned.map(x=>new Option(x.name+' · NES',x.id)));pinEl.value=earned.some(a=>a.id===pinCurrent)?pinCurrent:'';
}
function render(){const page=document.body.dataset.page;if(page==='home')renderHome();else if(page==='collection')renderCollection();else if(page==='passport')renderPassport();}
function downloadText(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});downloadBlob(name,blob);}
function downloadBlob(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function exportBackup(){const nes=readNES(),profile=readProfile();downloadText('laes-playlog-private-backup.json',{app:'Laes Playlog Private Backup',version:1,exportedAt:new Date().toISOString(),profile,consoles:{nes}});notify('Private backup saved. Keep this file for yourself.');}
function importPrivate(data){
 if(!isObj(data))throw Error('Invalid backup');let nes,profile;
 if(data.app==='Laes Playlog Private Backup'&&data.version===1&&isObj(data.consoles)&&isObj(data.consoles.nes)){nes=data.consoles.nes;profile=data.profile;}
 else if(data.app==='NES Playlog'&&Number.isInteger(data.version)&&data.version>=1&&data.version<=9){nes=data;profile=data.profile;}
 else throw Error('Not a private backup');
 if(!isObj(nes.records)||!Array.isArray(nes.custom)||!isObj(nes.unlocks)||!isObj(nes.profile))throw Error('Invalid save data');
 if(nes.custom.length>2000||Object.keys(nes.records).length>4500||Object.keys(nes.unlocks).length>3000)throw Error('Save too large');
 if(!confirm('Restore this PRIVATE backup? This replaces your own saved NES collection and profile in this browser. It will not import a friend passport.'))return;
 const normalized={...nes,version:VERSION};
 if(!saveNES(normalized))return;
 try{localStorage.setItem(PROFILE_KEY,JSON.stringify(cleanProfile(profile||nes.profile)));}catch(e){}
 render();notify('Your personal Playlog backup has been restored.');
}
function exportPublic(){const nes=readNES(),p=readProfile(),all=awards(nes),games=Object.entries(nes.records).filter(([id,r])=>isObj(r)&&(hasPlayed(r)||r.favorite||r.otherVersionStatus&&r.otherVersionStatus!=='none')).map(([id,r])=>({id,status:status(r),favorite:r.favorite===true,otherVersionStatus:['played','finished'].includes(r.otherVersionStatus)?r.otherVersionStatus:'none'}));const customGames=nes.custom.filter(g=>games.some(r=>r.id===g.id)).map(g=>({id:g.id,title:String(g.title).slice(0,120),year:g.year}));downloadText('laes-playlog-public-passport.json',{app:'Laes Playlog Public Passport',schema:2,exportedAt:new Date().toISOString(),profile:p,consoles:{nes:{games,achievements:all.filter(a=>a.earned).map(a=>a.id),customGames}}});notify('Public passport exported with no private notes, ratings or dates.');}
function safeGuest(input){if(!isObj(input)||JSON.stringify(input).length>1200000)throw Error('Not a valid visitor file');let section,profile;
 if(input.app==='NES Playlog Public Passport'&&input.schema===1){section={games:input.games,achievements:input.achievements,customGames:input.customGames};profile=input.profile;}
 else if(input.app==='Laes Playlog Public Passport'&&input.schema===2){section=input.consoles?.nes;profile=input.profile;}
 else throw Error('Unknown visitor file');
 if(!isObj(section)||!isObj(profile)||!Array.isArray(section.games)||!Array.isArray(section.achievements)||section.games.length>4000||section.achievements.length>400)throw Error('Invalid visitor file');
 const custom=Array.isArray(section.customGames)?section.customGames.slice(0,1000).filter(g=>typeof g.id==='string'&&g.id.startsWith('custom:')&&typeof g.title==='string'&&g.title.length<=120).map(g=>({id:g.id,title:g.title.slice(0,120),year:g.year})):[];
 const whitelist=new Set([...builtIn,...custom].map(g=>g.id)),seen=new Set();const games=section.games.filter(g=>isObj(g)&&typeof g.id==='string'&&whitelist.has(g.id)&&statCodes.includes(g.status)&&!seen.has(g.id)&&seen.add(g.id)).map(g=>({id:g.id,status:g.status,favorite:g.favorite===true,otherVersionStatus:g.otherVersionStatus==='finished'?'finished':g.otherVersionStatus==='played'?'played':'none'}));
 const achievementIDs=new Set(awards().map(a=>a.id));const ach=unique(section.achievements.filter(x=>typeof x==='string'&&achievementIDs.has(x)));return{profile:cleanProfile(profile),games,achievements:ach,custom};}
function renderVisitor(){const panel=$('visitorPanel');panel.hidden=!visitor;if(!visitor)return;const g=visitor,p=g.profile;$('visitorAlias').textContent=p.name;$('visitorMotto').textContent=p.motto;$('visitorBio').textContent=p.bio||'No biography provided';const counts={seen:g.games.filter(r=>r.status!=='unplayed').length,finished:g.games.filter(r=>['finished','mastered'].includes(r.status)).length,mastered:g.games.filter(r=>r.status==='mastered').length};$('visitorNumbers').textContent=`${counts.seen} PLAYED · ${counts.finished} FINISHED · ${counts.mastered} MASTERED · ${g.achievements.length} TROPHIES`;
 const list=g.games.filter(r=>visitorFilter==='all'?(r.status!=='unplayed'||r.otherVersionStatus!=='none'):visitorFilter==='finished'?['finished','mastered'].includes(r.status):visitorFilter==='mastered'?r.status==='mastered':r.status==='played'||r.status==='tried');const map=new Map([...builtIn,...g.custom].map(x=>[x.id,x]));$('visitorGameGrid').replaceChildren(...(list.length?list.slice(0,150).map(r=>{const data=map.get(r.id),n=node('div','visitor-game');n.append(node('b','',data?.title||'Unknown cartridge'),node('small','',statusName[r.status]+(r.favorite?' ★ FAVORITE':'')));return n;}):[node('p','','No games in this category.') ]));const earned=new Set(g.achievements);renderSeriesGrid($('visitorSeries'),SERIES.map(series=>({series,stars:seriesAwards(series,{records:{},unlocks:{}})})),earned);
 $('visitorTrophies').replaceChildren(...(g.achievements.length?g.achievements.slice(0,60).map(id=>{const a=awards().find(x=>x.id===id);return node('div','visitor-mini-trophy',`★ ${a?.name||id}`)}):[node('p','','No trophies earned yet.') ]));
 document.querySelectorAll('[data-visitor-filter]').forEach(b=>b.classList.toggle('active',b.dataset.visitorFilter===visitorFilter));}
function drawCard(){const p=readProfile(),nes=readNES(),m=metrics(nes),a=awards(nes),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=675;const ctx=canvas.getContext('2d');ctx.fillStyle='#1a2529';ctx.fillRect(0,0,1200,675);ctx.fillStyle='#29383d';for(let x=30;x<1200;x+=44)for(let y=30;y<675;y+=44)ctx.fillRect(x,y,2,2);ctx.fillStyle=ACCENTS[p.accent];ctx.fillRect(0,0,1200,18);ctx.fillRect(70,75,108,108);ctx.fillStyle='#161d20';ctx.font='bold 48px monospace';ctx.fillText(p.avatar,88,144);ctx.fillStyle='#f6edda';ctx.font='bold 32px monospace';ctx.fillText("LAE'S PLAYLOG",225,102);ctx.font='bold 61px sans-serif';ctx.fillText(p.name.slice(0,27),225,172);ctx.fillStyle='#e9be87';ctx.font='22px monospace';ctx.fillText(p.motto.slice(0,48),74,242);ctx.strokeStyle='#617073';ctx.beginPath();ctx.moveTo(74,278);ctx.lineTo(1110,278);ctx.stroke();ctx.fillStyle='#f6e9d7';ctx.font='bold 57px monospace';ctx.fillText(String(m.seen),80,383);ctx.fillText(String(m.fin),418,383);ctx.fillText(String(m.mastered),758,383);ctx.font='20px monospace';ctx.fillStyle='#b4c4bd';ctx.fillText('GAMES EXPERIENCED',80,428);ctx.fillText('FINISHED',418,428);ctx.fillText('MASTERED',758,428);ctx.fillStyle='#e9be87';ctx.font='25px monospace';ctx.fillText(`${a.filter(x=>x.earned).length} / ${a.length} ACHIEVEMENTS UNLOCKED`,74,512);ctx.fillStyle='#acb8b5';ctx.font='17px monospace';ctx.fillText('NES / FAMICOM MUSEUM   •   ACCOUNT-FREE COLLECTOR CARD',74,602);ctx.fillText('SHARED BY THE PLAYER',74,637);canvas.toBlob(blob=>{if(blob){downloadBlob('laes-playlog-collector-card.png',blob);notify('Your collector card is ready.');}},'image/png');}
function setup(){document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===document.body.dataset.page)a.setAttribute('aria-current','page');});
 const old=location.hash;if(document.body.dataset.page==='home'&&(old.startsWith('#series/')||old==='#exhibitions')){location.replace('./nes/index.html'+old);return;}
 const page=document.body.dataset.page;
 if(page==='collection'){
  $('collectionFilters').addEventListener('click',e=>{const b=e.target.closest('[data-collection]');if(b){viewFilter=b.dataset.collection;render();}});
  $('collectionSearch').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render();});
  const qs=new URLSearchParams(location.search);if(qs.has('filter')){const f=qs.get('filter');if(['all','tried','played','finished','mastered','other','want','favorite'].includes(f))viewFilter=f;}
 }
 if(page==='passport'){
  const form=$('profileForm');form.addEventListener('input',()=>form.dataset.dirty='1');form.addEventListener('change',()=>form.dataset.dirty='1');
  form.addEventListener('submit',e=>{e.preventDefault();const p={name:$('profileAlias').value,bio:$('profileBio').value,motto:$('profileMottoInput').value,avatar:$('profileAvatarInput').value,accent:$('profileColor').value,featured:[1,2,3].map(i=>$('feature'+i).value).filter(Boolean),pinnedAchievement:$('pinAchievement').value};delete form.dataset.dirty;saveProfile(p);});
  $('exportPublicBtn').addEventListener('click',exportPublic);$('downloadCardBtn').addEventListener('click',drawCard);
  $('openFriendBtn').addEventListener('click',()=>$('friendFile').click());$('friendFile').addEventListener('change',async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>1500000)throw Error('File is too large');visitor=safeGuest(JSON.parse(await f.text()));visitorFilter='all';renderVisitor();panelScroll();notify('Friend passport opened, your own collection was not changed.');}catch(err){console.warn(err);notify('This is not a supported public passport.');}});
  $('leaveFriendBtn').addEventListener('click',()=>{visitor=null;renderVisitor();notify('Back in your own museum.');});$('visitorFilters').addEventListener('click',e=>{const b=e.target.closest('[data-visitor-filter]');if(b){visitorFilter=b.dataset.visitorFilter;renderVisitor();}});
 }
 document.querySelectorAll('[data-backup]').forEach(b=>b.addEventListener('click',exportBackup));
 document.querySelectorAll('[data-private-import]').forEach(b=>b.addEventListener('click',()=>$('privateBackupFile').click()));
 $('privateBackupFile').addEventListener('change',async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>8000000)throw Error('File too large');importPrivate(JSON.parse(await f.text()));}catch(err){console.warn(err);notify('Could not open this private Playlog backup.');}});
 if('serviceWorker' in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}));
 window.addEventListener('storage',e=>{if(e.key===KEY||e.key===PROFILE_KEY){render();if(visitor)renderVisitor();}});
 render();
 }
function panelScroll(){$('visitorPanel').scrollIntoView({behavior:'smooth',block:'start'});}
setup();
})();
