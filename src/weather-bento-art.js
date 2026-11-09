// The weather page's sky strip and the Smooth icons, for the weather bento (weather-bento.js).
// The strip is weather-art.js's 12-hour sky with one change the Home Assistant weather patch made to it:
// `columns` (default 6), so the Next hours card can draw three days. The helpers it needs are copied from
// weather-art.js, which does not export them. The Smooth icons are app.js's Figma artwork (wxArt), which app.js
// does not export either; their classes start with wb here and gradient ids come from the caller.
import {WX_PALETTE,wxKey} from './weather-art.js';

const clamp=x=>x<0?0:x>1?1:x;
const hex=h=>{const s=String(h||'#000000').trim().replace('#','');const f=s.length===3?s.split('').map(c=>c+c).join(''):s;return [0,2,4].map(i=>parseInt(f.slice(i,i+2),16)||0)};
const toHex=c=>'#'+c.map(x=>Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,'0')).join('');
const MIX={};
const mix=(a,b,t)=>{const k=a+b+t;return MIX[k]||(MIX[k]=toHex(hex(a).map((x,i)=>x+(hex(b)[i]-x)*t)))};
const RGB={};
const rgbOf=h=>RGB[h]||(RGB[h]=hex(h));

function skies(C){
  const S={clear:[C.skyClearDay,C.skyClearNight],cloudy:[C.skyCloudyDay,C.skyCloudyNight],rain:[C.skyRainDay,C.skyRainNight],snow:[C.skySnowDay,C.skySnowNight],fog:[C.skyFogDay,C.skyFogNight]};
  S.partly=[mix(S.clear[0],S.cloudy[0],.12),mix(S.clear[1],S.cloudy[1],.12)];
  S.storm=[mix(S.rain[0],'#000000',.22),mix(S.rain[1],'#000000',.22)];
  return S;
}

const B8=[0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,
  3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
const th=(x,y)=>(B8[(y&7)*8+(x&7)]+.5)/64;
const SKYID=0,SUN=1,MOON=2,CLOUD=3,RAIN=4,SNOW=5,BOLT=6,STAR=7,RAY=8;
const inCloud=(u,v)=>v<=.6665&&((u-.5)*(u-.5)+(v-.2877)*(v-.2877)<=.0824||(u-.25)*(u-.25)+(v-.416)*(v-.416)<=.0625||
  (u-.791)*(u-.791)+(v-.458)*(v-.458)<=.0437||(u>=.25&&u<=.791&&v>=.416));
const inPoly=(pts,x,y)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c}return c};

// To pixels: colour as drawn, or ink and paper with outlines round the shapes. Empty cells stay clear.
function toPixels(col,ids,w,h,{oneBit,ink,paper,snowInk}){
  const data=new Uint8ClampedArray(w*h*4),inkRgb=rgbOf(ink),paperRgb=rgbOf(paper);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,id=ids[i];
    if(col[i]==null)continue;
    let rgb=rgbOf(col[i]);
    if(oneBit){
      let dark;
      if(id===RAIN||id===RAY)dark=true;
      else if(id===SNOW)dark=snowInk;
      else if(id===STAR||id===BOLT)dark=false;
      else dark=Math.round((.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])/255*4)/4<=th(x,y);
      if((id===SUN||id===MOON||id===CLOUD||id===BOLT)&&((x>0&&ids[i-1]!==id)||(x<w-1&&ids[i+1]!==id)||(y>0&&ids[i-w]!==id)||(y<h-1&&ids[i+w]!==id)))dark=true;
      rgb=dark?inkRgb:paperRgb;
    }
    data[i*4]=rgb[0];data[i*4+1]=rgb[1];data[i*4+2]=rgb[2];data[i*4+3]=255;
  }
  return {w,h,data};
}

// ---- The 12-hour sky ----
// Columns (six unless o.columns says otherwise), one per day. Time runs across each column from 06:00 to 06:00 the next day, so the left half is the
// day and the right half the night; segs are the halves in order (two per column), each {cond (Home Assistant condition), night}.
// Day and night meet along a wave: highest at noon, half way at dusk and dawn, lowest at midnight.
// Marks are placed in a 90 px tall sky and spread to the strip's height.
const COVER={clear:0,partly:.35,cloudy:.85,fog:.9,rain:1,storm:1,snow:.9};
const kindOfCond=c=>wxKey(c,false).split('/')[0];
const seeded=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296};
const CLOUD_PATH='M41.0875 21.224C40.4398 17.9648 38.6815 15.0313 36.1125 12.9237C33.5435 10.816 30.3229 9.66488 27 9.66651C21.4608 9.66651 16.65 12.8098 14.2542 17.3907C11.4355 17.6995 8.83007 19.0382 6.93769 21.1499C5.0453 23.2616 3.99919 25.9976 4 28.8332C4 31.8832 5.2116 34.8082 7.36827 36.9649C9.52494 39.1216 12.45 40.3332 15.5 40.3332H40.4167C41.6752 40.3332 42.9213 40.0853 44.084 39.6037C45.2468 39.1221 46.3032 38.4162 47.1931 37.5263C48.083 36.6364 48.7889 35.5799 49.2705 34.4172C49.7521 33.2545 50 32.0083 50 30.7498C50 25.6898 46.0708 21.5882 41.0875 21.224Z';
const MOON_PATH='M21.0459 6.11182C19.2847 8.44583 18.2402 11.3513 18.2402 14.5005C18.2405 22.199 24.4811 28.4398 32.1797 28.4399C34.9446 28.4399 37.5211 27.634 39.6885 26.2456C38.1734 34.0818 31.2788 40.0005 23 40.0005C13.6113 40.0005 6.00026 32.3891 6 23.0005C6 14.2725 12.5775 7.08102 21.0459 6.11182Z';
const STAR_PATH='M0 -1L0.2687 -0.2687L1 0L0.2687 0.2687L0 1L-0.2687 0.2687L-1 0L-0.2687 -0.2687Z';
const BOLT_PATH='M7 0L0 13L5 13L2 24L11 9L6 9L9 0Z';
const BOLT_STRIP=[[7,0],[0,13],[5,13],[2,24],[11,9],[6,9],[9,0]];
const BOLT_SMALL=['.##','##.','.#.','#..'];

function stripGeometry(segs,{width,height,colors,wave=.38,soft=6,glow=.6,columns=6}){
  const C={...WX_PALETTE,dawn:'#e5a77e',...colors},SKY=skies(C),W=width,H=height,cw=W/columns,sw=cw/2,TAU=Math.PI*2;
  const list=segs.length?segs:[{cond:'cloudy',night:false}];
  const S=[...Array(columns*2)].map((_,i)=>{const s=list[Math.min(i,list.length-1)],k=kindOfCond(s.cond),night=i%2===1;return {cond:s.cond,k,night,sky:SKY[k][night?1:0],cover:COVER[k]}});
  const yb=x=>H*(.5-wave*Math.cos(TAU*(x/cw-.25)));
  const side=(night,x,y)=>{const d=(night?yb(x)-y:y-yb(x))/Math.max(3,soft*1.4)+.5;return d<=0?0:d>=1?1:d};
  // a warm glow just under the wave at dusk and dawn, fainter under cloud
  const glowAt=x=>{
    const ph=((x/cw-.25)%1+1)%1,di=Math.max(0,Math.min(columns-1,Math.round(x/cw-.25))),ni=Math.max(0,Math.min(columns-1,Math.round(x/cw-.75)));
    const clear=1-(S[2*di].cover+S[2*ni+1].cover)/2,s=Math.sin(Math.PI*Math.min(1,Math.max(0,yb(x)/H)));
    return {c:ph<.5?C.dusk:C.dawn,a:glow*(.2+.8*clear)*s*s};
  };
  return {C,S,W,H,cw,sw,TAU,yb,side,glowAt,soft,tw:cw*.3,sy:H/90};
}

// Where the sun, moon, stars, clouds, rain, snow, fog and lightning sit, with a fixed seed so a week always looks the same
function stripMarks(G,{clock=0,ambient=false,seed=1}){
  const {S,sw,side,C,TAU,sy,H}=G,c=clock;
  const M={stars:[],suns:[],moons:[],clouds:[],drops:[],flakes:[],fogs:[],bolts:[]};
  S.forEach((s,i)=>{
    const r=seeded(seed*977+i*131+7),cx=(i+.5)*sw;
    const n=s.night?({clear:9,partly:5,cloudy:2,fog:0,rain:0,storm:0,snow:1})[s.k]:0;
    for(let j=0;j<n;j++){
      const x=cx+(r()-.5)*sw*1.6,y=(6+r()*76)*sy,big=r()<.35,size=1.8+r()*1.6;
      const o=side(true,x,y)*(big?.95:.7)*(ambient?.6+.4*Math.sin(TAU*c/2600+j*1.7+i):1);
      if(o>=.03)M.stars.push({x,y,big,size,o});
    }
    if(!s.night&&(s.k==='clear'||s.k==='partly')){
      const x=cx+(r()-.5)*sw*.3,rad=Math.min(15,sw*.29);
      M.suns.push({x,y:32*sy,rad,halo:rad*2.8*(ambient?1+.07*Math.sin(TAU*c/3600+i):1)});
    }
    if(s.night&&(s.k==='clear'||s.k==='partly')){
      const sc=Math.min(.78,sw*.55/34),x=cx-23*sc+(r()-.5)*sw*.2;
      M.moons.push({x:x+23*sc,y:(4+(ambient?.8*Math.sin(TAU*c/5200+i):0))*sy+23*sc,d:46*sc});
    }
  });
  // clouds sized by the sky's height, not the width of a half day (Matt, 1 Nov: way too big once the strip showed fewer
  // hours across): 56 to 100 wide, more of them across a wide half so cloudy still looks cloudy
  const cloudW=Math.max(56,Math.min(100,H*.45)),spread=Math.max(1,sw/(cloudW*2.4));
  S.forEach((s,i)=>{
    const base=({clear:0,partly:1,cloudy:3,fog:0,rain:3,storm:3,snow:2})[s.k];if(!base)return;
    const n=s.k==='partly'?1:Math.round(base*spread);
    const r=seeded(seed*577+i*71+3),cx=(i+.5)*sw;
    const fill=s.k==='rain'||s.k==='storm'||s.night?C.cloudNight:C.cloudDay,alpha=s.night?.82:s.k==='storm'?.75:1;
    for(let j=0;j<n;j++){
      const sc=cloudW/46*(s.k==='partly'?1:.8+r()*.4);
      // spread evenly across the half, each nudged a little, so they don't bunch up
      const x=cx+(s.k==='partly'?sw*.12:((j+.5)/n-.5)*sw*.95+(r()-.5)*sw*.5/n),y=(s.k==='partly'?40:6+r()*26)*sy;
      const dx=ambient?2.5*Math.sin(TAU*c/9000+i*1.3+j*2.1):0,dy=ambient?.9*Math.sin(TAU*c/6100+i+j):0;
      M.clouds.push({x:x-23*sc+dx,y:y-15.33*sc+dy,w:46*sc,h:30.66*sc,fill,o:alpha*(n>1&&j===0?.85:1)});
    }
  });
  S.forEach((s,i)=>{
    const r=seeded(seed*313+i*29+11),cx=(i+.5)*sw;
    const nr=s.cond==='pouring'?16:s.cond==='rainy'||s.cond==='hail'?9:s.cond==='lightning-rainy'?12:s.cond==='snowy-rainy'?5:0;
    for(let j=0;j<nr;j++){
      let x=cx+(r()-.5)*sw*1.05,y=44+r()*36,fade=1;
      if(ambient){const yr=((y-44+c*.04)%36+36)%36;x-=.21*(yr-(y-44));y=44+yr;fade=Math.min(1,yr/6,(36-yr)/6)}
      y*=sy;const o=side(s.night,x,y)*fade;if(o>=.05)M.drops.push({x,y,o});
    }
    const ns=s.cond==='snowy'?11:s.cond==='snowy-rainy'?6:0;
    for(let j=0;j<ns;j++){
      let x=cx+(r()-.5)*sw*1.05,y=40+r()*44,fade=1;
      if(ambient){const yr=((y-40+c*.009)%44+44)%44;y=40+yr;x+=1.6*Math.sin(TAU*c/2800+j*1.9+i);fade=Math.min(1,yr/6,(44-yr)/6)}
      y*=sy;const o=side(s.night,x,y)*fade;if(o>=.05)M.flakes.push({x,y,o});
    }
    if(s.k==='fog'){
      const fc=s.night?'#c8ccd6':'#ffffff',a=s.night?.28:.62,fx=ambient?4*Math.sin(TAU*c/8000+i):0;
      for(let j=0;j<4;j++)M.fogs.push({x:cx-sw*.75+(j%2)*sw*.18+(j%2?fx:-fx),y:(30+j*13)*sy,w:sw*1.3,c:fc,a});
    }
    if(s.k==='storm'){
      const fl=(c/3400+i*.37)%1;
      M.bolts.push({x:cx+(r()-.5)*sw*.3-5,y:36*sy,o:ambient&&!(fl<.05||(fl>.09&&fl<.12))?.8:1});
    }
  });
  return M;
}

function rasterStrip(G,M,GX,GY,pw,ph,clock,ambient){
  const {S,C,cw,yb,glowAt,soft,tw,sy}=G;
  const col=new Array(GX*GY),ids=new Uint8Array(GX*GY),isNight=new Uint8Array(GX*GY);
  const put=(x,y,cc,o,id)=>{if(cc==null||x<0||y<0||x>=GX||y>=GY)return;if(o>=1||o>th(x+5,y+3)){col[y*GX+x]=cc;ids[y*GX+x]=id}};
  const box=(cx,cy,r,fn)=>{for(let y=Math.max(0,Math.floor(cy-r)-1);y<=Math.min(GY-1,cy+r+1);y++)for(let x=Math.max(0,Math.floor(cx-r)-1);x<=Math.min(GX-1,cx+r+1);x++)fn(x,y,x+.5-cx,y+.5-cy)};
  // each half keeps its colour; the hand-over is dithered where the other half hides it
  const bandAt=(cols,first,X)=>{
    for(let i=0;i<cols.length-1;i++){const b=(i+first)*cw;if(X<b-tw/2)return [cols[i],cols[i],0];if(X<=b+tw/2)return [cols[i],cols[i+1],(X-b+tw/2)/tw]}
    const l=cols[cols.length-1];return [l,l,0];
  };
  const dayCols=S.filter(s=>!s.night).map(s=>s.sky),nightCols=S.filter(s=>s.night).map(s=>s.sky),sb=soft/ph,gb=16*sy/ph;
  for(let x=0;x<GX;x++){
    const X=(x+.5)*pw,edge=yb(X)/ph,dB=bandAt(dayCols,.75,X),nB=bandAt(nightCols,1.25,X),g=glowAt(X);
    for(let y=0;y<GY;y++){
      const t=th(x,y),dd=y+.5-edge;
      const day=(sb>.01?clamp(.5+dd/sb):(dd>0?1:0))>t;
      let cc=day?(dB[2]>t?dB[1]:dB[0]):(nB[2]>t?nB[1]:nB[0]);
      // depth: day lightens toward the bottom, night darkens toward the top
      const depth=day?clamp(((y+.5)/GY-.45)/.55)*.7:clamp(1-(y+.5)/(GY*.55))*.7;
      if(depth>th(x+2,y+5))cc=day?mix(cc,'#ffffff',.18):mix(cc,'#000000',.25);
      if(day&&dd>=0&&dd<gb&&g.a*1.3*(1-dd/gb)>th(x+6,y+1))cc=g.c;
      col[y*GX+x]=cc;isNight[y*GX+x]=day?0:1;
    }
  }
  const sunHalo=mix(C.sun,'#ffffff',.55),moonLight=mix(C.moon,'#ffffff',.6);
  M.stars.forEach(s=>{
    const x=Math.floor(s.x/pw),y=Math.floor(s.y/ph);
    if(x<0||y<0||x>=GX||y>=GY||!isNight[y*GX+x]||s.o<.15)return;
    const cc=s.o>.45?C.star:mix(C.star,col[y*GX+x],.5),arm=s.big&&s.o>.6?Math.floor(s.size/pw):0;
    put(x,y,cc,1,STAR);
    for(let a=1;a<=arm;a++)[[x-a,y],[x+a,y],[x,y-a],[x,y+a]].forEach(p=>{if(p[0]>=0&&p[1]>=0&&p[0]<GX&&p[1]<GY&&isNight[p[1]*GX+p[0]])put(p[0],p[1],cc,1,STAR)});
  });
  M.suns.forEach(s=>{
    const r=Math.max(1.5,s.rad/pw),cx=s.x/pw,cy=s.y/ph,hr=s.halo/pw*.85;
    box(cx,cy,hr,(x,y,dx,dy)=>{const d=Math.sqrt(dx*dx+dy*dy);if(d>r&&d<hr&&!isNight[y*GX+x])put(x,y,sunHalo,.3*(1-(d-r)/(hr-r)),0)});
    if(ambient){
      const turn=Math.floor(clock/500)%2,len=Math.max(1,r*.3);
      for(let a=0;a<8;a++)if(a%2===turn)for(let q=r+1.2;q<r+1.2+len;q+=.7)put(Math.floor(cx+Math.cos(a*Math.PI/4)*q),Math.floor(cy+Math.sin(a*Math.PI/4)*q),C.sun,1,RAY);
    }
    box(cx,cy,r,(x,y,dx,dy)=>{if(dx*dx+dy*dy<=r*r)put(x,y,clamp(((dy/r+1)/2-.6)/.4)>th(x,y)?C.sunEdge:C.sun,1,SUN)});
  });
  M.moons.forEach(m=>{
    const R=Math.max(1.5,m.d*.37/pw),cx=m.x/pw,cy=m.y/ph,bx=cx+.547*R,by=cy-.503*R,br=.82*R;
    box(cx,cy,R,(x,y,dx,dy)=>{
      if(dx*dx+dy*dy>R*R)return;const ex=x+.5-bx,ey=y+.5-by;
      if(ex*ex+ey*ey>br*br)put(x,y,clamp((dy+R)/(2*R)*1.1-.1)>th(x,y)?C.moon:moonLight,1,MOON);
    });
  });
  M.clouds.forEach(cl=>{
    const w=Math.max(3,cl.w/pw),h=w*.6665,ox=cl.x/pw,oy=cl.y/ph,shade=mix(cl.fill,'#000000',.16);
    for(let y=Math.max(0,Math.floor(oy)-1);y<=Math.min(GY-1,oy+h+1);y++)for(let x=Math.max(0,Math.floor(ox)-1);x<=Math.min(GX-1,ox+w+1);x++){
      const u=(x+.5-ox)/w,q=(y+.5-oy)/w;
      if(inCloud(u,q))put(x,y,!inCloud(u,q+1/w)||clamp((q-.42)/.25)*.8>th(x,y)?shade:cl.fill,cl.o,CLOUD);
    }
  });
  M.fogs.forEach(f=>{
    const y1=Math.floor(f.y/ph),y2=Math.max(y1,Math.floor((f.y+6*sy)/ph)-1),x1=Math.floor(f.x/pw),x2=Math.floor((f.x+f.w)/pw);
    for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++){const u=(x-x1)/Math.max(1,x2-x1);put(x,y,f.c,f.a*(u<.25?u/.25:u>.75?(1-u)/.25:1),0)}
  });
  const dl=Math.max(2,Math.round(9/ph));
  M.drops.forEach(d=>{const x0=d.x/pw,y0=Math.floor(d.y/ph);for(let t=0;t<dl;t++)put(Math.floor(x0-.208*t*ph/pw),y0+t,C.rain,d.o,RAIN)});
  const fa=Math.max(0,Math.round(4.4/pw/2.6));
  M.flakes.forEach(k=>{
    const x=Math.floor(k.x/pw),y=Math.floor(k.y/ph);
    put(x,y,C.snow,k.o,SNOW);
    for(let a=1;a<=fa;a++){put(x-a,y,C.snow,k.o,SNOW);put(x+a,y,C.snow,k.o,SNOW);put(x,y-a,C.snow,k.o,SNOW);put(x,y+a,C.snow,k.o,SNOW)}
  });
  M.bolts.forEach(b=>{
    if(pw<=3.5){
      for(let y=Math.floor(b.y/ph);y<=(b.y+24)/ph;y++)for(let x=Math.floor(b.x/pw);x<=(b.x+11)/pw;x++)
        if(inPoly(BOLT_STRIP,(x+.5)*pw-b.x,(y+.5)*ph-b.y))put(x,y,C.sun,1,BOLT);
    }else{
      const ox=Math.round(b.x/pw),oy=Math.round(b.y/ph);
      BOLT_SMALL.forEach((row,sy2)=>row.split('').forEach((ch,sx)=>{if(ch==='#')put(ox+sx,oy+sy2,C.sun,1,BOLT)}));
    }
  });
  return {col,ids};
}

// Bitmap and 1-bit sky. reveal (0–1) paints the sky in from the left, over prev (the last week's sky) if there was one;
// with reduce it dissolves instead.
export function wbStripBitmap(segs,o){
  const px=o.px||2,GX=Math.max(6,Math.round(o.width/px)),GY=Math.max(6,Math.round(o.height/px)),pw=o.width/GX,ph=o.height/GY;
  const clock=o.ambient?Math.floor((o.clock||0)/100)*100:0;
  const rasterOf=sg=>{const G=stripGeometry(sg,o);return rasterStrip(G,stripMarks(G,{clock,ambient:o.ambient,seed:o.seed}),GX,GY,pw,ph,clock,o.ambient)};
  const nb=rasterOf(segs),f=o.reveal==null?1:clamp(o.reveal);
  let col=nb.col,ids=nb.ids;
  if(f<1){
    const ob=o.prev?rasterOf(o.prev):null,edge=f*(GX+12);
    col=new Array(GX*GY);ids=new Uint8Array(GX*GY);
    for(let i=0;i<GX*GY;i++){
      const x=i%GX,y=(i/GX)|0,t=o.reduce?f:clamp((edge-x)/12);
      if(t>th(x,y)){col[i]=nb.col[i];ids[i]=nb.ids[i]}
      else if(ob){col[i]=ob.col[i];ids[i]=ob.ids[i]}
      else{col[i]=null;ids[i]=255}
    }
  }
  return toPixels(col,ids,GX,GY,{oneBit:o.oneBit,ink:o.ink||'#26221e',paper:o.paper||'#fbf9f6',snowInk:false});
}

// Smooth sky, drawn on a 2D canvas context already scaled to CSS pixels. Soft edges are stacked bands, not filters,
// so it looks the same in every browser.
export function wbStripSmooth(ctx,segs,o){
  const W=o.width,H=o.height,f=o.reveal==null?1:clamp(o.reveal);
  const paint=(g,sg)=>{const G=stripGeometry(sg,o);drawSmooth(g,G,stripMarks(G,o))};
  ctx.clearRect(0,0,W,H);
  if(f>=1){paint(ctx,segs);return}
  if(o.prev)paint(ctx,o.prev);
  if(o.reduce){ctx.save();ctx.globalAlpha=f;paint(ctx,segs);ctx.restore();return}
  // the new sky in an offscreen canvas, faded out past the moving edge, then laid over the old one
  const cv=ctx.canvas,off=cv.__wxOff||(cv.__wxOff=document.createElement('canvas'));
  if(off.width!==cv.width||off.height!==cv.height){off.width=cv.width;off.height=cv.height}
  const g=off.getContext('2d');
  g.setTransform(ctx.getTransform());g.clearRect(0,0,W,H);
  paint(g,segs);
  const e=f*(W+64)-64,mask=g.createLinearGradient(e,0,e+64,0);
  mask.addColorStop(0,'rgba(0,0,0,1)');mask.addColorStop(1,'rgba(0,0,0,0)');
  g.globalCompositeOperation='destination-in';g.fillStyle=mask;g.fillRect(0,0,W,H);g.globalCompositeOperation='source-over';
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(off,0,0);ctx.restore();
}

function drawSmooth(ctx,G,M){
  const {W,H,S,C,cw,yb,glowAt,soft,tw,sy}=G;
  // a very faint shadow under the sun, the moons and the clouds (Matt, 1 Nov); the canvas's scale undone so it's the
  // same at any pixel density
  const dpr=ctx.getTransform().a||1;
  const lift=on=>{ctx.shadowColor=on?'rgba(28,18,8,.22)':'transparent';ctx.shadowBlur=on?4*dpr:0;ctx.shadowOffsetY=on?1.5*dpr:0};
  const rgba=(h,a)=>{const c=rgbOf(h);return 'rgba('+c[0]+','+c[1]+','+c[2]+','+Math.max(0,Math.min(1,a)).toFixed(3)+')'};
  const band=(cols,first)=>{
    const gr=ctx.createLinearGradient(0,0,W,0);gr.addColorStop(0,cols[0]);
    for(let i=0;i<cols.length-1;i++){const m=(i+first)*cw,a=(m-tw/2)/W,b=(m+tw/2)/W;if(a>0&&a<1)gr.addColorStop(a,cols[i]);if(b>0&&b<1)gr.addColorStop(b,cols[i+1])}
    gr.addColorStop(1,cols[cols.length-1]);return gr;
  };
  const N=Math.max(24,Math.ceil(W/4));
  const region=(top,bottom)=>{
    ctx.beginPath();
    for(let k=0;k<=N;k++){const x=W*k/N,y=top==null?0:yb(x)+top;k?ctx.lineTo(x,y):ctx.moveTo(x,y)}
    for(let k=N;k>=0;k--){const x=W*k/N;ctx.lineTo(x,yb(x)+bottom)}
    ctx.closePath();ctx.fill();
  };
  ctx.save();
  ctx.fillStyle=band(S.filter(s=>!s.night).map(s=>s.sky),.75);ctx.fillRect(0,0,W,H);
  // glow under the wave in thin bands that fade downward
  const glow=ctx.createLinearGradient(0,0,W,0);
  for(let k=0;k<=64;k++){const g=glowAt(W*k/64);glow.addColorStop(k/64,rgba(g.c,Math.min(1,g.a)))}
  ctx.fillStyle=glow;
  for(let b=0;b<8;b++){ctx.globalAlpha=1-b/8;region(b*2*sy,(b+1)*2*sy)}
  // night above the wave, its edge softened in bands
  ctx.fillStyle=band(S.filter(s=>s.night).map(s=>s.sky),1.25);
  const sf=Math.max(.5,soft),n=6;
  ctx.globalAlpha=1;region(null,-sf);
  for(let b=0;b<n;b++){ctx.globalAlpha=1-(b+.5)/n;region(-sf+2*sf*b/n,-sf+2*sf*(b+1)/n)}
  ctx.globalAlpha=1;
  const star=new Path2D(STAR_PATH),moon=new Path2D(MOON_PATH),cloud=new Path2D(CLOUD_PATH),bolt=new Path2D(BOLT_PATH);
  ctx.fillStyle=C.star;
  M.stars.forEach(s=>{
    ctx.globalAlpha=s.o;
    if(s.big){ctx.save();ctx.translate(s.x,s.y);ctx.scale(s.size,s.size);ctx.fill(star);ctx.restore()}
    else{ctx.beginPath();ctx.arc(s.x,s.y,.8,0,Math.PI*2);ctx.fill()}
  });
  ctx.globalAlpha=1;
  const halo=mix(C.sun,'#ffffff',.55);
  M.suns.forEach(s=>{
    const hg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.halo);hg.addColorStop(0,rgba(halo,.42));hg.addColorStop(.7,rgba(halo,0));
    ctx.fillStyle=hg;ctx.beginPath();ctx.arc(s.x,s.y,s.halo,0,Math.PI*2);ctx.fill();
    const dg=ctx.createLinearGradient(0,s.y-s.rad,0,s.y+s.rad);dg.addColorStop(.6,C.sun);dg.addColorStop(1,C.sunEdge);
    ctx.fillStyle=dg;lift(true);ctx.beginPath();ctx.arc(s.x,s.y,s.rad,0,Math.PI*2);ctx.fill();lift(false);
  });
  const light=mix(C.moon,'#ffffff',.6);
  M.moons.forEach(m=>{
    ctx.save();ctx.translate(m.x-m.d/2,m.y-m.d/2);ctx.scale(m.d/46,m.d/46);
    const mg=ctx.createLinearGradient(0,6,0,40);mg.addColorStop(0,light);mg.addColorStop(1,C.moon);
    ctx.fillStyle=mg;lift(true);ctx.fill(moon);lift(false);ctx.restore();
  });
  M.clouds.forEach(cl=>{
    ctx.save();ctx.globalAlpha=cl.o;ctx.translate(cl.x,cl.y);ctx.scale(cl.w/46,cl.h/30.66);ctx.translate(-4,-9.67);
    ctx.fillStyle=cl.fill;lift(true);ctx.fill(cloud);lift(false);ctx.restore();
  });
  M.fogs.forEach(fg=>{
    const gr=ctx.createLinearGradient(fg.x,0,fg.x+fg.w,0);
    gr.addColorStop(0,rgba(fg.c,0));gr.addColorStop(.25,rgba(fg.c,fg.a));gr.addColorStop(.75,rgba(fg.c,fg.a));gr.addColorStop(1,rgba(fg.c,0));
    ctx.fillStyle=gr;ctx.fillRect(fg.x,fg.y,fg.w,6*sy);
  });
  ctx.fillStyle=C.rain;
  M.drops.forEach(d=>{ctx.save();ctx.globalAlpha=d.o;ctx.translate(d.x,d.y);ctx.rotate(12*Math.PI/180);ctx.fillRect(-1.5,0,3,9);ctx.restore()});
  ctx.fillStyle=C.snow;
  M.flakes.forEach(k=>{ctx.globalAlpha=k.o;ctx.beginPath();ctx.arc(k.x,k.y,2.2,0,Math.PI*2);ctx.fill()});
  ctx.fillStyle=C.sun;
  M.bolts.forEach(b=>{ctx.save();ctx.globalAlpha=b.o;ctx.translate(b.x,b.y);ctx.fill(bolt);ctx.restore()});
  ctx.restore();
}

// ---- Smooth icons (app.js) ----
const wxKind=c=>c==='sunny'?'clear':c==='clear-night'?'night':c==='partlycloudy'?'partly':
  ['rainy','pouring','lightning','lightning-rainy','hail'].includes(c)?'rain':['snowy','snowy-rainy'].includes(c)?'snow':'cloudy';
// Weather icons: artwork from the Figma "Weather icon" component, Condition × Time (day, night) × Size [Small 54, Large 90].
// The sky is the .wbWx background (weather-bento.css); clouds, drops and stars use classes or fixed colours from Figma.
const WX_CLOUD={s:'M41.0875 21.224C40.4398 17.9648 38.6815 15.0313 36.1125 12.9237C33.5435 10.816 30.3229 9.66488 27 9.66651C21.4608 9.66651 16.65 12.8098 14.2542 17.3907C11.4355 17.6995 8.83007 19.0382 6.93769 21.1499C5.0453 23.2616 3.99919 25.9976 4 28.8332C4 31.8832 5.2116 34.8082 7.36827 36.9649C9.52494 39.1216 12.45 40.3332 15.5 40.3332H40.4167C41.6752 40.3332 42.9213 40.0853 44.084 39.6037C45.2468 39.1221 46.3032 38.4162 47.1931 37.5263C48.083 36.6364 48.7889 35.5799 49.2705 34.4172C49.7521 33.2545 50 32.0083 50 30.7498C50 25.6898 46.0708 21.5882 41.0875 21.224Z',sp:'M41.025 27.045C40.5181 24.4943 39.142 22.1985 37.1315 20.5491C35.121 18.8996 32.6005 17.9987 30 18C25.665 18 21.9 20.46 20.025 24.045C17.8191 24.2867 15.7801 25.3344 14.2991 26.987C12.8181 28.6396 11.9994 30.7809 12 33C12 35.3869 12.9482 37.6761 14.636 39.364C16.3239 41.0518 18.6131 42 21 42H40.5C41.4849 42 42.4602 41.806 43.3701 41.4291C44.2801 41.0522 45.1069 40.4997 45.8033 39.8033C46.4997 39.1069 47.0522 38.2801 47.4291 37.3701C47.806 36.4602 48 35.4849 48 34.5C48 30.54 44.925 27.33 41.025 27.045Z',lp:'M70.8016 48.008C69.9751 43.8493 67.7316 40.1062 64.4536 37.4168C61.1755 34.7275 57.0661 33.2587 52.8261 33.2607C45.7581 33.2607 39.6196 37.2716 36.5625 43.1167C32.9659 43.5108 29.6414 45.219 27.2267 47.9135C24.8121 50.608 23.4772 54.0991 23.4783 57.7173C23.4783 61.609 25.0243 65.3414 27.7761 68.0933C30.528 70.8452 34.2604 72.3912 38.1522 72.3912H69.9456C71.5515 72.3912 73.1416 72.0749 74.6252 71.4604C76.1088 70.8458 77.4568 69.9451 78.5923 68.8096C79.7278 67.6741 80.6286 66.3261 81.2431 64.8425C81.8576 63.3589 82.1739 61.7688 82.1739 60.1629C82.1739 53.7064 77.1603 48.4727 70.8016 48.008Z',lc:'M65.3723 37.5398C64.4356 32.8266 61.8929 28.5843 58.1778 25.5364C54.4627 22.4885 49.8054 20.8238 45 20.8262C36.9897 20.8262 30.0326 25.3718 26.5679 31.9963C22.4918 32.4429 18.724 34.3788 15.9874 37.4326C13.2508 40.4864 11.738 44.443 11.7391 48.5436C11.7391 52.9542 13.4913 57.1842 16.6101 60.3031C19.7289 63.4219 23.9589 65.174 28.3696 65.174H64.4022C66.2221 65.174 68.0243 64.8155 69.7057 64.1191C71.3871 63.4226 72.9149 62.4018 74.2018 61.1149C75.4887 59.828 76.5095 58.3002 77.2059 56.6188C77.9024 54.9374 78.2609 53.1353 78.2609 51.3153C78.2609 43.9979 72.5788 38.0664 65.3723 37.5398Z',lr:'M62.9755 28.4431C62.149 24.2844 59.9055 20.5412 56.6275 17.8519C53.3494 15.1626 49.24 13.6937 45 13.6958C37.9321 13.6958 31.7935 17.7067 28.7364 23.5518C25.1398 23.9459 21.8153 25.654 19.4006 28.3485C16.986 31.043 15.6511 34.5342 15.6522 38.1523C15.6522 42.0441 17.1982 45.7765 19.9501 48.5284C22.7019 51.2802 26.4343 52.8262 30.3261 52.8262H62.1196C63.7254 52.8262 65.3155 52.5099 66.7991 51.8954C68.2827 51.2809 69.6307 50.3802 70.7662 49.2447C71.9017 48.1092 72.8025 46.7611 73.417 45.2775C74.0315 43.7939 74.3478 42.2038 74.3478 40.598C74.3478 34.1415 69.3342 28.9078 62.9755 28.4431Z'};
const WX_MOON={
 s:['M21.0459 6.11182C19.2847 8.44583 18.2402 11.3513 18.2402 14.5005C18.2405 22.199 24.4811 28.4398 32.1797 28.4399C34.9446 28.4399 37.5211 27.634 39.6885 26.2456C38.1734 34.0818 31.2788 40.0005 23 40.0005C13.6113 40.0005 6.00026 32.3891 6 23.0005C6 14.2725 12.5775 7.08102 21.0459 6.11182Z',6.11,40],
 l:['M41.1747 11.959C37.7298 16.5251 35.6875 22.2086 35.6874 28.3691C35.6874 43.4321 47.8979 55.6435 62.9608 55.6436C68.3701 55.6436 73.411 54.0676 77.6512 51.3516C74.6865 66.6826 61.197 78.2607 44.9999 78.2607C26.6305 78.2607 11.7391 63.3694 11.7391 45C11.7392 27.9244 24.6071 13.8562 41.1747 11.959Z',11.96,78.26],
 sp:['M16.6201 5.0791C15.3771 6.72655 14.6397 8.7772 14.6396 11C14.6396 16.4345 19.046 20.8398 24.4805 20.8398C26.4326 20.8398 28.2502 20.2686 29.7803 19.2881C28.7119 24.821 23.8449 29 18 29C11.3726 29 6 23.6274 6 17C6 10.8393 10.6426 5.76349 16.6201 5.0791Z',5.08,29],
 lp:['M32.5175 9.93848C30.0859 13.1616 28.6435 17.1729 28.6434 21.5215C28.6434 32.1541 37.2628 40.7733 47.8954 40.7734C51.7136 40.7734 55.2724 39.6622 58.2655 37.7451C56.1724 48.5666 46.6506 56.7391 35.2177 56.7393C22.251 56.7393 11.7391 46.2274 11.7391 33.2607C11.7393 21.2073 20.8226 11.2776 32.5175 9.93848Z',9.94,56.74]
};
const wxCloud=(d,cls)=>'<path class="'+cls+'" d="'+d+'"/>';
// Figma's 4-point star: inner radius 0.38. Classes and delays on the parts drive the Smooth idle loops (weather-bento.css, .wbMotion).
const wxDelay=(x,period)=>' style="animation-delay:-'+Math.round(x*137%period)+'ms"';
const wxStar=(x,y,r,o)=>{const k=r*.2687;return '<path class="wbTwinkle" fill="#fff"'+(o<1?' opacity="'+o+'"':'')+wxDelay(x,2400)+' d="M'+x+' '+(y-r)+'L'+(x+k)+' '+(y-k)+'L'+(x+r)+' '+y+'L'+(x+k)+' '+(y+k)+'L'+x+' '+(y+r)+'L'+(x-k)+' '+(y+k)+'L'+(x-r)+' '+y+'L'+(x-k)+' '+(y-k)+'Z"/>'};
const wxMoon=([d,y1,y2],g)=>'<path class="wbMoonPath" d="'+d+'" fill="url(#'+g+')"/><defs><linearGradient id="'+g+'" x1="0" y1="'+y1+'" x2="0" y2="'+y2+'" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF4C7"/><stop offset="1" stop-color="#F2C95E"/></linearGradient></defs>';
const wxSun=(g,L)=>L?'<circle class="wbSunDisc" cx="45" cy="45" r="33.26" fill="url(#'+g+')"/><defs><linearGradient id="'+g+'" x1="12" y1="8.5" x2="67" y2="73.5" gradientUnits="userSpaceOnUse"><stop offset=".653" stop-color="#FFE100"/><stop offset="1" stop-color="#F2C159"/></linearGradient></defs>'
  :'<circle class="wbSunDisc" cx="23" cy="23" r="17" fill="url(#'+g+')"/><defs><linearGradient id="'+g+'" x1="23" y1="6" x2="23" y2="40" gradientUnits="userSpaceOnUse"><stop offset=".606" stop-color="#FFE100"/><stop offset="1" stop-color="#FFAA00"/></linearGradient></defs>';
const wxDrops=L=>(L?['29.35','43.04','56.74'].map((x,i)=>'<g class="wbDrop" style="animation-delay:-'+i*317+'ms"><rect class="wbAccent" x="'+x+'" y="60.65" width="5.87" height="15.65" rx="2.93" transform="rotate(12 '+x+' 60.65)"/></g>')
  :[19,26,33].map((x,i)=>'<g class="wbDrop" style="animation-delay:-'+i*317+'ms"><rect class="wbAccent" width="3.03" height="9.41" rx="1.51" transform="matrix(0.9698 0.244 -0.1768 0.9843 '+x+' 38)"/></g>')).join('');
const wxFlakes=L=>(L?[[33.67,67.67],[47.67,64.67],[61.67,67.67],[40.67,77.67],[54.67,77.67]]:[[21.2,42.2],[29.2,40.2],[37.2,42.2],[25.2,48.2],[33.2,48.2]])
  .map(([x,y],i)=>'<circle class="wbFlake" style="animation-delay:-'+i*640+'ms" cx="'+x+'" cy="'+y+'" r="'+(L?3.67:2.2)+'" fill="#fff"/>').join('');
function wxArt(k,night,L,g){
  const lift=sh=>'<g filter="url(#'+g+'-sh)">'+sh+'</g>';
  if(k==='clear')return night?lift(wxMoon(L?WX_MOON.l:WX_MOON.s,g))+(L?wxStar(70,20,5.83,1)+wxStar(78.33,41.67,3.75,.8)+wxStar(60,71.67,3.33,.6):wxStar(42,12,3.5,1)+wxStar(47,25,2.25,.8)+wxStar(36,43,2,.6)):lift(wxSun(g,L));
  if(k==='partly')return lift(night?wxMoon(L?WX_MOON.lp:WX_MOON.sp,g):(L?'<circle class="wbSunDisc" cx="35.22" cy="33.26" r="23.48" fill="#FFE100"/>':'<circle class="wbSunDisc" cx="18" cy="17" r="12" fill="#FFE100"/>'))
    +lift(wxCloud(L?WX_CLOUD.lp:WX_CLOUD.sp,night?'wbCloudLight':'wbBright'))+(night?(L?wxStar(73.33,16.67,4.17,.9):wxStar(44,10,2.5,.9)):'');
  if(k==='cloudy')return lift(wxCloud(L?WX_CLOUD.lc:WX_CLOUD.s,night?'wbCloudLight':'wbBright'))+(night?(L?wxStar(15,15,3.75,.8)+wxStar(76.67,13.33,2.92,.6):wxStar(9,9,2.25,.8)+wxStar(46,8,1.75,.6)):'');
  return lift(wxCloud(L?WX_CLOUD.lr:WX_CLOUD.s,'wbCloudLight'))+(k==='rain'?wxDrops(L):wxFlakes(L));
}
// the shadow: straight down, soft and faint, a little larger on the large icon
const wxShadow=(g,L)=>'<defs><filter id="'+g+'-sh" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="'+(L?1.6:1)+'" stdDeviation="'+(L?1.8:1.1)+'" flood-color="#1c1208" flood-opacity=".22"/></filter></defs>';
// A condition as Smooth artwork: small (54 box) or large (90 box). id names the gradient, unique in the shadow root.
export function wbSmoothIcon(condition,large,isNight,id){
  let k=wxKind(condition);const night=k==='night'||!!isNight;if(k==='night')k='clear';
  const n=large?90:54;
  return {k,night,svg:'<svg viewBox="0 0 '+n+' '+n+'">'+wxShadow(id,large)+wxArt(k,night,large,id)+'</svg>'};
}
