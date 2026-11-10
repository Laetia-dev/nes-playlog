/* app.js */
(() => {
'use strict';
const KEY = 'nes-playlog-v2'; // Preserve localStorage key so earlier versions remain compatible.
const OLD_KEY = 'nes-playlog-v1';
const PAGE_SIZE = 40;
const STATUSES = ['unplayed','tried','played','finished','mastered'];
const OTHER_VERSION_STATUSES = ['none','played','finished']; // Never counted as NES play/finish progress.
const STATUS_NAMES = {unplayed:'○ Not played',tried:'◌ Tried it',played:'◉ Played it',finished:'◆ Finished',mastered:'✦ Mastered'};
const REGION_NAMES = {NA:'North America',PAL:'Europe / PAL',JP:'Japan / Famicom',FDS:'Famicom Disk System',PROTO:'NES prototype, unreleased',HOME:'NES homebrew',OTHER:'NES, region unknown'};
const PALETTE = ['#a35978','#517b8c','#9b6c52','#6a7d6a','#8c5d65','#7568a1','#497b7e','#a47c4e','#945a78'];
const GLYPHS = ['✦','◆','▧','★','◈','⌁','△','✳','✺','✶','✧'];
const catalog = Array.isArray(window.NES_CATALOG) ? window.NES_CATALOG : [];
const CREDITS = window.NES_CREDITS || {};
const TAXONOMY = window.NES_TAXONOMY || {};
const COVER_MANIFEST = window.NES_COVER_MANIFEST || {};
const ARCHIVE_VERSION = 9;
const unique = xs => [...new Set(xs.filter(Boolean))];
const metadata = g => ({...g,
 developer:g.developer||CREDITS[g.title]?.developer||'',
 publisher:g.publisher||CREDITS[g.title]?.publisher||'',
 genres:unique([...(g.genres||[]),...(TAXONOMY[g.title]?.genres||[])]),
 tags:unique([...(g.tags||[]),...(TAXONOMY[g.title]?.tags||[])])
});
const museumData = window.NES_MUSEUM || {extraGames:[],aliases:{},regions:{},exhibitions:[],series:[],gameGenre:{}};
const $ = id => document.getElementById(id);
const slug = title => String(title).normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const builtIn = [
 ...catalog.map(g => metadata({...g,id:`nes:${slug(g.title)}:${g.year}`,region:'NA',regions:museumData.regions[g.title]||['NA'],aliases:museumData.aliases[g.title]||[],genres:museumData.gameGenre[g.title]||[],custom:false})),
 ...museumData.extraGames.map(g => metadata({...g,id:`nes-extra:${slug(g.title)}:${g.year}`,regions:g.regions||[g.region],aliases:g.aliases||[],genres:g.genres||[],custom:false}))
];
const titleKey = text => String(text||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
const gameByName = new Map();
for(const g of builtIn) for(const t of [g.title,...g.aliases]) {const k=titleKey(t);if(!gameByName.has(k))gameByName.set(k,g);}
const lookupGame = name => gameByName.get(titleKey(name));
const EXHIBITIONS = museumData.exhibitions;
const SERIES = museumData.series;
const EXHIBITION_GAMES = new Map(EXHIBITIONS.map(x=>[x.id,(x.games||x.groups.flatMap(g=>g.games)).map(v=>lookupGame(v[0])).filter(Boolean)]));
const SERIES_GAMES = new Map(SERIES.map(x=>[x.id,x.titles.map(lookupGame).filter(Boolean)]));
const gameExhibits = id=>EXHIBITIONS.filter(x=>EXHIBITION_GAMES.get(x.id).some(g=>g.id===id));
const gameSeries = id=>SERIES.filter(x=>SERIES_GAMES.get(x.id).some(g=>g.id===id));
// A series can contain core titles and optional spin-offs, without duplicating a game record.
const MAINLINE = new Map(SERIES.map(s=>[s.id,new Set((s.mainline||s.titles).map(v=>lookupGame(v)?.id).filter(Boolean))]));
const seriesRole = (id,seriesId) => SERIES_GAMES.get(seriesId)?.some(g=>g.id===id) ? (MAINLINE.get(seriesId)?.has(id)?'Mainline':'Spin-off') : null;
const rolesFor = id => unique(gameSeries(id).map(s=>seriesRole(id,s.id)));
const mainlineGames = id => (SERIES_GAMES.get(id)||[]).filter(g=>MAINLINE.get(id)?.has(g.id));
const mainlineFinishedCount = id => mainlineGames(id).filter(g=>finished(rget(g.id))).length;

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const cleanStatus = s => STATUSES.includes(s) ? s : 'unplayed';
const getTime = v => Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
const cleanRecord = r => ({otherVersionStatus:OTHER_VERSION_STATUSES.includes(r?.otherVersionStatus)?r.otherVersionStatus:'none',otherVersionName:typeof r?.otherVersionName==='string'?r.otherVersionName.trim().slice(0,120):'',goal:typeof r?.goal === 'string' ? r.goal.slice(0,180) : '',status:STATUSES.includes(r?.status) ? r.status : r?.played === true ? 'played' : 'unplayed',wantToPlay:r?.wantToPlay === true,favorite:r?.favorite === true,rating:Number.isInteger(r?.rating) && r.rating >= 1 && r.rating <= 5 ? r.rating : 0,note:typeof r?.note === 'string' ? r.note.slice(0,1000) : '',playedDate:typeof r?.playedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.playedDate) ? r.playedDate : '',updatedAt:getTime(r?.updatedAt)});
const newStore = () => ({records:Object.create(null),custom:[],unlocks:Object.create(null),settings:{theme:'nes',coverArt:true},profile:{name:'PLAYER 1',bio:'',avatar:'P1',accent:'red',motto:'NES / FAMICOM ARCHIVIST',featured:[],pinnedAchievement:''}});
const cleanCustom = (list) => (Array.isArray(list) ? list : []).filter(g => g && typeof g.id === 'string' && g.id.startsWith('custom:') && typeof g.title === 'string' && g.title.trim() && g.title.length <= 120).slice(0,2000).map(g => ({id:g.id,title:g.title.trim(),year:Number.isInteger(g.year) && g.year >= 1983 && g.year <= 2100 ? g.year : null,region:REGION_NAMES[g.region] ? g.region : 'OTHER',regions:[REGION_NAMES[g.region] ? g.region : 'OTHER'],aliases:[],genres:Array.isArray(g.genres)?g.genres.filter(x=>typeof x==='string').slice(0,12).map(x=>x.slice(0,35)):[],tags:Array.isArray(g.tags)?g.tags.filter(x=>typeof x==='string').slice(0,15).map(x=>x.slice(0,35)):[],developer:typeof g.developer==='string'?g.developer.slice(0,120):'',publisher:typeof g.publisher==='string'?g.publisher.slice(0,120):'',custom:true}));
const bestStatus=(a,b)=>STATUSES[Math.max(STATUSES.indexOf(a),STATUSES.indexOf(b))];
function combineRecords(left,right){const a=cleanRecord(left),b=cleanRecord(right);return {
 status:bestStatus(a.status,b.status),otherVersionStatus:OTHER_VERSION_STATUSES[Math.max(OTHER_VERSION_STATUSES.indexOf(a.otherVersionStatus),OTHER_VERSION_STATUSES.indexOf(b.otherVersionStatus))],otherVersionName:a.otherVersionName||b.otherVersionName,wantToPlay:a.wantToPlay||b.wantToPlay,favorite:a.favorite||b.favorite,rating:a.rating||b.rating,
 goal:a.goal||b.goal,note:a.note&&b.note&&a.note!==b.note?(a.note+'\n\n'+b.note).slice(0,1000):(a.note||b.note),
 playedDate:a.playedDate||b.playedDate,updatedAt:Math.max(a.updatedAt,b.updatedAt)
};}
function canonicalCustom(g){const official=lookupGame(g.title);if(!official)return null;
 // Japanese Super Mario Bros. 2 is The Lost Levels, not the North American SMB2.
 if(g.region==='JP' && titleKey(g.title)===titleKey('Super Mario Bros. 2'))return null;
 return official.id;}

function parseStore(data){
 if(!isObj(data)) throw Error('Invalid backup');
 const s=newStore(),candidates=cleanCustom(data.custom),redirect=new Map();
 for(const g of candidates){const target=canonicalCustom(g);if(target)redirect.set(g.id,target);else s.custom.push(g);}
 const valid=new Set([...builtIn,...s.custom].map(g=>g.id));
 if(isObj(data.records)) for(const [id,value] of Object.entries(data.records)) {const target=redirect.get(id)||id;if(valid.has(target)&&isObj(value))s.records[target]=s.records[target]?combineRecords(s.records[target],value):cleanRecord(value);}
 if(isObj(data.unlocks)) for(const [id,t] of Object.entries(data.unlocks)) if(typeof id === 'string' && Number.isFinite(t) && t >= 0) s.unlocks[id]=t;
 if(isObj(data.settings)){s.settings.theme=data.settings.theme==='famicom'?'famicom':'nes';s.settings.coverArt=data.settings.coverArt!==false;}
 if(isObj(data.profile)){s.profile.name=typeof data.profile.name==='string'?(data.profile.name.trim().slice(0,32)||'PLAYER 1'):'PLAYER 1';s.profile.bio=typeof data.profile.bio==='string'?data.profile.bio.trim().slice(0,180):'';s.profile.avatar=['P1','✦','★','◆','☾','♡','♟'].includes(data.profile.avatar)?data.profile.avatar:'P1';s.profile.accent=['red','gold','teal','purple','blue'].includes(data.profile.accent)?data.profile.accent:'red';s.profile.motto=typeof data.profile.motto==='string'?data.profile.motto.trim().slice(0,60):'NES / FAMICOM ARCHIVIST';s.profile.featured=Array.isArray(data.profile.featured)?data.profile.featured.filter(id=>typeof id==='string').slice(0,3):[];s.profile.pinnedAchievement=typeof data.profile.pinnedAchievement==='string'?data.profile.pinnedAchievement:'';}
 return s;
}
let store = newStore();let migrated=false;
try{
 const current=localStorage.getItem(KEY),old=localStorage.getItem(OLD_KEY);
 if(current){const saved=JSON.parse(current);store=parseStore(saved);if(saved.version!==ARCHIVE_VERSION)migrated=true;}
 else if(old){store=parseStore(JSON.parse(old));migrated=true;}
}catch(e){console.warn('NES Playlog storage unavailable or invalid',e);}
// A Lae's Playlog passport is shared by all present and future console museums.
const HUB_PROFILE_KEY='laes-playlog-profile-v1';
try {const globalProfile=JSON.parse(localStorage.getItem(HUB_PROFILE_KEY)||'null');
  if(globalProfile && typeof globalProfile==='object' && !Array.isArray(globalProfile)) store.profile={...store.profile,...globalProfile};
  else if(!localStorage.getItem(HUB_PROFILE_KEY))localStorage.setItem(HUB_PROFILE_KEY,JSON.stringify(store.profile));
}catch(e){console.warn('Shared passport unavailable',e);}
let search='',statusFilter='all',yearFilter='all',seriesFilter='all',exhibitionFilter='all',genreFilter='all',tagFilter='all',developerFilter='all',publisherFilter='all',roleFilter='all',sort='alpha',view='grid',limit=PAGE_SIZE;
let activeExhibition='essentials',activeSeries='mario',seriesView='all';
let detailId=null,pendingRating=0,pendingFavorite=false,pendingWant=false,curatorId=null,toastTimer,achievementFilter='all';
const allGames = () => [...builtIn,...store.custom];
const seriesCount=id=>(SERIES_GAMES.get(id)||[]).filter(g=>played(rget(g.id))).length;
const seriesFinishedCount=id=>(SERIES_GAMES.get(id)||[]).filter(g=>finished(rget(g.id))).length;
const exhibitCount=id=>(EXHIBITION_GAMES.get(id)||[]).filter(g=>played(rget(g.id))).length;
const rget = id => Object.hasOwn(store.records,id) ? store.records[id] : cleanRecord({});
function persist(){try{localStorage.setItem(KEY,JSON.stringify({version:ARCHIVE_VERSION,records:store.records,custom:store.custom,unlocks:store.unlocks,settings:store.settings,profile:store.profile}));localStorage.setItem(HUB_PROFILE_KEY,JSON.stringify(store.profile));$('saveStatus').classList.remove('warning');$('saveStatus').lastChild.textContent='SAVED LOCALLY';return true;}catch(e){$('saveStatus').classList.add('warning');$('saveStatus').lastChild.textContent='UNSAVED, EXPORT DATA';notify('Browser storage unavailable, export a backup to keep your changes.');return false;}}
function notify(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3300);}
function hash(text){let n=0;for(const c of text) n=(Math.imul(31,n)+c.charCodeAt(0))|0;return n >>> 0;}
function colorFor(g){return PALETTE[hash(g.id)%PALETTE.length];}
function glyphFor(g){return GLYPHS[hash(g.id+'#')%GLYPHS.length];}
function make(tag,cls='',content=''){const el=document.createElement(tag);if(cls)el.className=cls;if(content !== '')el.textContent=content;return el;}

// No invented endings: score-chase, management and simulation games can use a personal victory goal.
// Only documented exceptions are assigned by title; the rest use broad genre inference.
const GAME_RULES={
 'Tetris':['score','An endless puzzle game. Decide what score, level or milestone counts as success for you.'],
 'Dr. Mario':['score','An arcade-style puzzler. Try a chosen difficulty or score challenge.'],
 'Pac-Man':['score','A score-chasing arcade game. Pick the board or score you want to reach.'],
 'Galaga: Demons of Death':['score','Aim for a personal survival or score milestone.'],
 'Balloon Fight':['score','Choose a score or Balloon Trip challenge.'],
 'Excitebike':['score','Choose a race result or build-and-race track goal.'],
 'Pinball':['score','Pick your target high score.'],
 'Duck Hunt':['score','Use a round or score milestone.'],
 'Golf':['score','Choose a course and score target.'],
 'M.U.L.E.':['simulation','Choose an economic victory or personal strategy challenge.'],
 'Elite':['simulation','Choose a trading, exploration or combat milestone.'],
 'Wall Street Kid':['simulation','Define a successful investing milestone.'],
 'A Ressha de Ikou':['simulation','Create your own profitable rail network goal.'],
 'Famicom Top Management':['simulation','Set a business or market-share objective.'],
 'SimCity (NES prototype)':['simulation','Unfinished prototype, set your own goal. Not a retail release.'],
 'Pirates!':['simulation','Choose a career, treasure or reputation objective.'],
 "Nobunaga's Ambition":['strategy','Define a conquest or campaign goal.'],
 'Romance of the Three Kingdoms':['strategy','Define a historical campaign goal.']
};
function completionInfo(g){
 const known=GAME_RULES[g.title];if(known)return {kind:known[0],description:known[1]};
 const names=(g.genres||[]).map(x=>x.toLowerCase());
 if(names.some(x=>/simulation|management|city.building/.test(x)))return {kind:'simulation',description:'Management games may have no fixed ending. Set your own goal, then mark it as achieved.'};
 if(names.some(x=>/strategy|tactic|wargame/.test(x)))return {kind:'strategy',description:'Finish a scenario or choose a strategic objective to count as completion.'};
 if(names.some(x=>/puzzle|sports|racing/.test(x)))return {kind:'score',description:'You may choose a tournament, score, level or other personal milestone.'};
 return {kind:'campaign',description:'Mark Finished after reaching the ending or your chosen meaningful stopping point.'};
}
function statusLabel(g,status){if(status==='finished'&&completionInfo(g).kind!=='campaign')return '◆ Goal met';if(status==='mastered'&&completionInfo(g).kind!=='campaign')return '✦ Personal mastery';return STATUS_NAMES[status];}

function played(r){return r.status!=='unplayed';}
function finished(r){return r.status==='finished'||r.status==='mastered';}
function stats(){const gs=allGames();let seen=0,fin=0,master=0,fav=0,want=0,notes=0,rated=0,years=new Set();for(const g of gs){const r=rget(g.id);if(played(r)){seen++;if(g.year)years.add(g.year);}if(finished(r))fin++;if(r.status==='mastered')master++;if(r.favorite)fav++;if(r.wantToPlay)want++;if(r.note.trim())notes++;if(r.rating)rated++;}return{total:gs.length,seen,fin,master,fav,want,notes,rated,years:years.size,custom:store.custom.length,pct:gs.length?Math.round(100*seen/gs.length):0};}
const ACHIEVEMENTS = [
 {id:'hello',icon:'✳',name:'First Contact',desc:'Play or try your first NES game.',target:1,get:s=>s.seen},
 {id:'eight',icon:'8',name:'Eight Bits of History',desc:'Explore 8 different games.',target:8,get:s=>s.seen},
 {id:'twentyfive',icon:'◈',name:'Shelf Starter',desc:'Explore 25 different games.',target:25,get:s=>s.seen},
 {id:'fifty',icon:'▦',name:'Seasoned Explorer',desc:'Explore 50 different games.',target:50,get:s=>s.seen},
 {id:'hundred',icon:'✺',name:'The Hundred Club',desc:'Explore 100 different games.',target:100,get:s=>s.seen},
 {id:'quarter',icon:'¼',name:'Quarter of the Archive',desc:'Explore at least 25% of your catalog.',target:25,get:s=>s.total?s.seen/s.total*100:0,suffix:'%'},
 {id:'credits',icon:'◆',name:'Roll the Credits',desc:'Finish your first NES game.',target:1,get:s=>s.fin},
 {id:'fin10',icon:'♜',name:'Boss Slayer',desc:'Finish 10 different NES games.',target:10,get:s=>s.fin},
 {id:'master',icon:'✦',name:'Beyond the Ending',desc:'Master a game completely.',target:1,get:s=>s.master},
 {id:'masters5',icon:'✶',name:'Perfectionist',desc:'Master 5 games completely.',target:5,get:s=>s.master},
 {id:'favs3',icon:'♡',name:'A Few Beloved Worlds',desc:'Favorite 3 games.',target:3,get:s=>s.fav},
 {id:'favs10',icon:'♥',name:'The Heart Collection',desc:'Favorite 10 games.',target:10,get:s=>s.fav},
 {id:'memory',icon:'▤',name:'Memory Keeper',desc:'Write your first game memory.',target:1,get:s=>s.notes},
 {id:'diary10',icon:'✎',name:'Dear Diary',desc:'Write memories for 10 games.',target:10,get:s=>s.notes},
 {id:'timetravel',icon:'⌛',name:'Time Traveler',desc:'Explore games from 5 different release years.',target:5,get:s=>s.years},
 {id:'curator',icon:'＋',name:'Guest Curator',desc:'Add your own NES or Famicom entry.',target:1,get:s=>s.custom},
 {id:'backlog',icon:'⌁',name:'Next Cartridge',desc:'Add your first game to Want to Play.',target:1,get:s=>s.want},
 {id:'backlog10',icon:'▤',name:'The Backlog Shelf',desc:'Build a Want to Play list of 10 games.',target:10,get:s=>s.want},
 {id:'essential-scout',icon:'✦',name:'Through the Door',desc:'Try 5 of the NES Essentials.',target:5,get:()=>exhibitCount('essentials')},
 {id:'essential-expert',icon:'♛',name:'Essential Historian',desc:'Experience all 20 NES Essentials.',target:20,get:()=>exhibitCount('essentials')},
 {id:'gem-seeker',icon:'◇',name:'Gem Seeker',desc:'Find 5 hidden gems.',target:5,get:()=>exhibitCount('gems')},
 {id:'pal-traveler',icon:'✳',name:'Cartridge Hunter',desc:'Explore 5 games in Cartridge Treasures.',target:5,get:()=>exhibitCount('europe')},
 {id:'jrpg-pioneer',icon:'☾',name:'JRPG Pioneer',desc:'Try 5 games from JRPG Origins.',target:5,get:()=>exhibitCount('jrpg')},
 {id:'strategist',icon:'▦',name:'Master Planner',desc:'Experience 5 simulation and strategy titles.',target:5,get:()=>exhibitCount('strategy')},
 {id:'mario-collector',icon:'★',name:'Mushroom Historian',desc:'Explore 3 games in the Super Mario series.',target:3,get:()=>seriesCount('mario'),kind:'series',seriesId:'mario'}
];
// Every NES / Famicom series receives an exploration and a completion badge.
// Small series have a one-game exploration threshold; larger ones use three.
for(const series of SERIES){
 const games=SERIES_GAMES.get(series.id)||[];if(!games.length)continue;
 const goal=games.length>=3?3:1;
 if(series.id!=='mario')ACHIEVEMENTS.push({id:`series-${series.id}-explore`,icon:'◈',name:`${series.name}: First Steps`,desc:`Play or try ${goal} ${goal===1?'game':'games'} in this NES series.`,target:goal,get:()=>seriesCount(series.id),kind:'series',seriesId:series.id});
 ACHIEVEMENTS.push({id:`series-${series.id}-complete`,icon:'♛',name:`${series.name}: Complete Set`,desc:`Finish or master all ${games.length} games in this NES / Famicom series, including spin-offs.`,target:games.length,get:()=>seriesFinishedCount(series.id),kind:'series',seriesId:series.id});
 const core=mainlineGames(series.id);
 if(core.length>1 && core.length<games.length) ACHIEVEMENTS.push({id:`series-${series.id}-mainline`,icon:'♜',name:`${series.name}: Mainline Master`,desc:`Finish all ${core.length} mainline games. Spin-offs are optional.`,target:core.length,get:()=>mainlineFinishedCount(series.id),kind:'series',seriesId:series.id});
}
// Genre discovery and self-defined challenges, without requiring every game to have an ending.
ACHIEVEMENTS.push(
 {id:'personal-goal',icon:'◎',name:'My Own Victory',desc:'Write a personal completion goal for any game.',target:1,get:()=>allGames().filter(g=>rget(g.id).goal?.trim()).length},
 {id:'personal-goals-five',icon:'◇',name:'Five Roads to Victory',desc:'Achieve five goals that you recorded yourself.',target:5,get:()=>allGames().filter(g=>rget(g.id).goal?.trim()&&finished(rget(g.id))).length},
 {id:'genre-five',icon:'▧',name:'Genre Wanderer',desc:'Explore games spanning five different tagged genres.',target:5,get:()=>new Set(allGames().filter(g=>played(rget(g.id))).flatMap(g=>g.genres||[])).size},
 {id:'genre-ten',icon:'✷',name:'8-bit Omnivore',desc:'Explore ten different genres.',target:10,get:()=>new Set(allGames().filter(g=>played(rget(g.id))).flatMap(g=>g.genres||[])).size},
 {id:'sim-goal',icon:'♟',name:'Master of Systems',desc:'Meet a personal goal in a simulation or strategy game.',target:1,get:()=>allGames().filter(g=>['simulation','strategy'].includes(completionInfo(g).kind)&&finished(rget(g.id))&&rget(g.id).goal?.trim()).length},
 {id:'archive-diary',icon:'▤',name:'Field Researcher',desc:'Rate 20 different NES games.',target:20,get:s=>s.rated}
);
for(const a of ACHIEVEMENTS)if(!a.kind)a.kind='general';
function awardAchievements(silent=true){const s=stats();let newly=[];for(const a of ACHIEVEMENTS){if(a.get(s)>=a.target && !store.unlocks[a.id]){store.unlocks[a.id]=Date.now();newly.push(a);}}if(newly.length){persist();if(!silent)notify(`✦ Achievement unlocked: ${newly[0].name}${newly.length>1?` (+${newly.length-1} more)`:''}`);}return newly;}
function renderStats(){const s=stats();$('statPlayed').innerHTML='';$('statPlayed').append(String(s.seen),Object.assign(make('small'),{textContent:` / ${s.total}`}));$('statFinished').textContent=s.fin;$('statFavs').textContent=s.fav;$('statPercent').innerHTML='';$('statPercent').append(String(s.pct),Object.assign(make('small'),{textContent:'%'}));$('statProgress').setAttribute('aria-valuenow',String(s.pct));$('statFill').style.width=s.pct+'%';$('catalogCount').textContent=s.total; if($('statWant'))$('statWant').textContent=s.want;}
// Optional online box art, never bundled with the website. Missing covers degrade gracefully.
// The community thumbnail endpoint has filename variants, so limit requests and cache misses in-session.
const badCoverURLs=new Set(),loadedCoverURLs=new Set(),allCoverURLs=new Set();
const verifiedCovers={
 'Super Mario Bros.':'Super Mario Bros. (World)',
 'Super Mario Bros. 2':'Super Mario Bros. 2 (USA)',
 'Super Mario Bros. 3':'Super Mario Bros. 3 (USA)',
 'The Legend of Zelda':'Legend of Zelda, The (USA)',
 'Zelda II: The Adventure of Link':'Zelda II - The Adventure of Link (USA)',
 'Metroid':'Metroid (USA)',
 'Tetris':'Tetris (USA)',
 "Kirby's Adventure":"Kirby's Adventure (USA)",
 'Contra':'Contra (USA)',
 'DuckTales':'DuckTales (USA)',
 'Mega Man 2':'Mega Man 2 (USA)',
 'Gradius':'Gradius (USA)',
 'Castlevania':'Castlevania (USA)',
 "Castlevania III: Dracula's Curse":"Castlevania III - Dracula's Curse (USA)",
 'Dr. Mario':'Dr. Mario (USA)',
 'Ninja Gaiden':'Ninja Gaiden (USA)',
 'Super C':'Super C (USA)',
 'Bubble Bobble':'Bubble Bobble (USA)',
};
function coverCandidates(g){
 if(g.prototype||g.region==='HOME'||!navigator.onLine)return [];
 const folder=g.region==='FDS'?'Nintendo - Family Computer Disk System':'Nintendo - Nintendo Entertainment System';
 const stems=[];
 if(COVER_MANIFEST[g.title])stems.push(...COVER_MANIFEST[g.title]);
 if(verifiedCovers[g.title])stems.push(verifiedCovers[g.title]);
 const the=/(^The )(.+)/.exec(g.title); const swap=the?the[2]+', The':null;
 // Original Libretro names generally use the No-Intro title plus a console release suffix.
 for(const name of [g.title,swap,...(g.aliases||[]).slice(0,1)].filter(Boolean)){
   const order=g.region==='JP'||g.region==='FDS'?['Japan','USA','Europe','World']:['USA','Europe','World','Japan'];
   for(const suffix of order)stems.push(`${name} (${suffix})`);
   stems.push(name);
 }
 const uniqueStems=unique(stems.map(n=>n.replace(/[&*/:<>?\\|]/g,'_'))).slice(0,5);
 return uniqueStems.map(name=>`https://thumbnails.libretro.com/${encodeURIComponent(folder)}/Named_Boxarts/${encodeURIComponent(name)}.png`);
}
function artStatus(){const el=$('artStatus');if(!el)return;el.textContent=store.settings.coverArt?`${loadedCoverURLs.size} unique covers displayed · ${badCoverURLs.size} filenames unavailable · ${navigator.onLine?'online artwork enabled':'offline fallback active'}`:'Online artwork off · original cartridge art is shown.';}
function attachBoxArt(g,sticker){
 if(!store.settings.coverArt||!navigator.onLine)return;
 const sources=coverCandidates(g).filter(url=>!badCoverURLs.has(url));if(!sources.length)return;
 const art=make('img','real-box-art');art.alt='';art.loading='lazy';art.decoding='async';art.referrerPolicy='no-referrer';
 let idx=0, finished=false; const tryNext=()=>{if(finished)return; if(idx>=sources.length){art.remove();sticker.classList.remove('has-box-art');artStatus();return;}art.src=sources[idx];};
 art.addEventListener('load',()=>{if(art.naturalWidth>0){finished=true;loadedCoverURLs.add(sources[idx]);sticker.classList.add('has-box-art');artStatus();}});
 art.addEventListener('error',()=>{if(finished)return;badCoverURLs.add(sources[idx]);idx++;tryNext();});
 tryNext();sticker.append(art);
}
function makeArt(g,mini=false){const pak=make('div',mini?'shelf-pak':'art-pak');pak.style.setProperty('--tone',colorFor(g));if(store.settings.theme==='famicom')pak.classList.add('famicom-pak');const sticker=make('div',mini?'shelf-sticker':'art-cover');if(!mini)sticker.append(make('span','cover-tiny','GAME PAK / NES'));sticker.append(make('i',mini?'':'cover-glyph',glyphFor(g)));sticker.append(make('b',mini?'':'',g.title));if(!mini)sticker.append(make('span','cover-footer','8 BIT / ARCHIVE'));pak.append(sticker);attachBoxArt(g,sticker);return pak;}
function makeShelfCard(g){const btn=make('button','shelf-card');btn.type='button';btn.dataset.open=g.id;btn.setAttribute('aria-label',`Open ${g.title} details`);btn.append(makeArt(g,true),make('span','shelf-name',g.title));return btn;}
function makeEmptyShelf(title,caption){const empty=make('div','empty-shelf');empty.append(make('span','empty-glyph','◇'),make('span','',title));const button=make('button','',caption);button.type='button';button.addEventListener('click',scrollToArchive);empty.append(button);return empty;}
function renderMuseum(){const games=allGames(),vis=games.filter(g=>played(rget(g.id))).sort((a,b)=>rget(b.id).updatedAt-rget(a.id).updatedAt);const favs=games.filter(g=>rget(g.id).favorite).sort((a,b)=>rget(b.id).updatedAt-rget(a.id).updatedAt);const fill=(id,items,empty,caption)=>$(id).replaceChildren(...(items.length?items.slice(0,4).map(makeShelfCard):[makeEmptyShelf(empty,caption)]));fill('recentShelf',vis,'Your shelf is waiting for its first cartridge.','EXPLORE THE GAMES ↗');fill('favoriteShelf',favs,'The ones you love will live here.','FIND YOUR FAVORITES ↗');
 const wishes=games.filter(g=>rget(g.id).wantToPlay).sort((a,b)=>rget(b.id).updatedAt-rget(a.id).updatedAt);
 fill('wantShelf',wishes,'A future adventure belongs here.','FIND A GAME ↗');if(!curatorId||!games.some(g=>g.id===curatorId)){const candidate=games.find(g=>g.title==='The Legend of Zelda')||games[0];curatorId=candidate?.id||null;}const curator=games.find(g=>g.id===curatorId);$('curatorText').textContent=curator?`${curator.title}${curator.year?` (${curator.year})`:''}, a little piece of gaming history ${played(rget(curator.id))?'already in your collection':'waiting to be explored'}.`:'Your next adventure is waiting.';}
function makeAchievementCard(a,s){
 const value=a.get(s),earned=!!store.unlocks[a.id],card=make('article','achievement-card'+(earned?' unlocked':'')+(a.kind==='series'?' series-achievement':''));
 const icon=make('div','achievement-icon',a.kind==='series'?(earned?'★':'☆'):a.icon);icon.setAttribute('aria-hidden','true');
 const title=make('h3','',a.name),desc=make('p','',a.desc);
 const foot=make('div','achievement-foot');foot.append(make('span','',earned?'✦ UNLOCKED':'LOCKED'),make('span','',earned?'ACHIEVED':`${Math.min(a.target,Math.floor(value))} / ${a.target}${a.suffix||''}`));
 const bar=make('div','achievement-track'),fill=make('span');fill.style.width=`${earned?100:Math.min(100,value/a.target*100)}%`;bar.append(fill);
 card.append(icon,title,desc,foot,bar);if(a.seriesId){const jump=make('button','achievement-jump','VIEW SERIES ↗');jump.type='button';jump.dataset.seriesJump=a.seriesId;card.append(jump);}return card;
}
function renderAchievements(){
 const s=stats(),unlocked=ACHIEVEMENTS.filter(a=>!!store.unlocks[a.id]).length;
 $('badgeCountHero').replaceChildren(String(unlocked)+' ',Object.assign(make('span'),{textContent:'/ '+ACHIEVEMENTS.length}));
 $('achievementTotal').textContent=`${unlocked} / ${ACHIEVEMENTS.length}`;
 const eligible=ACHIEVEMENTS.filter(a=>achievementFilter==='all'||a.kind===achievementFilter);
 $('achievementGrid').replaceChildren(...eligible.map(a=>makeAchievementCard(a,s)));
 document.querySelectorAll('[data-achievement-filter]').forEach(btn=>{const selected=btn.dataset.achievementFilter===achievementFilter;btn.classList.toggle('active',selected);btn.setAttribute('aria-pressed',String(selected));});
}
function matches(g){const r=rget(g.id);if(search && !search.split(/\s+/).every(term=>[g.title,...(g.aliases||[]),r.note,r.goal,r.otherVersionName,g.developer,g.publisher,...(g.genres||[]),...(g.tags||[]),...gameSeries(g.id).map(s=>s.name)].join(' ').toLocaleLowerCase().includes(term)))return false;if(statusFilter==='favorites'&&!r.favorite)return false;if(statusFilter==='want'&&!r.wantToPlay)return false;if(statusFilter==='other-played'&&r.otherVersionStatus!=='played'&&r.otherVersionStatus!=='finished')return false;if(statusFilter==='other-finished'&&r.otherVersionStatus!=='finished')return false;if(STATUSES.includes(statusFilter) && r.status!==statusFilter)return false;if(yearFilter!=='all'&&String(g.year)!==yearFilter)return false;if(seriesFilter!=='all'&&!SERIES_GAMES.get(seriesFilter)?.some(x=>x.id===g.id))return false;if(exhibitionFilter!=='all'&&!EXHIBITION_GAMES.get(exhibitionFilter)?.some(x=>x.id===g.id))return false;if(genreFilter!=='all'&&!(g.genres||[]).some(x=>titleKey(x)===titleKey(genreFilter)))return false;
 if(tagFilter!=='all'&&!(g.tags||[]).some(x=>titleKey(x)===titleKey(tagFilter)))return false;
 if(developerFilter!=='all'&&g.developer!==developerFilter)return false;
 if(publisherFilter!=='all'&&g.publisher!==publisherFilter)return false;
 if(roleFilter!=='all' && (roleFilter==='independent'?gameSeries(g.id).length>0:!rolesFor(g.id).includes(roleFilter)))return false;
 return true;}
function filteredGames(){const gs=allGames().filter(matches);gs.sort((a,b)=>{const ra=rget(a.id),rb=rget(b.id);if(sort==='recent')return rb.updatedAt-ra.updatedAt||a.title.localeCompare(b.title);if(sort==='oldest')return (a.year??9999)-(b.year??9999)||a.title.localeCompare(b.title);if(sort==='newest')return (b.year??0)-(a.year??0)||a.title.localeCompare(b.title);if(sort==='want')return Number(rb.wantToPlay)-Number(ra.wantToPlay)||a.title.localeCompare(b.title);if(sort==='status')return STATUSES.indexOf(rb.status)-STATUSES.indexOf(ra.status)||a.title.localeCompare(b.title);return a.title.localeCompare(b.title,undefined,{numeric:true});});return gs;}
function makeStatusSelect(g){const r=rget(g.id),select=make('select','quick-status');select.dataset.statusId=g.id;select.setAttribute('aria-label',`Progress for ${g.title}`);for(const s of STATUSES){const opt=new Option(statusLabel(g,s),s);select.add(opt);}select.value=r.status;return select;}
function makeGameCard(g){const r=rget(g.id),article=make('article','archive-card'+(played(r)?' is-visited':''));const art=make('button','archive-art');art.type='button';art.dataset.open=g.id;art.setAttribute('aria-label',`Open details for ${g.title}`);art.append(makeArt(g));if(played(r))art.append(make('span','status-tick',r.status==='mastered'?'✦':r.status==='finished'?'◆':'✓'));const content=make('div','archive-card-content');const title=make('h3','archive-card-title',g.title);title.title=g.title;const meta=make('div','archive-card-sub',g.year?String(g.year):'YEAR UNKNOWN');
 const maker=make('div','archive-card-maker',g.developer||'Developer not catalogued');maker.title=g.publisher?`Published by ${g.publisher}`:'';meta.append(make('span','badge-reg',g.prototype?' · PROTOTYPE':g.region==='FDS'?' · FDS':g.region==='JP'?' · FAMICOM':g.region==='PAL'?' · NES':' · NES'));const bottom=make('div','archive-card-bottom');const fav=make('button','quick-star'+(r.favorite?' active':''),r.favorite?'★':'☆');fav.type='button';fav.dataset.favoriteId=g.id;fav.setAttribute('aria-label',`${r.favorite?'Remove':'Add'} ${g.title} ${r.favorite?'from':'to'} favorites`);fav.setAttribute('aria-pressed',String(r.favorite));const want=make('button','quick-want'+(r.wantToPlay?' active':''),r.wantToPlay?'✓':'＋');want.type='button';want.dataset.wantId=g.id;want.setAttribute('title',r.wantToPlay?'Remove from Want to Play':'Add to Want to Play');want.setAttribute('aria-label',`${r.wantToPlay?'Remove':'Add'} ${g.title} ${r.wantToPlay?'from':'to'} Want to Play`);want.setAttribute('aria-pressed',String(r.wantToPlay));
 bottom.append(makeStatusSelect(g),want,fav);const genrePills=make('div','archive-tags');for(const genre of (g.genres||[]).slice(0,2))genrePills.append(make('span','archive-tag',genre));if(r.otherVersionStatus!=='none'){const tag=make('span','archive-tag other-version-tag',r.otherVersionStatus==='finished'?'◆ FINISHED OTHER VERSION':'◉ PLAYED OTHER VERSION');tag.title=r.otherVersionName||'Another edition or remake';genrePills.append(tag);}content.append(title,meta,maker,genrePills,bottom);article.append(art,content);return article;}
function renderArchive(){const arr=filteredGames(),shown=arr.slice(0,limit);$('resultCount').textContent=`SHOWING ${shown.length} OF ${arr.length} ARTIFACTS`;const root=$('gameGrid');root.classList.toggle('list-mode',view==='list');root.replaceChildren(...shown.map(makeGameCard));$('emptyArchive').classList.toggle('hidden',arr.length>0);$('moreBtn').classList.toggle('hidden',arr.length<=limit);}
function makeProgressText(seen,total){return `${seen} / ${total} explored`}
function progressBar(count,total){const wrap=make('div','room-track'),bar=make('span');bar.style.width=(total?Math.round(100*count/total):0)+'%';wrap.append(bar);return wrap;}
function exhibitionEntry(g,note){const rec=rget(g.id),card=make('article','curated-game'+(played(rec)?' explored':''));const art=make('button','curated-pak');art.type='button';art.dataset.open=g.id;art.setAttribute('aria-label',`Open ${g.title}`);art.append(makeArt(g,true));const desc=make('div','curated-desc');desc.append(make('h4','',g.title),make('p','',note||''));const small=make('span','curated-region',(g.prototype?'UNRELEASED':g.region==='JP'?'FAMICOM':g.region==='FDS'?'DISK SYSTEM':g.region==='PAL'?'NES':'NES')+'  ·  '+(g.year||'???'));desc.append(small);const sel=makeStatusSelect(g);sel.classList.add('curated-status');card.append(art,desc,sel);return card;}
function renderExhibitions(){
 const nav=$('roomNav');nav.replaceChildren();
 for(const room of EXHIBITIONS){const gs=EXHIBITION_GAMES.get(room.id)||[],count=gs.filter(g=>played(rget(g.id))).length,btn=make('button','room-tile'+(activeExhibition===room.id?' active':''));btn.type='button';btn.dataset.exhibit=room.id;btn.setAttribute('aria-pressed',String(activeExhibition===room.id));btn.append(make('span','room-tile-icon',room.icon),make('span','room-tile-number','ROOM '+room.number),make('strong','',room.name),make('small','',room.short),make('em','',makeProgressText(count,gs.length)),progressBar(count,gs.length));nav.append(btn);}
 const room=EXHIBITIONS.find(r=>r.id===activeExhibition)||EXHIBITIONS[0],gs=EXHIBITION_GAMES.get(room.id)||[],seen=gs.filter(g=>played(rget(g.id))).length;
 const panel=$('roomDetail');panel.className='room-detail theme-'+room.theme;panel.replaceChildren();
 const head=make('div','room-detail-top'),headCopy=make('div','room-detail-copy');headCopy.append(make('span','room-eyebrow','EXHIBITION '+room.number+'  /  '+room.subtitle.toUpperCase()),make('h3','',room.name),make('p','',room.description));
 const score=make('div','room-score');score.append(make('strong','',String(seen)+' / '+gs.length),make('span','', 'GAMES EXPERIENCED'),progressBar(seen,gs.length));head.append(headCopy,score);panel.append(head);
 const groups=room.groups||[{name:'The selected games',subtitle:'Curated for the NES museum',games:room.games}];
 for(const group of groups){const section=make('section','room-group'),heading=make('div','room-group-head');heading.append(make('h4','',group.name),make('small','',group.subtitle));section.append(heading);const entries=make('div','curated-list');for(const [title,note] of group.games){const g=lookupGame(title);if(g)entries.append(exhibitionEntry(g,note));}section.append(entries);panel.append(section);}
 if(room.special){const [title,copy]=room.special,g=lookupGame(title),special=make('div','special-artifact');special.append(make('span','special-seal','ARCHIVE NOTE  /  UNRELEASED'),make('h4','',title),make('p','',copy));if(g){const btn=make('button','btn btn-outline btn-small','VIEW NES PROTOTYPE ↗');btn.type='button';btn.dataset.open=g.id;special.append(btn);}panel.append(special);}
 const footer=make('div','room-bottom'),button=make('button','btn btn-outline btn-small','BROWSE THIS COLLECTION ↗');button.type='button';button.dataset.filterExhibit=room.id;footer.append(make('span','', 'A game may be displayed in more than one room. Its progress is never duplicated.'),button);panel.append(footer);
}
function selectSeries(id){if(!SERIES.some(s=>s.id===id))return;if(document.body.dataset.page!=='museum'){location.href='./index.html#series/'+encodeURIComponent(id);return;}activeSeries=id;renderSeries();if(location.hash!==`#series/${id}`)location.hash=`series/${id}`;else $('series').scrollIntoView({behavior:'smooth'});}
function renderSeries(){const root=$('seriesNav');root.replaceChildren();for(const series of SERIES){const gs=SERIES_GAMES.get(series.id)||[],cnt=seriesCount(series.id),btn=make('button','series-tile'+(activeSeries===series.id?' active':''));btn.dataset.series=series.id;btn.type='button';btn.setAttribute('aria-pressed',String(activeSeries===series.id));const done=gs.filter(g=>finished(rget(g.id))).length;
  btn.append(make('span','series-tile-deco',series.name.slice(0,2).toUpperCase()),make('strong','',series.name),make('span','',`${cnt} / ${gs.length} played · ${done} finished`));
  const seriesAwards=ACHIEVEMENTS.filter(a=>a.seriesId===series.id),badgeCount=seriesAwards.filter(a=>store.unlocks[a.id]).length;
  const badge=make('span','series-tile-awards',seriesAwards.map(a=>store.unlocks[a.id]?'★':'☆').join(' '));badge.title=`${badgeCount} / ${seriesAwards.length} unlocked`;badge.setAttribute('aria-label',badge.title);btn.append(badge);root.append(btn);}
 const series=SERIES.find(s=>s.id===activeSeries)||SERIES[0],gs=SERIES_GAMES.get(series.id)||[],count=seriesCount(series.id),info=$('seriesDetail');info.replaceChildren();
 const head=make('div','series-detail-head'),summary=make('div');summary.append(make('span','room-eyebrow','FRANCHISE CATALOG  /  '+series.category.toUpperCase()),make('h3','',series.name),make('p','',series.intro));const stats=make('div','room-score');stats.append(make('strong','',`${count} / ${gs.length}`),make('span','', 'GAMES EXPERIENCED'),progressBar(count,gs.length));head.append(summary,stats);info.append(head);
 const milestones=make('div','series-milestones'),awards=ACHIEVEMENTS.filter(a=>a.seriesId===series.id);
 for(const a of awards){const earned=!!store.unlocks[a.id],current=a.get({}),box=make('div','series-milestone'+(earned?' earned':''));
  box.append(make('div','series-milestone-icon',earned?'★':'☆'));const text=make('div','series-milestone-copy');text.append(make('b','',a.name),make('small','',a.desc));box.append(text);
  const prog=make('span','series-milestone-progress',earned?'✓ UNLOCKED':`${current} / ${a.target}`);box.append(prog);milestones.append(box);
 }
 info.append(milestones);
 const core=mainlineGames(series.id),coreDone=mainlineFinishedCount(series.id);
 const completion=make('div','series-completion-note',`${coreDone} / ${core.length} MAINLINE FINISHED · ${seriesFinishedCount(series.id)} / ${gs.length} TOTAL FINISHED. Spin-offs are optional for a Mainline Master badge, but count toward the Complete Set badge.`);
 info.append(completion);
 const segment=make('div','series-view-tabs');for(const [key,label] of [['all','ALL GAMES'],['mainline','MAINLINE'],['spin-off','SPIN-OFFS']]){const b=make('button','series-view-tab'+(seriesView===key?' active':''),label);b.type='button';b.dataset.seriesView=key;b.setAttribute('aria-pressed',String(seriesView===key));segment.append(b);}info.append(segment);
 const list=make('div','series-list');for(let i=0;i<gs.length;i++){const g=gs[i],r=rget(g.id),role=seriesRole(g.id,series.id);if(seriesView!=='all' && (seriesView==='mainline'?'Mainline':'Spin-off')!==role)continue;const card=make('article','series-list-item'+(played(r)?' explored':'')),num=make('span','series-no',String(i+1).padStart(2,'0'));const name=make('div','series-game-name');name.append(make('strong','',g.title),make('small','series-role-label',role.toUpperCase()),make('small','',`${g.year||'?'}  ·  ${g.region==='FDS'?'DISK SYSTEM':g.region==='JP'?'FAMICOM':g.region==='PAL'?'NES':'NES'}${g.aliases?.length?'  /  '+g.aliases[0]:''}`));const open=make('button','series-open','VIEW RECORD ↗');open.dataset.open=g.id;open.type='button';card.append(num,name,makeStatusSelect(g),open);list.append(card);}info.append(list);
 const actions=make('div','room-bottom'),browse=make('button','btn btn-outline btn-small','FILTER ARCHIVE TO THIS SERIES ↗');browse.type='button';browse.dataset.filterSeries=series.id;actions.append(make('span','', 'Alternate cartridge titles share one game entry.'),browse);info.append(actions);
}
$('roomNav').addEventListener('click',e=>{const btn=e.target.closest('[data-exhibit]');if(btn){activeExhibition=btn.dataset.exhibit;renderExhibitions();}});
$('roomDetail').addEventListener('click',e=>{const open=e.target.closest('[data-open]'),filter=e.target.closest('[data-filter-exhibit]');if(open)openGame(open.dataset.open);else if(filter)filterTo('exhibition',filter.dataset.filterExhibit);});
$('roomDetail').addEventListener('change',e=>{if(e.target.matches('[data-status-id]'))setRecord(e.target.dataset.statusId,{status:cleanStatus(e.target.value)});});
$('seriesNav').addEventListener('click',e=>{const btn=e.target.closest('[data-series]');if(btn)selectSeries(btn.dataset.series);});
$('seriesDetail').addEventListener('click',e=>{const open=e.target.closest('[data-open]'),filter=e.target.closest('[data-filter-series]'),seg=e.target.closest('[data-series-view]');if(open)openGame(open.dataset.open);else if(filter)filterTo('series',filter.dataset.filterSeries);else if(seg){seriesView=seg.dataset.seriesView;renderSeries();}});
$('seriesDetail').addEventListener('change',e=>{if(e.target.matches('[data-status-id]'))setRecord(e.target.dataset.statusId,{status:cleanStatus(e.target.value)});});
function renderPassport(){
 const s=stats();$('passportName').textContent=store.profile.name||'PLAYER 1';$('passportBioText').textContent=store.profile.bio||'Your NES journey begins here. Every cartridge tells a story.';
 $('passportStats').textContent=`${s.seen} EXPERIENCED  ·  ${s.fin} FINISHED  ·  ${s.master} MASTERED  ·  ${s.want} WANT TO PLAY`;const tint={red:'#e77b79',gold:'#d7aa6c',teal:'#6fb7ad',purple:'#a69ac9',blue:'#7ea8d2'}[store.profile.accent]||'#e77b79';$('passportPublicCard').style.setProperty('--passport-accent',tint);$('passportAvatar').textContent=store.profile.avatar||'P1';$('passportMotto').textContent=store.profile.motto||'NES / FAMICOM ARCHIVIST';
 const featured=(store.profile.featured||[]).map(findGame).filter(Boolean);const favs=featured.length?featured:allGames().filter(g=>rget(g.id).favorite).slice(0,4);$('passportFavorites').replaceChildren(...(favs.length?favs.map(g=>{const b=make('button','passport-fav',g.title);b.type='button';b.addEventListener('click',()=>openGame(g.id));return b;}):[make('span','passport-placeholder','Favorite some games to put them on display.') ]));
 const pinned=ACHIEVEMENTS.find(a=>a.id===store.profile.pinnedAchievement&&store.unlocks[a.id]);const badges=pinned?[pinned,...ACHIEVEMENTS.filter(a=>store.unlocks[a.id]&&a.id!==pinned.id).slice(-5)]:ACHIEVEMENTS.filter(a=>store.unlocks[a.id]).slice(-6);$('passportBadges').replaceChildren(...badges.map(a=>make('span','passport-earned',a.icon+' '+a.name)));
}
function renderAll(){renderStats();renderMuseum();renderExhibitions();renderSeries();renderArchive();renderAchievements();renderPassport();if(typeof renderCollection==='function'&&typeof collectionView!=='undefined')renderCollection();}
function updateYears(){const prev=$('yearFilter').value||'all';const years=[...new Set(allGames().map(g=>g.year).filter(Boolean))].sort((a,b)=>a-b);$('yearFilter').replaceChildren(new Option('Every year','all'),...years.map(y=>new Option(String(y),String(y))));$('yearFilter').value=years.map(String).includes(prev)?prev:'all';yearFilter=$('yearFilter').value;selection('genreFilter','All genres',allGames().flatMap(g=>g.genres||[]));selection('tagFilter','All tags',allGames().flatMap(g=>g.tags||[]));selection('developerFilter','All developers',allGames().map(g=>g.developer));selection('publisherFilter','All publishers',allGames().map(g=>g.publisher));}
function setRecord(id,patch,quiet=false){if(!allGames().some(g=>g.id===id))return;const old=rget(id);store.records[id]={...cleanRecord(old),...patch,updatedAt:Date.now()};if(patch.status && patch.status!=='unplayed')store.records[id].wantToPlay=false;persist();const unlocked=awardAchievements(quiet);renderAll();if(!quiet&&!unlocked.length)notify('Game record saved to your museum.');}
function setView(next){view=next;document.querySelectorAll('[data-view]').forEach(btn=>{const active=btn.dataset.view===next;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});renderArchive();}
function resetFilters(){search='';statusFilter='all';yearFilter='all';seriesFilter='all';exhibitionFilter='all';genreFilter='all';tagFilter='all';developerFilter='all';publisherFilter='all';roleFilter='all';sort='alpha';limit=PAGE_SIZE;$('searchInput').value='';for(const id of ['statusFilter','yearFilter','seriesFilter','exhibitionFilter','genreFilter','tagFilter','developerFilter','publisherFilter','roleFilter'])$(id).value='all';$('sortSelect').value='alpha';renderArchive();}
function filterTo(type,id){if(document.body.dataset.page!=='archive'){location.href='./archive.html?filter='+encodeURIComponent(type)+'&value='+encodeURIComponent(id);return;}resetFilters();if(type==='exhibition'){exhibitionFilter=id;$('exhibitionFilter').value=id;}else if(type==='series'){seriesFilter=id;$('seriesFilter').value=id;}
 else if(type==='genre'){genreFilter=id;$('genreFilter').value=id;}
 else if(type==='tag'){tagFilter=id;$('tagFilter').value=id;}
 else if(type==='developer'){developerFilter=id;$('developerFilter').value=id;}
 else if(type==='publisher'){publisherFilter=id;$('publisherFilter').value=id;}
 else if(type==='want'){statusFilter='want';$('statusFilter').value='want';}
 renderArchive();document.getElementById('archive').scrollIntoView({behavior:'smooth'});}

function findGame(id){return allGames().find(g=>g.id===id);}
function drawWant(){const btn=$('detailWant');btn.classList.toggle('active',pendingWant);btn.setAttribute('aria-pressed',String(pendingWant));btn.textContent=pendingWant?'✓ ON WANT TO PLAY':'＋ WANT TO PLAY';}
function drawFavorite(){const btn=$('detailFavorite');btn.classList.toggle('active',pendingFavorite);btn.setAttribute('aria-pressed',String(pendingFavorite));btn.textContent=pendingFavorite?'★ FAVORITED':'☆ ADD TO FAVORITES';}
function drawRating(){document.querySelectorAll('[data-rate]').forEach(b=>{const n=Number(b.dataset.rate);b.textContent=n<=pendingRating?'★':'☆';b.setAttribute('aria-pressed',String(n===pendingRating));});}
function openGame(id){const g=findGame(id);if(!g)return;detailId=g.id;const r=rget(id);$('detailCartridge').replaceChildren(makeArt(g));$('detailTitle').textContent=g.title;$('detailRegion').textContent=g.prototype?'UNRELEASED NES PROTOTYPE':g.region==='FDS'?'FAMICOM DISK SYSTEM':g.region==='JP'?'FAMICOM':g.region==='HOME'?'HOMEBREW':'NES';$('detailYear').textContent=`${g.year||'Unknown year'} · ${g.region==='FDS'?'FDS':g.region==='JP'?'FAMICOM':'NES'}${g.prototype?' · NOT RETAIL RELEASED':''}`;
 const tags=$('detailTags');tags.replaceChildren();for(const exhibit of gameExhibits(id))tags.append(make('span','detail-tag',exhibit.name));for(const series of gameSeries(id))tags.append(make('button','detail-tag detail-tag-link',series.name));for(const genre of g.genres||[]){const t=make('button','detail-tag detail-tag-muted',genre);t.type='button';t.dataset.genreJump=genre;tags.append(t);}
 for(const tag of g.tags||[]){const t=make('button','detail-tag detail-tag-tech',tag);t.type='button';t.dataset.tagJump=tag;tags.append(t);}
 for(const s of gameSeries(id)){const role=seriesRole(id,s.id);tags.append(make('span','detail-tag detail-tag-role',`${s.name}: ${role}`));}
 for(const tag of tags.querySelectorAll('button'))tag.addEventListener('click',()=>{
 if(tag.dataset.genreJump){$('gameDialog').close();filterTo('genre',tag.dataset.genreJump);return;}
 if(tag.dataset.tagJump){$('gameDialog').close();filterTo('tag',tag.dataset.tagJump);return;}
 const sr=SERIES.find(x=>x.name===tag.textContent);if(sr){$('gameDialog').close();selectSeries(sr.id);}
 });
 $('detailCredits').replaceChildren();
 const credit=(name,value,type)=>{const el=make('button','detail-credit',`${name} · ${value||'Not yet catalogued'}`);el.type='button';if(value){el.dataset.creditType=type;el.dataset.creditValue=value;}else el.disabled=true;$('detailCredits').append(el);};
 credit('DEVELOPER',g.developer,'developer');credit('PUBLISHER',g.publisher,'publisher');
 $('detailAliases').textContent=g.aliases?.length?'ALTERNATE CARTRIDGE TITLES · '+g.aliases.join(' · '):'';
 $('detailAvailability').textContent='FORMATS ON FILE · '+[...new Set((g.regions||[g.region]).map(c=>({NA:'NES',PAL:'NES',JP:'FAMICOM',FDS:'DISK SYSTEM',PROTO:'UNRELEASED PROTOTYPE',HOME:'HOMEBREW',OTHER:'NES'})[c]||'NES'))].join(' / ');
 $('detailPrototype').classList.toggle('hidden',!g.prototype);$('detailCode').textContent=g.id;const rule=completionInfo(g);$('completionRule').textContent=(rule.kind==='campaign'?'ENDING / CAMPAIGN':rule.kind==='score'?'ARCADE / PERSONAL GOAL':rule.kind==='strategy'?'STRATEGY / PERSONAL GOAL':'SIMULATION / PERSONAL GOAL')+' · '+rule.description;[...$('detailStatus').options].forEach(opt=>opt.textContent=statusLabel(g,opt.value));$('detailGoal').value=r.goal||'';$('detailStatus').value=r.status;$('detailOtherVersionStatus').value=r.otherVersionStatus;$('detailOtherVersionName').value=r.otherVersionName;$('detailDate').value=r.playedDate;$('detailNote').value=r.note;pendingRating=r.rating;pendingFavorite=r.favorite;pendingWant=r.wantToPlay;drawRating();drawFavorite();drawWant();$('removeGameBtn').classList.toggle('hidden',!g.custom);$('gameDialog').showModal();}
function parseFreeTags(value,max=12){return unique(String(value).split(',').map(s=>s.trim().slice(0,35)).filter(Boolean)).slice(0,max);}
function pickRandom(){const remaining=allGames().filter(g=>!played(rget(g.id)));const pool=remaining.length?remaining:allGames();if(!pool.length)return;const game=pool[Math.floor(Math.random()*pool.length)];curatorId=game.id;renderMuseum();openGame(game.id);}
function download(filename,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),a=make('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function exportBackup(){download('nes-playlog-v9-backup.json',JSON.stringify({app:'NES Playlog',version:ARCHIVE_VERSION,exportedAt:new Date().toISOString(),records:store.records,custom:store.custom,unlocks:store.unlocks,settings:store.settings,profile:store.profile},null,2));notify('Backup exported. Keep it somewhere safe!');}
function scrollToArchive(){if(document.body.dataset.page!=='archive'){location.href='./archive.html';return;}document.getElementById('archive').scrollIntoView({behavior:'smooth'});}

function drawMuseumCard(){
 const c=document.createElement('canvas');c.width=1200;c.height=720;const ctx=c.getContext('2d');
 const fam=store.settings.theme==='famicom';const ink=fam?'#4e1420':'#171a1b';const ground=fam?'#f0e3ca':'#dedbd5';const accent=fam?'#981f33':'#d54240';
 ctx.fillStyle=ink;ctx.fillRect(0,0,1200,720);
 ctx.fillStyle=ground;ctx.fillRect(26,26,1148,668);ctx.fillStyle=accent;ctx.fillRect(26,26,1148,19);
 ctx.fillStyle=ink;ctx.fillRect(50,64,1100,585);
 ctx.fillStyle=ground;ctx.font='bold 29px monospace';ctx.fillText('▦ NES / PLAYLOG',76,113);ctx.font='18px monospace';ctx.fillText(fam?'FAMICOM COLLECTION':'NES COLLECTION',873,112);
 ctx.fillStyle=accent;ctx.fillRect(75,134,1050,3);
 const name=(store.profile.name||'PLAYER 1').toUpperCase().slice(0,26);ctx.fillStyle=ground;ctx.font='bold 66px sans-serif';ctx.fillText(name,72,218,1030);
 const s=stats();ctx.fillStyle='#aaa6a0';ctx.font='23px monospace';ctx.fillText(`${s.seen} GAMES PLAYED    ${s.fin} CONQUERED    ${ACHIEVEMENTS.filter(a=>store.unlocks[a.id]).length} TROPHIES`,75,279);
 ctx.fillStyle=accent;ctx.font='bold 24px monospace';ctx.fillText('FAVORITE CARTRIDGES',75,332);
 const favs=allGames().filter(g=>rget(g.id).favorite).sort((a,b)=>rget(b.id).updatedAt-rget(a.id).updatedAt).slice(0,4);
 ctx.font='bold 29px sans-serif';ctx.fillStyle=ground;
 if(!favs.length)ctx.fillText('Your favorite games belong here.',75,377,1010);
 else favs.forEach((g,i)=>{ctx.fillStyle=i%2? '#c7c3bd':'#eeeae4';ctx.fillText(`${i+1}. ${g.title}`,75,376+i*53,990);});
 const completed=SERIES.filter(x=>{const gs=SERIES_GAMES.get(x.id)||[];return gs.length>0&&gs.every(g=>finished(rget(g.id)));});
 ctx.fillStyle=accent;ctx.font='bold 21px monospace';ctx.fillText('SERIES MASTERED: '+completed.length,75,597);
 ctx.fillStyle=ground;ctx.font='18px monospace';ctx.fillText('AN OFFLINE COLLECTION · NO ACCOUNT REQUIRED',75,633);
 ctx.fillStyle=ink;ctx.font='bold 19px monospace';ctx.fillText('PERSONAL 8-BIT MUSEUM   ·   MADE WITH NES PLAYLOG',49,676);
 const a=document.createElement('a');a.download='nes-playlog-player-card.png';a.href=c.toDataURL('image/png');a.click();notify('Your player card was saved as an image. ✦');
}
$('shareCardBtn').addEventListener('click',drawMuseumCard);
function updateOnlineState(){const net=$('networkState');if(net)net.textContent=navigator.onLine?'● ONLINE':'○ OFFLINE';artStatus();}
window.addEventListener('online',updateOnlineState);window.addEventListener('offline',updateOnlineState);
// PWA works on HTTPS/GitHub Pages or localhost, but not for a file:// preview.
let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;const el=$('installState');if(el)el.textContent='Ready to install · choose INSTALL NES PLAYLOG';});
$('installBtn').addEventListener('click',async()=>{
 if(installPrompt){const prompt=installPrompt;installPrompt=null;prompt.prompt();await prompt.userChoice;return;}
 notify('Install from your browser menu after publishing on HTTPS. Use Add to Home Screen or Install app.');
});
$('helpInstallBtn').addEventListener('click',()=>notify('After publishing on GitHub Pages, use the browser menu → Install app or Add to Home Screen.'));
if(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'){
 if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('../sw.js',{scope:'../'}).catch(e=>console.warn('Offline cache unavailable:',e)));
}
updateOnlineState();
$('passportForm').addEventListener('submit',e=>{e.preventDefault();store.profile.name=$('passportAlias').value.trim().slice(0,32)||'PLAYER 1';store.profile.bio=$('passportBio').value.trim().slice(0,180);store.profile.avatar=$('passportAvatarInput').value;store.profile.accent=$('passportAccentInput').value;store.profile.motto=$('passportMottoInput').value.trim().slice(0,60);store.profile.featured=unique([1,2,3].map(n=>$('passportFeatured'+n).value)).filter(Boolean);store.profile.pinnedAchievement=$('passportPinnedAchievement').value;persist();renderPassport();$('passportDialog').close();notify('Local player passport saved.');});
$('passportEdit').addEventListener('click',()=>{$('passportAlias').value=store.profile.name;$('passportBio').value=store.profile.bio;$('passportAvatarInput').value=store.profile.avatar||'P1';$('passportAccentInput').value=store.profile.accent||'red';$('passportMottoInput').value=store.profile.motto||'';const opts=allGames().slice().sort((a,b)=>a.title.localeCompare(b.title));for(let n=1;n<=3;n++){const el=$('passportFeatured'+n);el.replaceChildren(new Option('Choose a game (optional)',''),...opts.map(g=>new Option(g.title,g.id)));el.value=(store.profile.featured||[])[n-1]||'';}const a=$('passportPinnedAchievement');a.replaceChildren(new Option('Show latest trophies automatically',''),...ACHIEVEMENTS.filter(x=>store.unlocks[x.id]).map(x=>new Option(x.icon+' '+x.name,x.id)));a.value=store.profile.pinnedAchievement||'';$('passportDialog').showModal();});
$('detailCredits').addEventListener('click',e=>{const b=e.target.closest('[data-credit-type]');if(b){$('gameDialog').close();filterTo(b.dataset.creditType,b.dataset.creditValue);}});
$('wantShelfLink').addEventListener('click',()=>filterTo('want','want'));
$('gameGrid').addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;if(btn.dataset.open)openGame(btn.dataset.open);else if(btn.dataset.favoriteId)setRecord(btn.dataset.favoriteId,{favorite:!rget(btn.dataset.favoriteId).favorite});else if(btn.dataset.wantId)setRecord(btn.dataset.wantId,{wantToPlay:!rget(btn.dataset.wantId).wantToPlay});});
$('gameGrid').addEventListener('change',e=>{const el=e.target;if(el.matches('[data-status-id]')){setRecord(el.dataset.statusId,{status:cleanStatus(el.value)});}});
['recentShelf','favoriteShelf','wantShelf'].forEach(id=>$(id).addEventListener('click',e=>{const btn=e.target.closest('[data-open]');if(btn)openGame(btn.dataset.open);}));
$('curatorBtn').addEventListener('click',()=>{if(curatorId)openGame(curatorId);});
$('randomBtn').addEventListener('click',pickRandom);$('exploreBtn').addEventListener('click',scrollToArchive);
$('searchInput').addEventListener('input',e=>{search=e.target.value.trim().toLocaleLowerCase();limit=PAGE_SIZE;renderArchive();});
[['statusFilter',v=>statusFilter=v],['yearFilter',v=>yearFilter=v],['seriesFilter',v=>seriesFilter=v],['exhibitionFilter',v=>exhibitionFilter=v],['genreFilter',v=>genreFilter=v],['tagFilter',v=>tagFilter=v],['developerFilter',v=>developerFilter=v],['publisherFilter',v=>publisherFilter=v],['roleFilter',v=>roleFilter=v],['sortSelect',v=>sort=v]].forEach(([id,set])=>$(id).addEventListener('change',e=>{set(e.target.value);limit=PAGE_SIZE;renderArchive();}));
document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
$('clearFiltersBtn').addEventListener('click',resetFilters);$('clearEmptyBtn').addEventListener('click',resetFilters);
$('moreBtn').addEventListener('click',()=>{limit+=PAGE_SIZE;renderArchive();});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')&&!document.querySelector('dialog[open]')){e.preventDefault();$('searchInput').focus();}else if(e.key==='Escape'&&document.activeElement===$('searchInput')&&$('searchInput').value){$('searchInput').value='';search='';limit=PAGE_SIZE;renderArchive();}});
$('detailFavorite').addEventListener('click',()=>{pendingFavorite=!pendingFavorite;drawFavorite();});$('detailWant').addEventListener('click',()=>{pendingWant=!pendingWant;drawWant();});
document.querySelectorAll('[data-rate]').forEach(b=>b.addEventListener('click',()=>{pendingRating=Number(b.dataset.rate);drawRating();}));
$('clearRating').addEventListener('click',()=>{pendingRating=0;drawRating();});
$('gameForm').addEventListener('submit',e=>{e.preventDefault();if(!detailId)return;const status=cleanStatus($('detailStatus').value);setRecord(detailId,{status,otherVersionStatus:$('detailOtherVersionStatus').value,otherVersionName:$('detailOtherVersionName').value.trim().slice(0,120),playedDate:$('detailDate').value,note:$('detailNote').value.trim().slice(0,1000),goal:$('detailGoal').value.trim().slice(0,180),favorite:pendingFavorite,wantToPlay:pendingWant,rating:pendingRating});$('gameDialog').close();});
$('addBtn').addEventListener('click',()=>$('addDialog').showModal());$('aboutBtn').addEventListener('click',()=>$('aboutDialog').showModal());
document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>$(btn.dataset.close).close()));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
$('addForm').addEventListener('submit',e=>{e.preventDefault();const title=$('addTitle').value.trim(),y=$('addYear').value,year=y?Number(y):null,region=$('addRegion').value;if(!title||title.length>120)return;if(y&&(!Number.isInteger(year)||year<1983||year>2100)){notify('Choose a valid release year.');return;}if(!REGION_NAMES[region])return;const existing=lookupGame(title);if(existing){$('addDialog').close();openGame(existing.id);notify('This game already has a record. Alternate cartridge titles share the same checkmark.');return;}if(allGames().some(g=>g.title.toLocaleLowerCase()===title.toLocaleLowerCase()&&g.year===year&&g.region===region)){notify('That entry is already on the shelf.');return;}const id=`custom:${slug(title)}:${year??'na'}:${region.toLowerCase()}`;if(allGames().some(g=>g.id===id)){notify('That entry already exists.');return;}store.custom.push({id,title,year,region,regions:[region],aliases:[],genres:parseFreeTags($('addGenres').value,12),tags:parseFreeTags($('addTags').value,15),developer:$('addDeveloper').value.trim().slice(0,120),publisher:$('addPublisher').value.trim().slice(0,120),custom:true});persist();awardAchievements(false);updateYears();resetFilters();$('searchInput').value=title;search=title.toLocaleLowerCase();renderAll();$('addForm').reset();$('addDialog').close();notify('A new cartridge has joined your museum.');});
$('removeGameBtn').addEventListener('click',()=>{const g=findGame(detailId);if(!g?.custom)return;if(!confirm(`Remove ${g.title} from your custom catalog? Its saved notes and status will be deleted.`))return;store.custom=store.custom.filter(x=>x.id!==g.id);delete store.records[g.id];persist();updateYears();resetFilters();renderAll();$('gameDialog').close();notify('Custom cartridge removed.');});
['exportBtn','bannerExportBtn','aboutExportBtn'].forEach(id=>$(id).addEventListener('click',exportBackup));
['importBtn','bannerImportBtn'].forEach(id=>$(id).addEventListener('click',()=>$('importFile').click()));
$('importFile').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>8_000_000)throw Error('File too large');const data=JSON.parse(await file.text());if(data?.app!=='NES Playlog'||![1,2,3,4,5,6,7,8,9].includes(data.version)||!isObj(data.records)||!Array.isArray(data.custom))throw Error('Unknown format');const imported=parseStore(data);if(!confirm(`Import your NES Playlog version ${data.version} backup? This will replace the collection stored in this browser.`))return;store=imported;awardAchievements(true);persist();applySettings();updateYears();resetFilters();renderAll();notify('Museum restored from your backup. ✦');}catch(err){console.warn(err);notify('Could not import that file. Please choose a NES Playlog JSON backup.');}});
function applySettings(){
 document.documentElement.dataset.theme=store.settings.theme;
 document.documentElement.dataset.covers=store.settings.coverArt?'on':'off';
 $('consoleLabel').textContent=store.settings.theme==='famicom'?'FAMICOM MODE':'NES MODE';
 document.querySelectorAll('[data-theme-select]').forEach(btn=>{const a=btn.dataset.themeSelect===store.settings.theme;btn.classList.toggle('active',a);btn.setAttribute('aria-pressed',String(a));});
 $('coverToggle').checked=store.settings.coverArt;
}
document.querySelectorAll('[data-theme-select]').forEach(btn=>btn.addEventListener('click',()=>{store.settings.theme=btn.dataset.themeSelect;persist();applySettings();renderAll();notify(store.settings.theme==='famicom'?'Famicom shell selected.':'NES shell selected.');}));
$('coverToggle').addEventListener('change',e=>{store.settings.coverArt=e.target.checked;persist();applySettings();renderAll();notify(store.settings.coverArt?'Online box art enabled.':'Original illustrated cartridge labels restored.');});
document.querySelectorAll('[data-achievement-filter]').forEach(btn=>btn.addEventListener('click',()=>{achievementFilter=btn.dataset.achievementFilter;renderAchievements();}));
$('achievementGrid').addEventListener('click',e=>{const btn=e.target.closest('[data-series-jump]');if(btn)selectSeries(btn.dataset.seriesJump);});
$('resetBtn').addEventListener('click',()=>{if(!confirm('Permanently reset all game progress, notes, custom entries, and achievements in this browser? Export a backup first to keep them.'))return;store=newStore();persist();applySettings();updateYears();resetFilters();renderAll();notify('Your museum has been reset.');});
// Archive selectors are independent of play status and never duplicate a game record.
$('exhibitionFilter').replaceChildren(new Option('All collections','all'),...EXHIBITIONS.map(x=>new Option(x.name,x.id)));
$('seriesFilter').replaceChildren(new Option('Every series','all'),...SERIES.map(x=>new Option(x.name,x.id)));
const selection=(id,label,values)=>$(id).replaceChildren(new Option(label,'all'),...unique(values).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'})).map(x=>new Option(x,x)));
selection('genreFilter','All genres',allGames().flatMap(g=>g.genres||[]));
selection('tagFilter','All tags',allGames().flatMap(g=>g.tags||[]));
selection('developerFilter','All developers',allGames().map(g=>g.developer));
selection('publisherFilter','All publishers',allGames().map(g=>g.publisher));
function seriesFromHash(){const match=decodeURIComponent(location.hash).match(/^#series\/([a-z-]+)$/);if(match&&SERIES.some(x=>x.id===match[1])){activeSeries=match[1];renderSeries();$('series').scrollIntoView({behavior:'auto'});}}
window.addEventListener('hashchange',seriesFromHash);

/* My Collection, a real destination that displays statuses without archive filters. */
let collectionView='all',collectionQuery='',visitorData=null,visitorFilter='all';
const collectionBuckets=[['tried','TRIED'],['played','PLAYED'],['finished','FINISHED'],['mastered','MASTERED']];
function progressCount(status){return allGames().filter(g=>rget(g.id).status===status).length;}
function countBlocks(root){root.replaceChildren(...collectionBuckets.map(([key,label])=>{const b=make('div','collection-count');b.append(make('strong','',String(progressCount(key))),make('span','',label));return b;}));}
function collectionLabel(r){return ({tried:'◌ TRIED',played:'◉ PLAYED',finished:'◆ FINISHED',mastered:'✦ MASTERED',unplayed:r.otherVersionStatus==='finished'?'◆ OTHER EDITION FINISHED':'◉ OTHER EDITION PLAYED'})[r.status]||'NOT PLAYED';}
function matchesCollection(g){const r=rget(g.id),q=collectionQuery;if(q&&!([g.title,...(g.aliases||[]),r.otherVersionName].join(' ').toLowerCase().includes(q)))return false;
 if(collectionView==='all')return played(r);if(collectionView==='other')return r.otherVersionStatus!=='none';if(collectionView==='want')return r.wantToPlay;if(collectionView==='favorite')return r.favorite;return r.status===collectionView;}
function renderCollection(){countBlocks($('collectionCounts'));countBlocks($('profileCollectionStats'));
 const selection=allGames().filter(matchesCollection).sort((a,b)=>rget(b.id).updatedAt-rget(a.id).updatedAt||a.title.localeCompare(b.title));$('collectionResultText').textContent=selection.length+' GAMES ON THIS SHELF';
 $('collectionGrid').replaceChildren(...selection.slice(0,240).map(g=>{const r=rget(g.id),c=make('article','collection-item');c.append(makeArt(g),make('h3','',g.title),make('span','collection-label',collectionView==='other'?(r.otherVersionStatus==='finished'?'◆ FINISHED ANOTHER VERSION':'◉ PLAYED ANOTHER VERSION'):collectionLabel(r)));if(collectionView==='other'&&r.otherVersionName)c.append(make('small','',r.otherVersionName));const b=make('button','collection-open','OPEN RECORD ↗');b.dataset.collectionOpen=g.id;b.type='button';c.append(b);return c;}));
 $('collectionEmpty').hidden=selection.length>0;document.querySelectorAll('[data-collection-filter]').forEach(b=>b.classList.toggle('active',b.dataset.collectionFilter===collectionView));
 const recent=allGames().filter(g=>played(rget(g.id))).sort((a,b)=>rget(b.id).updatedAt-rget(a.id).updatedAt).slice(0,6);$('profileCollectionCards').replaceChildren(...(recent.length?recent.map(g=>{const r=rget(g.id),el=make('div','profile-mini-game');el.append(make('small','',collectionLabel(r)),make('strong','',g.title));return el;}):[make('p','', 'Your gallery will fill as you play more games.')]));
}
$('collectionTabs').addEventListener('click',e=>{const b=e.target.closest('[data-collection-filter]');if(b){collectionView=b.dataset.collectionFilter;renderCollection();}});
$('collectionSearch').addEventListener('input',e=>{collectionQuery=e.target.value.trim().toLowerCase();renderCollection();});
$('collectionGrid').addEventListener('click',e=>{const b=e.target.closest('[data-collection-open]');if(b)openGame(b.dataset.collectionOpen);});

/* Shareable guest museum files are strictly read-only. Never parse through parseStore or persist. */
function publicPassportData(){const entries=Object.entries(store.records).filter(([id,v])=>{const r=cleanRecord(v);return played(r)||r.favorite||r.otherVersionStatus!=='none';}).map(([id,v])=>{const r=cleanRecord(v);return{id,status:r.status,favorite:r.favorite,otherVersionStatus:r.otherVersionStatus};});
 return{app:'NES Playlog Public Passport',schema:1,exportedAt:new Date().toISOString(),profile:{name:store.profile.name||'PLAYER 1',bio:store.profile.bio||'',avatar:store.profile.avatar||'P1',accent:store.profile.accent||'red',motto:store.profile.motto||'',featured:(store.profile.featured||[]).slice(0,3)},games:entries,achievements:ACHIEVEMENTS.filter(a=>store.unlocks[a.id]).map(a=>a.id),customGames:store.custom.map(g=>({id:g.id,title:g.title,year:g.year})).filter(g=>entries.some(r=>r.id===g.id))};}
function exportPublicPassport(){const payload=publicPassportData();download('nes-playlog-public-passport.json',JSON.stringify(payload,null,2));notify('Public passport exported. Share that file, not your private backup.');}
const safeGuest=(data)=>{if(!isObj(data)||data.app!=='NES Playlog Public Passport'||data.schema!==1||!Array.isArray(data.games)||!Array.isArray(data.achievements)||!isObj(data.profile))throw Error('Not a public passport');if(data.games.length>4000||data.achievements.length>300||JSON.stringify(data).length>900000)throw Error('Passport too large');
 const custom=Array.isArray(data.customGames)?data.customGames.slice(0,1000).filter(g=>typeof g.id==='string'&&g.id.startsWith('custom:')&&typeof g.title==='string'&&g.title.length<=120).map(g=>({id:g.id,title:g.title,year:g.year})):[];
 const known=new Set([...builtIn,...custom].map(g=>g.id));const games=unique(data.games.filter(x=>isObj(x)&&known.has(x.id)&&STATUSES.includes(x.status)).map(x=>x.id)).map(id=>{const r=data.games.find(x=>x.id===id);return{id,status:r.status,favorite:r.favorite===true,otherVersionStatus:OTHER_VERSION_STATUSES.includes(r.otherVersionStatus)?r.otherVersionStatus:'none'};});
 const knownAwards=new Set(ACHIEVEMENTS.map(a=>a.id));return{profile:{name:String(data.profile.name||'GUEST').slice(0,32),bio:String(data.profile.bio||'').slice(0,180),motto:String(data.profile.motto||'').slice(0,60),avatar:String(data.profile.avatar||'P1').slice(0,3),accent:String(data.profile.accent||'red').slice(0,20)},games,achievements:unique(data.achievements.filter(x=>typeof x==='string'&&knownAwards.has(x))),customGames:custom};};
function renderGuest(){const panel=$('visitorPanel');panel.classList.toggle('hidden',!visitorData);if(!visitorData)return;
 const d=visitorData; $('visitorName').textContent=(d.profile.avatar||'✦')+' '+(d.profile.name||'GUEST');$('visitorBio').textContent=[d.profile.motto,d.profile.bio].filter(Boolean).join(' · ');
 const counts={all:0,played:0,finished:0,mastered:0};for(const g of d.games){if(g.status!=='unplayed')counts.all++;if(['played','finished','mastered'].includes(g.status))counts.played++;if(['finished','mastered'].includes(g.status))counts.finished++;if(g.status==='mastered')counts.mastered++;}
 $('visitorStats').replaceChildren(...[['all','VISITED'],['finished','FINISHED'],['mastered','MASTERED']].map(([key,label])=>make('span','',counts[key]+' '+label)),make('span','',d.achievements.length+' TROPHIES'));
 const items=d.games.filter(g=>{if(visitorFilter==='all')return g.status!=='unplayed'||g.otherVersionStatus!=='none';if(visitorFilter==='played')return ['played','finished','mastered'].includes(g.status);if(visitorFilter==='finished')return ['finished','mastered'].includes(g.status);return g.status==='mastered';});
 const map=new Map([...builtIn,...d.customGames].map(x=>[x.id,x]));$('visitorGames').replaceChildren(...(items.length?items.slice(0,350).map(r=>{const g=map.get(r.id);const el=make('article','visitor-game');el.append(make('strong','',g?.title||'Unknown game'),make('small','',r.status.toUpperCase().replace('UNPLAYED','OTHER VERSION')+(r.favorite?'  ★ FAVORITE':'')));return el;}):[make('p','', 'No games recorded in this category.') ]));
 $('visitorTrophies').replaceChildren(...(d.achievements.length?d.achievements.map(id=>{const a=ACHIEVEMENTS.find(a=>a.id===id);const el=make('article','visitor-trophy');el.append(make('strong','',a.icon+' '+a.name),make('small','',a.desc));return el;}):[make('p','', 'No trophies recorded yet.') ]));
 document.querySelectorAll('[data-visitor-filter]').forEach(b=>b.classList.toggle('active',b.dataset.visitorFilter===visitorFilter));}
$('exportGuestBtn').addEventListener('click',exportPublicPassport);
$('openGuestBtn').addEventListener('click',()=>$('visitorFile').click());
$('closeGuestBtn').addEventListener('click',()=>{visitorData=null;visitorFilter='all';renderGuest();notify('You are viewing your own museum again.');});
$('visitorTabs').addEventListener('click',e=>{const b=e.target.closest('[data-visitor-filter]');if(b){visitorFilter=b.dataset.visitorFilter;renderGuest();}});
$('visitorFile').addEventListener('change',async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>1000000)throw Error('Too large');const data=JSON.parse(await f.text());visitorData=safeGuest(data);visitorFilter='all';renderGuest();$('visitorPanel').scrollIntoView({behavior:'smooth',block:'start'});notify('Friend passport opened in visitor mode. Your own collection is untouched.');}catch(err){console.warn(err);notify('Could not open this public passport. Please choose a public passport export, not a private backup.');}});

applySettings();updateYears();awardAchievements(true);if(migrated)persist();const p=new URLSearchParams(location.search);if(document.body.dataset.page==='archive'&&p.has('filter'))filterTo(p.get('filter'),p.get('value')||'all');renderAll();renderCollection();if(document.body.dataset.page==='museum')seriesFromHash();if(p.has('game')){const requested=decodeURIComponent(p.get('game'));if(findGame(requested))openGame(requested);}
})();

