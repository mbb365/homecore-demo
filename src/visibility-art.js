// The weather page's visibility tile (Matt, 28 Oct; HomeCore since 29 Oct), from the Home Assistant frontend patch
// (homecore-visibility-art.ts and homecore-landmarks.ts): a ship on the horizon that fog covers as the visibility drops,
// Figma "Visibility tile · proposal" (564:4340), and the distance as landmarks from the home's country.
//
//   visibilityBitmap(width, height, km, colors)  // RGBA pixels, one a CSS pixel; colors: skyClearDay, skyFogDay
//   nearestLandmarks(country, km)                // { from, to, km } or undefined
//   visibilityToKm(value, unit), visibilityLevel(km)
//
// One pixel a CSS pixel, twice the weather icons, with the same 8×8 dither and palette. A wider tile only gets a wider
// sea; the ship keeps its size, in the middle.
import {WX_PALETTE} from './weather-art.js';

const B8=[0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,
  51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
const th=(x,y)=>(B8[(y%8)*8+(x%8)]+.5)/64;
const rgb=hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
const mix=(a,b,t)=>[Math.round(a[0]+(b[0]-a[0])*t),Math.round(a[1]+(b[1]-a[1])*t),Math.round(a[2]+(b[2]-a[2])*t)];
const clamp=x=>x<0?0:x>1?1:x;
// Stable noise for the wave dashes
const noise=(x,y)=>{
  let h=(x*374761393+y*668265263)^0x5bd1e995;
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967296;
};

const WHITE=[255,255,255],INK=rgb('#26221e'),SEA_FAR=rgb('#0288d1'),SEA_NEAR=rgb('#01579b');
const CLOUD=rgb(WX_PALETTE.cloudDay),CLOUD_SHADE=rgb(WX_PALETTE.cloudNight),DUSK=rgb(WX_PALETTE.dusk),SUN_EDGE=rgb(WX_PALETTE.sunEdge),SUN=rgb(WX_PALETTE.sun);

// The ship is 2 km out; from 10 km nothing is fogged
const SHIP_KM=2,CLEAR_KM=10,THICK_KM=.3,SHIP_W=56,SHIP_H=21;

// The ship, bottom row first: x 0 is the bow, y 0 the waterline
function drawShip(sky){
  const ship=Array.from({length:SHIP_H},()=>new Array(SHIP_W).fill(undefined));
  const put=(x,y,c)=>{ship[y][x]=c};
  // Hull: raked bow, square stern, a red boot stripe and a light deck edge
  const boot=mix(DUSK,INK,.35),deck=mix(INK,WHITE,.22);
  for(let y=0;y<=6;y++){
    const right=y<2?SHIP_W-2:SHIP_W-1;
    for(let x=6-y;x<=right;x++)put(x,y,y<2?boot:y===6?deck:INK);
  }
  // Containers in blocks of five, two or three tiers, a dark seam between
  const colors=[DUSK,SUN_EDGE,CLOUD_SHADE,rgb(WX_PALETTE.skyRainDay),mix(DUSK,INK,.2),mix(sky,INK,.35)];
  [2,3,2,3,3].forEach((count,block)=>{
    const x0=9+block*6;
    for(let tier=0;tier<count;tier++){
      const c=colors[(block*2+tier*3)%colors.length];
      for(let x=x0;x<x0+5;x++){
        put(x,7+tier*2,mix(c,INK,.12));
        put(x,8+tier*2,tier===count-1?mix(c,WHITE,.3):c);
      }
      put(x0+5,7+tier*2,INK);
      put(x0+5,8+tier*2,INK);
    }
  });
  // Fore mast with its light
  for(let y=7;y<=12;y++)put(5,y,INK);
  put(5,13,SUN_EDGE);
  // Bridge: white, a shaded side, a band of windows and the wings
  for(let y=7;y<=14;y++)for(let x=42;x<=51;x++)put(x,y,x===51?CLOUD_SHADE:CLOUD);
  for(let x=43;x<=50;x+=2){put(x,12,INK);put(x,9,mix(INK,CLOUD,.4))}
  for(let x=40;x<=53;x++)put(x,14,x===40||x===53?CLOUD_SHADE:CLOUD);
  // Funnel with a band, and the main mast with its light
  for(let y=15;y<=18;y++)for(let x=46;x<=49;x++)put(x,y,y===18?INK:y===16?SUN_EDGE:DUSK);
  for(let y=15;y<=19;y++)put(44,y,INK);
  put(44,20,SUN);
  return ship;
}

// The picture as RGBA pixels, one a CSS pixel
export function visibilityBitmap(width,height,km,colors){
  const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
  const data=new Uint8ClampedArray(w*h*4);
  const sky=rgb(colors.skyClearDay),fog=rgb(colors.skyFogDay),ship=drawShip(sky);
  const hz=Math.round(h*.55);
  const haze=clamp(1-Math.log(km/THICK_KM)/Math.log(CLEAR_KM/THICK_KM));
  const skyBase=mix(sky,fog,haze);
  // Thin fog is no fog: the first tenth adds no dots
  const thin=f=>clamp((f-.1)/.9);
  const shipFog=clamp((1-Math.exp(-SHIP_KM/km)-.2)/.8);
  const sx=Math.round(w/2-SHIP_W/2),waterline=hz+3;
  for(let y=0;y<h;y++){
    const up=waterline-1-y,below=y-waterline;
    for(let x=0;x<w;x++){
      const lx=x-sx;
      let c,f;
      const part=up>=0&&up<SHIP_H&&lx>=0&&lx<SHIP_W?ship[up][lx]:undefined;
      if(part){c=part;f=shipFog}
      else if(up>=0&&up<=1&&lx>=4-up&&lx<=5-up){
        // Foam on the bow
        c=mix(WHITE,SEA_FAR,.15);f=shipFog;
      }else if(y<hz){
        // Day sky in four dithered steps, lighter toward the horizon
        const t=clamp(((y+.5)/hz-.15)/.85)*3,step=Math.min(3,Math.floor(t+th(x+2,y+5)));
        c=mix(skyBase,WHITE,step*.1);f=haze*.95;
      }else{
        const r=(y-hz+.5)/(h-hz);
        // Steep perspective: the water in front of you is metres away, so it clears last
        const d=Math.min(1.5,.006/(r*r)),t=clamp(r*1.4)*3,step=Math.min(3,Math.floor(t+th(x+1,y+6)));
        c=mix(SEA_FAR,SEA_NEAR,step/3);
        // Wave dashes, longer and closer together toward you
        const len=1+Math.round(r*7),cell=Math.floor(x/(len*3)),dash=.06+.16*r,onDash=x%(len*3)<len;
        if(onDash&&noise(cell,y)<dash)c=mix(c,WHITE,.18+.1*(1-r));
        else if(onDash&&r>.5&&noise(cell,y-1)<dash)c=mix(c,INK,.12);
        f=thin(1-Math.exp(-d/km));
        if(below===0&&lx>=3&&lx<=8){
          // Bow wave
          c=mix(c,WHITE,lx<6?.8:.45);f=shipFog;
        }else if(below>=0&&below<=2&&lx>=SHIP_W&&lx<SHIP_W+40){
          // Wake, thinning out behind the stern
          const fade=1-(lx-SHIP_W)/40;
          if(fade*(below===1?.9:.5)>th(x,y+3))c=mix(c,WHITE,.5);
          f=shipFog;
        }else if(below===0&&lx>=6&&lx<SHIP_W){
          // The hull's shadow on the water
          c=mix(c,INK,lx%2===0?.35:.2);f=shipFog;
        }
      }
      const out=f>th(x,y)?fog:c,i=(y*w+x)*4;
      data[i]=out[0];data[i+1]=out[1];data[i+2]=out[2];data[i+3]=255;
    }
  }
  return {data,w,h};
}

// Landmark pairs that make a visibility easy to picture, by the home's country (Matt, 28 Oct). Distances are straight
// lines between the landmarks' Wikipedia and Wikidata coordinates, checked 28 Oct 2026
const LANDMARKS={
  GB:[['Big Ben','the London Eye',.46],['Big Ben','Trafalgar Square',.85],['the London Eye','Buckingham Palace',1.58],['Big Ben','the Shard',2.66],
    ['Big Ben','Tower Bridge',3.45],['Buckingham Palace','Tower Bridge',4.64],['Big Ben','Hampstead Heath',7.09],['Buckingham Palace','Canary Wharf',8.48],
    ['Big Ben','Wembley Stadium',12.33],['Big Ben','Heathrow Airport',23.47],['Big Ben','Brighton Palace Pier',76.25]],
  NL:[['the Rijksmuseum','the Van Gogh Museum',.34],['Dam Square','the Anne Frank House',.64],['Dam Square','Amsterdam Centraal',.83],['Dam Square','the Rijksmuseum',1.54],
    ['Dam Square','the Vondelpark',2.37],['Dam Square','the Olympic Stadium',4.22],['Dam Square','the Johan Cruyff Arena',7.35],['Dam Square','Schiphol Airport',11.34],
    ['Dam Square','the Grote Kerk in Haarlem',17.33],['Dam Square','Keukenhof',26.12],['Dam Square','the Dom Tower in Utrecht',35.05],['Dam Square','the Erasmus Bridge in Rotterdam',58.61]]
};
// A pair counts as "as far as" when it's within this factor of the reading
const NEAR_ENOUGH=1.6;
export function nearestLandmarks(country,km){
  const pairs=country?LANDMARKS[String(country).toUpperCase()]:undefined;
  if(!pairs||!(km>0))return undefined;
  const off=p=>Math.abs(Math.log(p[2]/km));
  const best=pairs.reduce((a,b)=>off(b)<off(a)?b:a);
  return off(best)<=Math.log(NEAR_ENOUGH)?{from:best[0],to:best[1],km:best[2]}:undefined;
}
export const visibilityToKm=(value,unit)=>unit==='mi'?value*1.609344:unit==='m'?value/1000:unit==='ft'?value*.0003048:unit==='yd'?value*.0009144:value;
// The Met Office's visibility bands
export const visibilityLevel=km=>km<1?'very_poor':km<4?'poor':km<10?'moderate':km<20?'good':km<40?'very_good':'excellent';
