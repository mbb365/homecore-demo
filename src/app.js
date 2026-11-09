// Move Assistant app logic, ported from the v63 HTML prototype.
// Runs inside the card's shadow root; `bridge` connects it to Home Assistant.
import {wxKey,wxPose,wxMorph,wxBitmap,wxStripBitmap,wxStripSmooth} from './weather-art.js';

export function mountMoveAssistant(root, bridge){
const $=id=>root.getElementById(id);
const workoutView=$('workoutView');
const workoutNameInput=$('workoutNameInput');
const loops=new Set();
let alive=true;

const homeClock=$('homeClock');
function updateHomeClock(){
  if(!homeClock)return;
  homeClock.textContent=new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(new Date());
}
updateHomeClock();
setInterval(updateHomeClock,15000);


const createFlow=$('createFlow');
const createMovementsSlot=$('createMovementsSlot');
const createTimingSlot=$('createTimingSlot');
const createFinishSlot=$('createFinishSlot');
const movementStepSummary=$('movementStepSummary');
const timingStepSummary=$('timingStepSummary');
const finishStepSummary=$('finishStepSummary');
const continueToTiming=$('continueToTiming');
const continueToFinish=$('continueToFinish');
const finishMoveButton=$('finishMoveButton');

let createTimingVisited=false;
let createFlowOrigins=[];

function rememberOrigin(node){
  if(!node || createFlowOrigins.some(x=>x.node===node))return;
  createFlowOrigins.push({node,parent:node.parentNode,next:node.nextSibling});
}
function moveToCreateSlot(node,slot){
  if(!node)return;
  rememberOrigin(node);
  slot.appendChild(node);
}
function restoreCreateFlowNodes(){
  [...createFlowOrigins].reverse().forEach(({node,parent,next})=>{
    if(!parent)return;
    if(next && next.parentNode===parent)parent.insertBefore(node,next);
    else parent.appendChild(node);
  });
  createFlowOrigins=[];
}
function setCreateStep(step){
  root.querySelectorAll('.createStep').forEach(section=>{
    section.classList.toggle('active',section.dataset.createStep===step);
  });
  if(step==='timing')createTimingVisited=true;
  updateCreateStepSummaries();
}
function updateCreateStepSummaries(){
  if(!creatingNewMove)return;
  const profile=workoutProfiles[selectedWorkoutKey];
  const visibleItems=strengthPool.filter(item=>!item.hidden);
  const movementCount=visibleItems.filter(item=>item.kind!=='rest').length;
  const restCount=visibleItems.filter(item=>item.kind==='rest').length;

  movementStepSummary.textContent=movementCount
    ? movementCount+' movement'+(movementCount===1?'':'s')+(restCount?' · '+restCount+' rest'+(restCount===1?'':'s'):'')
    : 'No movements yet';

  const canTime=movementCount>0;
  const timingHeader=root.querySelector('[data-open-step="timing"]');
  const finishHeader=root.querySelector('[data-open-step="finish"]');
  timingHeader.disabled=!canTime;
  continueToTiming.disabled=!canTime;

  timingStepSummary.textContent=canTime
    ? formatTotalMinutes(totalInput.value)+' · '+formatDuration(workInput.value)+' movement · '+formatDuration(restInput.value)+' rest'
    : 'Add a movement first';

  finishHeader.disabled=!(canTime && createTimingVisited);
  const name=(workoutNameInput?.value||'').trim();
  const extras=[];
  if($('includeWarmupPreset')?.checked)extras.push('warm-up');
  if($('includeCooldownPreset')?.checked)extras.push('cooldown');
  finishStepSummary.textContent=name
    ? name+(extras.length?' · '+extras.join(' + '):'')
    : (extras.length?extras.join(' + '):'Name and optional extras');
}
function enterCreateFlow(){
  createFlow.hidden=false;
  createTimingVisited=false;

  const editNameRow=root.querySelector('.editNameRow');
  const createMoveOptions=$('createMoveOptions');
  const timeTiles=root.querySelector('.timeTiles');
  const routineSummary=$('routineSummaryModal');
  const tempoRevealRow=root.querySelector('.tempoRevealRow');
  const tempoExperiment=$('tempoExperiment');
  const warmSection=$('warmupList')?.closest('section');
  const movementLaunch=$('movementCreatorLaunch');
  const movementCreator=$('movementCreator');
  const strengthSection=$('strengthList')?.closest('section');
  const coolSection=$('cooldownList')?.closest('section');

  const extras=createMoveOptions?.querySelector('.createExtras');
  [extras,warmSection,movementLaunch,movementCreator,strengthSection,coolSection].forEach(node=>node&&moveToCreateSlot(node,createMovementsSlot));
  [createMoveOptions,timeTiles,routineSummary,tempoRevealRow,tempoExperiment].forEach(node=>moveToCreateSlot(node,createTimingSlot));
  moveToCreateSlot(editNameRow,createFinishSlot);

  setCreateStep('movements');
  updateCreateStepSummaries();
}
function leaveCreateFlow(){
  restoreCreateFlowNodes();
  createFlow.hidden=true;
  root.querySelectorAll('.createStep').forEach(section=>section.classList.remove('active'));
}
root.querySelectorAll('[data-open-step]').forEach(btn=>btn.addEventListener('click',()=>{
  if(btn.disabled)return;
  setCreateStep(btn.dataset.openStep);
}));
continueToTiming.addEventListener('click',()=>{
  if(!continueToTiming.disabled)setCreateStep('timing');
});
continueToFinish.addEventListener('click',()=>setCreateStep('finish'));
finishMoveButton.addEventListener('click',()=>$('saveWorkoutEdit').click());

const views={home:$('homeView'),workout:$('workoutView'),settings:$('settingsView')};
const homeNav=$('homeNav'),settingsNav=$('settingsNav');
function showView(name){Object.entries(views).forEach(([k,v])=>v.classList.toggle('active',k===name));homeNav.classList.toggle('active',name==='home');settingsNav.classList.toggle('active',name==='settings');if(name==='home')setTimeout(checkCheckinDue,400);if(name==='settings'){requestAnimationFrame(()=>positionRubberIndicator(root.querySelector('.tab.active'),false));renderMetaTable()}}

const totalInput=$('totalTime'),workInput=$('workTime'),restInput=$('restTime');
const totalOut=$('totalOut'),workOut=$('workOut'),restOut=$('restOut');
const totalFill=$('totalFill'),workFill=$('workFill'),restFill=$('restFill');
const roundsInput=$('roundsInput'),roundsFill=$('roundsFill'),roundsOut=$('roundsOut'),totalLabel=$('totalLabel');
const routineSummaryModal=$('routineSummaryModal');

const defaultWarmup=[
{id:'standing-reach',name:'Standing reach',group:'Warm-up',kind:'warmup',hidden:false},
{id:'arm-circles',name:'Arm circles',group:'Warm-up',kind:'warmup',hidden:false},
{id:'hip-hinge',name:'Hip hinge drill',group:'Warm-up',kind:'warmup',hidden:false}
];
let warmup=defaultWarmup.map(x=>({...x}));
let strengthPool=[
{id:'goblet-squat',name:'Kettlebell goblet squat',group:'Glutes + legs',kind:'work',hidden:false},
{id:'floor-press',name:'Kettlebell floor press',group:'Chest + triceps',kind:'work',hidden:false},
{id:'one-arm-row',name:'One-arm kettlebell row',group:'Back + arms',kind:'work',hidden:false},
{id:'deadlift',name:'Kettlebell deadlift',group:'Glutes + hamstrings',kind:'work',hidden:false},
{id:'halo',name:'Kettlebell halo',group:'Shoulders + core',kind:'work',hidden:false},
{id:'swing',name:'Kettlebell swing',group:'Glutes + core',kind:'work',hidden:false},
{id:'kneeling-press',name:'Half-kneeling press',group:'Shoulders + core',kind:'work',hidden:false},
{id:'suitcase-march',name:'Suitcase march',group:'Core + grip',kind:'work',hidden:false},
{id:'glute-bridge',name:'Glute bridge with kettlebell',group:'Glutes',kind:'work',hidden:false},
{id:'pullover',name:'Kettlebell pullover',group:'Chest + core',kind:'work',hidden:false}
];
const defaultCooldown=[
{id:'hip-flexor',name:'Hip flexor stretch',group:'Cooldown',kind:'cooldown',hidden:false},
{id:'chest-opener',name:'Chest opener',group:'Cooldown',kind:'cooldown',hidden:false},
{id:'hamstring',name:'Hamstring stretch',group:'Cooldown',kind:'cooldown',hidden:false},
{id:'slow-breathing',name:'Slow breathing',group:'Cooldown',kind:'cooldown',hidden:false}
];
let cooldown=defaultCooldown.map(x=>({...x}));
const defaultProfiles={
 kettlebell:{
   name:'Kettlebell full body',
   source:'Example imported routine',
   total:20,work:45,rest:15,
   strength:[
    ['goblet-squat','Kettlebell goblet squat','Glutes + legs'],
    ['floor-press','Kettlebell floor press','Chest + triceps'],
    ['one-arm-row','One-arm kettlebell row','Back + arms'],
    ['deadlift','Kettlebell deadlift','Glutes + hamstrings'],
    ['halo','Kettlebell halo','Shoulders + core'],
    ['swing','Kettlebell swing','Glutes + core'],
    ['kneeling-press','Half-kneeling press','Shoulders + core'],
    ['suitcase-march','Suitcase march','Core + grip'],
    ['glute-bridge','Glute bridge with kettlebell','Glutes'],
    ['pullover','Kettlebell pullover','Chest + core']
   ]
 },
 mobility:{
   name:'Mobility reset',
   source:'Imported mobility routine',
   total:15,work:40,rest:10,
   strength:[
    ['world-greatest','World’s greatest stretch','Mobility'],
    ['thoracic','Thoracic rotation','Spine + shoulders'],
    ['cossack','Cossack squat','Hips + legs'],
    ['shoulder-flow','Shoulder flow','Shoulders'],
    ['deep-squat','Deep squat hold','Hips + ankles']
   ]
 },
 core:{
   name:'Core + carry',
   source:'Imported strength routine',
   total:20,work:45,rest:15,
   strength:[
    ['suitcase-march','Suitcase march','Core + grip'],
    ['deadbug','Dead bug','Core'],
    ['halo','Kettlebell halo','Shoulders + core'],
    ['plank-pull','Plank kettlebell pull-through','Core + shoulders'],
    ['farmer','Farmer carry','Grip + core'],
    ['glute-bridge','Glute bridge with kettlebell','Glutes + core']
   ]
 }
};
/* stored state (Home Assistant user data) */
const store=normaliseStore(bridge.data);
const workoutProfiles=store.profiles;
let selectedWorkoutKey=workoutProfiles[store.selected]?store.selected:(store.order.find(k=>workoutProfiles[k])||'kettlebell');

function normaliseStore(data){
  const d=data&&typeof data==='object'?JSON.parse(JSON.stringify(data)):{};
  const profiles=d.profiles&&Object.keys(d.profiles).length?d.profiles:JSON.parse(JSON.stringify(defaultProfiles));
  const order=(Array.isArray(d.order)?d.order:Object.keys(profiles)).filter(k=>profiles[k]);
  Object.keys(profiles).forEach(k=>{if(!order.includes(k))order.push(k)});
  return {
    v:1,
    profiles,
    order,
    selected:d.selected||order[0],
    history:Array.isArray(d.history)?d.history:[],
    checkins:(Array.isArray(d.checkins)?d.checkins:migrateEnergy(d.energy)).map(toPercentScale),
    settings:{...(d.settings||{})}
  };
}
function migrateEnergy(list){
  // v0.1 logged a single "How do you feel?" value; keep it as that slot's energy.
  if(!Array.isArray(list))return [];
  const labels=['Drained','Low','Okay','Good','Energised','Great'];
  const out=[];
  list.forEach(e=>{
    const d=new Date(e.at);if(isNaN(d))return;
    const date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const slot=d.getHours()<14?'morning':'evening';
    if(out.some(c=>c.date===date&&c.slot===slot))return;
    const level=labels.indexOf(e.value)+1;
    if(level>0)out.push({date,slot,mood:null,energy:level,at:e.at});
  });
  return out;
}
function toPercentScale(c){
  if(c.scale===100)return c;
  const conv=v=>v==null?null:Math.round((Number(v)-1)/5*100);
  return {...c,mood:conv(c.mood),energy:conv(c.energy),scale:100};
}
function persist(){
  if(creatingNewMove)return;
  store.selected=selectedWorkoutKey;
  store.order=store.order.filter(k=>workoutProfiles[k]&&!(k===pendingNewMoveKey));
  bridge.save(store);
}
function settings(){return store.settings}

function setWorkoutProfile(key){
 const profile=workoutProfiles[key];
 if(!profile)return;
 selectedWorkoutKey=key;
 const nameInput=$('workoutNameInput');if(nameInput)nameInput.value=profile.name;
 totalInput.value=profile.total;workInput.value=profile.work;restInput.value=profile.rest;
 roundsInput.value=profile.rounds||1;

 if(profile.customSequence){
   // The premade warm-up and cooldown live in their own sections. Older saves mixed them into
   // the sequence (marked with presetRole), so split those out.
   const seq=(profile.sequence||[]).map(item=>({...item}));
   const fromSeq=role=>seq.filter(x=>x.presetRole===role).map(({presetRole,...x})=>x);
   warmup=(profile.warmup||fromSeq('warmup')).map(x=>({...x}));
   cooldown=(profile.cooldown||fromSeq('cooldown')).map(x=>({...x}));
   strengthPool=seq.filter(x=>!x.presetRole);
   applyCreatePreset(profile.preset||'movement',false);
 }else{
   totalInput.min=3; totalInput.max=40; totalInput.step=1;
   workInput.min=20; workInput.max=60; workInput.step=5;
   restInput.min=5; restInput.max=30; restInput.step=5;
   warmup=(profile.warmup||defaultWarmup).map(x=>({...x}));
   cooldown=(profile.cooldown||defaultCooldown).map(x=>({...x}));
   strengthPool=profile.strength.map(entry=>Array.isArray(entry)
     ? (([id,name,group,hidden=false])=>({id,name,group,kind:'work',hidden:Boolean(hidden)}))(entry)
     : {...entry});
 }
 root.querySelectorAll('.workoutPanel[data-workout]').forEach(panel=>panel.classList.toggle('active',panel.dataset.workout===key));
 buildRoutine();
}


function getBorderGlowMetrics(card,x,y){
  const rect=card.getBoundingClientRect();
  const cx=rect.width/2,cy=rect.height/2;
  const dx=x-cx,dy=y-cy;
  let kx=Infinity,ky=Infinity;
  if(dx!==0)kx=cx/Math.abs(dx);
  if(dy!==0)ky=cy/Math.abs(dy);
  const edge=Math.min(Math.max(1/Math.min(kx,ky),0),1);
  let angle=Math.atan2(dy,dx)*(180/Math.PI)+90;
  if(angle<0)angle+=360;
  return {edge,angle};
}
function updateBorderGlow(card,e,force=false){
  const rect=card.getBoundingClientRect();
  const x=e.clientX-rect.left;
  const y=e.clientY-rect.top;
  const {edge,angle}=getBorderGlowMetrics(card,x,y);
  const proximity=force?100:edge*100;
  card.style.setProperty('--edge-proximity',proximity.toFixed(3));
  card.style.setProperty('--cursor-angle',angle.toFixed(3)+'deg');
  card.classList.toggle('borderGlowActive',force||proximity>=30);
}
function attachBorderGlow(card){
  card.addEventListener('pointermove',e=>updateBorderGlow(card,e,false));
  card.addEventListener('pointerenter',e=>updateBorderGlow(card,e,false));
  card.addEventListener('pointerdown',e=>updateBorderGlow(card,e,true));
  const clear=()=>{
    card.classList.remove('borderGlowActive');
    card.style.setProperty('--edge-proximity','0');
  };
  card.addEventListener('pointerleave',clear);
  card.addEventListener('pointerup',clear);
  card.addEventListener('pointercancel',clear);
}
attachBorderGlow($('addWorkoutPanel'));

let creatingNewMove=false;
let pendingNewMoveKey=null;

function esc(value){
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function panelSummary(profile){
  if(profile.summary)return profile.summary;
  return profile.customSequence
    ? formatTotalMinutes(profile.total)+' · custom move'
    : formatTotalMinutes(profile.total)+' · '+formatDuration(profile.work)+' / '+formatDuration(profile.rest)+' · warm-up + cooldown';
}
function createMovePanel(key,profile){
  const panel=document.createElement('article');
  panel.className='workoutPanel';
  panel.dataset.workout=key;
  panel.tabIndex=0;
  const count=profile.activityCount??(profile.sequence?.length||0);
  panel.innerHTML=
    '<span class="edgeLight" aria-hidden="true"></span>'+
    '<div class="panelExpanded"><div><div class="workoutPanelTop"><div>'+
      '<div class="workoutName">'+esc(profile.name)+'</div>'+
      '<div class="sub">'+esc(panelSummary(profile))+'</div>'+
      '<span class="sourceTag">'+esc(profile.source||'Custom move')+'</span>'+
    '</div><button class="pill seeWorkoutBtn" type="button">Edit</button></div></div>'+
    '<div class="workoutFooter"><div><strong class="activityCount">'+(count?count+' activities'+((profile.rounds||1)>1?' × '+profile.rounds:''):'—')+'</strong></div>'+
    '<div class="workoutPanelActions"><button class="primary startWorkoutBtn" type="button">Start move</button></div></div></div>'+
    '<div class="panelCollapsed"><div class="panelCollapsedText">'+esc(profile.name)+'</div></div>';

  const addPanel=$('addWorkoutPanel');
  $('workoutGallery').insertBefore(panel,addPanel);
  attachBorderGlow(panel);
  panel.addEventListener('click',e=>{if(!e.target.closest('button'))setWorkoutProfile(key)});
  panel.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){
      e.preventDefault();setWorkoutProfile(key);
    }
  });
  panel.querySelector('.seeWorkoutBtn').addEventListener('click',e=>{e.stopPropagation();setWorkoutProfile(key);openWorkoutEditor(false)});
  panel.querySelector('.startWorkoutBtn').addEventListener('click',e=>{e.stopPropagation();setWorkoutProfile(key);showWorkout()});
  return panel;
}
function renderGallery(){
  root.querySelectorAll('.workoutPanel[data-workout]').forEach(panel=>panel.remove());
  store.order.forEach(key=>{if(workoutProfiles[key])createMovePanel(key,workoutProfiles[key])});
  root.querySelectorAll('.workoutPanel[data-workout]').forEach(panel=>panel.classList.toggle('active',panel.dataset.workout===selectedWorkoutKey));
}
renderGallery();

$('addWorkoutPanel').addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();$('addWorkoutPanel').click()}
});
$('addWorkoutPanel').addEventListener('click',()=>{
  creatingNewMove=true;
  pendingNewMoveKey='custom-'+Date.now();
  workoutProfiles[pendingNewMoveKey]={
    name:'New move',
    source:'Custom move',
    total:20,
    work:45,
    rest:15,
    customSequence:true,
    preset:'movement',
    includeWarmup:false,
    includeCooldown:false,
    sequence:[],
    strength:[]
  };
  setWorkoutProfile(pendingNewMoveKey);
  openWorkoutEditor(true);
});
let routine=[],index=0,seconds=0,totalPhase=1,paused=false,timer=null,countTimer=null,energyLogs=[],isResting=false;
let upcomingVisibleCount=store.settings.upcomingCount??'all';
let createMovePreset='movement';

function pct(v,min,max){return ((Number(v)-min)/(max-min))*100}
function formatDuration(seconds){
  const s=Math.max(0,Number(seconds)||0);
  if(s>=3600 && s%3600===0)return (s/3600)+' hr';
  if(s>=60 && s%60===0)return (s/60)+' min';
  if(s>=60)return Math.round(s/60)+' min';
  return Math.round(s)+' sec';
}
function formatTotalMinutes(minutes){
  const m=Math.max(0,Number(minutes)||0);
  if(m>=60 && m%60===0)return (m/60)+' hr';
  if(m>=60)return Math.floor(m/60)+' hr '+(m%60)+' min';
  return m+' min';
}
function updateRangeFills(){
  totalFill.style.width=pct(totalInput.value,Number(totalInput.min),Number(totalInput.max))+'%';
  workFill.style.width=pct(workInput.value,Number(workInput.min),Number(workInput.max))+'%';
  restFill.style.width=pct(restInput.value,Number(restInput.min),Number(restInput.max))+'%';
  workOut.textContent=formatDuration(workInput.value);
  restOut.textContent=formatDuration(restInput.value);
  const rounds=Number(roundsInput.value)||1;
  roundsFill.style.width=pct(rounds,1,10)+'%';
  totalLabel.textContent=rounds>1?'Time per round':'Total time';
}
function visible(arr){return arr.filter(x=>!x.hidden)}
// 754 -> "12:34", 3725 -> "1:02:05"
function clock(seconds){
  const s=Math.max(0,Math.round(Number(seconds)||0)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;
  return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(r).padStart(2,'0');
}
// Reads a YouTube link (watch, youtu.be, shorts, live, embed) and any start (t=1m30s) / end time.
function parseYouTube(text){
  let u;try{u=new URL(String(text||'').trim())}catch(_){return null}
  const host=u.hostname.replace(/^(www|m|music)\./,'');
  let id=null;
  if(host==='youtu.be')id=u.pathname.slice(1).split('/')[0];
  else if(/^youtube(-nocookie)?\.com$/.test(host)){
    if(u.pathname==='/watch')id=u.searchParams.get('v');
    else{const m=u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);if(m)id=m[2]}
  }
  if(!id||!/^[\w-]{11}$/.test(id))return null;
  const time=v=>{
    if(!v)return 0;
    if(/^\d+$/.test(v))return Number(v);
    const m=v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return m?(Number(m[1])||0)*3600+(Number(m[2])||0)*60+(Number(m[3])||0):0;
  };
  const start=time(u.searchParams.get('t')||u.searchParams.get('start'));
  const end=time(u.searchParams.get('end'));
  return {id,start,end:end>start?end:null};
}
// How long a video step runs: the clip (link start to its end, or to the end of the video),
// or the length you set yourself.
function videoStepSeconds(x,fallback){
  if(x.useVideoLength===false)return Math.max(5,Number(x.duration)||fallback||300);
  const start=Number(x.start)||0,end=Number(x.end)||Number(x.videoDuration)||0;
  return end>start?Math.round(end-start):(Number(x.duration)||300);
}
function secondsFromCreator(value,unit){
  const n=Math.max(0,Number(value)||0);
  if(unit==='hour')return Math.round(n*3600);
  if(unit==='min')return Math.round(n*60);
  return Math.round(n);
}
function applyCreatePreset(preset,resetValues=true){
  createMovePreset=preset;
  root.querySelectorAll('.createPresetBtn').forEach(btn=>btn.classList.toggle('active',btn.dataset.movePreset===preset));
  const profile=workoutProfiles[selectedWorkoutKey];
  if(profile)profile.preset=preset;

  if(preset==='work'){
    totalInput.min=30; totalInput.max=480; totalInput.step=30;
    workInput.min=300; workInput.max=7200; workInput.step=300;
    restInput.min=60; restInput.max=1800; restInput.step=60;
    if(resetValues){
      totalInput.value=60;
      workInput.value=1500;
      restInput.value=300;
    }
    $('addMovementUnit').value='min';
    $('addMovementDuration').value=25;
    $('addRestUnit').value='min';
    $('addRestDuration').value=5;
  }else{
    totalInput.min=3; totalInput.max=40; totalInput.step=1;
    workInput.min=20; workInput.max=60; workInput.step=5;
    restInput.min=5; restInput.max=30; restInput.step=5;
    if(resetValues){
      totalInput.value=20;
      workInput.value=45;
      restInput.value=15;
    }
    $('addMovementUnit').value='sec';
    $('addMovementDuration').value=45;
    $('addRestUnit').value='sec';
    $('addRestDuration').value=30;
  }
  updateRangeFills();
}
function premadeItems(list,tag){
  // focus-work moves run in long blocks, so their stretches get a minute each instead
  const own=createMovePreset==='work';
  return list.map((x,i)=>({...x,id:tag+'-'+i+'-'+Date.now().toString(36),useGlobalTiming:!own,duration:own?60:Number(workInput.value)}));
}
function syncPremadeSequence(){
  const profile=workoutProfiles[selectedWorkoutKey];
  if(!profile?.customSequence)return;
  profile.includeWarmup=$('includeWarmupPreset').checked;
  profile.includeCooldown=$('includeCooldownPreset').checked;
  if(profile.includeWarmup&&!warmup.length)warmup=premadeItems(defaultWarmup,'warm');
  if(profile.includeCooldown&&!cooldown.length)cooldown=premadeItems(defaultCooldown,'cool');
  buildRoutine();
}
function updateUpcomingCountOptions(){
  const select=$('upcomingCountSetting');
  if(!select)return;
  const max=Math.max(1,routine.length-1);
  const previous=upcomingVisibleCount;
  select.innerHTML='';
  for(let i=1;i<=max;i++){
    const option=document.createElement('option');
    option.value=String(i);
    option.textContent=String(i);
    select.appendChild(option);
  }
  const allOption=document.createElement('option');
  allOption.value='all';
  allOption.textContent='All';
  select.appendChild(allOption);
  const desired=previous==='all'?'all':String(Math.min(Number(previous)||1,max));
  select.value=desired;
  upcomingVisibleCount=desired==='all'?'all':Number(desired);
}
function buildRoutine(){
 const target=Number(totalInput.value)*60;
 const work=Number(workInput.value);
 const rest=Number(restInput.value);
 const profile=workoutProfiles[selectedWorkoutKey];
 const custom=Boolean(profile?.customSequence);
 const vWarm=(custom?!profile.includeWarmup:profile?.warmupOff)?[]:visible(warmup);
 const vStrength=visible(strengthPool);
 const vCool=custom&&!profile.includeCooldown?[]:visible(cooldown);
 if(profile){
   profile.total=Number(totalInput.value);
   profile.work=work;
   profile.rest=rest;
   profile.rounds=Number(roundsInput.value)||1;
   if(profile.customSequence){
     profile.sequence=strengthPool.map(x=>({...x}));
     profile.warmup=warmup.map(x=>({...x}));
     profile.cooldown=cooldown.map(x=>({...x}));
   }else{
     profile.strength=strengthPool.map(x=>({...x}));
     profile.warmup=warmup.map(x=>({...x}));
     profile.cooldown=cooldown.map(x=>({...x}));
   }
 }

 if(profile?.customSequence){
   const baseSequence=[...vWarm.map(x=>({...x,section:'warmup'})),...vStrength,...vCool.map(x=>({...x,section:'cooldown'}))].map(item=>{
     if(item.kind==='video')return {...item,duration:videoStepSeconds(item,work),rest:0};
     if(item.kind==='rest'){
       const duration=item.useGlobalTiming===true
         ? rest
         : (Number(item.duration)||rest);
       return {...item,duration,rest:0};
     }
     const duration=item.useGlobalTiming===false
       ? (Number(item.duration)||work)
       : work;
     return {...item,duration,rest:0};
   });
   if(profile.autoRest && Number(profile.autoRestDuration)>0){
     routine=[];
     baseSequence.forEach((item,i)=>{
       routine.push(item);
       const next=baseSequence[i+1];
       if(item.kind!=='rest' && next && next.kind!=='rest'){
         routine.push({
           id:'auto-rest-'+i,
           name:'Rest',
           group:'Rest',
           kind:'rest',
           hidden:false,
           duration:Number(profile.autoRestDuration),
           rest:0,
           autoGenerated:true
         });
       }
     });
   }else{
     routine=baseSequence;
   }
 }else{
   // Play exactly the listed exercises, once each, in order.
   routine=[...vWarm.map(x=>({...x,section:'warmup'})),...vStrength,...vCool.map(x=>({...x,section:'cooldown'}))].map(x=>{
     if(x.kind==='video')return {...x,duration:videoStepSeconds(x,work),rest:0};
     if(x.kind==='rest')return {...x,duration:x.useGlobalTiming===true?rest:(Number(x.duration)||rest),rest:0};
     return {...x,duration:x.useGlobalTiming===false?(Number(x.duration)||work):work,rest};
   });
   // no extra rest straight after (or before) a rest step
   routine.forEach((x,i)=>{if(routine[i+1]?.kind==='rest')x.rest=0});
   if(routine.length)routine[routine.length-1].rest=0;
 }
 // Repeat the whole sequence for each round, with a normal rest between rounds.
 const rounds=Math.max(1,Math.min(10,Number(roundsInput.value)||1));
 const oneRound=routine;
 // Only the main section repeats: the warm-up plays once at the start of round 1, the cooldown
 // once at the end of the last round, and a video can be set to play in just the first or last.
 const onceIn=x=>{
   if(rounds<=1)return null;
   if(x.section==='warmup'||x.presetRole==='warmup')return 'first';
   if(x.section==='cooldown'||x.presetRole==='cooldown')return 'last';
   if(x.kind==='video'&&(x.videoRounds==='first'||x.videoRounds==='last'))return x.videoRounds;
   return null;
 };
 const oneOff=x=>Boolean(onceIn(x));
 const everyRound=oneRound.filter(x=>!oneOff(x)),onceItems=oneRound.filter(oneOff);
 const perRound=everyRound.length;
 const roundSeconds=everyRound.reduce((sum,x)=>sum+x.duration+x.rest,0);
 const onceSeconds=onceItems.reduce((sum,x)=>sum+x.duration+x.rest,0);
 const onceParts=[
   onceItems.some(x=>x.section==='warmup'||x.presetRole==='warmup')&&'warm-up',
   onceItems.some(x=>x.section==='cooldown'||x.presetRole==='cooldown')&&'cooldown',
   onceItems.some(x=>x.kind==='video'&&!x.section&&!x.presetRole)&&'video'
 ].filter(Boolean);
 const onceText=onceParts.length>1?onceParts.slice(0,-1).join(', ')+' & '+onceParts[onceParts.length-1]:onceParts[0]||'';
 routine=[];
 // a video step can be set to play only in the first or the last round
 const playsIn=(x,r)=>{const once=onceIn(x);return !once||(once==='first'?r===1:r===rounds)};
 for(let r=1;r<=rounds;r++){
   oneRound.filter(x=>playsIn(x,r)).forEach((item,i)=>routine.push({...item,id:item.id+(rounds>1?'-r'+r:''),round:r,roundIndex:i}));
   if(r<rounds&&perRound){
     if(profile?.customSequence){
       routine.push({id:'round-break-'+r,name:'Rest',group:'Round '+(r+1)+' next',kind:'rest',hidden:false,duration:rest,rest:0,round:r,roundIndex:perRound,roundBreak:true});
     }else{
       const last=routine[routine.length-1];
       last.rest=rest;last.roundBreakAfter=true;
     }
   }
 }
 updateRangeFills();

 const actualSeconds=routine.reduce((sum,x)=>sum+x.duration+x.rest,0);
 const roundMinutes=Math.round(roundSeconds/60);
 const totalMinutes=Math.round(actualSeconds/60);
 const length=rounds>1
   ? formatTotalMinutes(roundMinutes)+' × '+rounds+' rounds'+(onceSeconds?' + '+formatDuration(onceSeconds)+' '+onceText:'')+' ('+formatTotalMinutes(totalMinutes)+')'
   : formatTotalMinutes(totalMinutes);
 const extras=[vWarm.length?'warm-up':'',vCool.length?'cooldown':''].filter(Boolean);
 const text=profile?.customSequence
   ? length+' · '+perRound+' items'+(extras.length&&!(rounds>1&&onceSeconds)?' · '+extras.join(' + '):'')
   : length+' · '+formatDuration(work)+' / '+formatDuration(rest)+(extras.length&&!(rounds>1&&onceSeconds)?' · '+extras.join(' + '):'');
 totalOut.textContent=formatDuration(roundSeconds);
 const steps=routine.filter(x=>!x.roundBreak).length;
 const countText=rounds>1?steps+' activities · '+rounds+' rounds':perRound+' activities';
 roundsOut.textContent=rounds>1?rounds+' rounds · '+formatTotalMinutes(totalMinutes)+' total':'1 round';
 $('roundsCount').textContent=rounds;
 root.querySelectorAll('[data-rounds-step]').forEach(b=>{b.disabled=Number(b.dataset.roundsStep)<0?rounds<=1:rounds>=10});
 if(profile){profile.summary=text;profile.activityCount=perRound}
 const activeSummary=root.querySelector('.workoutPanel.active .sub');
 if(activeSummary)activeSummary.textContent=text;
 routineSummaryModal.textContent=text;
 updateSetupSummary();
 root.querySelectorAll('.workoutPanel.active .activityCount').forEach(el=>el.textContent=countText);
 updateRangeFills();
 renderLists();
 updateMovementCreatorAvailability();
 updateGlobalTimingUI();
 updateUpcomingCountOptions();
 if(creatingNewMove)updateCreateStepSummaries();

 // If the move screen is open but not actively counting, keep its preview consistent.
 if(views.workout.classList.contains('active') && !timer){
   makeProgress();
 }
}
const GRIP='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><g fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></g></svg>';
const TRASH='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6z"/></svg>';
// Icons: path data from the Figma Icon/* components (24 grid, 2px stroke), drawn at the slot's glyph size.
const ICONS={
  activity:'<path d="M22 12H18L15 21L9 3L6 12H2"/>',
  steps:'<path d="M12 19V5"/><path d="M5 12L12 5L19 12"/>',
  mood:'<path d="M12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22Z"/><path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14"/><path d="M9 9H9.01"/><path d="M15 9H15.01"/>',
  energy:'<path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/>',
  clock:'<path d="M12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22Z"/><path d="M12 6V12L16 14"/>',
  streak:'<path d="M22 7L13.5 15.5L8.5 10.5L2 17"/><path d="M16 7H22V13"/>',
  calendar:'<path d="M19 4H5C3.9 4 3 4.9 3 6V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4Z"/><path d="M16 2V6"/><path d="M8 2V6"/><path d="M3 10H21"/>',
  home:'<path d="M3 10.5L12 3L21 10.5V21H3V10.5Z"/>',
  settings:'<path d="M21 4H14"/><path d="M10 4H3"/><path d="M21 12H12"/><path d="M8 12H3"/><path d="M21 20H16"/><path d="M12 20H3"/><path d="M14 2V6"/><path d="M8 10V14"/><path d="M16 18V22"/>',
  fullscreen:'<path d="M8 3H5C3.9 3 3 3.9 3 5V8"/><path d="M21 8V5C21 3.9 20.1 3 19 3H16"/><path d="M3 16V19C3 20.1 3.9 21 5 21H8"/><path d="M16 21H19C20.1 21 21 20.1 21 19V16"/>',
  move:'<path d="M7 17L17 7"/><path d="M7 7H17V17"/>',
  check:'<path d="M20 6L9 17L4 12"/>',
  back:'<path d="M15 18L9 12L15 6"/>',
  close:'<path d="M18 6L6 18"/><path d="M6 6L18 18"/>',
  add:'<path d="M5 12H19"/><path d="M12 5V19"/>',
  play:'<path d="M8 5.5V18.5L18.5 12L8 5.5Z"/>',
  pause:'<path d="M9 6V18"/><path d="M15 6V18"/>'
};
const icon=name=>'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[name]||'')+'</svg>';
root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon)});
// ---- edit a movement in place ----
let editingItem=null;
let pendingNew=null; // {item,arr}: dropped into the list but not saved yet
function splitDuration(sec){
  sec=Math.max(1,Number(sec)||0);
  if(sec>=3600&&sec%3600===0)return {value:sec/3600,unit:'hour'};
  if(sec>=60&&sec%60===0)return {value:sec/60,unit:'min'};
  return {value:sec,unit:'sec'};
}
function focusEditForm(select=false){const f=root.querySelector('.moveEditForm input[data-f=url],.moveEditForm input[data-f=name]');if(!f)return;f.focus({preventScroll:true});if(select)f.select()}
// opts.sheet: the form sits in the phone bottom sheet (with Hide / Remove, and callbacks
// instead of the inline list behaviour). opts.isNew: a step that isn't in the list yet.
function renderEditForm(item,i,opts={}){
  const isRest=item.kind==='rest',isVideo=item.kind==='video';
  const global=isVideo?item.useVideoLength!==false:isRest?item.useGlobalTiming===true:item.useGlobalTiming!==false;
  const globalSec=Number(isRest?restInput.value:workInput.value);
  const own=splitDuration(isVideo?(item.useVideoLength===false?item.duration:videoStepSeconds({...item,useVideoLength:true})):global?globalSec:(item.duration||globalSec));
  const known=isVideo&&(Number(item.videoDuration)>0||Number(item.end)>0);
  const fields=isVideo
    ? '<label class="moveEditWide"><span>YouTube link</span><input class="addInput" data-f="url" type="url" inputmode="url" autocomplete="off" value="'+esc(item.url||'')+'" placeholder="Paste a YouTube link"></label>'+
      '<label><span>Name</span><input class="addInput" data-f="name" type="text" value="'+esc(item.autoName?'':item.name)+'" placeholder="Uses the video’s title"></label>'+
      '<label><span>Plays in</span><select class="creatorUnitSelect" data-f="rounds">'+
        [['every','Every round'],['first','The first round only'],['last','The last round only']].map(([v,l])=>'<option value="'+v+'"'+((item.videoRounds||'every')===v?' selected':'')+'>'+l+'</option>').join('')+
      '</select></label>'+
      '<p class="fieldError" data-f="urlError" hidden>That isn’t a YouTube link. Copy it from the Share button on YouTube.</p>'
    : '<label><span>Name</span><input class="addInput" data-f="name" type="text" value="'+esc(item.name)+'" placeholder="'+(isRest?'Rest':'Name this movement')+'"></label>'+
      '<label><span>Type / group</span><input class="addInput" data-f="group" type="text" value="'+esc(item.group)+'" placeholder="'+(isRest?'Rest':'e.g. Glutes + legs')+'"></label>';
  const toggleText=isVideo
    ? 'Play the whole '+(Number(item.start)>0||Number(item.end)>0?'clip':'video')+(known?' · '+clock(videoStepSeconds({...item,useVideoLength:true})):'')
    : 'Use global timing · '+formatDuration(globalSec);
  const row=document.createElement('div');
  row.className='moveRow editing'+(opts.sheet?' inSheet':'');
  row.dataset.index=i;
  row.dataset.id=item.id;
  const isNew=opts.isNew??(pendingNew?.item===item);
  const actions=opts.sheet
    ? '<div class="moveEditActions sheetActions">'+
        (isNew?'':'<div class="sheetSecondary"><button class="hideBtn" type="button" data-a="hide">'+(item.hidden?'Show':'Hide')+'</button>'+
          '<button class="removeBtn" type="button" data-a="remove" aria-label="Hold to remove '+esc(item.name)+'"><span class="removeFill"></span><span class="removeLabel">Remove</span></button></div>')+
        '<div class="sheetPrimary"><button class="pill" type="button" data-a="cancel">Cancel</button><button class="primary" type="button" data-a="save">'+(isNew?'Add':'Save')+'</button></div>'+
      '</div>'
    : '<div class="moveEditActions"><button class="pill" type="button" data-a="cancel">Cancel</button><button class="primary" type="button" data-a="save">Save</button></div>';
  row.innerHTML=
    '<div class="moveEditForm">'+
      '<div class="moveEditFields'+(isVideo?' videoFields':'')+'">'+fields+'</div>'+
      '<div class="moveEditTiming">'+
        '<label class="globalTimingToggle"><input type="checkbox" data-f="global"'+(global?' checked':'')+'>'+
          '<span class="toggleTrack" aria-hidden="true"><span class="toggleThumb"></span></span>'+
          '<span class="toggleLabel">'+esc(toggleText)+'</span></label>'+
        '<div class="creatorDurationRow">'+
          '<input class="addInput creatorNumber" data-f="dur" type="number" min="1" max="3600" step="1" value="'+own.value+'" aria-label="Duration">'+
          '<select class="creatorUnitSelect" data-f="unit" aria-label="Duration unit">'+
            ['sec','min','hour'].map(u=>'<option value="'+u+'"'+(u===own.unit?' selected':'')+'>'+({sec:'seconds',min:'minutes',hour:'hours'})[u]+'</option>').join('')+
          '</select>'+
        '</div>'+
      '</div>'+
      actions+
    '</div>';
  const f=k=>row.querySelector('[data-f='+k+']');
  const syncGlobal=()=>{const on=f('global').checked;f('dur').disabled=on;f('unit').disabled=on;row.querySelector('.creatorDurationRow').classList.toggle('isDisabled',on)};
  f('global').addEventListener('change',syncGlobal);syncGlobal();
  // Cancelling a row that was just dropped in removes it again.
  const close=()=>{if(opts.sheet){opts.onCancel?.();return}if(isNew)discardPendingNew();editingItem=null;buildRoutine()};
  const save=()=>{
    if(isVideo){saveVideo();return}
    const name=f('name').value.trim();
    if(!name){f('name').focus();return}
    item.name=name;
    item.group=f('group').value.trim()||(isRest?'Rest':'Movement');
    const on=f('global').checked;
    item.useGlobalTiming=on;
    if(!on)item.duration=Math.max(isRest?5:1,secondsFromCreator(f('dur').value,f('unit').value));
    if(opts.sheet){opts.onSaved?.();return}
    if(isNew)pendingNew=null;
    editingItem=null;buildRoutine();
    showToast(isNew?(isRest?'Rest added':'Movement added'):'Movement updated');
  };
  const saveVideo=()=>{
    const link=f('url').value.trim(),parsed=parseYouTube(link);
    if(!parsed){f('urlError').hidden=false;f('url').classList.add('invalid');f('url').focus();return}
    const changed=parsed.id!==item.videoId;
    item.url=link;item.videoId=parsed.id;item.start=parsed.start;item.end=parsed.end;
    if(changed){item.videoDuration=null;item.videoError=null}
    const typed=f('name').value.trim();
    item.autoName=!typed;
    item.name=typed||(changed?'':item.name)||item.videoTitle||'YouTube video';
    item.group='Video';
    item.videoRounds=f('rounds').value;
    item.useVideoLength=f('global').checked;
    if(!item.useVideoLength)item.duration=Math.max(5,secondsFromCreator(f('dur').value,f('unit').value));
    if(opts.sheet)opts.onSaved?.();
    else{
      if(isNew)pendingNew=null;
      editingItem=null;buildRoutine();
      showToast(isNew?'Video added':'Video updated');
    }
    if(changed||!item.videoDuration||(item.autoName&&!item.videoTitle))fetchVideoDetails(item);
  };
  if(isVideo)f('url').addEventListener('input',()=>{f('urlError').hidden=true;f('url').classList.remove('invalid')});
  row.querySelector('[data-a=cancel]').addEventListener('click',close);
  row.querySelector('[data-a=save]').addEventListener('click',save);
  if(opts.sheet&&!isNew){
    row.querySelector('[data-a=hide]').addEventListener('click',()=>opts.onHide?.());
    const rm=row.querySelector('[data-a=remove]');
    bindFuseHold(rm,rm.querySelector('.removeFill'),1200,()=>opts.onRemove?.());
  }
  row.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}
    if(e.key==='Enter'&&e.target.matches('input')){e.preventDefault();save()}
  });
  return row;
}
function renderList(arr,targetId){
 const target=$(targetId);target.innerHTML='';
 arr.forEach((item,i)=>{
   if(item===editingItem&&!phoneLayout()){target.appendChild(renderEditForm(item,i));return}
   const row=document.createElement('div');
   row.className='moveRow'+(item.hidden?' hidden':'')+(item.kind==='rest'?' restItem':'')+(item.kind==='video'?' videoItem':'')+(metaHidden(item)?' noMeta':'');
   row.dataset.index=i;
   row.dataset.id=item.id;
   const displayDuration=item.kind==='rest'
     ? (item.useGlobalTiming===true?'Global timing':formatDuration(item.duration))
     : (item.useGlobalTiming===false?formatDuration(item.duration):'Global timing');
   // only other kinds of media get a chip; a rest row speaks for itself
   const kindBadge=item.kind==='video'?'<span class="moveKindBadge">Video</span>':'';
   const metaText=item.kind==='video'
     ? (item.videoError?'YouTube · can’t play outside YouTube':'YouTube · '+(item.useVideoLength===false?'stops after '+formatDuration(item.duration):(Number(item.videoDuration)>0||Number(item.end)>0)?clock(videoStepSeconds(item)):'plays to the end')
        +(item.videoRounds==='first'?' · first round only':item.videoRounds==='last'?' · last round only':''))
     : item.group+' · '+displayDuration;
   const handleHtml='<button class="dragHandle" type="button" title="Drag to reorder" aria-label="Reorder '+esc(item.name)+'. Drag, or use the up and down arrow keys">'+GRIP+'</button>';
   const textHtml='<div class="moveText"><div class="moveItemName">'+esc(item.name)+kindBadge+'</div><div class="moveMeta">'+esc(metaText)+'</div></div>';
   const handleKeys=handle=>handle.addEventListener('keydown',e=>{
     if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
     e.preventDefault();
     const from=arr.indexOf(item),to=from+(e.key==='ArrowUp'?-1:1);
     if(to<0||to>=arr.length)return;
     arr.splice(from,1);arr.splice(to,0,item);
     buildRoutine();
     $(targetId).children[to]?.querySelector('.dragHandle')?.focus();
   });
   // Phones: a clean row; tapping it opens the step in the bottom sheet.
   if(phoneLayout()){
     row.classList.add('phoneRow');
     row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label','Edit '+(item.name||'step'));
     row.innerHTML=handleHtml+textHtml+'<span class="rowChevron" aria-hidden="true">›</span>';
     const handle=row.querySelector('.dragHandle');
     handle.addEventListener('pointerdown',e=>startRowDrag(e,row,target,arr));
     handleKeys(handle);
     row.addEventListener('click',e=>{if(!e.target.closest('.dragHandle'))openItemSheet(item,arr)});
     row.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target===row){e.preventDefault();openItemSheet(item,arr)}});
     target.appendChild(row);
     return;
   }
   row.innerHTML=handleHtml+textHtml+
     '<div class="moveActions seg"><button class="hideBtn editBtn segBtn" type="button" aria-label="Edit '+esc(item.name)+'">Edit</button><button class="hideBtn segBtn" type="button">'+(item.hidden?'Show':'Hide')+'</button>'+
     '<button class="removeBtn segBtn" type="button" title="Hold to remove" aria-label="Hold to remove '+esc(item.name)+'"><span class="removeFill"></span><span class="removeLabel">'+TRASH+'</span></button></div>';
   row.querySelector('.editBtn').addEventListener('click',()=>{discardPendingNew();editingItem=item;buildRoutine();focusEditForm()});
   row.querySelector('.hideBtn:not(.editBtn)').addEventListener('click',()=>{item.hidden=!item.hidden;buildRoutine()});
   const removeBtn=row.querySelector('.removeBtn');
   bindFuseHold(removeBtn,removeBtn.querySelector('.removeFill'),1200,()=>{
     const idx=arr.indexOf(item);
     if(idx<0)return;
     arr.splice(idx,1);
     buildRoutine();
     showToast('Removed '+item.name,{label:'Undo',run:()=>{arr.splice(Math.min(idx,arr.length),0,item);buildRoutine()}});
   });
   const handle=row.querySelector('.dragHandle');
   handle.addEventListener('pointerdown',e=>startRowDrag(e,row,target,arr));
   handleKeys(handle);
   target.appendChild(row);
 });
}
const reduceMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const buzz=ms=>{try{navigator.vibrate?.(ms)}catch(_){}}; // a tiny tap on phones that support it
// Reordering has the same feel as dragging a new step in: the row lifts with a little pop and
// follows the pointer on a spring (sway, tilt and stretch). The grabbed row never moves in the page
// while you drag (moving it would drop the pointer); the other rows slide out of the way on the
// rubbery curve to show where it will land, however far you sweep. Pull it off to the side and the
// gap closes: let go there and it springs back to where it started.
function startRowDrag(e,row,list,arr){
 if(e.button!==undefined&&e.button!==0)return;
 e.preventDefault();
 const handle=e.currentTarget,pid=e.pointerId,motion=!reduceMotion();
 try{handle.setPointerCapture(pid)}catch(_){}
 const scroller=row.closest('.exerciseScroller')||scrollParent(row);
 const prevPosition=list.style.position;list.style.position='relative'; // offsets are then measured from the list
 const rows=[...list.children].filter(r=>r.classList.contains('moveRow'));
 const from=rows.indexOf(row);
 const gap=parseFloat(getComputedStyle(list).rowGap)||8;
 const h=row.offsetHeight,step=h+gap;
 const tops=rows.map(r=>r.offsetTop),heights=rows.map(r=>r.offsetHeight);
 const listTop=()=>list.getBoundingClientRect().top;
 const width=list.getBoundingClientRect().width;
 const grab=e.clientY-(listTop()+tops[from]),startX=e.clientX;
 let lastY=e.clientY,lastX=e.clientX,y=listTop()+tops[from],vy=0,x=0,vx=0,lift=1,vl=0;
 let to=from,cancelling=false,raf=0,settling=false,landed=false,finalTop=tops[from];
 list.classList.add('reordering');row.classList.add('dragging');row.style.transition='none';
 buzz(8);
 // how many of the other rows sit above the dragged row's centre (in the original layout)
 const targetIndex=()=>{
   const center=lastY-grab+h/2-listTop();
   let n=0;
   rows.forEach((r,i)=>{if(i!==from&&center>tops[i]+heights[i]/2)n++});
   return n;
 };
 const shiftOthers=()=>{
   rows.forEach((r,i)=>{
     if(i===from)return;
     const s=from<to&&i>from&&i<=to?-step:from>to&&i>=to&&i<from?step:0;
     r.style.transform=s?'translateY('+s+'px)':'';
   });
 };
 const update=()=>{
   const lb=list.getBoundingClientRect();
   const off=Math.abs(lastX-startX)>Math.max(80,width*.3)||lastX<lb.left-24||lastX>lb.right+24;
   if(off!==cancelling){cancelling=off;row.classList.toggle('willReturn',off);buzz(off?10:4)}
   const next=cancelling?from:targetIndex();
   if(next!==to){to=next;shiftOthers();if(!cancelling)buzz(4)}
 };
 // the dragged row's top once it lands in slot `to`
 const landingTop=()=>{
   if(to===from)return tops[from];
   const others=rows.filter((r,i)=>i!==from);
   let top=tops[0];
   for(let k=0;k<to;k++)top+=others[k].offsetHeight+gap;
   return top;
 };
 const paint=()=>{
   const st=motion?Math.min(Math.abs(vy)/40,1):0;
   const tilt=motion&&!settling?Math.max(-3,Math.min(3,vx*.6)):0;
   row.style.transform='translate('+x.toFixed(2)+'px,'+(y-(listTop()+tops[from])).toFixed(2)+'px) rotate('+tilt.toFixed(2)+'deg) scale('+(lift*(1-.04*st)).toFixed(4)+','+(lift*(1+.06*st)).toFixed(4)+')';
 };
 const frame=()=>{
   raf=requestAnimationFrame(frame);
   const dx=lastX-startX;
   const ty=settling?listTop()+finalTop:lastY-grab;
   const tx=settling?0:cancelling?dx*.9:Math.max(-22,Math.min(22,dx*.22));
   const tl=settling?1:cancelling?.97:1.035;
   if(!motion){y=ty;x=settling?0:tx;lift=1;paint();if(settling)land();return}
   const k=settling?.24:.2,d=settling?.62:.68;
   vy=(vy+(ty-y)*k)*d;y+=vy;
   vx=(vx+(tx-x)*.16)*.7;x+=vx;
   vl=(vl+(tl-lift)*.22)*.6;lift+=vl;
   paint();
   if(settling&&Math.abs(vy)<.15&&Math.abs(ty-y)<.5&&Math.abs(x)<.5&&Math.abs(lift-1)<.003)land();
 };
 const scrollTimer=setInterval(()=>{
   if(!scroller||settling)return;
   const b=scroller.getBoundingClientRect(),edge=56;
   const dy=lastY<b.top+edge?-10:lastY>b.bottom-edge?10:0;
   if(dy){scroller.scrollTop+=dy;update()}
 },30);
 function land(){
   if(landed)return;landed=true;
   cancelAnimationFrame(raf);
   const moved=to!==from,id=row.dataset.id;
   list.classList.remove('reordering');
   rows.forEach(r=>{r.style.transition='none';r.style.transform=''});
   row.classList.remove('dragging','willReturn');
   list.style.position=prevPosition;
   if(moved){const [it]=arr.splice(from,1);arr.splice(to,0,it)}
   buildRoutine();
   const placed=id&&list.querySelector('.moveRow[data-id="'+id+'"]');
   if(placed&&motion)placed.animate([{transform:'scale(1.02,.95)'},{transform:'scale(.995,1.012)'},{transform:'none'}],{duration:340,easing:'ease-out'});
   if(moved)showToast('Order saved');
 }
 const move=ev=>{
   if(ev.pointerId!==pid)return;
   if(ev.pointerType==='mouse'&&ev.buttons===0){release();return}
   lastY=ev.clientY;lastX=ev.clientX;update();
 };
 const up=ev=>{if(ev.pointerId===pid)release()};
 function release(){
   if(settling)return;
   window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);
   window.removeEventListener('pointercancel',up,true);handle.removeEventListener('lostpointercapture',release);
   clearInterval(scrollTimer);
   if(cancelling&&to!==from){to=from;shiftOthers()}
   finalTop=landingTop();
   settling=true;buzz(6);
   setTimeout(land,800);
 }
 window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);
 window.addEventListener('pointercancel',up,true);handle.addEventListener('lostpointercapture',release);
 raf=requestAnimationFrame(frame);
 paint();
}
function renderLists(){
 const profile=workoutProfiles[selectedWorkoutKey];
 const warmSection=$('warmupList')?.closest('section');
 const coolSection=$('cooldownList')?.closest('section');
 const strengthTitle=$('strengthList')?.closest('section')?.querySelector('.sectionTitle');

 if(profile?.customSequence){
   if(warmSection)warmSection.hidden=!profile.includeWarmup;
   if(coolSection)coolSection.hidden=!profile.includeCooldown;
   if(strengthTitle){
     strengthTitle.textContent='Move sequence';
   }
 }else{
   if(warmSection)warmSection.hidden=Boolean(profile?.warmupOff);
   if(coolSection)coolSection.hidden=false;
   if(strengthTitle)strengthTitle.textContent='Kettlebell work';
 }
 renderList(warmup,'warmupList');
 renderList(strengthPool,'strengthList');
 renderList(cooldown,'cooldownList');
}

// ---- grab "Add movement" / "Add rest" and drop it anywhere in the list ----
// The new item sticks to the button for a moment (it stretches as you pull), then pops free
// and springs after the pointer. Over a list it snaps into line, a gap opens where it will
// land, and on drop it settles into the gap as a new row, already open for editing.
function discardPendingNew(){
  if(!pendingNew)return;
  const {item,arr}=pendingNew;pendingNew=null;
  const i=arr.indexOf(item);if(i>=0)arr.splice(i,1);
  if(editingItem===item)editingItem=null;
}
function listContext(list){
  if(list.id==='warmupList')return {arr:warmup,kind:'warmup',group:'Warm-up'};
  if(list.id==='cooldownList')return {arr:cooldown,kind:'cooldown',group:'Cooldown'};
  return {arr:strengthPool,kind:'work',group:''};
}
function newListItem(type,list){
  const ctx=listContext(list),stamp=Date.now().toString(36);
  if(type==='video')return {id:'video-'+stamp,name:'',group:'Video',kind:'video',hidden:false,url:'',videoId:'',start:0,end:null,videoDuration:null,useVideoLength:true,autoName:true,duration:300};
  return type==='rest'
    ? {id:'rest-'+stamp,name:'Rest',group:'Rest',kind:'rest',hidden:false,useGlobalTiming:true,duration:Number(restInput.value)}
    : {id:'movement-'+stamp,name:'',group:ctx.group,kind:ctx.kind,hidden:false,useGlobalTiming:true,duration:Number(workInput.value)};
}
const RUBBER='cubic-bezier(.34,1.46,.64,1)';
// Rows (and section titles) glide from where they were to where they end up.
function flipRows(scope,mutate){
  if(reduceMotion()||!scope){mutate();return}
  const key=el=>el.dataset?.id||el;
  const all=()=>[...scope.querySelectorAll('.moveRow,.sectionTitle,.movementCreatorLaunch')];
  const before=new Map(all().map(el=>[key(el),el.getBoundingClientRect().top]));
  mutate();
  all().forEach(el=>{
    const top=before.get(key(el));if(top===undefined)return;
    const dy=top-el.getBoundingClientRect().top;if(Math.abs(dy)<.5)return;
    el.animate([{transform:'translateY('+dy+'px)'},{transform:'none'}],{duration:440,easing:RUBBER});
  });
}
// The new row grows out of the gap it was dropped into.
function revealNewRow(row,fromHeight){
  if(!row||reduceMotion())return;
  const h=row.offsetHeight,cut=Math.max(0,h-(fromHeight||0));
  row.animate([{clipPath:'inset(0 0 '+cut+'px 0 round 20.8px)'},{clipPath:'inset(0 0 0 0 round 20.8px)'}],{duration:460,easing:RUBBER});
}
function addNewAt(type,list,index,fromHeight){
  const {arr}=listContext(list);
  const item=newListItem(type,list);
  arr.splice(Math.max(0,Math.min(index,arr.length)),0,item);
  pendingNew={item,arr};editingItem=item;
  flipRows(list.closest('.exerciseScroller,.createStepSlot')||list,()=>buildRoutine());
  const row=list.querySelector('.moveRow.editing');
  revealNewRow(row,fromHeight);
  focusEditForm(type==='rest');
  return row;
}
function scrollParent(el){
  for(let n=el;n&&n.nodeType===1;n=n.parentElement){
    const oy=getComputedStyle(n).overflowY;
    if(/(auto|scroll)/.test(oy)&&n.scrollHeight>n.clientHeight)return n;
  }
  return null;
}
const ADD_LABELS={movement:['New movement','Drop to add, then name it'],rest:['Rest','Rest · Global timing'],video:['New video','Drop to add, then paste a YouTube link']};
function makeGhost(type,label){
  const ghost=document.createElement('div');
  ghost.className='addGhost'+(type==='movement'?'':' rest');
  ghost.innerHTML='<span class="addGhostGrip">'+GRIP+'</span><span class="addGhostText"><strong>'+esc(label[0])+'</strong><small>'+esc(label[1])+'</small></span>';
  $('workoutModal').appendChild(ghost);
  return ghost;
}
function removeGhost(ghost){ghost.classList.add('leaving');setTimeout(()=>ghost.remove(),180)}
// Desktop: pull a new step off the Add button.
function startAddDrag(btn,type,sx,sy){
  if(editingItem||pendingNew){discardPendingNew();editingItem=null;buildRoutine()}
  const b=btn.getBoundingClientRect();
  const ghost=makeGhost(type,ADD_LABELS[type]);
  ghost.setAttribute('aria-hidden','true');
  ghost.style.width=b.width+'px';ghost.style.height=b.height+'px';
  ghost.style.transform='translate('+b.left+'px,'+b.top+'px)';
  btn.classList.add('lifting');
  const scroller=scrollParent(btn);
  return startGhostDrag({ghost,origin:b,sx,sy,scroller,column:btn.closest('.exerciseScroller,.createFlow')||scroller,
    home:()=>btn.getBoundingClientRect(),
    onDrop:(list,index,fromH)=>{removeGhost(ghost);btn.classList.remove('lifting');addNewAt(type,list,index,fromH)},
    onReturn:()=>{removeGhost(ghost);btn.classList.remove('lifting')}});
}
// The drag itself: sticky at first, then a springy follow; over a list it snaps into line and a
// gap opens; on drop it settles into the gap, otherwise it springs back home.
function startGhostDrag({ghost,origin:b,sx,sy,scroller,column,home,onDrop,onReturn,rowLook=false}){
  const motion=!reduceMotion();
  const rowH=root.querySelector('.moveList .moveRow:not(.editing)')?.offsetHeight||80;
  const grabX=sx-b.left,grabY=sy-b.top,STICK=44;
  let px=sx,py=sy,x=b.left,y=b.top,vx=0,vy=0;
  let free=!motion,over=null,slot=null,slotIndex=-1,raf=0,settle=null;
  const lists=()=>['warmupList','strengthList','cooldownList'].map(id=>$(id)).filter(l=>l&&l.getClientRects().length&&!l.closest('[hidden]'));
  const setOver=l=>{
    if(l===over)return;over=l;
    ghost.classList.toggle('overList',Boolean(l)||rowLook);
    const w=l?l.getBoundingClientRect().width:b.width;
    ghost.style.width=w+'px';ghost.style.height=(l?rowH:b.height)+'px';
  };
  const collapse=sl=>{sl.classList.add('leaving');sl.style.height='0px';sl.style.marginTop='-8px';setTimeout(()=>sl.remove(),motion?320:0)};
  const placeSlot=(list,before,index)=>{
    if(slot&&slot.parentNode===list&&slotIndex===index)return;
    if(slot){collapse(slot);slot=null;slotIndex=-1}
    if(!list)return;
    const sl=document.createElement('div');sl.className='dropSlot';
    list.insertBefore(sl,before);
    slot=sl;slotIndex=index;
    sl.getBoundingClientRect();
    sl.style.height=rowH+'px';sl.style.marginTop='0px';
  };
  const updateDrop=()=>{
    let best=null,bestD=Infinity;
    for(const l of lists()){
      const r=l.getBoundingClientRect();
      if(px<r.left-48||px>r.right+48)continue;
      const top=r.top-28,bottom=r.bottom+28;
      const d=py<top?top-py:py>bottom?py-bottom:0;
      if(d<bestD){bestD=d;best=l}
    }
    // anywhere over the list column snaps to the nearest spot; outside it, only right on a list
    const c=column?.getBoundingClientRect();
    const inColumn=c&&px>=c.left&&px<=c.right&&py>=c.top&&py<=c.bottom;
    const target=inColumn||bestD===0?best:null;
    if(target){
      const rows=[...target.children].filter(r=>r.classList.contains('moveRow'));
      let idx=rows.findIndex(r=>{const rb=r.getBoundingClientRect();return py<rb.top+rb.height/2});
      if(idx<0)idx=rows.length;
      placeSlot(target,rows[idx]||null,idx);
    }else placeSlot(null);
    setOver(target);
  };
  const aim=()=>{
    if(settle)return settle.aim();
    if(over){
      const lb=over.getBoundingClientRect();
      let ty=py-rowH/2;
      if(slot)ty=ty*.6+slot.getBoundingClientRect().top*.4; // pulled towards the gap
      return {x:lb.left,y:ty};
    }
    return {x:px-grabX,y:py-grabY};
  };
  const paint=(tilt,a,sx2,sy2)=>{
    ghost.style.transform='translate('+x+'px,'+y+'px) rotate('+tilt+'deg) rotate('+a+'rad) scale('+sx2+','+sy2+') rotate('+(-a)+'rad)';
  };
  const frame=()=>{
    raf=requestAnimationFrame(frame);
    if(!free){
      // still stuck to the button: it stretches towards the pointer
      const dx=px-sx,dy=py-sy,t=Math.min(Math.hypot(dx,dy)/STICK,1);
      x=b.left+dx*.35;y=b.top+dy*.35;
      paint(0,Math.atan2(dy,dx),1+.155*t,1-.1*t);
      return;
    }
    const T=aim();
    if(!motion){x=T.x;y=T.y;paint(0,0,1,1);if(settle){cancelAnimationFrame(raf);settle.done()}return}
    const k=settle?settle.k:.17,damp=settle?settle.d:.70;
    vx=(vx+(T.x-x)*k)*damp;vy=(vy+(T.y-y)*k)*damp;
    x+=vx;y+=vy;
    const sp=Math.hypot(vx,vy),st=Math.min(sp/48,1);
    const tilt=over||settle?0:Math.max(-5,Math.min(5,vx*.32));
    paint(tilt,Math.atan2(vy,vx),1+.1*st,1-.063*st);
    if(settle&&sp<.15&&Math.hypot(T.x-x,T.y-y)<.6){cancelAnimationFrame(raf);settle.done()}
  };
  const scrollTimer=setInterval(()=>{
    if(!scroller||settle)return;
    const r=scroller.getBoundingClientRect(),edge=64;
    const dy=py<r.top+edge?-(r.top+edge-py)/4:py>r.bottom-edge?(py-(r.bottom-edge))/4:0;
    if(dy){scroller.scrollTop+=Math.max(-18,Math.min(18,dy));updateDrop()}
  },30);
  raf=requestAnimationFrame(frame);
  let finished=false;
  const finish=(list,index)=>{
    if(finished)return;finished=true;
    cancelAnimationFrame(raf);
    // the gap stays until the list re-renders, so nothing jumps
    const fromH=slot?slot.offsetHeight:rowH;
    if(!list&&slot){slot.remove();slot=null}
    if(list)onDrop(list,index,fromH);else onReturn();
  };
  return {
    move(cx,cy){
      px=cx;py=cy;
      if(!free&&Math.hypot(px-sx,py-sy)>STICK){free=true;vx=(px-sx)*.085;vy=(py-sy)*.085} // pops off the button
      if(free)updateDrop();
    },
    drop(cancel){
      clearInterval(scrollTimer);
      const list=over,index=slotIndex;
      if(!cancel&&list&&slot){
        const s=slot;
        settle={k:.24,d:.62,aim:()=>{const sb=s.getBoundingClientRect();return {x:sb.left,y:sb.top}},done:()=>finish(list,index)};
        setTimeout(()=>finish(list,index),650);
        if(!motion){cancelAnimationFrame(raf);finish(list,index)}
        return;
      }
      // not over the list: spring back home
      placeSlot(null);setOver(null);
      settle={k:.2,d:.66,aim:()=>{const r=home();return {x:r.left,y:r.top}},done:()=>finish(null)};
      setTimeout(()=>finish(null),650);
      if(!motion){cancelAnimationFrame(raf);finish(null)}
    }
  };
}
function bindAddDrag(btn,type){
  let dragged=false;
  btn.addEventListener('click',e=>{
    if(dragged){dragged=false;e.preventDefault();return}
    if(phoneLayout()){openNewSheet(type);return}
    // a plain tap (or Enter on a remote) adds it to the end of the main list
    const list=$('strengthList');
    const row=addNewAt(type,list,listContext(list).arr.length,0);
    row?.scrollIntoView({block:'nearest',behavior:reduceMotion()?'auto':'smooth'});
  });
  btn.addEventListener('pointerdown',e=>{
    if(e.button!==undefined&&e.button!==0)return;
    const id=e.pointerId,sx=e.clientX,sy=e.clientY;
    let drag=null,ended=false;
    try{btn.setPointerCapture(id)}catch(_){}
    // Listen on the whole window (and for a lost capture) so letting go always ends the drag,
    // even if something else on the page catches the release first.
    const move=ev=>{
      if(ev.pointerId!==id)return;
      if(ev.pointerType==='mouse'&&ev.buttons===0){end(false);return} // the release was missed
      if(!drag){
        if(Math.hypot(ev.clientX-sx,ev.clientY-sy)<6)return;
        drag=startAddDrag(btn,type,sx,sy);
      }
      drag.move(ev.clientX,ev.clientY);
    };
    const up=ev=>{if(ev.pointerId===id)end(false)};
    const cancel=ev=>{if(ev.pointerId===id)end(true)};
    const lost=()=>end(false);
    const blur=()=>end(true);
    const key=ev=>{if(ev.key==='Escape'&&drag){ev.preventDefault();ev.stopPropagation();end(true)}};
    function end(cancelled){
      if(ended)return;ended=true;
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',up,true);
      window.removeEventListener('pointercancel',cancel,true);
      window.removeEventListener('keydown',key,true);
      window.removeEventListener('blur',blur);
      btn.removeEventListener('lostpointercapture',lost);
      if(drag){const d=drag;drag=null;dragged=true;setTimeout(()=>{dragged=false},0);d.drop(cancelled)}
    }
    window.addEventListener('pointermove',move,true);
    window.addEventListener('pointerup',up,true);
    window.addEventListener('pointercancel',cancel,true);
    window.addEventListener('keydown',key,true);
    window.addEventListener('blur',blur);
    btn.addEventListener('lostpointercapture',lost);
  });
}

/* ---- phones: rows open a bottom sheet; + adds a step that floats until you drag it into place ---- */
const phoneQuery=window.matchMedia?.('(max-width: 620px)');
function phoneLayout(){return Boolean(window.matchMedia?.('(max-width: 620px)').matches)}
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
const kindWord=x=>x.kind==='rest'?'rest':x.kind==='video'?'video':'movement';
let sheetOnClose=null,hovering=null;
function openSheet(title,content,onClose,focus){
  closeSheet();
  $('sheetTitle').textContent=title;
  const body=$('sheetBody');body.innerHTML='';body.appendChild(content);
  sheetOnClose=onClose||null;
  $('sheet').setAttribute('aria-hidden','false');
  $('sheetScrim').classList.add('open');$('sheet').classList.add('open');
  setTimeout(()=>{
    // only if this sheet is still the one showing (a quick Add/Cancel must not bring the keyboard back)
    if(!$('sheet').classList.contains('open')||!body.contains(content))return;
    const el=focus?body.querySelector('input[data-f=url],input[data-f=name]'):body.querySelector('button,input,select');
    el?.focus({preventScroll:true});
  },reduceMotion()?0:360);
}
function closeSheet(){
  const sheet=$('sheet');
  if(!sheet.classList.contains('open'))return;
  sheet.classList.remove('open');$('sheetScrim').classList.remove('open');sheet.setAttribute('aria-hidden','true');
  if(sheet.contains(root.activeElement))root.activeElement.blur(); // puts the phone keyboard away
  const done=sheetOnClose;sheetOnClose=null;done?.();
  setTimeout(fitEditorToScreen,0);
}
$('sheetScrim').addEventListener('click',closeSheet);
$('sheet').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeSheet()}});
function openItemSheet(item,arr){
  const form=renderEditForm(item,arr.indexOf(item),{sheet:true,isNew:false,
    onSaved(){closeSheet();buildRoutine();showToast(cap(kindWord(item))+' updated')},
    onCancel:closeSheet,
    onHide(){item.hidden=!item.hidden;closeSheet();buildRoutine();showToast((item.hidden?'Hidden: ':'Showing: ')+item.name)},
    onRemove(){
      closeSheet();
      const idx=arr.indexOf(item);if(idx<0)return;
      arr.splice(idx,1);buildRoutine();
      showToast('Removed '+item.name,{label:'Undo',run:()=>{arr.splice(Math.min(idx,arr.length),0,item);buildRoutine()}});
    }});
  openSheet('Edit '+kindWord(item),form,null,false);
}
function openAddChooser(){
  const box=document.createElement('div');box.className='sheetChoices';
  [['movement','activity','Movement','Name it, then drag it into place'],['rest','pause','Rest','A pause between movements'],['video','play','Video','Paste a YouTube link']].forEach(([type,ic,label,sub])=>{
    const b=document.createElement('button');b.type='button';b.className='sheetChoice';
    b.innerHTML='<span class="timeIcon" aria-hidden="true">'+icon(ic)+'</span><span><strong>'+label+'</strong><small>'+sub+'</small></span>';
    b.addEventListener('click',()=>openNewSheet(type));
    box.appendChild(b);
  });
  openSheet('Add to the move',box,null,false);
}
function openNewSheet(type){
  if(hovering)placeHoverAtEnd(); // one floating step at a time
  const item=newListItem(type,$('strengthList'));
  const form=renderEditForm(item,-1,{sheet:true,isNew:true,
    onSaved(){closeSheet();startHover(item,type)},
    onCancel:closeSheet});
  openSheet('New '+kindWord(item),form,null,true);
}
// Setup (name, warm-up, timing, rounds) folds into one line on phones and opens in the sheet.
const setupPanel=$('workoutModal').querySelector('.modalStatic'),setupHome={parent:setupPanel.parentNode,next:setupPanel.nextSibling};
function openSetupSheet(){
  const holder=document.createElement('div');holder.className='sheetSetup';
  holder.appendChild(setupPanel);
  const done=document.createElement('button');done.type='button';done.className='primary sheetDone';done.textContent='Done';
  done.addEventListener('click',closeSheet);holder.appendChild(done);
  openSheet('Setup',holder,()=>{setupHome.parent.insertBefore(setupPanel,setupHome.next);updateSetupSummary()},false);
}
function updateSetupSummary(){
  const name=$('setupSummaryName');if(!name)return;
  name.textContent=($('workoutNameInput')?.value||'').trim()||workoutProfiles[selectedWorkoutKey]?.name||'Move';
  $('setupSummaryMeta').textContent=routineSummaryModal.textContent;
}
$('setupSummary').addEventListener('click',openSetupSheet);
$('addFab').addEventListener('click',openAddChooser);
// The new step waits above the list, gently glowing, until it's dragged into place.
function hoverScroller(){const list=$('strengthList');return scrollParent(list)||list.closest('.exerciseScroller')}
function hoverHome(){
  const lb=$('strengthList').getBoundingClientRect(),sc=(hoverScroller()||$('strengthList')).getBoundingClientRect();
  const h=hovering?.ghost.offsetHeight||64;
  return {left:lb.left,top:Math.max(sc.top+12,Math.min(sc.bottom-h-96,sc.top+sc.height*.55-h/2)),width:lb.width,height:h};
}
function startHover(item,type){
  const ghost=makeGhost(type,[item.name||ADD_LABELS[type][0],'Drag into place']);
  ghost.classList.add('overList','hovering');
  ghost.setAttribute('aria-label',(item.name||'New step')+'. Drag it into place in the list, or add it at the end.');
  const actions=document.createElement('span');actions.className='addGhostActions';
  actions.innerHTML='<button class="hideBtn" type="button" data-a="end">Add at end</button><button class="hideBtn ghostDiscard" type="button" data-a="discard" aria-label="Discard '+esc(item.name)+'">✕</button>';
  ghost.appendChild(actions);
  hovering={item,type,ghost};
  const rowH=root.querySelector('.moveList .moveRow:not(.editing)')?.offsetHeight||64;
  ghost.style.width=$('strengthList').getBoundingClientRect().width+'px';ghost.style.height=rowH+'px';
  const spot=hoverHome();
  // it rises out of the closing sheet, then waits
  const from=modal.querySelector('.modal').getBoundingClientRect().bottom;
  ghost.style.transform='translate('+spot.left+'px,'+from+'px)';
  ghost.getBoundingClientRect();
  if(!reduceMotion()){ghost.classList.add('rising');setTimeout(()=>ghost.classList.remove('rising'),650)}
  ghost.style.transform='translate('+spot.left+'px,'+spot.top+'px)';
  actions.querySelector('[data-a=end]').addEventListener('click',placeHoverAtEnd);
  actions.querySelector('[data-a=discard]').addEventListener('click',discardHover);
  ghost.addEventListener('pointerdown',beginHoverDrag);
}
function beginHoverDrag(e){
  if(!hovering||e.target.closest('button'))return;
  if(e.button!==undefined&&e.button!==0)return;
  e.preventDefault();
  const {item,ghost}=hovering,id=e.pointerId;
  try{ghost.setPointerCapture(id)}catch(_){}
  ghost.classList.remove('hovering','rising');ghost.classList.add('held');
  const r=ghost.getBoundingClientRect(),scroller=hoverScroller();
  const drag=startGhostDrag({ghost,origin:{left:r.left,top:r.top,width:r.width,height:r.height},sx:e.clientX,sy:e.clientY,
    scroller,column:$('strengthList').closest('.exerciseScroller,.createFlow')||scroller,rowLook:true,
    home:hoverHome,
    onDrop:(list,index,fromH)=>{hovering=null;removeGhost(ghost);placeNewItem(item,list,index,fromH)},
    onReturn:()=>{ghost.classList.remove('held');ghost.classList.add('hovering')}});
  let ended=false;
  const move=ev=>{if(ev.pointerId!==id)return;if(ev.pointerType==='mouse'&&ev.buttons===0){end(false);return}drag.move(ev.clientX,ev.clientY)};
  const up=ev=>{if(ev.pointerId===id)end(false)},cancel=ev=>{if(ev.pointerId===id)end(true)};
  const lost=()=>end(false),blur=()=>end(true);
  const key=ev=>{if(ev.key==='Escape'){ev.preventDefault();end(true)}};
  function end(cancelled){
    if(ended)return;ended=true;
    window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);
    window.removeEventListener('pointercancel',cancel,true);window.removeEventListener('keydown',key,true);
    window.removeEventListener('blur',blur);ghost.removeEventListener('lostpointercapture',lost);
    drag.drop(cancelled);
  }
  window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);
  window.addEventListener('pointercancel',cancel,true);window.addEventListener('keydown',key,true);
  window.addEventListener('blur',blur);ghost.addEventListener('lostpointercapture',lost);
}
function placeNewItem(item,list,index,fromH){
  const ctx=listContext(list);
  if(item.kind!=='rest'&&item.kind!=='video'){item.kind=ctx.kind;if(ctx.group&&(!item.group||item.group==='Movement'))item.group=ctx.group}
  ctx.arr.splice(Math.max(0,Math.min(index,ctx.arr.length)),0,item);
  flipRows(list.closest('.exerciseScroller,.createStepSlot')||list,()=>buildRoutine());
  revealNewRow(list.querySelector('.moveRow[data-id="'+item.id+'"]'),fromH);
  showToast(cap(kindWord(item))+' added');
}
function placeHoverAtEnd(){
  if(!hovering)return;
  const {item,ghost}=hovering;hovering=null;removeGhost(ghost);
  const list=$('strengthList');
  placeNewItem(item,list,listContext(list).arr.length,0);
  list.querySelector('.moveRow[data-id="'+item.id+'"]')?.scrollIntoView({block:'nearest',behavior:reduceMotion()?'auto':'smooth'});
}
function discardHover(){if(!hovering)return;const g=hovering.ghost;hovering=null;removeGhost(g);showToast('Discarded')}
function endHover(){if(!hovering)return;hovering.ghost.remove();hovering=null}
window.addEventListener('resize',()=>{
  if(hovering?.ghost.classList.contains('hovering')){const spot=hoverHome();hovering.ghost.style.width=spot.width+'px';hovering.ghost.style.transform='translate('+spot.left+'px,'+spot.top+'px)'}
});
phoneQuery?.addEventListener?.('change',()=>{closeSheet();if(hovering&&!phoneLayout())placeHoverAtEnd();renderLists()});
// Belt and braces for browsers without overflow:clip: if anything scrolls the panel, put it back.
{const panel=$('workoutModal').querySelector('.modal');
 panel.addEventListener('scroll',()=>{if(panel.scrollTop||panel.scrollLeft){panel.scrollTop=0;panel.scrollLeft=0}});}
// Phones: the editor is a full-screen sheet sized to the part of the screen you can actually see —
// the whole screen normally, the part above the keyboard while typing. It is measured rather than
// left to CSS because the Home Assistant app (and the keyboard panning the page) can make a
// "fixed, full height" panel end up taller, shorter or shifted.
function fitEditorToScreen(){
  const backdrop=$('workoutModal'),vv=window.visualViewport;
  if(!backdrop.classList.contains('open')||!phoneLayout()){unfitEditor();return}
  const top=vv?vv.offsetTop:0,left=vv?vv.offsetLeft:0;
  const w=vv?vv.width:window.innerWidth,h=vv?vv.height:window.innerHeight;
  Object.assign(backdrop.style,{right:'auto',bottom:'auto',width:w+'px',height:h+'px',top:top+'px',left:left+'px'});
  // If a parent element has turned "fixed" into "fixed to me", move it back onto the screen.
  const r=backdrop.getBoundingClientRect();
  if(Math.abs(r.top-top)>.5)backdrop.style.top=(2*top-r.top)+'px';
  if(Math.abs(r.left-left)>.5)backdrop.style.left=(2*left-r.left)+'px';
}
function unfitEditor(){['top','left','right','bottom','width','height'].forEach(k=>$('workoutModal').style.removeProperty(k))}
window.visualViewport?.addEventListener('resize',fitEditorToScreen);
window.visualViewport?.addEventListener('scroll',fitEditorToScreen);
window.addEventListener('resize',fitEditorToScreen);
window.addEventListener('scroll',fitEditorToScreen,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(fitEditorToScreen,250));

function updateMovementCreatorAvailability(){
 const hasItems=strengthPool.length>0;
 const addMove=$('addMovementBtn');
 const addRest=$('addRestBtn');
 if(addMove)addMove.innerHTML=GRIP+'<span>Add movement</span>';
 if(addRest)addRest.innerHTML=GRIP+'<span>Add rest</span>';
 const addVideo=$('addVideoBtn');if(addVideo)addVideo.innerHTML=GRIP+'<span>Add video</span>';
}
function updateGlobalTimingUI(){
 const useGlobal=$('useGlobalTiming').checked;
 const duration=$('addMovementDuration');
 const unit=$('addMovementUnit');
 duration.disabled=useGlobal;
 unit.disabled=useGlobal;
 duration.parentElement.style.opacity=useGlobal?'.38':'1';
 $('globalTimingValue').textContent='Use global timing · '+formatDuration(workInput.value);

 const useGlobalRest=$('useGlobalRestTiming').checked;
 const restDuration=$('addRestDuration');
 const restUnit=$('addRestUnit');
 restDuration.disabled=useGlobalRest;
 restUnit.disabled=useGlobalRest;
 restDuration.parentElement.style.opacity=useGlobalRest?'.38':'1';
 $('globalRestTimingValue').textContent='Use global timing · '+formatDuration(restInput.value);
}

let creatorItemType='movement';
function setCreatorItemType(type){
 creatorItemType=type;
 const movementFields=$('movementFields');
 const restFields=$('restFields');
 movementFields.hidden=type!=='movement';
 restFields.hidden=type!=='rest';
 $('movementCreatorHeading').textContent=type==='rest'?'Add rest':'Add movement';
 $('movementCreator').setAttribute('aria-label',type==='rest'?'Create rest':'Create movement');
 updateGlobalTimingUI();
}

function addMovement(){
 const profile=workoutProfiles[selectedWorkoutKey];
 const useGlobal=creatingNewMove ? true : $('useGlobalTiming').checked;
 const movementDuration=useGlobal
   ? Number(workInput.value)
   : secondsFromCreator(
       $('addMovementDuration').value,
       $('addMovementUnit').value
     );

 const useGlobalRest=creatingNewMove ? true : $('useGlobalRestTiming').checked;
 const restDuration=useGlobalRest
   ? Number(restInput.value)
   : secondsFromCreator(
       $('addRestDuration').value,
       $('addRestUnit').value
     );

 if(creatorItemType==='rest'){
   const title=$('addRestTitle').value.trim()||'Rest';
   const group=$('addRestGroup').value.trim()||'Rest';
   strengthPool.push({
     id:'rest-'+Date.now(),
     name:title,
     group,
     kind:'rest',
     hidden:false,
     useGlobalTiming:useGlobalRest,
     duration:Math.max(5,restDuration||Number(restInput.value))
   });
   buildRoutine();
   $('movementCreator').hidden=true;
   $('addRestTitle').value='Rest';
   $('addRestGroup').value='Rest';
   showToast('Rest added');
   if(creatingNewMove){
     setCreateStep('movements');
     updateCreateStepSummaries();
   }
 }else{
   const name=$('addMovementInput').value.trim();
   if(!name)return;
   const group=$('addMovementGroup').value.trim()||'Movement';
   strengthPool.push({
     id:'movement-'+Date.now(),
     name,
     group,
     kind:'work',
     hidden:false,
     useGlobalTiming:useGlobal,
     duration:Math.max(5,movementDuration||Number(workInput.value))
   });
   $('addMovementInput').value='';
   $('addMovementGroup').value='';
   buildRoutine();
   $('movementCreator').hidden=true;
   showToast('Movement added');
   if(creatingNewMove){
     setCreateStep('movements');
     updateCreateStepSummaries();
   }
 }
 updateMovementCreatorAvailability();
}

/* energy */
let toastTimer=null;
function showToast(message,action){
 const toast=$('toast');
 toast.innerHTML='';
 const text=document.createElement('span');text.textContent=message;toast.appendChild(text);
 if(action){
   const btn=document.createElement('button');btn.type='button';btn.className='toastAction';btn.textContent=action.label;
   btn.addEventListener('click',()=>{action.run();toast.classList.remove('show','withAction');clearTimeout(toastTimer)});
   toast.appendChild(btn);
 }
 toast.classList.toggle('withAction',Boolean(action));
 toast.classList.add('show');
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>toast.classList.remove('show','withAction'),action?5000:2200);
}
/* twice-daily check-in: mood + energy on a terrible → great slider (0–100) */
const LEVELS=['Terrible','Poor','Meh','Okay','Good','Great'];
const LEVEL_COLORS=['#6E63A8','#5878A8','#6F8B8A','#5F9B72','#D5A53E','#D56B54'];
function band(v){return Math.max(0,Math.min(5,Math.floor(Number(v)/100*6)))}
function levelLabel(_scale,v){return LEVELS[band(v)]}
function levelColor(v){return LEVEL_COLORS[band(v)]}
function dayKey(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function checkinTimes(){
  return {morning:settings().morningTime||'08:00',evening:settings().eveningTime||'19:00'};
}
function minutesOf(hhmm){const [h,m]=String(hhmm).split(':').map(Number);return (h||0)*60+(m||0)}
function slotFor(d){
  const t=checkinTimes(),now=d.getHours()*60+d.getMinutes();
  return now>=minutesOf(t.evening)?'evening':'morning';
}
function findCheckin(date,slot){return store.checkins.find(c=>c.date===date&&c.slot===slot)}
function isComplete(c){return Boolean(c&&c.mood!=null&&c.energy!=null)}
// The check-in that's due right now, or null.
function dueSlot(){
  const now=new Date(),date=dayKey(now),slot=slotFor(now);
  const t=checkinTimes(),mins=now.getHours()*60+now.getMinutes();
  if(slot==='morning'&&mins<minutesOf(t.morning))return null;
  return isComplete(findCheckin(date,slot))?null:slot;
}

const checkinModal=$('checkinModal'),checkinTab=$('checkinTab'),checkinBadge=$('checkinBadge');
const sliders={mood:{input:$('moodInput'),fill:$('moodFill')},energy:{input:$('energyLevelInput'),fill:$('energyLevelFill')}};
function paintSlider(scale){
  const {input,fill}=sliders[scale];
  fill.style.width=input.value+'%';
  input.setAttribute('aria-valuetext',levelLabel(scale,input.value));
}
Object.keys(sliders).forEach(scale=>sliders[scale].input.addEventListener('input',()=>paintSlider(scale)));

let checkinSlotOpen=null;
function nextCheckinText(){
  const t=checkinTimes(),now=new Date(),mins=now.getHours()*60+now.getMinutes();
  if(mins<minutesOf(t.morning))return 'Next check-in at '+t.morning;
  if(mins<minutesOf(t.evening))return 'Next check-in at '+t.evening;
  return 'Next check-in tomorrow at '+t.morning;
}
function nextCheckinAt(){
  const t=checkinTimes(),now=new Date(),mins=now.getHours()*60+now.getMinutes();
  const at=(hhmm,addDay)=>{const [h,m]=hhmm.split(':').map(Number);return new Date(now.getFullYear(),now.getMonth(),now.getDate()+(addDay?1:0),h,m)};
  if(mins<minutesOf(t.morning))return {date:at(t.morning),time:t.morning};
  if(mins<minutesOf(t.evening))return {date:at(t.evening),time:t.evening};
  return {date:at(t.morning,true),time:t.morning};
}
let peekTimer=null,peekTick=null;
function paintPeek(){
  if(dueSlot()){hidePeek();updateCheckinTab();return}
  const next=nextCheckinAt();
  const left=Math.max(0,Math.round((next.date-Date.now())/1000));
  const h=Math.floor(left/3600),m=Math.floor(left%3600/60),sec=left%60;
  $('peekCountdown').textContent=h+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  $('peekAt').textContent='Available at '+next.time;
}
function showPeek(){
  paintPeek();
  checkinTab.classList.add('peek');
  clearInterval(peekTick);peekTick=setInterval(paintPeek,1000);
  clearTimeout(peekTimer);peekTimer=setTimeout(hidePeek,6000);
}
function hidePeek(){
  checkinTab.classList.remove('peek');
  clearInterval(peekTick);clearTimeout(peekTimer);
}
function openCheckin(){
  // Only two check-ins a day: the popup opens only while one is due.
  const slot=dueSlot();
  if(!slot){checkinTab.classList.contains('peek')?hidePeek():showPeek();return}
  const now=new Date();
  checkinSlotOpen={date:dayKey(now),slot};
  const existing=findCheckin(checkinSlotOpen.date,slot);
  const last=store.checkins.find(c=>isComplete(c));
  Object.keys(sliders).forEach(scale=>{
    sliders[scale].input.value=existing?.[scale]??last?.[scale]??50;
    paintSlider(scale);
  });
  $('checkinTitle').textContent=slot==='morning'?'Morning check-in':'Evening check-in';
  checkinModal.classList.add('open');
  checkinModal.setAttribute('aria-hidden','false');
  requestAnimationFrame(()=>sliders.mood.input.focus());
}
function closeCheckin(){
  checkinModal.classList.remove('open');
  checkinModal.setAttribute('aria-hidden','true');
  if(checkinSlotOpen)dismissedKey=checkinSlotOpen.date+'-'+checkinSlotOpen.slot;
  try{localStorage.setItem('move-assistant-dismissed',dismissedKey)}catch(_e){}
  checkinSlotOpen=null;
  updateCheckinTab();
}
function saveCheckin(){
  if(!checkinSlotOpen)return;
  if(isComplete(findCheckin(checkinSlotOpen.date,checkinSlotOpen.slot))){closeCheckin();return}
  const {date,slot}=checkinSlotOpen;
  let entry=findCheckin(date,slot);
  if(!entry){entry={date,slot};store.checkins.unshift(entry);store.checkins=store.checkins.slice(0,2000)}
  entry.mood=Number(sliders.mood.input.value);
  entry.energy=Number(sliders.energy.input.value);
  entry.scale=100;
  entry.at=new Date().toISOString();
  persist();
  bridge.fire('checkin',{slot,mood:entry.mood,energy:entry.energy,mood_label:levelLabel('mood',entry.mood),energy_label:levelLabel('energy',entry.energy)});
  showToast((slot==='morning'?'Morning':'Evening')+' check-in saved');
  closeCheckin();
  renderFeelingRows();
  renderFeelWeek();
  renderWeek();
  renderInsights();
}
let dismissedKey='';
try{dismissedKey=localStorage.getItem('move-assistant-dismissed')||''}catch(_e){}
function updateCheckinTab(){
  const due=dueSlot();
  checkinBadge.hidden=!due;
  // Only show the tab while a check-in is due; it comes back at the next check-in time.
  checkinTab.hidden=!due;
  if(!due)hidePeek();
  checkinTab.classList.toggle('due',Boolean(due));
  checkinTab.setAttribute('aria-label',due?(due==='morning'?'Morning':'Evening')+' check-in is due':nextCheckinText());
  checkinTab.title=due?'Check in now':nextCheckinText();
}
function checkCheckinDue(){
  updateCheckinTab();
  const due=dueSlot();
  if(!due||checkinModal.classList.contains('open'))return;
  if(settings().checkinAutoOpen===false)return;
  if($('app').classList.contains('house'))return; // the Spacing test is the house only
  if(!views.home.classList.contains('active')||modal.classList.contains('open'))return;
  if(dismissedKey===dayKey(new Date())+'-'+due)return;
  openCheckin();
}
checkinTab.addEventListener('click',openCheckin);
$('checkinLater').addEventListener('click',closeCheckin);
$('checkinSave').addEventListener('click',saveCheckin);
checkinModal.addEventListener('click',e=>{if(e.target===checkinModal)closeCheckin()});
checkinModal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeCheckin()}});
setInterval(checkCheckinDue,30000);

function renderFeelingRows(){
  const today=dayKey(new Date());
  const latest=scale=>store.checkins.find(c=>c.date===today&&c[scale]!=null);
  [['mood','moodMeta'],['energy','energyLevelMeta']].forEach(([scale,id])=>{
    const c=latest(scale);
    $(id).textContent=c?levelLabel(scale,c[scale]):'—';
  });
}

/* how you've felt this week */
function renderFeelWeek(){
  const card=$('feelCard');if(!card)return;
  const now=new Date();
  const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()+6)%7));
  const days=[...Array(7)].map((_,i)=>{
    const d=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+i);
    const key=dayKey(d);
    const checks=store.checkins.filter(c=>c.date===key);
    const avg=scale=>{const v=checks.map(c=>c[scale]).filter(v=>v!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
    return {d,key,mood:avg('mood'),energy:avg('energy'),count:checks.filter(isComplete).length,future:d>now&&key!==dayKey(now)};
  });
  const all=scale=>{const v=days.map(x=>x[scale]).filter(v=>v!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
  const wkMood=all('mood'),wkEnergy=all('energy');
  const meter=(label,v)=>'<div class="feelMeter"><div class="feelMeterTop"><span>'+label+'</span><span>'+(v==null?'—':esc(levelLabel('',v)))+'</span></div><div class="feelTrack"><span style="width:'+(v==null?0:Math.max(4,v))+'%;background:'+(v==null?'transparent':levelColor(v))+'"></span></div></div>';
  const best=days.filter(x=>x.mood!=null&&x.energy!=null).sort((a,b)=>(b.mood+b.energy)-(a.mood+a.energy))[0];
  card.innerHTML=
    '<div class="feelTop">'+
      '<div class="feelSummary">'+
        '<div class="feelHeadline">'+(wkMood==null?'No check-ins yet':esc(levelLabel('',(wkMood+wkEnergy)/2)))+'</div>'+
        '<div class="weekCopy">'+(wkMood==null?'Your first check-in will appear here.':'on average this week'+(best?' · best day '+esc(new Intl.DateTimeFormat(undefined,{weekday:'long'}).format(best.d)):''))+'</div>'+
      '</div>'+
    '</div>'+
    '<div class="feelDays">'+days.map(x=>
      '<div class="weekChip feelDay'+(x.future?' future':'')+(x.key===dayKey(now)?' today':'')+'">'+
        '<div class="weekChipTop"><strong>'+esc(new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(x.d))+'</strong>'+(x.count>=2?'<span class="weekTick">'+icon('check')+'</span>':'<span class="feelDots">'+'●'.repeat(x.count)+'</span>')+'</div>'+
        meter('Mood',x.mood)+meter('Energy',x.energy)+
      '</div>'
    ).join('')+'</div>';
}

const upcomingCountSetting=$('upcomingCountSetting');
upcomingCountSetting.addEventListener('change',()=>{
  upcomingVisibleCount=upcomingCountSetting.value==='all'?'all':Number(upcomingCountSetting.value);
  renderUpcomingExercises();
});

const tempoRevealBtn=$('tempoRevealBtn');
const tempoExperiment=$('tempoExperiment');
const tempoQuad=$('tempoQuad');
const tempoDot=$('tempoDot');
const tempoEstimate=$('tempoEstimate');
const tempoReadout=$('tempoReadout');

let tempoValue={x:.5,y:.5},tempoDragging=false;
let tempoSliderBase={total:20,work:45,rest:15};


function clampToStep(value,min,max,step){
  const clamped=Math.max(min,Math.min(max,value));
  return Math.round((clamped-min)/step)*step+min;
}
function updateTimingSlidersFromTempo(x,y){
  const hard=(x-.5)*2;
  const slow=(y-.5)*2;

  const total=clampToStep(
    tempoSliderBase.total + hard*5 + slow*8,
    Number(totalInput.min),Number(totalInput.max),Number(totalInput.step)
  );
  const work=clampToStep(
    tempoSliderBase.work + hard*10 + slow*8,
    Number(workInput.min),Number(workInput.max),Number(workInput.step)
  );
  const rest=clampToStep(
    tempoSliderBase.rest + hard*6 + slow*6,
    Number(restInput.min),Number(restInput.max),Number(restInput.step)
  );

  totalInput.value=total;
  workInput.value=work;
  restInput.value=rest;

  workOut.textContent=work+' sec';
  restOut.textContent=rest+' sec';
  updateRangeFills();

  return {total,work,rest};
}

function updateTempoProfile(x,y){
  // x: Low -> Hard. y: Fast -> Slow.
  const horiz=x<.34?'Low':x>.66?'Hard':'Medium';
  const vert=y<.34?'Fast':y>.66?'Slow':'Balanced';
  const timing=updateTimingSlidersFromTempo(x,y);
  tempoReadout.textContent=horiz+' + '+vert;
  tempoEstimate.textContent=timing.total+' min';
  tempoQuad.setAttribute('aria-valuetext',horiz+' and '+vert+', estimated '+timing.total+' minutes');
}

function setTempoFromPointer(e){
  const r=tempoQuad.getBoundingClientRect();
  const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
  const y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
  tempoValue={x,y};
  tempoDot.style.left=(x*100)+'%';
  tempoDot.style.top=(y*100)+'%';
  updateTempoProfile(x,y);
}

tempoRevealBtn.addEventListener('click',()=>{
  const opening=tempoExperiment.hidden;
  tempoExperiment.hidden=!opening;
  tempoRevealBtn.setAttribute('aria-expanded',opening?'true':'false');
  tempoRevealBtn.textContent=opening?'Now close this':'Don’t try this!';
  if(opening){
    tempoSliderBase={
      total:Number(totalInput.value),
      work:Number(workInput.value),
      rest:Number(restInput.value)
    };
    tempoValue={x:.5,y:.5};
    tempoDot.style.left='50%';
    tempoDot.style.top='50%';
    updateTempoProfile(tempoValue.x,tempoValue.y);
  }
});

let testingFeedbackRating=null;
root.querySelectorAll('[data-feedback-rating]').forEach(btn=>btn.addEventListener('click',()=>{
  testingFeedbackRating=Number(btn.dataset.feedbackRating);
  root.querySelectorAll('[data-feedback-rating]').forEach(b=>b.classList.toggle('selected',b===btn));
}));
const testingFeedbackForm=$('testingFeedbackForm');
const testingFeedbackThanks=$('testingFeedbackThanks');
const testingFeedbackAgain=$('testingFeedbackAgain');

testingFeedbackForm.addEventListener('submit',e=>{
  e.preventDefault();
  testingFeedbackForm.hidden=true;
  testingFeedbackThanks.hidden=false;
  showToast('Feedback captured for prototype');
});

testingFeedbackAgain.addEventListener('click',e=>{
  e.preventDefault();
  testingFeedbackForm.reset();
  testingFeedbackRating=null;
  root.querySelectorAll('[data-feedback-rating]').forEach(b=>b.classList.remove('selected'));
  testingFeedbackThanks.hidden=true;
  testingFeedbackForm.hidden=false;
});

tempoQuad.addEventListener('pointerdown',e=>{
  tempoDragging=true;
  setTempoFromPointer(e);
  try{tempoQuad.setPointerCapture?.(e.pointerId)}catch(_){}
});
tempoQuad.addEventListener('pointermove',e=>{if(tempoDragging)setTempoFromPointer(e)});
tempoQuad.addEventListener('pointerup',e=>{if(tempoDragging){tempoDragging=false;setTempoFromPointer(e);buildRoutine()}});
tempoQuad.addEventListener('pointercancel',()=>tempoDragging=false);
tempoQuad.addEventListener('keydown',e=>{
  let {x,y}=tempoValue,changed=true;
  if(e.key==='ArrowLeft')x-=.05;
  else if(e.key==='ArrowRight')x+=.05;
  else if(e.key==='ArrowUp')y-=.05;
  else if(e.key==='ArrowDown')y+=.05;
  else changed=false;
  if(!changed)return;
  e.preventDefault();
  x=Math.max(0,Math.min(1,x));y=Math.max(0,Math.min(1,y));
  tempoValue={x,y};
  tempoDot.style.left=(x*100)+'%';tempoDot.style.top=(y*100)+'%';
  updateTempoProfile(x,y);
  buildRoutine();
});




/* modal */
const modal=$('workoutModal');
let workoutEditSnapshot=null;

function cloneMovementList(list){return list.map(x=>({...x}))}
function captureWorkoutEditSnapshot(){
  const profile=workoutProfiles[selectedWorkoutKey];
  return {
    key:selectedWorkoutKey,
    profile:profile ? JSON.parse(JSON.stringify(profile)) : null,
    warmup:cloneMovementList(warmup),
    strength:cloneMovementList(strengthPool),
    cooldown:cloneMovementList(cooldown),
    total:Number(totalInput.value),
    work:Number(workInput.value),
    rest:Number(restInput.value),
    rounds:Number(roundsInput.value)||1
  };
}
function openWorkoutEditor(isCreate=false){
  creatingNewMove=Boolean(isCreate);
  editingItem=null;
  pendingNew=null;
  closeSheet();endHover();
  workoutEditSnapshot=captureWorkoutEditSnapshot();
  $('moveEditorTitle').textContent=creatingNewMove?'Create new move':'Edit move';
  $('moveEditorSubtitle').textContent='Build the sequence first, then set timing, then finish the move.';
  $('moveEditorSubtitle').hidden=!creatingNewMove;
  $('warmupRow').hidden=creatingNewMove;
  $('deleteMoveOpen').hidden=creatingNewMove;
  const createOptions=$('createMoveOptions');
  createOptions.hidden=!creatingNewMove;
  {
    const profile=workoutProfiles[selectedWorkoutKey];
    $('includeWarmupPreset').checked=Boolean(profile?.includeWarmup);
    $('includeCooldownPreset').checked=Boolean(profile?.includeCooldown);
  }
  syncWarmupSwitch();
  if(creatingNewMove){
    $('useGlobalTiming').checked=true;
    $('useGlobalRestTiming').checked=true;
    const profile=workoutProfiles[selectedWorkoutKey];
    applyCreatePreset(profile?.preset||'movement',false);
  }
  $('movementCreator').hidden=true;
  setCreatorItemType('movement');
  updateMovementCreatorAvailability();
  updateGlobalTimingUI();
  tempoExperiment.hidden=true;
  tempoRevealBtn.setAttribute('aria-expanded','false');
  tempoRevealBtn.textContent='Don’t try this!';
  modal.classList.toggle('createMode',creatingNewMove);
  // The create-flow styles are written against the inner .modal, so mark it too.
  modal.querySelector('.modal').classList.toggle('createMode',creatingNewMove);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  fitEditorToScreen();
  if(creatingNewMove)enterCreateFlow();
}
function warmupIsOn(){
  const p=workoutProfiles[selectedWorkoutKey];
  return p?.customSequence?Boolean(p.includeWarmup):!p?.warmupOff;
}
function syncWarmupSwitch(){
  const on=warmupIsOn(),sw=$('warmupSwitch');
  sw.classList.toggle('on',on);sw.setAttribute('aria-checked',String(on));
}
$('warmupSwitch').addEventListener('click',()=>{
  const p=workoutProfiles[selectedWorkoutKey];
  if(!p)return;
  if(p.customSequence){$('includeWarmupPreset').checked=!p.includeWarmup;syncPremadeSequence()}
  else{p.warmupOff=!p.warmupOff;buildRoutine()}
  syncWarmupSwitch();
});
function closeWorkoutEditor(){
  closeSheet();endHover();
  unfitEditor();
  pendingNew=null;editingItem=null;
  if(modal.classList.contains('createMode'))leaveCreateFlow();
  modal.classList.remove('createMode');
  modal.querySelector('.modal').classList.remove('createMode');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
}
function restoreWorkoutEditSnapshot(){
  if(!workoutEditSnapshot)return;
  const s=workoutEditSnapshot;
  if(s.profile)workoutProfiles[s.key]=JSON.parse(JSON.stringify(s.profile));
  selectedWorkoutKey=s.key;
  warmup=cloneMovementList(s.warmup);
  strengthPool=cloneMovementList(s.strength);
  cooldown=cloneMovementList(s.cooldown);
  totalInput.value=s.total;workInput.value=s.work;restInput.value=s.rest;roundsInput.value=s.rounds||1;
  const profile=workoutProfiles[selectedWorkoutKey];
  if(profile){
    root.querySelectorAll('.workoutPanel[data-workout]').forEach(panel=>panel.classList.toggle('active',panel.dataset.workout===selectedWorkoutKey));
    const panel=root.querySelector('.workoutPanel.active');
    if(panel){
      const name=panel.querySelector('.workoutName');if(name)name.textContent=profile.name;
      const collapsed=panel.querySelector('.panelCollapsedText');if(collapsed)collapsed.textContent=profile.name;
      const source=panel.querySelector('.sourceTag');if(source)source.textContent=profile.source;
    }
    workoutNameInput.value=profile.name;
  }
  buildRoutine();
}
$('cancelWorkoutEdit').addEventListener('click',()=>{
  if(creatingNewMove){
    const doomed=selectedWorkoutKey;
    delete workoutProfiles[doomed];
    creatingNewMove=false;
    pendingNewMoveKey=null;
    setWorkoutProfile(store.order.find(k=>workoutProfiles[k])||Object.keys(workoutProfiles)[0]);
  }else{
    restoreWorkoutEditSnapshot();
  }
  closeWorkoutEditor();
});
$('saveWorkoutEdit').addEventListener('click',()=>{
  closeSheet();
  if(hovering)placeHoverAtEnd(); // a step still floating goes at the end rather than being lost
  const profile=workoutProfiles[selectedWorkoutKey];
  const name=workoutNameInput.value.trim()||'New move';
  if(profile)profile.name=name;
  discardPendingNew();editingItem=null;
  buildRoutine();

  if(creatingNewMove && profile){
    createMovePanel(selectedWorkoutKey,profile);
    root.querySelectorAll('.workoutPanel[data-workout]').forEach(panel=>panel.classList.toggle('active',panel.dataset.workout===selectedWorkoutKey));
    creatingNewMove=false;
    pendingNewMoveKey=null;
    if(!store.order.includes(selectedWorkoutKey))store.order.push(selectedWorkoutKey);
    showToast('Move created');
  }else{
    const panel=root.querySelector('.workoutPanel.active');
    if(panel){
      const nameEl=panel.querySelector('.workoutName');if(nameEl)nameEl.textContent=name;
      const collapsed=panel.querySelector('.panelCollapsedText');if(collapsed)collapsed.textContent=name;
    }
    showToast('Move saved');
  }

  workoutEditSnapshot=null;
  closeWorkoutEditor();
  persist();
});
modal.addEventListener('click',e=>{
  if(e.target===modal){
    if(creatingNewMove){
      const doomed=selectedWorkoutKey;
      delete workoutProfiles[doomed];
      creatingNewMove=false;
      pendingNewMoveKey=null;
      setWorkoutProfile(store.order.find(k=>workoutProfiles[k])||Object.keys(workoutProfiles)[0]);
    }else{
      restoreWorkoutEditSnapshot();
    }
    closeWorkoutEditor();
  }
});
bindAddDrag($('addMovementBtn'),'movement');
bindAddDrag($('addRestBtn'),'rest');
bindAddDrag($('addVideoBtn'),'video');
$('closeMovementCreator').addEventListener('click',()=>{
  $('movementCreator').hidden=true;
});
$('useGlobalTiming').addEventListener('change',updateGlobalTimingUI);
$('useGlobalRestTiming').addEventListener('change',updateGlobalTimingUI);
root.querySelectorAll('.createPresetBtn').forEach(btn=>btn.addEventListener('click',()=>{
  applyCreatePreset(btn.dataset.movePreset,true);
  buildRoutine();
}));
$('includeWarmupPreset').addEventListener('change',syncPremadeSequence);
$('includeCooldownPreset').addEventListener('change',syncPremadeSequence);
$('includeWarmupPreset').addEventListener('change',updateCreateStepSummaries);
$('includeCooldownPreset').addEventListener('change',updateCreateStepSummaries);
workoutNameInput.addEventListener('input',updateCreateStepSummaries);
workoutNameInput.addEventListener('input',updateSetupSummary);
$('confirmAddMovement').addEventListener('click',addMovement);
$('confirmAddRest').addEventListener('click',addMovement);
$('addMovementInput').addEventListener('keydown',e=>{if(e.key==='Enter')addMovement()});

/* workout */
const countdown=$('countdown'),countNum=$('countNum');
const countdownCanvas=$('countdownPixelCanvas');
let pixelAnimation=null,pixelResizeObserver=null,pixelMode='appear';
class CountdownPixel{
 constructor(canvas,ctx,x,y,color,speed,delay){
  this.width=canvas.width;this.height=canvas.height;this.ctx=ctx;this.x=x;this.y=y;this.color=color;
  this.speed=(Math.random()*.8+.1)*speed;this.size=0;this.sizeStep=Math.random()*.4;this.minSize=.5;this.maxSizeInteger=2;
  this.maxSize=Math.random()*(this.maxSizeInteger-this.minSize)+this.minSize;this.delay=delay;this.counter=0;
  this.counterStep=Math.random()*4+(this.width+this.height)*.01;this.isIdle=false;this.isReverse=false;this.isShimmer=false;
 }
 draw(){const o=this.maxSizeInteger*.5-this.size*.5;this.ctx.fillStyle=this.color;this.ctx.fillRect(this.x+o,this.y+o,this.size,this.size)}
 appear(){this.isIdle=false;if(this.counter<=this.delay){this.counter+=this.counterStep;return}if(this.size>=this.maxSize)this.isShimmer=true;if(this.isShimmer)this.shimmer();else this.size+=this.sizeStep;this.draw()}
 disappear(){this.isShimmer=false;this.counter=0;if(this.size<=0){this.isIdle=true;return}else this.size-=.1;this.draw()}
 shimmer(){if(this.size>=this.maxSize)this.isReverse=true;else if(this.size<=this.minSize)this.isReverse=false;this.size+=this.isReverse?-this.speed:this.speed}
}
let countdownPixels=[];
let countdownDrawWidth=1,countdownDrawHeight=1;
function appZoomFactor(){
 const z=parseFloat(getComputedStyle($("app")).zoom);
 return Number.isFinite(z)&&z>0?z:1;
}

function initCountdownPixels(){
 if(!countdownCanvas)return;
 const zoom=appZoomFactor();
 const width=Math.max(1,window.innerWidth/zoom),height=Math.max(1,window.innerHeight/zoom);
 countdownDrawWidth=width;
 countdownDrawHeight=height;
 const dpr=Math.min(window.devicePixelRatio||1,2);
 countdownCanvas.width=Math.floor(width*dpr);
 countdownCanvas.height=Math.floor(height*dpr);
 countdownCanvas.style.width=width+'px';
 countdownCanvas.style.height=height+'px';
 const ctx=countdownCanvas.getContext('2d');
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const colors=['#f2fbff','#d4effc','#a9e0fa','#6cc8f6'];
 const gap=12;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const speed=reduced?0:.055;
 countdownPixels=[];
 for(let x=0;x<width;x+=gap){
   for(let y=0;y<height;y+=gap){
     const dx=x-width/2,dy=y-height/2;
     const dist=Math.sqrt(dx*dx+dy*dy);
     const delay=reduced?0:(Math.random()*75+dist*.05);
     const px=new CountdownPixel({width,height},ctx,x,y,colors[Math.floor(Math.random()*colors.length)],speed,delay);
     px.maxSizeInteger=4;
     px.maxSize=Math.random()*3.2+.8;
     px.sizeStep=.35+Math.random()*.45;
     countdownPixels.push(px);
   }
 }
}
function animateCountdownPixels(mode){
 cancelAnimationFrame(pixelAnimation);pixelMode=mode;
 const ctx=countdownCanvas?.getContext('2d');if(!ctx)return;
 function frame(){
   ctx.clearRect(0,0,countdownDrawWidth,countdownDrawHeight);
   let allIdle=true;
   countdownPixels.forEach(px=>{px[pixelMode]();if(!px.isIdle)allIdle=false});
   if(!(pixelMode==='disappear'&&allIdle))pixelAnimation=requestAnimationFrame(frame);
 }
 pixelAnimation=requestAnimationFrame(frame);
}

function burstCountdownPixels(){
  cancelAnimationFrame(pixelAnimation);
  initCountdownPixels();
  animateCountdownPixels('appear');
  setTimeout(()=>animateCountdownPixels('disappear'),560);
}

window.addEventListener('resize',()=>{if(countdown.classList.contains('active'))burstCountdownPixels()});

/* PixelTrail-style workout background */
const trailCanvas=$('pixelTrailCanvas');
const trailCtx=trailCanvas.getContext('2d');
let trailEnabled=true,trailStrength=.7,trailMaxAge=600;
let trailPoints=[],trailRAF=null,trailLast={x:0,y:0,ready:false};
function sizeTrailCanvas(){
  const rect=workoutView.getBoundingClientRect(),zoom=appZoomFactor(),dpr=Math.min(window.devicePixelRatio||1,2);
  const width=Math.max(1,rect.width/zoom),height=Math.max(1,rect.height/zoom);
  trailCanvas.width=Math.max(1,Math.floor(width*dpr));
  trailCanvas.height=Math.max(1,Math.floor(height*dpr));
  trailCanvas.style.width=width+'px';trailCanvas.style.height=height+'px';
  trailCtx.setTransform(dpr,0,0,dpr,0,0);
}
function addTrailPoint(x,y){
  if(!trailEnabled)return;
  const now=performance.now();
  if(!trailLast.ready){trailLast={x,y,ready:true}}
  const steps=7;
  for(let i=1;i<=steps;i++){
    const t=i/steps;
    trailPoints.push({
      x:trailLast.x+(x-trailLast.x)*t,
      y:trailLast.y+(y-trailLast.y)*t,
      born:now-(steps-i)*10
    });
  }
  trailLast={x,y,ready:true};
}
function drawTrail(now){
  trailRAF=null;
  if(!alive)return;
  if(!views.workout.classList.contains('active')){trailRAF=requestAnimationFrame(drawTrail);return}
  const rect=workoutView.getBoundingClientRect(),zoom=appZoomFactor();
  trailCtx.clearRect(0,0,rect.width/zoom,rect.height/zoom);
  if(trailEnabled){
    const grid=14;
    trailPoints=trailPoints.filter(p=>now-p.born<trailMaxAge);
    trailCtx.fillStyle=$('app').classList.contains('light')?'#03A9F4':'#f4f4f4';
    trailPoints.forEach(p=>{
      const age=(now-p.born)/trailMaxAge;
      const a=(1-age)*trailStrength;
      const gx=Math.round(p.x/grid)*grid,gy=Math.round(p.y/grid)*grid;
      trailCtx.globalAlpha=Math.max(0,a);
      const s=2+5*(1-age)*trailStrength;
      trailCtx.fillRect(gx-s/2,gy-s/2,s,s);
    });
    trailCtx.globalAlpha=1;
  }
  trailRAF=requestAnimationFrame(drawTrail);
}
workoutView.addEventListener('pointermove',e=>{
  const r=workoutView.getBoundingClientRect(),zoom=appZoomFactor();
  addTrailPoint((e.clientX-r.left)/zoom,(e.clientY-r.top)/zoom);
});
workoutView.addEventListener('pointerleave',()=>trailLast.ready=false);
new ResizeObserver(sizeTrailCanvas).observe(workoutView);
sizeTrailCanvas();
trailRAF=requestAnimationFrame(drawTrail);

/* Ripple-grid-inspired movement animation */
const rippleCanvas=$('movementRippleCanvas');
const rippleCtx=rippleCanvas.getContext('2d');
let rippleEnabled=true,rippleRAF=null,rippleStarted=performance.now();
function sizeRippleCanvas(){
  const r=rippleCanvas.parentElement.getBoundingClientRect();
  const zoom=appZoomFactor();
  const width=Math.max(1,r.width/zoom),height=Math.max(1,r.height/zoom);
  const dpr=Math.min(window.devicePixelRatio||1,2);
  rippleCanvas.width=Math.max(1,Math.floor(width*dpr));
  rippleCanvas.height=Math.max(1,Math.floor(height*dpr));
  rippleCanvas.style.width=width+'px';
  rippleCanvas.style.height=height+'px';
  rippleCtx.setTransform(dpr,0,0,dpr,0,0);
}
// A rest phase after an exercise, or a rest step in a custom move.
function restingNow(){return isResting||routine[index]?.kind==='rest'}
function movementPulsePeriod(){
  const s=routine[index];
  if(restingNow())return 2200;
  if(!s)return 1600;
  if(s.kind==='warmup'||s.kind==='cooldown')return 2400;
  return 1350;
}
function drawRipple(now){
  rippleRAF=null;
  if(!alive)return;
  if(!views.workout.classList.contains('active')){rippleRAF=requestAnimationFrame(drawRipple);return}
  const r=rippleCanvas.parentElement.getBoundingClientRect();
  const zoom=appZoomFactor();
  const width=Math.max(1,r.width/zoom),height=Math.max(1,r.height/zoom);
  rippleCtx.clearRect(0,0,width,height);
  if(rippleEnabled){
    const period=movementPulsePeriod();
    const phase=((now-rippleStarted)%period)/period;
    const cols=15,rows=Math.max(8,Math.round(cols*height/Math.max(1,width)));
    const gapX=width/(cols+1),gapY=height/(rows+1);
    const cx=width*.5,cy=height*.52;
    const maxD=Math.hypot(cx,cy);
    const light=$('app').classList.contains('light');
    const base=light?'34,34,34':'244,244,244';
    for(let y=1;y<=rows;y++){
      for(let x=1;x<=cols;x++){
        const px=x*gapX,py=y*gapY;
        const d=Math.hypot(px-cx,py-cy)/maxD;
        const resting=restingNow();
        const restWave=resting
          ? Math.exp(-Math.pow((d-((phase*.82+.08)%1)*1.18)*5.5,2))
          : 0;
        const workWave=Math.exp(-Math.pow((d-phase*1.25)*7,2));
        const wave=resting?restWave:workWave;
        const beat=resting
          ? (.5+.5*Math.sin((phase*Math.PI*2)-d*3)**2)
          : (.35+.65*Math.sin((phase*Math.PI*2)-d*5)**2);
        const radius=resting ? 1.4+wave*4.2*beat : 1.2+wave*5*beat;
        rippleCtx.beginPath();
        rippleCtx.arc(px,py,radius,0,Math.PI*2);
        rippleCtx.fillStyle=`rgba(${base},${resting?0.08+wave*.48:0.05+wave*.55})`;
        rippleCtx.fill();
      }
    }
  }
  rippleRAF=requestAnimationFrame(drawRipple);
}
new ResizeObserver(sizeRippleCanvas).observe(rippleCanvas.parentElement);
sizeRippleCanvas();
rippleRAF=requestAnimationFrame(drawRipple);


const title=$('exerciseTitle'),meta=$('exerciseMeta'),stepLabel=$('stepLabel'),digits=$('digits'),fill=$('fill'),progress=$('progress'),pauseBtn=$('pause');


const nextName=$('nextName'),nextMeta=$('nextMeta'),nextIcon=$('nextIcon');
const skipNextSession=$('skipNextSession');
let immediateNextItem=null;
function nextVisibleRoutineIndex(fromIndex){
  for(let i=Math.max(0,fromIndex);i<routine.length;i++){
    if(!routine[i].sessionHidden)return i;
  }
  return -1;
}
function getNextPart(){
  const current=routine[index];
  if(!current)return{name:'Complete',meta:'Move finished',icon:'check'};
  if(isResting){
    const ni=nextVisibleRoutineIndex(index+1);
    const n=ni>=0?routine[ni]:null;
    return n?{name:n.name,meta:partMeta(n),icon:futureIcon(n)}:{name:'Complete',meta:'Move finished',icon:'check'};
  }
  if(current.rest>0)return{name:'Rest',meta:current.rest+' sec · '+(current.roundBreakAfter?'round '+(current.round+1)+' next':'recovery'),icon:'pause'};
  const ni=nextVisibleRoutineIndex(index+1);
  const n=ni>=0?routine[ni]:null;
  return n?{name:n.name,meta:partMeta(n),icon:futureIcon(n)}:{name:'Complete',meta:'Move finished',icon:'check'};
}
function getFutureExerciseStartIndex(){
  const current=routine[index];
  if(!current)return routine.length;
  const nextIndex=nextVisibleRoutineIndex(index+1);
  if(nextIndex<0)return routine.length;
  return nextIndex+1;
}
function futureIcon(item){
  return item.kind==='video'?'play':'clock';
}
function partMeta(n){return n.kind==='video'?'YouTube · '+clock(n.duration):n.group+' · '+n.duration+' sec'}
function totalRounds(){return routine.length?routine[routine.length-1].round||1:1}
function stepText(i){
  const s=routine[i];
  if(!s)return '';
  const rounds=totalRounds();
  if(rounds<=1)return 'Step '+(i+1)+' of '+routine.length;
  if(s.roundBreak)return 'Round '+s.round+' of '+rounds+' · Rest';
  const inRound=routine.filter(x=>x.round===s.round&&!x.roundBreak).length;
  return 'Round '+s.round+' of '+rounds+' · Step '+(s.roundIndex+1)+' of '+inRound;
}
function activeSegment(){return progress.querySelector('[data-step="'+index+'"]')}
function refreshProgressState(){
  // The bar shows the current round; rebuild it when a new round starts.
  if(routine[index]&&Number(progress.dataset.round)!==(routine[index].round||1))makeProgress();
  [...progress.children].forEach(el=>{
    const i=Number(el.dataset.step);
    el.classList.toggle('done',i<index);
    el.classList.toggle('active',i===index);
    el.classList.toggle('rewindable',i<=index);
    el.disabled=i>index;
    if(i===index)el.style.setProperty('--segment-progress','0%');
  });
  if(routine[index]){
    stepLabel.textContent=stepText(index);
    updateTimer();
  }
}
function skipFutureExercise(item){
  const skipIndex=routine.indexOf(item);
  if(skipIndex<0 || skipIndex<=index)return;
  item.sessionHidden=!item.sessionHidden;
  updateNextCard();
  showToast((item.sessionHidden?'Hidden ':'Included ')+item.name+' for this session');
}
function renderUpcomingExercises(){
  const list=$('upcomingList');
  if(!list)return;
  list.innerHTML='';
  const start=getFutureExerciseStartIndex();
  const future=routine.slice(start);
  const visibleFuture=upcomingVisibleCount==='all'?future:future.slice(0,Math.max(1,Number(upcomingVisibleCount)||1));
  visibleFuture.forEach(item=>{
    const card=document.createElement('section');
    card.className='upcomingCard'+(item.sessionHidden?' sessionHidden':'')+(metaHidden(item)?' noMeta':'');
    card.innerHTML=
      '<div class="upcomingInfo">'+
        '<div class="upcomingIcon" aria-hidden="true">'+icon(futureIcon(item))+'</div>'+
        '<div><div class="upcomingName">'+esc(item.name)+'</div>'+
        '<div class="upcomingMeta">'+esc(partMeta(item))+(totalRounds()>1?' · round '+item.round:'')+'</div></div>'+
      '</div>'+
      '<button class="skipSessionBtn" type="button">'+(item.sessionHidden?'Include this session':'Skip this session')+'</button>';
    card.querySelector('.skipSessionBtn').addEventListener('click',()=>skipFutureExercise(item));
    list.appendChild(card);
  });
}
function updateNextCard(){
  const p=getNextPart();
  nextName.textContent=p.name;
  nextMeta.textContent=p.meta;
  nextIcon.innerHTML=icon(p.icon);
  {const n=isResting?routine[nextVisibleRoutineIndex(index+1)]:(routine[index]?.rest>0?{kind:'rest'}:routine[nextVisibleRoutineIndex(index+1)]);
   root.querySelector('.nextCard').classList.toggle('noMeta',Boolean(n&&metaHidden(n)))}

  immediateNextItem=null;
  if(isResting){
    const ni=nextVisibleRoutineIndex(index+1);
    if(ni>=0)immediateNextItem=routine[ni];
  }else{
    const current=routine[index];
    if(current && current.rest>0){
      immediateNextItem=null;
    }else{
      const ni=nextVisibleRoutineIndex(index+1);
      if(ni>=0)immediateNextItem=routine[ni];
    }
  }

  if(skipNextSession){
    skipNextSession.hidden=!immediateNextItem;
    skipNextSession.textContent=immediateNextItem?.sessionHidden?'Include this session':'Skip this session';
  }
  renderUpcomingExercises();
}

skipNextSession.addEventListener('click',()=>{
  if(!immediateNextItem)return;
  immediateNextItem.sessionHidden=!immediateNextItem.sessionHidden;
  showToast((immediateNextItem.sessionHidden?'Hidden ':'Included ')+immediateNextItem.name+' for this session');
  updateNextCard();
});

/* session log + Home Assistant events */
let session=null,sessionClock=null;
function moveEvent(action,extra={}){
  const profile=workoutProfiles[selectedWorkoutKey];
  bridge.fire(action,{move:profile?.name||'',move_id:selectedWorkoutKey,...extra});
}
function beginSession(){
  const profile=workoutProfiles[selectedWorkoutKey];
  session={key:selectedWorkoutKey,name:profile?.name||'Move',startedAt:Date.now(),active:0};
  clearInterval(sessionClock);
  sessionClock=setInterval(()=>{if(session&&!paused)session.active++},1000);
  moveEvent('started',{steps:routine.length});
}
function finishSession(completed){
  clearInterval(sessionClock);
  if(!session)return;
  const s=session;session=null;
  moveEvent(completed?'completed':'ended',{seconds:s.active});
  if(s.active<30)return;
  store.history.unshift({id:'h-'+s.startedAt,move_id:s.key,name:s.name,start:new Date(s.startedAt).toISOString(),seconds:s.active,completed});
  store.history=store.history.slice(0,1000);
  persist();
  renderWeek();
  renderInsights();
}

/* ---- sound cues: so you can follow a move without looking ----
   Tones are made in the browser. The Start move tap switches audio on (browsers need a tap first). */
let soundCtx=null,lastCueSecond=null,quietNextStep=false;
function soundsOn(){return settings().sounds!==false}
function unlockSound(){
 if(!soundsOn())return;
 try{
   // play through the iPhone silent switch, like a workout timer
   if(navigator.audioSession)navigator.audioSession.type='playback';
   soundCtx=soundCtx||new (window.AudioContext||window.webkitAudioContext)();
   if(soundCtx.state==='suspended')soundCtx.resume();
 }catch(_){soundCtx=null}
}
function tone(freq,at,dur,{to=freq,vol=.25,type='sine'}={}){
 const t=soundCtx.currentTime+at,osc=soundCtx.createOscillator(),gain=soundCtx.createGain();
 osc.type=type;
 osc.frequency.setValueAtTime(freq,t);
 if(to!==freq)osc.frequency.exponentialRampToValueAtTime(to,t+dur);
 gain.gain.setValueAtTime(0.0001,t);
 gain.gain.exponentialRampToValueAtTime(vol,t+.01);
 gain.gain.exponentialRampToValueAtTime(0.0001,t+dur);
 osc.connect(gain).connect(soundCtx.destination);
 osc.start(t);osc.stop(t+dur+.02);
}
const CUES={
 tick:()=>tone(880,0,.07,{vol:.18}),
 move:()=>{tone(660,0,.12,{type:'triangle',vol:.3});tone(990,.13,.16,{type:'triangle',vol:.3})},
 rest:()=>tone(660,0,.4,{to:440,vol:.22}),
 done:()=>{tone(523,0,.16,{type:'triangle'});tone(659,.16,.16,{type:'triangle'});tone(784,.32,.4,{type:'triangle'})}
};
function cue(name){
 if(!soundsOn()||!soundCtx)return;
 try{if(soundCtx.state==='suspended')soundCtx.resume();CUES[name]()}catch(_){}
}
// three ticks before a move or rest ends
function cueCountdown(){
 if(seconds>=1&&seconds<=3&&seconds!==lastCueSecond){lastCueSecond=seconds;cue('tick')}
}

function showWorkout(){
 unlockSound();
 showView('workout');startCountdown();
 const first=nextVisibleRoutineIndex(0);
 if(first>=0&&routine[first].kind==='video')prepareVideo(routine[first]);
}
function showHome(){stopVideo();finishSession(false);clearInterval(timer);clearInterval(countTimer);isResting=false;setPaused(false);$('app').classList.remove('resting');countdown.classList.remove('active');showView('home')}
function startCountdown(){
 countdown.classList.add('active');
 let n=5;
 countNum.textContent=n;
 cue('tick');
 requestAnimationFrame(burstCountdownPixels);
 clearInterval(countTimer);
 countTimer=setInterval(()=>{
   n--;
   if(n>0){
     countNum.textContent=n;
     cue('tick');
     burstCountdownPixels();
   }else{
     clearInterval(countTimer);
     countNum.textContent='GO';
     cue('move');quietNextStep=true;
     burstCountdownPixels();
     setTimeout(()=>{
       countdown.classList.remove('active');
       cancelAnimationFrame(pixelAnimation);
       startRoutine();
     },650);
   }
 },1000)
}
function makeProgress(){
 progress.innerHTML='';
 const round=(routine[Math.max(0,index)]||routine[0])?.round||1;
 progress.dataset.round=round;
 routine.forEach((step,stepIndex)=>{
   if((step.round||1)!==round)return;
   const seg=document.createElement('button');
   seg.dataset.step=stepIndex;
   seg.type='button';
   seg.className='progressSegment';
   seg.setAttribute('aria-label','Go to '+step.name);
   seg.addEventListener('click',()=>{
     if(stepIndex<=index)rewindToStep(stepIndex);
   });
   progress.appendChild(seg);
 });
}

// One place decides whether the move is paused. The Pause button, the blue screen, the timer
// and a playing video all follow it, whichever control changed it.
function setPaused(on){
 on=Boolean(on);
 const changed=paused!==on;
 paused=on;
 pauseBtn.textContent=on?'Resume':'Pause';
 $('app').classList.toggle('paused',on);
 if(ytActive&&yt){try{on?yt.pauseVideo():yt.playVideo()}catch(_){}}
 if(changed&&session)moveEvent(on?'paused':'resumed');
}
function rewindToStep(stepIndex){
 if(stepIndex<0 || stepIndex>=routine.length || stepIndex>index)return;
 clearInterval(timer);
 isResting=false;
 $('app').classList.remove('resting');
 index=stepIndex;
 setPaused(false);
 loadStep();
 timer=setInterval(tick,1000);
}
function startRoutine(){
 index=nextVisibleRoutineIndex(0);
 setPaused(false);makeProgress();
 if(index<0){title.textContent='No activities';meta.textContent='Open Edit and enable or add a movement';meta.hidden=false;return}
 beginSession();
 loadStep();clearInterval(timer);timer=setInterval(tick,1000)
}
/* ---- YouTube video steps ----
   A video step plays in the right-hand third of the workout screen. During the step before it
   the video is loaded muted and held at its start, so it plays the moment its step begins. */
const videoStage=$('videoStage'),videoSound=$('videoSound');
const YT_ENDED=0,YT_PLAYING=1,YT_PAUSED=2;
let ytQuietUntil=0; // ignore the pause the player reports while we start or seek it
let ytApi=null,ytReady=null,yt=null,ytCued=null,ytCuedStart=0,ytPrimed=false,ytActive=null,ytSoundCheck=null;
function loadYouTubeApi(){
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(ytApi)return ytApi;
  ytApi=new Promise((resolve,reject)=>{
    const prev=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{try{prev?.()}catch(_){}};
    const poll=setInterval(()=>{if(window.YT?.Player){clearInterval(poll);clearTimeout(give);resolve(window.YT)}},100);
    const give=setTimeout(()=>{clearInterval(poll);ytApi=null;reject(new Error('YouTube did not load'))},15000);
    if(!document.querySelector('script[src*="youtube.com/iframe_api"]')){
      const tag=document.createElement('script');
      tag.src='https://www.youtube.com/iframe_api';tag.async=true;
      tag.onerror=()=>{clearInterval(poll);clearTimeout(give);ytApi=null;reject(new Error('YouTube did not load'))};
      document.head.appendChild(tag);
    }
  });
  return ytApi;
}
function ytPlayer(){
  if(ytReady)return ytReady;
  ytReady=loadYouTubeApi().then(YT=>new Promise(resolve=>{
    const host=document.createElement('div');
    $('videoFrame').appendChild(host);
    yt=new YT.Player(host,{width:'100%',height:'100%',
      playerVars:{playsinline:1,rel:0,iv_load_policy:3,modestbranding:1},
      events:{onReady:()=>resolve(yt),onStateChange:e=>onVideoState(e.data),onError:e=>onVideoError(e.data)}});
  }));
  ytReady.catch(()=>{ytReady=null});
  return ytReady;
}
// Load the next video quietly so there's no wait when its step starts.
function prepareVideo(item){
  if(!item?.videoId||item.videoError)return;
  ytPlayer().then(p=>{
    if(ytActive||ytCued===item.videoId)return;
    ytCued=item.videoId;ytCuedStart=Number(item.start)||0;ytPrimed=false;
    p.mute();
    p.loadVideoById({videoId:item.videoId,startSeconds:ytCuedStart});
  }).catch(()=>{});
}
function prepareUpcomingVideo(){
  const ni=nextVisibleRoutineIndex(index+1);
  if(ni>=0&&routine[ni].kind==='video')prepareVideo(routine[ni]);
}
function onVideoState(state){
  if(!ytActive){
    // buffered while preparing: hold it at the start, ready to go
    if(state===YT_PLAYING&&!ytPrimed){ytPrimed=true;yt.pauseVideo();yt.seekTo(ytCuedStart,true)}
    return;
  }
  videoStage.classList.toggle('playing',state===YT_PLAYING);
  // tapping play or pause on the video itself pauses or resumes the whole move
  if(routine[index]===ytActive&&performance.now()>ytQuietUntil){
    if(state===YT_PLAYING&&paused)setPaused(false);
    else if(state===YT_PAUSED&&!paused)setPaused(true);
  }
  if(state===YT_PLAYING&&rememberVideoLength(ytActive.videoId,yt.getDuration()))persist();
  if(state===YT_ENDED)videoFinished();
}
function onVideoError(code){
  const item=ytActive;
  if(!item){ytCued=null;return}
  if(code===101||code===150){markVideoError(item.videoId);showToast('That video can’t play outside YouTube, so it was skipped')}
  else showToast('The video couldn’t play, so it was skipped');
  videoFinished();
}
function playVideoStep(item){
  $('app').classList.add('videoStep');
  videoSound.hidden=true;
  ytActive=item;
  clearTimeout(ytSoundCheck);
  if(!item.videoId){showToast('This video step has no link yet, so it was skipped');setTimeout(()=>videoFinished(),0);return}
  ytPlayer().then(p=>{
    if(ytActive!==item)return;
    ytQuietUntil=performance.now()+1500;
    const start=Number(item.start)||0;
    if(ytCued!==item.videoId){ytCued=item.videoId;ytCuedStart=start;p.loadVideoById({videoId:item.videoId,startSeconds:start})}
    else{p.seekTo(start,true);p.playVideo()}
    p.unMute();
    if(paused)p.pauseVideo();
    // Some browsers only allow sound after a tap: play muted instead and offer a button.
    ytSoundCheck=setTimeout(()=>{
      if(ytActive!==item||paused)return;
      if(p.getPlayerState()!==YT_PLAYING){p.mute();p.playVideo();videoSound.hidden=false}
      else if(p.isMuted())videoSound.hidden=false;
    },1600);
  }).catch(()=>{if(ytActive!==item)return;showToast('YouTube didn’t load, so the video was skipped');videoFinished()});
}
// Theater mode height: whatever is left between the top of the video row and the controls
// at the bottom of the screen.
function fitTheater(){
  if(!$('app').classList.contains('videoStep'))return;
  const grid=root.querySelector('.workGrid'),controls=root.querySelector('.sessionControlRow');
  const top=grid.getBoundingClientRect().top,controlsH=controls?.offsetHeight||42;
  const avail=window.innerHeight-top-16-controlsH-84; // 84: room for the floating nav buttons
  grid.style.setProperty('--theater-h',Math.max(240,Math.round(avail))+'px');
}
window.addEventListener('resize',fitTheater);
function stopVideo(){
  clearTimeout(ytSoundCheck);
  const was=ytActive;ytActive=null;
  $('app').classList.remove('videoStep');videoStage.classList.remove('playing');videoSound.hidden=true;
  if(was&&yt){try{yt.pauseVideo()}catch(_){}ytCued=null}
}
function videoFinished(){
  const item=ytActive;
  if(!item||routine[index]!==item)return;
  stopVideo();
  clearInterval(timer);advance();timer=setInterval(tick,1000);
}
videoSound.addEventListener('click',()=>{if(yt){yt.unMute();yt.playVideo()}videoSound.hidden=true});
// When the video step ends: the link's end time, your own length, or the end of the video.
function videoEndAt(s){
  const start=Number(s.start)||0;
  if(s.useVideoLength===false)return start+(Number(s.duration)||300);
  const live=yt&&ytActive===s?Number(yt.getDuration?.())||0:0;
  return Number(s.end)||live||Number(s.videoDuration)||start+(Number(s.duration)||300);
}
function eachVideoItem(videoId,fn){
  const profile=workoutProfiles[selectedWorkoutKey];
  [warmup,strengthPool,cooldown,profile?.warmup,profile?.strength,profile?.cooldown,profile?.sequence]
    .forEach(list=>(Array.isArray(list)?list:[]).forEach(x=>{if(x&&x.kind==='video'&&x.videoId===videoId)fn(x)}));
}
function rememberVideoLength(videoId,sec){
  sec=Math.round(Number(sec)||0);let changed=false;
  if(videoId&&sec>0)eachVideoItem(videoId,x=>{if(x.videoDuration!==sec){x.videoDuration=sec;changed=true}});
  return changed;
}
function markVideoError(videoId){eachVideoItem(videoId,x=>{x.videoError='embed'});persist()}
// Title (for the name) and length, fetched once when a link is saved.
function fetchVideoDetails(item){
  const id=item.videoId;if(!id)return;
  const refresh=()=>{
    if(!modal.classList.contains('open')){buildRoutine();persist()}
    else if(!editingItem)buildRoutine();
  };
  fetch('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent('https://www.youtube.com/watch?v='+id))
    .then(r=>r.ok?r.json():Promise.reject(r.status))
    .then(d=>{if(item.videoId!==id)return;item.videoTitle=d.title||'';if(item.autoName&&d.title)item.name=d.title;refresh()})
    .catch(status=>{if(item.videoId===id&&status===401){item.videoError='embed';refresh()}});
  probeVideoLength(id)
    .then(sec=>{if(rememberVideoLength(id,sec))refresh()})
    .catch(err=>{if(err==='embed'&&item.videoId===id){item.videoError='embed';refresh()}});
}
// A throwaway player off-screen, just to read the video's length.
function probeVideoLength(id){
  return loadYouTubeApi().then(YT=>new Promise((resolve,reject)=>{
    const box=document.createElement('div');box.className='videoProbe';box.setAttribute('aria-hidden','true');
    const host=document.createElement('div');box.appendChild(host);$('app').appendChild(box);
    let p=null,settled=false;
    const finish=(sec,err)=>{
      if(settled)return;settled=true;clearTimeout(timeout);
      setTimeout(()=>{try{p?.destroy()}catch(_){}box.remove()},0);
      err?reject(err):resolve(sec);
    };
    const timeout=setTimeout(()=>finish(0),20000);
    const read=()=>{const d=Number(p?.getDuration?.())||0;if(d>0)finish(d);return d>0};
    p=new YT.Player(host,{width:320,height:180,videoId:id,playerVars:{playsinline:1,mute:1,controls:0},
      events:{
        onReady:()=>{if(!read()){p.mute();p.playVideo()}},
        onStateChange:()=>read(),
        onError:e=>finish(0,(e.data===101||e.data===150)?'embed':'error')
      }});
  }));
}

function loadStep(){
 isResting=false;
 const s=routine[index];
 $('app').classList.toggle('resting',s.kind==='rest');
 if(s.kind==='video')playVideoStep(s);else stopVideo();
 seconds=s.duration;
 totalPhase=s.duration;
 lastCueSecond=null;
 if(quietNextStep)quietNextStep=false;else cue(s.kind==='rest'?'rest':'move');
 title.textContent=s.name;
 meta.textContent=s.group;
 meta.hidden=true;
 stepLabel.textContent=stepText(index);
 if(session)moveEvent('step',{name:s.name,group:s.group,kind:s.kind,step:index+1,of:routine.length,round:s.round||1,rounds:totalRounds(),duration:s.duration});
 updateNextCard();
 refreshProgressState();
 prepareUpcomingVideo();
 if(s.kind==='video')setTimeout(fitTheater,0);
}
function updateTimer(){
 const isVideo=routine[index]?.kind==='video'&&!isResting;
 const asClock=isVideo&&seconds>=60;
 digits.textContent=asClock?clock(seconds):seconds;
 digits.classList.toggle('long',asClock);
 // in theater mode the big digits make way for the video; the time left sits by the controls
 if(isVideo)$('videoClock').textContent=clock(seconds)+' left';
 const remainingPct=(seconds/totalPhase)*100;
 fill.style.width=remainingPct+'%';
 const activeSeg=activeSegment();
 if(activeSeg&&!isResting){
   const completedPct=100-remainingPct;
   activeSeg.style.setProperty('--segment-progress',completedPct+'%');
 }
}
function tick(){
 if(paused)return;
 const s=routine[index];
 // a video step follows the video itself
 if(s?.kind==='video'&&!isResting&&ytActive===s){
   const t=Number(yt?.getCurrentTime?.())||0,start=Number(s.start)||0,end=videoEndAt(s);
   totalPhase=Math.max(1,end-start);
   if(t>start||yt?.getPlayerState?.()===YT_PLAYING)seconds=Math.max(0,Math.ceil(end-t));
   updateTimer();cueCountdown();
   if(t>start&&t>=end-.25)videoFinished();
   return;
 }
 seconds--;updateTimer();cueCountdown();if(seconds<=0){if(s.rest>0)startRest(s.rest);else advance()}
}
function startRest(restSec){
 isResting=true;$('app').classList.add('resting');
 const activeSeg=activeSegment();if(activeSeg)activeSeg.style.setProperty('--segment-progress','100%');
 clearInterval(timer);seconds=restSec;totalPhase=restSec;lastCueSecond=null;cue('rest');if(session)moveEvent('rest',{duration:restSec});title.textContent='Rest';meta.textContent=routine[index]?.roundBreakAfter?'Round '+(routine[index].round+1)+' next':'Recovery';updateNextCard();updateTimer();
 timer=setInterval(()=>{if(paused)return;seconds--;updateTimer();cueCountdown();if(seconds<=0){clearInterval(timer);advance();timer=setInterval(tick,1000)}},1000)
}
function advance(){
 isResting=false;
 const nextIndex=nextVisibleRoutineIndex(index+1);
 if(nextIndex>=0){
   index=nextIndex;
   loadStep();
 }else{
   clearInterval(timer);
   stopVideo();
   setPaused(false);
   $('app').classList.remove('resting');
   title.textContent='Complete';meta.textContent='Move finished';meta.hidden=false;digits.textContent='✓';
   {const rounds=totalRounds();stepLabel.textContent=rounds>1?rounds+' rounds done':routine.filter(x=>!x.roundBreak).length+' steps done';}
   finishSession(true);
   cue('done');
   {const wk=dailySeries(7).reduce((a,d)=>a+d.minutes,0);meta.textContent='Move finished · '+wk+' min in the last 7 days';}
   fill.style.width='100%';updateNextCard();
 }
}


/* workout controls */
// Skipping always carries on: if the move was paused, the next step starts running.
$('skipExercise').addEventListener('click',()=>{skipStep();setPaused(false)});
function skipStep(){
 clearInterval(timer);
 const current=routine[index];

 if(isResting){
   isResting=false;
   $('app').classList.remove('resting');
   const nextIndex=nextVisibleRoutineIndex(index+1);
   if(nextIndex>=0){
     index=nextIndex;
     loadStep();
     timer=setInterval(tick,1000);
   }else{
     advance();
   }
   return;
 }

 if(current && current.rest>0){
   startRest(current.rest);
   return;
 }

 const nextIndex=nextVisibleRoutineIndex(index+1);
 if(nextIndex>=0){
   index=nextIndex;
   loadStep();
   timer=setInterval(tick,1000);
 }else{
   advance();
 }
}


$('restartSegment').addEventListener('click',()=>{
 clearInterval(timer);
 setPaused(false);
 if(isResting){
   const current=routine[index];
   seconds=current.rest;
   totalPhase=current.rest;
   lastCueSecond=null;cue('rest');
   title.textContent='Rest';
   meta.textContent='Recovery';
   $('app').classList.add('resting');
   updateNextCard();
   updateTimer();
 }else{
   loadStep();
 }
 timer=setInterval(isResting?()=>{if(paused)return;seconds--;updateTimer();cueCountdown();if(seconds<=0){clearInterval(timer);advance();timer=setInterval(tick,1000)}}:tick,1000);
});

function bindFuseHold(button,fill,duration,onComplete){
  let start=0,frame=null,holding=false;
  function reset(){
    if(frame)cancelAnimationFrame(frame);
    frame=null;start=0;holding=false;
    fill.style.width='0%';
    button.classList.remove('holding');
  }
  function step(ts){
    if(!holding)return;
    if(!start)start=ts;
    const p=Math.min(1,(ts-start)/duration);
    fill.style.width=(p*100)+'%';
    if(p>=1){
      holding=false;
      if(frame)cancelAnimationFrame(frame);
      frame=null;
      fill.style.width='100%';
      setTimeout(()=>fill.style.width='0%',90);
      onComplete();
      return;
    }
    frame=requestAnimationFrame(step);
  }
  function begin(e){
    if(e && e.button!==undefined && e.button!==0)return;
    e?.preventDefault();
    reset();
    holding=true;
    button.classList.add('holding');
    try{button.setPointerCapture?.(e.pointerId)}catch(_){}
    frame=requestAnimationFrame(step);
  }
  function cancel(){
    if(!holding)return;
    reset();
  }
  button.addEventListener('pointerdown',begin);
  button.addEventListener('pointerup',cancel);
  button.addEventListener('pointercancel',cancel);
  button.addEventListener('lostpointercapture',cancel);
  button.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat)begin(e)});
  button.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')cancel()});
}

const endWorkoutBtn=$('endWorkout');
bindFuseHold(endWorkoutBtn,$('holdEndFill'),1500,showHome);


const deleteMoveConfirm=$('deleteMoveConfirm');
$('deleteMoveOpen').addEventListener('click',()=>{
  deleteMoveConfirm.classList.add('open');
  deleteMoveConfirm.setAttribute('aria-hidden','false');
});
$('deleteMoveCancel').addEventListener('click',()=>{
  deleteMoveConfirm.classList.remove('open');
  deleteMoveConfirm.setAttribute('aria-hidden','true');
});
function deleteSelectedMove(){
  const key=selectedWorkoutKey;
  const panel=root.querySelector('.workoutPanel[data-workout="'+key+'"]');
  if(panel)panel.remove();
  delete workoutProfiles[key];

  store.order=store.order.filter(k=>k!==key);
  let nextPanel=root.querySelector('.workoutPanel[data-workout]');
  if(!nextPanel){
    const newKey='custom-'+Date.now();
    workoutProfiles[newKey]={name:'New move',source:'Custom routine',total:20,work:45,rest:15,customSequence:true,preset:'movement',sequence:[],strength:[]};
    store.order.push(newKey);
    nextPanel=createMovePanel(newKey,workoutProfiles[newKey]);
  }

  deleteMoveConfirm.classList.remove('open');
  deleteMoveConfirm.setAttribute('aria-hidden','true');
  workoutEditSnapshot=null;
  closeWorkoutEditor();
  setWorkoutProfile(nextPanel.dataset.workout);
  persist();
  showToast('Move deleted');
}
bindFuseHold($('deleteMoveYes'),$('deleteMoveFill'),1500,deleteSelectedMove);

/* settings */
const rubberTabs=root.querySelector('.rubberTabs');
const rubberIndicator=$('rubberIndicator');
function positionRubberIndicator(tab,animate=true){
 if(!tab||!rubberTabs||!rubberIndicator)return;
 const host=rubberTabs.getBoundingClientRect();
 const rect=tab.getBoundingClientRect();
 rubberIndicator.style.transition=animate?'left .34s cubic-bezier(.2,1.35,.4,1),width .34s cubic-bezier(.2,1.35,.4,1),transform .18s ease':'none';
 const zoom=appZoomFactor();
 rubberIndicator.style.left=((rect.left-host.left)/zoom+rubberTabs.scrollLeft)+'px';
 rubberIndicator.style.width=(rect.width/zoom)+'px';
 if(animate){
   rubberIndicator.style.transform='scaleX(1.08)';
   setTimeout(()=>rubberIndicator.style.transform='scaleX(1)',180);
 }
}
root.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
 tab.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});
 root.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
 root.querySelectorAll('.settingsPane').forEach(p=>p.classList.remove('active'));
 tab.classList.add('active');
 $(tab.dataset.pane).classList.add('active');
 positionRubberIndicator(tab,true);
}));
requestAnimationFrame(()=>positionRubberIndicator(root.querySelector('.tab.active'),false));
window.addEventListener('resize',()=>positionRubberIndicator(root.querySelector('.tab.active'),false));
const pixelTrailToggle=$('pixelTrailToggle');
const rippleToggle=$('rippleToggle');
const trailStrengthInput=$('trailStrength');
const trailLifeInput=$('trailLife');

function saveSetting(key,value){settings()[key]=value;persist()}

/* ---- second line on phones: hide the small line under a step's name, per type ---- */
const KIND_ORDER=['Warm-up','Movement','Cooldown','Rest','Video'];
function typeKey(x){
  if(x.kind==='rest')return 'rest';
  if(x.kind==='video')return 'video';
  return 'g:'+String(x.group||'').trim().toLowerCase();
}
function metaHidden(x){return Boolean(settings().hideMeta?.[typeKey(x)])}
function collectTypes(){
  const map=new Map();
  const add=(x,listKind,moveName)=>{
    if(!x)return;
    if(Array.isArray(x))x={name:x[1],group:x[2],kind:'work'};
    const key=typeKey(x);
    let t=map.get(key);
    if(!t){t={key,label:key==='rest'?'Rest':key==='video'?'Video':(String(x.group||'').trim()||'No type'),kinds:new Set(),moves:new Set(),count:0};map.set(key,t)}
    t.kinds.add(key==='rest'?'Rest':key==='video'?'Video':listKind);t.moves.add(moveName);t.count++;
  };
  Object.values(workoutProfiles).forEach(p=>{
    const name=p.name||'Move';
    (p.warmup||(p.customSequence?[]:defaultWarmup)).forEach(x=>add(x,'Warm-up',name));
    (p.customSequence?(p.sequence||[]):(p.strength||[])).forEach(x=>add(x,x.presetRole==='warmup'?'Warm-up':x.presetRole==='cooldown'?'Cooldown':'Movement',name));
    (p.cooldown||(p.customSequence?[]:defaultCooldown)).forEach(x=>add(x,'Cooldown',name));
  });
  // rests and videos are always listed, so they can be set before you add one
  [['rest','Rest'],['video','Video']].forEach(([key,label])=>{if(!map.has(key))map.set(key,{key,label,kinds:new Set([label]),moves:new Set(),count:0})});
  return [...map.values()]
    .map(t=>({...t,kind:t.kinds.has('Movement')?'Movement':[...t.kinds][0],moves:[...t.moves]}))
    .sort((a,b)=>KIND_ORDER.indexOf(a.kind)-KIND_ORDER.indexOf(b.kind)||a.label.localeCompare(b.label));
}
let metaKind='all';
function visibleTypes(){
  const q=$('metaSearch').value.trim().toLowerCase();
  return collectTypes().filter(t=>(metaKind==='all'||t.kind===metaKind)&&(!q||t.label.toLowerCase().includes(q)||t.moves.some(m=>m.toLowerCase().includes(q))));
}
function renderMetaTable(){
  const body=$('metaTableBody');if(!body)return;
  const hidden=settings().hideMeta||{},rows=visibleTypes();
  body.innerHTML=rows.length?'':'<tr class="metaEmpty"><td colspan="4">No types match</td></tr>';
  rows.forEach(t=>{
    const on=!hidden[t.key];
    const used=!t.count?'Not used yet':(t.moves.length>2?t.moves.slice(0,2).join(', ')+' + '+(t.moves.length-2)+' more':t.moves.join(', '))+' · '+t.count+' step'+(t.count===1?'':'s');
    const tr=document.createElement('tr');tr.className=on?'':'off';
    tr.innerHTML='<td><div class="metaType">'+esc(t.label)+'</div><div class="metaSub">'+esc(t.kind+' · '+used)+'</div></td>'+
      '<td class="metaKindCol">'+esc(t.kind)+'</td><td class="metaUsedCol">'+esc(used)+'</td>'+
      '<td class="metaSwitchCol"><button class="switch'+(on?' on':'')+'" type="button" role="switch" aria-checked="'+on+'" aria-label="Second line for '+esc(t.label)+' on phones"></button></td>';
    tr.querySelector('.switch').addEventListener('click',()=>setMetaHidden([t.key],on));
    body.appendChild(tr);
  });
  const off=rows.filter(t=>hidden[t.key]).length;
  $('metaCount').textContent=rows.length?rows.length+' type'+(rows.length===1?'':'s')+(off?' · '+off+' hidden on phones':''):'';
}
function setMetaHidden(keys,hide){
  const next={...(settings().hideMeta||{})};
  keys.forEach(k=>{if(hide)next[k]=true;else delete next[k]});
  saveSetting('hideMeta',next);
  renderMetaTable();renderLists();updateNextCard();
}
$('metaSearch').addEventListener('input',renderMetaTable);
$('metaKinds').querySelectorAll('.kindChip').forEach(b=>b.addEventListener('click',()=>{
  metaKind=b.dataset.kind;
  $('metaKinds').querySelectorAll('.kindChip').forEach(c=>c.classList.toggle('active',c===b));
  renderMetaTable();
}));
$('metaHideAll').addEventListener('click',()=>setMetaHidden(visibleTypes().map(t=>t.key),true));
$('metaShowAll').addEventListener('click',()=>setMetaHidden(visibleTypes().map(t=>t.key),false));

/* what you see */
const dataToggles={feel:true,steps:true,mood:true,energyLevel:true,weather:true,...(settings().toggles||{})};
function applyDataToggles(){
  root.querySelectorAll('[data-toggle]').forEach(sw=>sw.classList.toggle('on',dataToggles[sw.dataset.toggle]!==false));
  root.querySelector('.feelSection').hidden=true; // parked for now
  [['steps','stepsRow'],['mood','moodRow'],['energyLevel','energyLevelRow']].forEach(([k,id])=>{$(id).hidden=dataToggles[k]===false});
  const anyActivity=['steps','mood','energyLevel'].some(k=>dataToggles[k]!==false);
  root.querySelector('.activityCard').hidden=!anyActivity;
  // the weather moved to the house page's bento (Matt, 27 Oct): the Move page has no weather card
  $('weatherCard').hidden=true;
  const grid=root.querySelector('#homeView .grid');
  grid.classList.toggle('noActivity',!anyActivity);
  grid.classList.toggle('noWeather',true);
}
root.querySelectorAll('[data-toggle]').forEach(sw=>sw.addEventListener('click',()=>{
  dataToggles[sw.dataset.toggle]=!(dataToggles[sw.dataset.toggle]!==false);
  applyDataToggles();
  saveSetting('toggles',{...dataToggles});
}));
applyDataToggles();

/* motion */
function applyMotionSettings(){
  pixelTrailToggle.classList.toggle('on',trailEnabled);
  rippleToggle.classList.toggle('on',rippleEnabled);
  trailStrengthInput.value=Math.round(trailStrength*100);
  $('trailStrengthValue').textContent=trailStrengthInput.value+'%';
  trailLifeInput.value=trailMaxAge;
  $('trailLifeValue').textContent=trailLifeInput.value+' ms';
}
if(settings().trailEnabled!==undefined)trailEnabled=settings().trailEnabled;
if(settings().rippleEnabled!==undefined)rippleEnabled=settings().rippleEnabled;
if(settings().trailStrength!==undefined)trailStrength=settings().trailStrength;
if(settings().trailMaxAge!==undefined)trailMaxAge=settings().trailMaxAge;
applyMotionSettings();

const soundsToggle=$('soundsToggle');
soundsToggle.classList.toggle('on',soundsOn());
soundsToggle.addEventListener('click',()=>{
  saveSetting('sounds',!soundsOn());
  soundsToggle.classList.toggle('on',soundsOn());
  if(soundsOn()){unlockSound();cue('move')}
});
pixelTrailToggle.addEventListener('click',()=>{
  trailEnabled=!trailEnabled;
  pixelTrailToggle.classList.toggle('on',trailEnabled);
  if(!trailEnabled)trailPoints=[];
  saveSetting('trailEnabled',trailEnabled);
});
rippleToggle.addEventListener('click',()=>{
  rippleEnabled=!rippleEnabled;
  rippleToggle.classList.toggle('on',rippleEnabled);
  saveSetting('rippleEnabled',rippleEnabled);
});
trailStrengthInput.addEventListener('input',()=>{
  trailStrength=Number(trailStrengthInput.value)/100;
  $('trailStrengthValue').textContent=trailStrengthInput.value+'%';
});
trailStrengthInput.addEventListener('change',()=>saveSetting('trailStrength',trailStrength));
trailLifeInput.addEventListener('input',()=>{
  trailMaxAge=Number(trailLifeInput.value);
  $('trailLifeValue').textContent=trailLifeInput.value+' ms';
});
trailLifeInput.addEventListener('change',()=>saveSetting('trailMaxAge',trailMaxAge));
upcomingCountSetting.addEventListener('change',()=>saveSetting('upcomingCount',upcomingVisibleCount));

/* appearance */
function applyTheme(theme){
  root.querySelectorAll('.themeBtn').forEach(b=>b.classList.toggle('active',b.dataset.theme===theme));
  const isLight=theme==='light';
  $('app').classList.toggle('light',isLight);
  bridge.setLight(isLight);
  paintWx(root);
}
applyTheme(settings().theme||'dark');
root.querySelectorAll('.themeBtn').forEach(btn=>btn.addEventListener('click',()=>{
  applyTheme(btn.dataset.theme);
  saveSetting('theme',btn.dataset.theme);
}));

/* Home Assistant step sensor */
const sensorEntities={steps:null,weather:null,...(settings().entities||{})};
let lastStates=null;
let stepsByDay={};
function sensorChoices(states){
  const all=Object.values(states).filter(st=>st.entity_id.startsWith('sensor.')||st.entity_id.startsWith('input_number.'));
  const label=st=>(st.attributes.friendly_name||st.entity_id);
  const suggested=all.filter(st=>/step/i.test(st.entity_id)||/step/i.test(label(st))||['steps','step'].includes(String(st.attributes.unit_of_measurement||'').toLowerCase()));
  const rest=all.filter(st=>!suggested.includes(st));
  const byName=(a,b)=>label(a).localeCompare(label(b));
  const healthFirst=(a,b)=>(/health_steps/.test(b.entity_id)-/health_steps/.test(a.entity_id))||byName(a,b);
  return {suggested:suggested.sort(healthFirst),rest:rest.sort(byName),label};
}
function renderSensorPickers(states){
  const select=$('stepsEntity');
  if(!select||select.matches(':focus'))return;
  const {suggested,rest,label}=sensorChoices(states);
  const opt=st=>'<option value="'+esc(st.entity_id)+'">'+esc(label(st))+'</option>';
  select.innerHTML='<option value="">Not connected</option>'+
    (suggested.length?'<optgroup label="Suggested">'+suggested.map(opt).join('')+'</optgroup>':'')+
    (rest.length?'<optgroup label="All sensors">'+rest.map(opt).join('')+'</optgroup>':'');
  select.value=sensorEntities.steps||'';
  const status=$('stepsStatus');
  const st=sensorEntities.steps&&states[sensorEntities.steps];
  status.textContent=st?'Connected · '+label(st):status.dataset.empty;
}
$('stepsEntity').addEventListener('change',()=>{
  sensorEntities.steps=$('stepsEntity').value||null;
  saveSetting('entities',{...sensorEntities});
  stepsByDay={};
  loadStepHistory();
  if(lastStates){renderSensorPickers(lastStates);renderActivity(lastStates)}
});
function formatNumber(v,digits=0){
  return new Intl.NumberFormat(undefined,{maximumFractionDigits:digits}).format(v);
}
function todaysSteps(){
  const st=sensorEntities.steps&&lastStates?.[sensorEntities.steps];
  const n=Number(st?.state);
  return Number.isFinite(n)?n:null;
}
function renderActivity(states){
  const id=sensorEntities.steps;
  const n=id?Number(states[id]?.state):NaN;
  $('stepsMeta').textContent=!id?'Set up in Settings':Number.isFinite(n)?formatNumber(n):'—';
}
// Daily step totals for the last 30 days, from Home Assistant's long-term statistics.
let stepHistoryLoadedAt=0;
async function loadStepHistory(){
  const id=sensorEntities.steps;
  if(!id||!bridge.ws)return;
  stepHistoryLoadedAt=Date.now();
  const end=new Date();
  const start=new Date(end.getFullYear(),end.getMonth(),end.getDate()-30);
  try{
    const result=await bridge.ws({type:'recorder/statistics_during_period',start_time:start.toISOString(),end_time:end.toISOString(),statistic_ids:[id],period:'day',types:['max']});
    const rows=result?.[id]||[];
    const next={};
    rows.forEach(r=>{if(Number.isFinite(r.max))next[dayKey(new Date(r.start))]=r.max});
    if(!Object.keys(next).length){
      // Helpers (e.g. an input_number fed by Apple Health) have no long-term statistics:
      // use the recorder's recent history instead and take each day's highest reading.
      const hist=await bridge.ws({type:'history/history_during_period',start_time:start.toISOString(),end_time:end.toISOString(),entity_ids:[id],minimal_response:true,no_attributes:true,significant_changes_only:false});
      (hist?.[id]||[]).forEach(h=>{
        const v=Number(h.s??h.state);
        const t=h.lu?h.lu*1000:Date.parse(h.last_updated||h.last_changed);
        if(!Number.isFinite(v)||!t)return;
        const k=dayKey(new Date(t));
        next[k]=Math.max(next[k]||0,v);
      });
    }
    stepsByDay=next;
    renderInsights();
  }catch(_e){/* no history for this sensor; insights fall back to moves only */}
}

/* weekly movement from the session log */
function renderWeek(){renderInsights()}
renderWeek();
setInterval(()=>{renderWeek();renderFeelWeek();updateCheckinTab()},10*60*1000);

/* movement & you: motivation + how moving relates to mood and energy */
function dailySeries(days){
  const minutes={},moves={};
  store.history.forEach(h=>{
    const k=dayKey(new Date(h.start));
    minutes[k]=(minutes[k]||0)+(h.seconds||0)/60;
    moves[k]=(moves[k]||0)+1;
  });
  const now=new Date(),today=dayKey(now);
  const out=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i);
    const k=dayKey(d);
    const checks=store.checkins.filter(c=>c.date===k);
    const avg=scale=>{const v=checks.map(c=>c[scale]).filter(Boolean);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
    out.push({
      key:k,date:d,
      minutes:Math.round(minutes[k]||0),
      moves:moves[k]||0,
      steps:k===today&&todaysSteps()!=null?todaysSteps():(stepsByDay[k]??null),
      mood:avg('mood'),
      energy:avg('energy')
    });
  }
  return out;
}
function currentStreak(series){
  let i=series.length-1;
  if(series[i]&&!series[i].minutes)i--; // today isn't over yet
  let n=0;
  while(i>=0&&series[i].minutes>0){n++;i--}
  return n;
}
function renderInsights(){
  // Movement is one dataset: this week, the streak and 30 days are read together, so they share
  // one tile (Figma "Movement summary 2") instead of three separate ones. No daily graph.
  const card=$('insightCard');if(!card)return;
  const series=dailySeries(30);
  const streak=currentStreak(series);
  const month=series.reduce((a,d)=>a+d.minutes,0);
  const now=new Date(),today=dayKey(now);
  const monday=dayKey(new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()+6)%7)));
  const thisWeek=series.filter(x=>x.key>=monday&&x.key<=today).reduce((a,x)=>a+x.minutes,0);
  const reading=(icon,name,value)=>
    '<div class="activityRow"><div class="activityRowIcon" aria-hidden="true">'+icon+'</div>'+
    '<div><div class="activityRowName">'+esc(name)+'</div><div class="activityRowMeta">'+esc(value)+'</div></div></div>';
  card.innerHTML=
    '<div class="activityHeader"><div class="activityIcon" aria-hidden="true">'+icon('move')+'</div><div class="activityTitle">Movement</div></div>'+
    '<div class="activityRows jointRows">'+
      reading(icon('clock'),'This week',thisWeek+' min')+
      reading(icon('streak'),'Streak',streak+' day'+(streak===1?'':'s'))+
      reading(icon('calendar'),'30 days',month+' min')+
    '</div>';
}

/* Weather: current conditions from a weather entity, daily forecast over the websocket */
const WX_NAMES={'sunny':'Sunny','clear-night':'Clear','partlycloudy':'Partly cloudy','cloudy':'Cloudy','fog':'Fog','windy':'Windy','windy-variant':'Windy','exceptional':'Unusual weather',
  'rainy':'Rain','pouring':'Heavy rain','lightning':'Thunder','lightning-rainy':'Thunderstorms','hail':'Hail','snowy':'Snow','snowy-rainy':'Sleet'};
const wxKind=c=>c==='sunny'?'clear':c==='clear-night'?'night':c==='partlycloudy'?'partly':
  ['rainy','pouring','lightning','lightning-rainy','hail'].includes(c)?'rain':['snowy','snowy-rainy'].includes(c)?'snow':'cloudy';
// Weather icons: artwork from the Figma "Weather icon" component, Condition × Time (day, night) × Size [Small 54, Large 90].
// The sky is the .wxIcon background (CSS); clouds, drops and stars use classes or fixed colours from Figma.
const WX_CLOUD={s:'M41.0875 21.224C40.4398 17.9648 38.6815 15.0313 36.1125 12.9237C33.5435 10.816 30.3229 9.66488 27 9.66651C21.4608 9.66651 16.65 12.8098 14.2542 17.3907C11.4355 17.6995 8.83007 19.0382 6.93769 21.1499C5.0453 23.2616 3.99919 25.9976 4 28.8332C4 31.8832 5.2116 34.8082 7.36827 36.9649C9.52494 39.1216 12.45 40.3332 15.5 40.3332H40.4167C41.6752 40.3332 42.9213 40.0853 44.084 39.6037C45.2468 39.1221 46.3032 38.4162 47.1931 37.5263C48.083 36.6364 48.7889 35.5799 49.2705 34.4172C49.7521 33.2545 50 32.0083 50 30.7498C50 25.6898 46.0708 21.5882 41.0875 21.224Z',sp:'M41.025 27.045C40.5181 24.4943 39.142 22.1985 37.1315 20.5491C35.121 18.8996 32.6005 17.9987 30 18C25.665 18 21.9 20.46 20.025 24.045C17.8191 24.2867 15.7801 25.3344 14.2991 26.987C12.8181 28.6396 11.9994 30.7809 12 33C12 35.3869 12.9482 37.6761 14.636 39.364C16.3239 41.0518 18.6131 42 21 42H40.5C41.4849 42 42.4602 41.806 43.3701 41.4291C44.2801 41.0522 45.1069 40.4997 45.8033 39.8033C46.4997 39.1069 47.0522 38.2801 47.4291 37.3701C47.806 36.4602 48 35.4849 48 34.5C48 30.54 44.925 27.33 41.025 27.045Z',lp:'M70.8016 48.008C69.9751 43.8493 67.7316 40.1062 64.4536 37.4168C61.1755 34.7275 57.0661 33.2587 52.8261 33.2607C45.7581 33.2607 39.6196 37.2716 36.5625 43.1167C32.9659 43.5108 29.6414 45.219 27.2267 47.9135C24.8121 50.608 23.4772 54.0991 23.4783 57.7173C23.4783 61.609 25.0243 65.3414 27.7761 68.0933C30.528 70.8452 34.2604 72.3912 38.1522 72.3912H69.9456C71.5515 72.3912 73.1416 72.0749 74.6252 71.4604C76.1088 70.8458 77.4568 69.9451 78.5923 68.8096C79.7278 67.6741 80.6286 66.3261 81.2431 64.8425C81.8576 63.3589 82.1739 61.7688 82.1739 60.1629C82.1739 53.7064 77.1603 48.4727 70.8016 48.008Z',lc:'M65.3723 37.5398C64.4356 32.8266 61.8929 28.5843 58.1778 25.5364C54.4627 22.4885 49.8054 20.8238 45 20.8262C36.9897 20.8262 30.0326 25.3718 26.5679 31.9963C22.4918 32.4429 18.724 34.3788 15.9874 37.4326C13.2508 40.4864 11.738 44.443 11.7391 48.5436C11.7391 52.9542 13.4913 57.1842 16.6101 60.3031C19.7289 63.4219 23.9589 65.174 28.3696 65.174H64.4022C66.2221 65.174 68.0243 64.8155 69.7057 64.1191C71.3871 63.4226 72.9149 62.4018 74.2018 61.1149C75.4887 59.828 76.5095 58.3002 77.2059 56.6188C77.9024 54.9374 78.2609 53.1353 78.2609 51.3153C78.2609 43.9979 72.5788 38.0664 65.3723 37.5398Z',lr:'M62.9755 28.4431C62.149 24.2844 59.9055 20.5412 56.6275 17.8519C53.3494 15.1626 49.24 13.6937 45 13.6958C37.9321 13.6958 31.7935 17.7067 28.7364 23.5518C25.1398 23.9459 21.8153 25.654 19.4006 28.3485C16.986 31.043 15.6511 34.5342 15.6522 38.1523C15.6522 42.0441 17.1982 45.7765 19.9501 48.5284C22.7019 51.2802 26.4343 52.8262 30.3261 52.8262H62.1196C63.7254 52.8262 65.3155 52.5099 66.7991 51.8954C68.2827 51.2809 69.6307 50.3802 70.7662 49.2447C71.9017 48.1092 72.8025 46.7611 73.417 45.2775C74.0315 43.7939 74.3478 42.2038 74.3478 40.598C74.3478 34.1415 69.3342 28.9078 62.9755 28.4431Z'};
const WX_MOON={
 s:['M21.0459 6.11182C19.2847 8.44583 18.2402 11.3513 18.2402 14.5005C18.2405 22.199 24.4811 28.4398 32.1797 28.4399C34.9446 28.4399 37.5211 27.634 39.6885 26.2456C38.1734 34.0818 31.2788 40.0005 23 40.0005C13.6113 40.0005 6.00026 32.3891 6 23.0005C6 14.2725 12.5775 7.08102 21.0459 6.11182Z',6.11,40],
 l:['M41.1747 11.959C37.7298 16.5251 35.6875 22.2086 35.6874 28.3691C35.6874 43.4321 47.8979 55.6435 62.9608 55.6436C68.3701 55.6436 73.411 54.0676 77.6512 51.3516C74.6865 66.6826 61.197 78.2607 44.9999 78.2607C26.6305 78.2607 11.7391 63.3694 11.7391 45C11.7392 27.9244 24.6071 13.8562 41.1747 11.959Z',11.96,78.26],
 sp:['M16.6201 5.0791C15.3771 6.72655 14.6397 8.7772 14.6396 11C14.6396 16.4345 19.046 20.8398 24.4805 20.8398C26.4326 20.8398 28.2502 20.2686 29.7803 19.2881C28.7119 24.821 23.8449 29 18 29C11.3726 29 6 23.6274 6 17C6 10.8393 10.6426 5.76349 16.6201 5.0791Z',5.08,29],
 lp:['M32.5175 9.93848C30.0859 13.1616 28.6435 17.1729 28.6434 21.5215C28.6434 32.1541 37.2628 40.7733 47.8954 40.7734C51.7136 40.7734 55.2724 39.6622 58.2655 37.7451C56.1724 48.5666 46.6506 56.7391 35.2177 56.7393C22.251 56.7393 11.7391 46.2274 11.7391 33.2607C11.7393 21.2073 20.8226 11.2776 32.5175 9.93848Z',9.94,56.74]
};
let wxGrad=0;
const wxCloud=(d,cls)=>'<path class="'+cls+'" d="'+d+'"/>';
// Figma's 4-point star: inner radius 0.38. Classes and delays on the parts drive the Smooth idle loops (styles.css, .wxMotion).
const wxDelay=(x,period)=>' style="animation-delay:-'+Math.round(x*137%period)+'ms"';
const wxStar=(x,y,r,o)=>{const k=r*.2687;return '<path class="wxTwinkle" fill="#fff"'+(o<1?' opacity="'+o+'"':'')+wxDelay(x,2400)+' d="M'+x+' '+(y-r)+'L'+(x+k)+' '+(y-k)+'L'+(x+r)+' '+y+'L'+(x+k)+' '+(y+k)+'L'+x+' '+(y+r)+'L'+(x-k)+' '+(y+k)+'L'+(x-r)+' '+y+'L'+(x-k)+' '+(y-k)+'Z"/>'};
const wxMoon=([d,y1,y2],g)=>'<path class="wxMoonPath" d="'+d+'" fill="url(#'+g+')"/><defs><linearGradient id="'+g+'" x1="0" y1="'+y1+'" x2="0" y2="'+y2+'" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF4C7"/><stop offset="1" stop-color="#F2C95E"/></linearGradient></defs>';
const wxSun=(g,L)=>L?'<circle class="wxSunDisc" cx="45" cy="45" r="33.26" fill="url(#'+g+')"/><defs><linearGradient id="'+g+'" x1="12" y1="8.5" x2="67" y2="73.5" gradientUnits="userSpaceOnUse"><stop offset=".653" stop-color="#FFE100"/><stop offset="1" stop-color="#F2C159"/></linearGradient></defs>'
  :'<circle class="wxSunDisc" cx="23" cy="23" r="17" fill="url(#'+g+')"/><defs><linearGradient id="'+g+'" x1="23" y1="6" x2="23" y2="40" gradientUnits="userSpaceOnUse"><stop offset=".606" stop-color="#FFE100"/><stop offset="1" stop-color="#FFAA00"/></linearGradient></defs>';
const wxDrops=L=>(L?['29.35','43.04','56.74'].map((x,i)=>'<g class="wxDrop" style="animation-delay:-'+i*317+'ms"><rect class="wxAccent" x="'+x+'" y="60.65" width="5.87" height="15.65" rx="2.93" transform="rotate(12 '+x+' 60.65)"/></g>')
  :[19,26,33].map((x,i)=>'<g class="wxDrop" style="animation-delay:-'+i*317+'ms"><rect class="wxAccent" width="3.03" height="9.41" rx="1.51" transform="matrix(0.9698 0.244 -0.1768 0.9843 '+x+' 38)"/></g>')).join('');
const wxFlakes=L=>(L?[[33.67,67.67],[47.67,64.67],[61.67,67.67],[40.67,77.67],[54.67,77.67]]:[[21.2,42.2],[29.2,40.2],[37.2,42.2],[25.2,48.2],[33.2,48.2]])
  .map(([x,y],i)=>'<circle class="wxFlake" style="animation-delay:-'+i*640+'ms" cx="'+x+'" cy="'+y+'" r="'+(L?3.67:2.2)+'" fill="#fff"/>').join('');
function wxArt(k,night,L,g){
  if(k==='clear')return night?wxMoon(L?WX_MOON.l:WX_MOON.s,g)+(L?wxStar(70,20,5.83,1)+wxStar(78.33,41.67,3.75,.8)+wxStar(60,71.67,3.33,.6):wxStar(42,12,3.5,1)+wxStar(47,25,2.25,.8)+wxStar(36,43,2,.6)):wxSun(g,L);
  if(k==='partly')return (night?wxMoon(L?WX_MOON.lp:WX_MOON.sp,g):(L?'<circle class="wxSunDisc" cx="35.22" cy="33.26" r="23.48" fill="#FFE100"/>':'<circle class="wxSunDisc" cx="18" cy="17" r="12" fill="#FFE100"/>'))
    +wxCloud(L?WX_CLOUD.lp:WX_CLOUD.sp,night?'wxCloudLight':'wxBright')+(night?(L?wxStar(73.33,16.67,4.17,.9):wxStar(44,10,2.5,.9)):'');
  if(k==='cloudy')return wxCloud(L?WX_CLOUD.lc:WX_CLOUD.s,night?'wxCloudLight':'wxBright')+(night?(L?wxStar(15,15,3.75,.8)+wxStar(76.67,13.33,2.92,.6):wxStar(9,9,2.25,.8)+wxStar(46,8,1.75,.6)):'');
  return wxCloud(L?WX_CLOUD.lr:WX_CLOUD.s,'wxCloudLight')+(k==='rain'?wxDrops(L):wxFlakes(L));
}
// HA only sends "clear-night"; for every other condition the sun entity says whether it is night now.
const isNightNow=()=>lastStates?.['sun.sun']?.state==='below_horizon';
// Weather style, chosen in Settings → Appearance: bitmap (default), onebit or smooth (the Figma artwork above)
let wxStyle=settings().weatherStyle||'bitmap';
// Weather layout: the six days as tiles (default) or as the 12-hour sky strip
let wxLayout=settings().weatherLayout==='strip'?'strip':'tiles';
// Weather motion (Settings → Appearance): idle loops and changes of shape. With reduced motion there are no loops
// and a change dissolves in place.
let wxMotion=settings().weatherMotion!==false;
const wxMoving=()=>wxMotion&&!reduceMotion();
// Icons that stay put between renders (Now, each forecast day) remember what they showed, so a new condition changes from it
const wxSlots=new Map(),WX_CHANGE=700;
const wxSmooth=key=>{const [k,t]=key.split('/');return {k:k==='fog'?'cloudy':k==='storm'?'rain':k,night:t==='night'}};
// night: whether it is night, when the caller knows (the bigger view); otherwise "now" asks the sun
function wxIcon(condition,large,now,style=wxStyle,slot,isNight){
  let k=wxKind(condition);const night=k==='night'||(isNight!=null?!!isNight:(!!now&&isNightNow()));if(k==='night')k='clear';
  const n=large?90:54,key=wxKey(condition,night),t=performance.now();
  let s=slot?wxSlots.get(slot):null;
  if(slot&&!s)wxSlots.set(slot,s={key,t0:-1e9});
  else if(s&&s.key!==key){s.fromKey=s.key;s.from=s.last||null;s.key=key;s.t0=t}
  if(style!=='smooth')return '<span class="wxIcon pixels'+(large?' large':'')+'" aria-hidden="true"><canvas data-wx="'+key+'"'+(slot?' data-wx-slot="'+slot+'"':'')+' data-wx-style="'+style+'" data-wx-size="'+n+'"></canvas></span>';
  // Smooth changes by fading the old picture out over the new one
  let old='';
  if(s&&t-s.t0<WX_CHANGE&&(wxMoving()||reduceMotion())){
    const o=wxSmooth(s.fromKey);
    old='<span class="wxLayer wxOut '+o.k+(o.night?' night':'')+'" style="animation-delay:'+Math.round(s.t0-t)+'ms"><svg viewBox="0 0 '+n+' '+n+'">'+wxArt(o.k,o.night,large,'wxg'+(++wxGrad))+'</svg></span>';
  }
  return '<span class="wxIcon '+k+(night?' night':'')+(large?' large':'')+'" aria-hidden="true"><svg viewBox="0 0 '+n+' '+n+'">'+wxArt(k,night,large,'wxg'+(++wxGrad))+'</svg>'+old+'</span>';
}
// Bitmap and 1-bit icons are canvases; their pixels are drawn once the markup is in place (and again when the theme changes)
function wxColors(){
  const app=$('app'),cs=getComputedStyle(app),v=n=>cs.getPropertyValue(n).trim();
  const colors={};
  [['skyClearDay','--wx-clear'],['skyClearNight','--wx-night'],['skyCloudyDay','--wx-cloudy'],['cloudDay','--wx-cloud-bright'],['cloudNight','--wx-cloudy'],['rain','--color-accent-primary']]
    .forEach(([k,n])=>{if(v(n))colors[k]=v(n)});
  const text=v('--color-text-primary')||'#f1f1f1',card=v('--color-bg-card')||'#222222',light=app.classList.contains('light');
  return {colors,ink:light?text:card,paper:light?card:text};
}
function paintWx(scope,t=performance.now()){
  const list=scope.querySelectorAll('canvas[data-wx]');if(!list.length)return;
  const c=wxColors(),moving=wxMoving(),reduce=reduceMotion();
  list.forEach(cv=>{
    const key=cv.dataset.wx,s=cv.dataset.wxSlot?wxSlots.get(cv.dataset.wxSlot):null;
    let pose=wxPose(key,c.colors);
    if(s&&s.key===key){
      const p=(t-s.t0)/WX_CHANGE;
      if(p<1&&(moving||reduce))pose=wxMorph(s.from||wxPose(s.fromKey,c.colors),pose,Math.max(0,p),c.colors,reduce);
      s.last=pose;
    }
    const img=wxBitmap(pose,{size:Number(cv.dataset.wxSize)||54,px:2,oneBit:cv.dataset.wxStyle==='onebit',colors:c.colors,ink:c.ink,paper:c.paper,clock:t,idle:moving});
    if(cv.width!==img.w)cv.width=img.w;
    if(cv.height!==img.h)cv.height=img.h;
    cv.getContext('2d')?.putImageData(new ImageData(img.data,img.w,img.h),0,0);
  });
}
// One clock for the weather pictures: 10 steps a second for idle loops, every frame while something changes or
// the Smooth sky drifts. It paints only what is on screen and stops when nothing moves.
let wxRAF=null,wxStep=-1;
function wxTick(t){
  wxRAF=null;
  if(!alive)return;
  const moving=wxMoving(),step=Math.floor(t/100);
  const changing=[...wxSlots.values()].some(s=>t-s.t0<WX_CHANGE),stripping=[...wxStrips.values()].some(s=>t-s.t0<s.dur);
  const homeOn=views.home.classList.contains('active'),dialogOn=wxDialog.classList.contains('open');
  const smoothSky=moving&&wxStyle==='smooth'&&(dialogOn||(homeOn&&wxLayout==='strip'));
  if(!document.hidden&&(changing||stripping||smoothSky||(moving&&step!==wxStep))){
    wxStep=step;
    if(homeOn){paintWx($('weatherCard'),t);paintStrips($('weatherCard'),t)}
    if(dialogOn){paintWx(wxDialog,t);paintStrips(wxDialog,t)}
  }
  if(moving||changing||stripping)wxRAF=requestAnimationFrame(wxTick);
}
function wxWake(){
  $('app').classList.toggle('wxMotion',wxMoving());
  if(!wxRAF&&alive)wxRAF=requestAnimationFrame(wxTick);
}
let wxForecast=[],wxFor=undefined,wxUnsub=null,wxNoForecast=false;

/* The 12-hour sky (Weather layout → Sky strip, and the bigger view). Six days as twelve halves: day 06–18, night 18–06.
   Conditions come from the most detailed forecast there is: hourly (the most common condition in each half, rain and
   snow counting double), then twice daily, then the day's own forecast. */
const HOUR=36e5,WX_WET=new Set(['rainy','pouring','lightning','lightning-rainy','hail','snowy','snowy-rainy']);
let wxDetail=[],wxDetailType=null,wxDetailUnsub=null;
function wxTimeline(){
  const n=new Date(),at=(i,h)=>new Date(n.getFullYear(),n.getMonth(),n.getDate()+i,h);
  const hours=wxDetailType==='hourly'?wxDetail.map(h=>({t:+new Date(h.datetime),c:h.condition,temp:Number(h.temperature)})).filter(h=>Number.isFinite(h.t)).sort((a,b)=>a.t-b.t):[];
  const twice=wxDetailType==='twice_daily'?wxDetail:[];
  const days=[...Array(6)].map((_,i)=>{
    const ds=at(i,6),ns=at(i,18),ne=at(i+1,6),f=wxForecast.find(x=>dayKey(new Date(x.datetime))===dayKey(ds));
    const half=(a,b,night)=>{
      const inside=hours.filter(h=>h.t>=+a&&h.t<+b);
      if(inside.length){const count={};inside.forEach(h=>{count[h.c]=(count[h.c]||0)+(WX_WET.has(h.c)?2:1)});return Object.entries(count).sort((p,q)=>q[1]-p[1])[0][0]}
      const tw=twice.find(x=>{const t=+new Date(x.datetime);return t>=+a-3*HOUR&&t<+b&&(x.is_daytime==null||!!x.is_daytime===!night)});
      if(tw)return tw.condition;
      const c=f?.condition||'cloudy';return night&&c==='sunny'?'clear-night':c;
    };
    return {start:+ds,end:+ne,day:half(ds,ns,false),night:half(ns,ne,true),hi:Number(f?.temperature),lo:Number(f?.templow)};
  });
  return {days,hours,start:days[0].start,end:days[5].end};
}
// Where a moment sits along the strip (0–1 across the six columns), and back
const wxPos=(tl,t)=>{const i=tl.days.findIndex(d=>t<d.end);if(i<0)return 1;const d=tl.days[i];return Math.max(0,(i+(t-d.start)/(d.end-d.start))/6)};
const wxTime=(tl,f)=>{const x=Math.max(0,Math.min(.99999,f))*6,i=Math.floor(x),d=tl.days[i];return d.start+(x-i)*(d.end-d.start)};
// The weather at a moment: the hourly forecast where there is one, otherwise the half it falls in,
// with the temperature eased between the day's low (05:00) and high (15:00)
function wxAt(tl,t){
  const i=Math.max(0,tl.days.findIndex(d=>t<d.end)),d=tl.days[i],night=(t-d.start)/(d.end-d.start)>=.5;
  let cond=night?d.night:d.day,temp=NaN;
  const hs=tl.hours;
  if(hs.length&&t>=hs[0].t-HOUR&&t<=hs[hs.length-1].t+HOUR){
    let k=hs.findIndex(h=>h.t>t);if(k<0)k=hs.length;
    const a=hs[Math.max(0,k-1)],b=hs[Math.min(hs.length-1,k)];
    cond=a.c||cond;
    temp=b.t>a.t?a.temp+(b.temp-a.temp)*Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))):a.temp;
  }
  if(!Number.isFinite(temp)){
    const pts=[];
    tl.days.forEach(x=>{if(Number.isFinite(x.lo))pts.push([x.start-HOUR,x.lo]);if(Number.isFinite(x.hi))pts.push([x.start+9*HOUR,x.hi])});
    if(pts.length){
      temp=t<=pts[0][0]?pts[0][1]:pts[pts.length-1][1];
      for(let k=1;k<pts.length;k++)if(t<=pts[k][0]&&t>pts[k-1][0]){const [t0,v0]=pts[k-1],[t1,v1]=pts[k];temp=v0+(v1-v0)*(1-Math.cos(Math.PI*(t-t0)/(t1-t0)))/2;break}
    }
  }
  return {cond:night&&cond==='sunny'?'clear-night':cond,temp,night,day:d};
}
// Day names in the strip's narrow columns: "Today", then short weekdays ("Tomorrow" doesn't fit on phones)
const wxDayShort=t=>dayKey(new Date(t))===dayKey(new Date())?'Today':new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(new Date(t));
// Each sky strip remembers its last week, so a new forecast paints over it; the first time it shows, it paints in from the left
const wxStrips=new Map(),WX_ENTER=900,WX_UPDATE=700;
let wxObserved=null;
const wxStripObserver=typeof ResizeObserver==='function'?new ResizeObserver(entries=>entries.forEach(e=>{
  paintStrips(e.target.parentElement);
  if(e.target.closest('#wxDialog'))drawWxLine();
})):null;
function paintStrips(scope,t=performance.now()){
  const list=scope.querySelectorAll('canvas[data-wx-strip]');if(!list.length)return;
  const tl=wxTimeline(),segs=tl.days.flatMap(d=>[{cond:d.day,night:false},{cond:d.night,night:true}]),sig=segs.map(s=>s.cond).join();
  const c=wxColors(),moving=wxMoving(),reduce=reduceMotion(),seed=Number(dayKey(new Date(tl.start)).replace(/\D/g,''))%9973;
  let animating=false;
  list.forEach(cv=>{
    const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;
    const name=cv.dataset.wxStrip;let s=wxStrips.get(name);
    if(!s)wxStrips.set(name,s={sig,segs,prev:null,t0:t,dur:WX_ENTER});
    else if(s.sig!==sig){s.prev=s.segs;s.sig=sig;s.segs=segs;s.t0=t;s.dur=WX_UPDATE}
    const p=moving||reduce?Math.min(1,Math.max(0,(t-s.t0)/s.dur)):1;
    if(p<1)animating=true;
    const o={width:w,height:h,colors:c.colors,clock:t,ambient:moving,seed,reveal:reduce?p:1-Math.pow(1-p,3),prev:p<1?s.prev:null,reduce};
    if(wxStyle==='smooth'){
      const dpr=Math.min(2,window.devicePixelRatio||1),pw=Math.round(w*dpr),ph=Math.round(h*dpr);
      if(cv.width!==pw)cv.width=pw;
      if(cv.height!==ph)cv.height=ph;
      const ctx=cv.getContext('2d');if(!ctx)return;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      wxStripSmooth(ctx,segs,o);
    }else{
      const img=wxStripBitmap(segs,{...o,px:2,oneBit:wxStyle==='onebit',ink:c.ink,paper:c.paper});
      if(cv.width!==img.w)cv.width=img.w;
      if(cv.height!==img.h)cv.height=img.h;
      cv.getContext('2d')?.putImageData(new ImageData(img.data,img.w,img.h),0,0);
    }
  });
  if(animating)wxWake();
}
function renderWeather(){
  const card=$('weatherCard');if(!card||card.hidden)return;
  const id=sensorEntities.weather,st=id&&lastStates?.[id];
  const header=(icon)=>'<div class="activityHeader">'+icon+'<div class="activityTitle">Weather</div></div>';
  if(!st){
    card.innerHTML='<div class="activityHeader"><div class="activityTitle">Weather</div></div><div class="activityRows"><div class="activityRow">'+wxIcon('cloudy')+
      '<div><div class="activityRowName">Forecast</div><div class="activityRowMeta">'+(id?'Not available':'Set up in Settings')+'</div></div></div></div>';
    paintWx(card);
    return;
  }
  const a=st.attributes||{};
  const unit=a.temperature_unit||'°';
  const deg=v=>Number.isFinite(Number(v))?Math.round(Number(v))+'°':'—';
  const place=(a.friendly_name||'').replace(/^forecast\s+/i,'')||'Weather';
  const condition=WX_NAMES[st.state]||(st.state?st.state.charAt(0).toUpperCase()+st.state.slice(1):'—');
  const todayKey=dayKey(new Date());
  const days=wxForecast.slice(0,7);
  const today=days.find(d=>dayKey(new Date(d.datetime))===todayKey)||null;
  const upcoming=days.filter(d=>dayKey(new Date(d.datetime))>=todayKey).slice(0,6);
  const now=new Date(),tomorrowKey=dayKey(new Date(now.getFullYear(),now.getMonth(),now.getDate()+1));
  const range=today?'H '+deg(today.temperature)+'&ensp; L '+deg(today.templow):'';
  const dayName=d=>{const k=dayKey(new Date(d.datetime));return k===todayKey?'Today':k===tomorrowKey?'Tomorrow':new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(new Date(d.datetime))};
  const temp=Number.isFinite(Number(a.temperature))?Math.round(Number(a.temperature)):'—';
  // tapping Now or a day opens the bigger view, at now or at that day's midday
  const dayIndex=d=>{const a=new Date(d.datetime);return Math.round((new Date(a.getFullYear(),a.getMonth(),a.getDate())-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/864e5)};
  const lower=c=>(WX_NAMES[c]||c||'').toLowerCase();
  const dayTile=(d,i)=>'<div class="activityRow wxDayTile" role="button" tabindex="0" data-wx-day="'+dayIndex(d)+'" aria-label="'+esc(dayName(d)+': '+lower(d.condition)+', '+deg(d.temperature)+' / '+deg(d.templow)+'. Open the forecast')+'">'+
    wxIcon(d.condition,false,false,wxStyle,'day'+i)+'<div><div class="activityRowName">'+esc(dayName(d))+'</div><div class="activityRowMeta">'+deg(d.temperature)+' / '+deg(d.templow)+'</div></div></div>';
  // Sky strip: six day columns, the 12-hour sky running across them
  const strip=()=>{
    const tl=wxTimeline();
    return '<div class="wxStrip"><div class="wxStripDays">'+tl.days.map((d,i)=>{
      const long=new Intl.DateTimeFormat(undefined,{weekday:'long'}).format(new Date(d.start));
      const label=long+': '+lower(d.day)+(lower(d.day)===lower(d.night)?' all day and night':', then '+lower(d.night)+' overnight')+(Number.isFinite(d.hi)?'. High '+deg(d.hi):'')+(Number.isFinite(d.lo)?', low '+deg(d.lo):'')+'. Open the forecast';
      return '<div class="wxStripDay" role="button" tabindex="0" data-wx-day="'+i+'" aria-label="'+esc(label)+'"><span class="wxDayName">'+esc(wxDayShort(d.start))+'</span><span class="wxStripGap" aria-hidden="true"></span>'+
        '<span class="wxTemps" aria-hidden="true"><span class="wxHigh">'+deg(d.hi)+'</span><span class="wxLow">'+deg(d.lo)+'</span></span></div>';
    }).join('')+'</div><canvas class="wxStripSky" data-wx-strip="inline" aria-hidden="true"></canvas></div>';
  };
  card.innerHTML=
    '<div class="wxWide">'+
      '<div class="wxNow" role="button" tabindex="0" data-wx-open="now" aria-label="'+esc('Now in '+place+': '+temp+'°, '+lower(st.state)+'. Open the forecast')+'">'+
        '<div class="wxCurrent">'+wxIcon(st.state,true,true,wxStyle,'now')+
          '<div class="wxTempBlock"><div class="wxTemp"><span class="wxDeg">'+esc(String(temp))+'</span><span class="wxUnit">'+esc(unit)+'</span></div>'+
          '<div class="wxPlace">'+esc(place)+'</div></div></div>'+
        '<div class="wxCondition"><div class="wxCondName">'+esc(condition)+'</div>'+(range?'<div class="wxRange">'+range+'</div>':'')+'</div>'+
      '</div>'+
      // the days are tiles under Now, like every card of readings (Figma "Weather in halves · proposal"), or the sky strip
      (!upcoming.length?'<div class="wxNoDays">'+(wxNoForecast?'This weather service has no daily forecast':'Loading the forecast…')+'</div>'
        :wxLayout==='strip'?strip()
        :'<div class="activityRows wxDays">'+upcoming.map(dayTile).join('')+'</div>')+
    '</div>';
  paintWx(card);
  const sky=card.querySelector('canvas[data-wx-strip]');
  if(wxObserved&&wxObserved!==sky)wxStripObserver?.unobserve(wxObserved);
  wxObserved=sky;
  if(sky){wxStripObserver?.observe(sky);paintStrips(card)}
  wxWake();
  renderWxDialog();
}
const wxCard=$('weatherCard');
const wxOpenFrom=el=>{
  const day=el.closest('[data-wx-day]');
  if(day){const n=new Date();openWxDialog(+new Date(n.getFullYear(),n.getMonth(),n.getDate()+Number(day.dataset.wxDay),12),day);return}
  const now=el.closest('[data-wx-open]');
  if(now)openWxDialog(Date.now(),now);
};
wxCard.addEventListener('click',e=>wxOpenFrom(e.target));
wxCard.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-wx-day],[data-wx-open]')){e.preventDefault();wxOpenFrom(e.target)}});

/* The bigger view: Now at the top, the sky across six days with the temperature drawn over it. Drag along it (or use
   the arrow keys) to see the weather at any hour; the picture changes shape as you cross into rain or night. */
const wxDialog=$('wxDialog'),wxGraph=$('wxGraph'),wxGraphWrap=$('wxGraphWrap');
let wxCursor=Date.now(),wxOpener=null,wxScrubbing=false,wxLineY=null;
function openWxDialog(t,opener){
  const tl=wxTimeline();
  wxOpener=opener||null;
  wxCursor=Math.max(tl.start,Math.min(tl.end-HOUR,t));
  wxStrips.delete('dialog');wxSlots.delete('scrub');
  wxDialog.classList.add('open');wxDialog.setAttribute('aria-hidden','false');
  renderWxDialog();
  wxStripObserver?.observe(wxDialog.querySelector('canvas[data-wx-strip]'));
  wxGraph.focus({preventScroll:true});
  wxWake();
}
function closeWxDialog(){
  wxDialog.classList.remove('open');wxDialog.setAttribute('aria-hidden','true');
  wxStripObserver?.unobserve(wxDialog.querySelector('canvas[data-wx-strip]'));
  wxOpener?.focus?.({preventScroll:true});wxOpener=null;
}
function renderWxDialog(){
  if(!wxDialog.classList.contains('open'))return;
  const tl=wxTimeline();
  $('wxGraphDays').innerHTML=tl.days.map(d=>'<span>'+esc(wxDayShort(d.start))+'</span>').join('');
  drawWxLine(tl);
  renderWxScrub(tl);
  paintStrips(wxDialog);
}
// The top of the view: the weather at the cursor ("Now" while the cursor is on the current hour)
function renderWxScrub(tl=wxTimeline()){
  const w=wxAt(tl,wxCursor),st=lastStates?.[sensorEntities.weather],a=st?.attributes||{},unit=a.temperature_unit||'°';
  const now=Math.abs(wxCursor-Date.now())<HOUR/2;
  const cond=now&&st?st.state:w.cond;
  const temp=now&&Number.isFinite(Number(a.temperature))?Math.round(Number(a.temperature)):Number.isFinite(w.temp)?Math.round(w.temp):'—';
  const name=WX_NAMES[cond]||(cond?cond.charAt(0).toUpperCase()+cond.slice(1):'—');
  const when=now?'Now':new Intl.DateTimeFormat(undefined,{weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(Math.round(wxCursor/HOUR)*HOUR));
  const d=w.day,range=(Number.isFinite(d.hi)?'H '+Math.round(d.hi)+'°':'')+(Number.isFinite(d.lo)?'&ensp; L '+Math.round(d.lo)+'°':'');
  $('wxDialogNow').innerHTML=
    '<div class="wxCurrent">'+wxIcon(cond,true,now,wxStyle,'scrub',now?undefined:w.night)+
      '<div class="wxTempBlock"><div class="wxTemp"><span class="wxDeg">'+esc(String(temp))+'</span><span class="wxUnit">'+esc(unit)+'</span></div>'+
      '<div class="wxPlace">'+esc(when)+'</div></div></div>'+
    '<div class="wxCondition"><div class="wxCondName">'+esc(name)+'</div>'+(range?'<div class="wxRange">'+range+'</div>':'')+'</div>';
  paintWx($('wxDialogNow'));
  wxGraph.setAttribute('aria-valuenow',String(Math.round((wxCursor-tl.start)/HOUR)));
  wxGraph.setAttribute('aria-valuetext',when+', '+name.toLowerCase()+', '+temp+'°');
  moveWxCursor(tl);
  wxWake();
}
// The temperature across the six days, hour by hour; in Bitmap and 1-bit it snaps to the 2 px grid
function drawWxLine(tl=wxTimeline()){
  const svg=$('wxGraphLine'),w=wxGraphWrap.clientWidth,h=wxGraphWrap.clientHeight;if(!w||!h)return;
  const pts=[];
  for(let t=tl.start;t<=tl.end;t+=HOUR){const v=wxAt(tl,t).temp;if(Number.isFinite(v))pts.push([wxPos(tl,t)*w,v])}
  svg.setAttribute('viewBox','0 0 '+w+' '+h);
  if(pts.length<2){svg.innerHTML='<g id="wxCursorMark"></g>';wxLineY=null;moveWxCursor(tl);return}
  const vals=pts.map(p=>p[1]),lo=Math.min(...vals),hi=Math.max(...vals),span=Math.max(4,hi-lo);
  const pixel=wxStyle!=='smooth',q=n=>pixel?Math.round(n/2)*2:Math.round(n*10)/10;
  wxLineY=v=>h*.84-(v-lo)/span*h*.62;
  const c=wxColors(),main=wxStyle==='onebit'?c.paper:'#ffffff',shade=wxStyle==='onebit'?c.ink:'rgba(0,0,0,.28)';
  const d='M'+pts.map(p=>q(p[0])+' '+q(wxLineY(p[1]))).join(' L');
  const label=(v,below)=>{const p=pts.find(x=>x[1]===v);return '<text class="wxLineLabel" x="'+q(Math.min(w-14,Math.max(14,p[0])))+'" y="'+q(wxLineY(v)+(below?18:-10))+'" fill="'+main+'" stroke="'+shade+'">'+Math.round(v)+'°</text>'};
  svg.setAttribute('shape-rendering',pixel?'crispEdges':'auto');
  svg.innerHTML='<path d="'+d+'" fill="none" stroke="'+shade+'" stroke-width="'+(pixel?4:5)+'" stroke-linejoin="round"/>'+
    '<path d="'+d+'" fill="none" stroke="'+main+'" stroke-width="2" stroke-linejoin="round"/>'+label(hi,false)+label(lo,true)+'<g id="wxCursorMark"></g>';
  moveWxCursor(tl);
}
function moveWxCursor(tl=wxTimeline()){
  const g=$('wxGraphLine').querySelector('#wxCursorMark');if(!g)return;
  const w=wxGraphWrap.clientWidth,h=wxGraphWrap.clientHeight,pixel=wxStyle!=='smooth',q=n=>pixel?Math.round(n/2)*2:n;
  const x=q(wxPos(tl,wxCursor)*w),v=wxAt(tl,wxCursor).temp,c=wxColors(),main=wxStyle==='onebit'?c.paper:'#ffffff',shade=wxStyle==='onebit'?c.ink:'rgba(0,0,0,.28)';
  const y=wxLineY&&Number.isFinite(v)?q(wxLineY(v)):null;
  g.innerHTML='<rect x="'+(x-2)+'" y="0" width="4" height="'+h+'" fill="'+shade+'"/><rect x="'+(x-1)+'" y="0" width="2" height="'+h+'" fill="'+main+'"/>'+
    (y==null?'':pixel?'<rect x="'+(x-5)+'" y="'+(y-5)+'" width="10" height="10" fill="'+main+'" stroke="'+shade+'" stroke-width="2"/>'
      :'<circle cx="'+x+'" cy="'+y+'" r="6" fill="'+main+'" stroke="'+shade+'" stroke-width="2"/>');
}
const wxScrubAt=x=>{const r=wxGraphWrap.getBoundingClientRect();if(!r.width)return;wxCursor=wxTime(wxTimeline(),(x-r.left)/r.width);renderWxScrub()};
wxGraph.addEventListener('pointerdown',e=>{if(e.button!==0)return;wxScrubbing=true;try{wxGraph.setPointerCapture(e.pointerId)}catch{}wxScrubAt(e.clientX)});
wxGraph.addEventListener('pointermove',e=>{if(wxScrubbing)wxScrubAt(e.clientX)});
['pointerup','pointercancel','lostpointercapture'].forEach(n=>wxGraph.addEventListener(n,()=>{wxScrubbing=false}));
wxGraph.addEventListener('keydown',e=>{
  const tl=wxTimeline(),step={ArrowLeft:-HOUR,ArrowRight:HOUR,ArrowDown:-HOUR,ArrowUp:HOUR,PageUp:-24*HOUR,PageDown:24*HOUR}[e.key];
  if(step){e.preventDefault();wxCursor=Math.max(tl.start,Math.min(tl.end-HOUR,Math.round(wxCursor/HOUR)*HOUR+step));renderWxScrub(tl)}
  else if(e.key==='Home'||e.key==='End'){e.preventDefault();wxCursor=e.key==='Home'?tl.start:tl.end-HOUR;renderWxScrub(tl)}
});
$('wxDialogClose').addEventListener('click',closeWxDialog);
wxDialog.addEventListener('click',e=>{if(e.target===wxDialog)closeWxDialog()});
wxDialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeWxDialog()}});
renderWeather();

window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',()=>{wxWake();paintWx(root)});
wxWake();

/* TV mode */
const tvNav=$('tvNav');
if(!bridge.fullscreenSupported)tvNav.hidden=true;
tvNav.addEventListener('click',()=>bridge.toggleFullscreen());

/* remote / keyboard shortcuts during a move */
root.addEventListener('keydown',e=>{
  if(!views.workout.classList.contains('active')||countdown.classList.contains('active'))return;
  if(e.target.closest('input,select,textarea,.holdEnd'))return;
  if(e.key==='MediaPlayPause'||(e.key===' '&&!e.target.closest('button'))){e.preventDefault();pauseBtn.click()}
  else if(e.key==='MediaTrackNext'){e.preventDefault();$('skipExercise').click()}
  else if(e.key==='MediaTrackPrevious'){e.preventDefault();$('restartSegment').click()}
});

/* nav and controls */
root.querySelectorAll('[data-rounds-step]').forEach(b=>b.addEventListener('click',()=>{
 const next=Math.max(1,Math.min(10,(Number(roundsInput.value)||1)+Number(b.dataset.roundsStep)));
 if(String(next)===roundsInput.value)return;
 roundsInput.value=next;roundsInput.dispatchEvent(new Event('input',{bubbles:true}));
}));
[totalInput,workInput,restInput,roundsInput].forEach(i=>i.addEventListener('input',()=>{
 const profile=workoutProfiles[selectedWorkoutKey];
 if(profile){
   profile.total=Number(totalInput.value);
   profile.work=Number(workInput.value);
   profile.rest=Number(restInput.value);
 }
 buildRoutine();
}));
homeNav.addEventListener('click',showHome);
settingsNav.addEventListener('click',()=>showView('settings'));
$('settingsBack').addEventListener('click',showHome);
pauseBtn.addEventListener('click',()=>setPaused(!paused));

// Load the selected move's saved timing into the editor before building, so the
// default slider values never overwrite what was saved.
setWorkoutProfile(selectedWorkoutKey);
renderFeelingRows();
renderFeelWeek();
renderInsights();

/* Apple Health help: the Integrations button jumps to the Help tab */
$('healthHelpOpen').addEventListener('click',()=>root.querySelector('.tab[data-pane=helpPane]').click());

/* reset stats: clears what you've done, keeps your moves and settings */
bindFuseHold($('resetStats'),$('resetStatsFill'),1500,()=>{
  store.history=[];
  store.checkins=[];
  dismissedKey='';
  try{localStorage.removeItem('move-assistant-dismissed')}catch(_e){}
  persist();
  renderWeek();renderFeelWeek();renderFeelingRows();renderInsights();updateCheckinTab();
  showToast('Stats reset');
});

/* check-in settings */
const morningTimeInput=$('morningTime'),eveningTimeInput=$('eveningTime'),checkinAutoOpen=$('checkinAutoOpen');
morningTimeInput.value=checkinTimes().morning;
eveningTimeInput.value=checkinTimes().evening;
checkinAutoOpen.classList.toggle('on',settings().checkinAutoOpen!==false);
[['morningTime',morningTimeInput],['eveningTime',eveningTimeInput]].forEach(([key,input])=>input.addEventListener('change',()=>{
  if(!input.value)return;
  saveSetting(key,input.value);
  updateCheckinTab();
}));
checkinAutoOpen.addEventListener('click',()=>{
  const on=settings().checkinAutoOpen===false;
  checkinAutoOpen.classList.toggle('on',on);
  saveSetting('checkinAutoOpen',on);
});
setTimeout(checkCheckinDue,800);

/* phone notification: a Home Assistant automation that Move Assistant creates and keeps in sync */
const checkinNotify=$('checkinNotify'),notifyTarget=$('checkinNotifyTarget'),notifyStatus=$('checkinNotifyStatus');
const NOTIFY_DEFAULT_STATUS=notifyStatus.textContent;
function renderNotifyTargets(){
  const services=bridge.notifyServices();
  const phones=services.filter(n=>n.startsWith('mobile_app_'));
  const list=phones.length?phones:services;
  const name=n=>n.replace(/^mobile_app_/,'').replace(/_/g,' ');
  notifyTarget.innerHTML=list.map(n=>'<option value="'+esc(n)+'">'+esc(name(n))+'</option>').join('');
  if(!settings().notifyTarget&&list[0])settings().notifyTarget=list[0];
  notifyTarget.value=settings().notifyTarget||'';
}
function renderNotify(){
  const on=Boolean(settings().notifyOn);
  checkinNotify.classList.toggle('on',on);
  $('checkinNotifyTargetRow').hidden=!on;
  const t=checkinTimes();
  notifyStatus.textContent=on?'Sends at '+t.morning+' and '+t.evening:NOTIFY_DEFAULT_STATUS;
}
async function syncNotifyAutomation(){
  const on=Boolean(settings().notifyOn);
  try{
    await bridge.setReminderAutomation(on?{target:settings().notifyTarget,times:checkinTimes()}:null);
    return true;
  }catch(_e){
    showToast("Couldn't update the reminder in Home Assistant");
    return false;
  }
}
checkinNotify.addEventListener('click',async()=>{
  const on=!settings().notifyOn;
  if(on){
    renderNotifyTargets();
    if(!settings().notifyTarget){showToast('Install the Companion app on your phone first');return}
  }
  settings().notifyOn=on;
  renderNotify();
  if(await syncNotifyAutomation()){
    persist();
    showToast(on?'Check-in notifications on':'Check-in notifications off');
  }else{
    settings().notifyOn=!on;
    renderNotify();
  }
});
notifyTarget.addEventListener('change',()=>{
  saveSetting('notifyTarget',notifyTarget.value);
  if(settings().notifyOn)syncNotifyAutomation();
});
[morningTimeInput,eveningTimeInput].forEach(input=>input.addEventListener('change',()=>{
  renderNotify();
  if(settings().notifyOn)syncNotifyAutomation();
}));
renderNotifyTargets();
renderNotify();
let insightTimer=null;
function renderInsightsSoon(){
  // step counts tick often; redraw the card at most every 30s
  if(insightTimer)return;
  insightTimer=setTimeout(()=>{insightTimer=null;renderInsights()},30000);
}

return {
  updateStates(states){
    const weatherChanged=!lastStates||lastStates[sensorEntities.weather]!==states[sensorEntities.weather]
      ||lastStates['sun.sun']?.state!==states['sun.sun']?.state;
    lastStates=states;
    renderSensorPickers(states);
    renderActivity(states);
    if(weatherChanged)renderWeather();
    if(Date.now()-stepHistoryLoadedAt>60*60*1000)loadStepHistory();
    renderInsightsSoon();
  },
  applyRemoteData(data){
    // Another device saved; only take history/energy so an open editor isn't clobbered.
    if(!data)return;
    if(Array.isArray(data.history)){store.history=data.history;renderWeek()}
    if(Array.isArray(data.history)){renderInsights()}
    if(Array.isArray(data.checkins)){store.checkins=data.checkins.map(toPercentScale);updateCheckinTab();renderFeelingRows();renderFeelWeek();renderWeek();renderInsights()}
    if(data.profiles&&!modal.classList.contains('open')&&!session){
      const next=normaliseStore(data);
      Object.keys(workoutProfiles).forEach(k=>delete workoutProfiles[k]);
      Object.assign(workoutProfiles,next.profiles);
      store.order=next.order;
      if(!workoutProfiles[selectedWorkoutKey])selectedWorkoutKey=store.order[0];
      renderGallery();
      setWorkoutProfile(selectedWorkoutKey);
    }
  },
  suspend(){alive=false},
  resume(){
    if(alive)return;
    alive=true;
    if(!trailRAF)trailRAF=requestAnimationFrame(drawTrail);
    if(!rippleRAF)rippleRAF=requestAnimationFrame(drawRipple);
    wxWake();
    positionRubberIndicator(root.querySelector('.tab.active'),false);
  },
};
}
