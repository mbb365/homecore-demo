// Weather bento: the HomeCore weather page from the Home Assistant frontend patch (homecore-weather-page.patch:
// hui-weather-bento-card, the weather page strategy and the cards in it), as plain JavaScript for the test page.
//
//   const bento = mountWeatherBento(container, { getHass, entityId, style });   // style: 'bitmap' | 'onebit' | 'smooth'
//   bento.update();      // whenever hass changes; redraws only the cards whose content changed
//   bento.setStyle(s);   // the weather style changed in Settings
//   bento.refresh();     // another choice in Settings changed (hoursWindow(): 'day' | 'waking' | 'all', Next hours' pages)
//   bento.destroy();     // unsubscribes, stops the timers and the paint clock, empties the container
//
// Cards, order and widths are the patch's (its Visibility since 29 Oct, when Matt asked for it): the weather card and
// Next hours (520), then data tiles (252), with Compared to average two wide; they wrap with the container, 16 apart, and
// go to the phone layout under 652. Heights follow the dashboard's grid on desktop (weather-bento.css).
// A card without data hides, as in the patch. Rules are in weather-bento.css; the container must sit inside #app so
// the card's tokens (and light mode) reach it. Weather art: weather-art.js, plus weather-bento-art.js for the three-day sky
// and visibility-art.js for the visibility tile's ship.
import {WX_PALETTE,wxKey,wxPose,wxBitmap} from './weather-art.js';
import {wbStripBitmap,wbStripSmooth,wbSmoothIcon} from './weather-bento-art.js';
import {visibilityBitmap,nearestLandmarks,visibilityToKm,visibilityLevel} from './visibility-art.js';

const MINUTE=6e4,HOUR=36e5,DAY=864e5,DAY_MINUTES=1440;
// The weather card: six days. Today's readings for the opened day are fetched again after ten minutes.
const DAYS=6,HISTORY_MAX_AGE=10*MINUTE;
// Next hours: from 06:00 over three days, a day half (06–18) and a night half (18–06) per column; about a day across the card
const STRIP_COLUMNS=3,MARK_EVERY=3;
// Next hours as pages (Matt, 1 Nov): each page a day's chosen hours, a swipe snapping from one day to the next
const WINDOWS={day:[6,22],waking:[7,23],all:[0,24]};
// Next days as bars: a colour for each temperature in °C, blue when cold to red when hot, as Apple Weather's
const TEMP_COLOURS=[[-5,[91,141,239]],[5,[79,195,230]],[12,[95,211,160]],[18,[255,211,77]],[24,[255,159,67]],[30,[255,91,79]]];
// Line (Matt, 1 Nov: a style to try): the weather as thin outline drawings on a 24 grid, round ends, in the text colour
const LINE_CLOUD='M6.5 18.5h11a4 4 0 0 0 .4-7.98 5.5 5.5 0 0 0-10.6-1.1A4.5 4.5 0 0 0 6.5 18.5Z';
const lineSun=(cx,cy,r,ray)=>'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'"/><path d="'+[0,45,90,135,180,225,270,315].map(a=>{
  const c=Math.cos(a*Math.PI/180),n=Math.sin(a*Math.PI/180),r1=r+2,r2=r+2+ray;
  return 'M'+(cx+c*r1).toFixed(2)+' '+(cy+n*r1).toFixed(2)+'L'+(cx+c*r2).toFixed(2)+' '+(cy+n*r2).toFixed(2);
}).join('')+'"/>';
const lineCloud=t=>'<path d="'+LINE_CLOUD+'"'+(t?' transform="'+t+'"':'')+'/>';
const lineMarks=d=>'<path d="'+d+'"/>';
const LINE_MOON='<path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10Z"/>';
function lineArt(condition,night){
  const up='translate(0,-3)';
  switch(condition){
    case 'sunny':return night?LINE_MOON:lineSun(12,12,4,2.5);
    case 'clear-night':return LINE_MOON;
    case 'partlycloudy':return (night?'<path d="M11.5 9.5A4.5 4.5 0 1 1 6 4a3.6 3.6 0 0 0 5.5 5.5Z"/>':lineSun(7.5,7.5,2.6,1.4))+lineCloud('translate(3.6,3) scale(.85)');
    case 'cloudy':return lineCloud();
    case 'fog':return lineMarks('M4 8.5h16M3 12.5h18M5 16.5h14');
    case 'rainy':return lineCloud(up)+lineMarks('M8.5 18.5 7.5 21M12.5 18.5l-1 2.5M16.5 18.5l-1 2.5');
    case 'pouring':return lineCloud(up)+lineMarks('M7.5 18.5 6 22M11 18.5 9.5 22M14.5 18.5 13 22M18 18.5 16.5 22');
    case 'snowy':return lineCloud(up)+lineMarks('M8 20h.01M12 21.5h.01M16 20h.01');
    case 'snowy-rainy':return lineCloud(up)+lineMarks('M8.5 18.5 7.5 21M12 21h.01M16.5 18.5l-1 2.5');
    case 'hail':return lineCloud(up)+'<circle cx="8" cy="20.5" r="1"/><circle cx="12" cy="21.5" r="1"/><circle cx="16" cy="20.5" r="1"/>';
    case 'lightning':return lineCloud(up)+lineMarks('M12.5 16 10.5 19.5h3l-2 3');
    case 'lightning-rainy':return lineCloud(up)+lineMarks('M12.5 16 10.5 19.5h3l-2 3M7.5 18.5l-1 2.5M17.5 18.5l-1 2.5');
    case 'windy':case 'windy-variant':return lineMarks('M3 8.5h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12h15.5a2.5 2.5 0 1 1-2.5 2.5M3 15.5h8');
    default:return '<circle cx="12" cy="12" r="8"/>'+lineMarks('M12 8v5M12 16h.01');
  }
}
const lineIcon=(condition,night)=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+lineArt(condition,night)+'</svg>';
const WET=new Set(['rainy','pouring','lightning','lightning-rainy','hail','snowy','snowy-rainy']);
// Data tiles: history refreshed every 30 minutes; a week of highs for the average (at least 3 days); 1 hPa in 3 hours is a trend
const REFRESH=30*MINUTE,AVERAGE_DAYS=7,MIN_AVERAGE_DAYS=3,PRESSURE_TREND_HPA=1;
const SUN_TICK=MINUTE,MOON_TICK=15*MINUTE;
// Visibility: past landmarks, the distance as a walk at 5 km/h
const WALKING_KMH=5;

// Material Design Icons, as the patch uses them
const I={
  back:'M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z',
  sunsetUp:'M3,12H7A5,5 0 0,1 12,7A5,5 0 0,1 17,12H21A1,1 0 0,1 22,13A1,1 0 0,1 21,14H3A1,1 0 0,1 2,13A1,1 0 0,1 3,12M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M12.71,16.3L15.82,19.41C16.21,19.8 16.21,20.43 15.82,20.82C15.43,21.21 14.8,21.21 14.41,20.82L12,18.41L9.59,20.82C9.2,21.21 8.57,21.21 8.18,20.82C7.79,20.43 7.79,19.8 8.18,19.41L11.29,16.3C11.5,16.1 11.74,16 12,16C12.26,16 12.5,16.1 12.71,16.3Z',
  sunsetDown:'M3,12H7A5,5 0 0,1 12,7A5,5 0 0,1 17,12H21A1,1 0 0,1 22,13A1,1 0 0,1 21,14H3A1,1 0 0,1 2,13A1,1 0 0,1 3,12M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M12.71,20.71L15.82,17.6C16.21,17.21 16.21,16.57 15.82,16.18C15.43,15.79 14.8,15.79 14.41,16.18L12,18.59L9.59,16.18C9.2,15.79 8.57,15.79 8.18,16.18C7.79,16.57 7.79,17.21 8.18,17.6L11.29,20.71C11.5,20.9 11.74,21 12,21C12.26,21 12.5,20.9 12.71,20.71Z',
  chartLine:'M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z',
  gauge:'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,14.4 19,16.5 17.3,18C15.9,16.7 14,16 12,16C10,16 8.2,16.7 6.7,18C5,16.5 4,14.4 4,12A8,8 0 0,1 12,4M14,5.89C13.62,5.9 13.26,6.15 13.1,6.54L11.81,9.77L11.71,10C11,10.13 10.41,10.6 10.14,11.26C9.73,12.29 10.23,13.45 11.26,13.86C12.29,14.27 13.45,13.77 13.86,12.74C14.12,12.08 14,11.32 13.57,10.76L13.67,10.5L14.96,7.29L14.97,7.26C15.17,6.75 14.92,6.17 14.41,5.96C14.28,5.91 14.15,5.89 14,5.89M10,6A1,1 0 0,0 9,7A1,1 0 0,0 10,8A1,1 0 0,0 11,7A1,1 0 0,0 10,6M7,9A1,1 0 0,0 6,10A1,1 0 0,0 7,11A1,1 0 0,0 8,10A1,1 0 0,0 7,9M17,9A1,1 0 0,0 16,10A1,1 0 0,0 17,11A1,1 0 0,0 18,10A1,1 0 0,0 17,9Z',
  waterPercent:'M12,3.25C12,3.25 6,10 6,14C6,17.32 8.69,20 12,20A6,6 0 0,0 18,14C18,10 12,3.25 12,3.25M14.47,9.97L15.53,11.03L9.53,17.03L8.47,15.97M9.75,10A1.25,1.25 0 0,1 11,11.25A1.25,1.25 0 0,1 9.75,12.5A1.25,1.25 0 0,1 8.5,11.25A1.25,1.25 0 0,1 9.75,10M14.25,14.5A1.25,1.25 0 0,1 15.5,15.75A1.25,1.25 0 0,1 14.25,17A1.25,1.25 0 0,1 13,15.75A1.25,1.25 0 0,1 14.25,14.5Z',
  rainy:'M6,14.03A1,1 0 0,1 7,15.03C7,15.58 6.55,16.03 6,16.03C3.24,16.03 1,13.79 1,11.03C1,8.27 3.24,6.03 6,6.03C7,3.68 9.3,2.03 12,2.03C15.43,2.03 18.24,4.69 18.5,8.06L19,8.03A4,4 0 0,1 23,12.03C23,14.23 21.21,16.03 19,16.03H18C17.45,16.03 17,15.58 17,15.03C17,14.47 17.45,14.03 18,14.03H19A2,2 0 0,0 21,12.03A2,2 0 0,0 19,10.03H17V9.03C17,6.27 14.76,4.03 12,4.03C9.5,4.03 7.45,5.84 7.06,8.21C6.73,8.09 6.37,8.03 6,8.03A3,3 0 0,0 3,11.03A3,3 0 0,0 6,14.03M12,14.15C12.18,14.39 12.37,14.66 12.56,14.94C13,15.56 14,17.03 14,18C14,19.11 13.1,20 12,20A2,2 0 0,1 10,18C10,17.03 11,15.56 11.44,14.94C11.63,14.66 11.82,14.4 12,14.15M12,11.03L11.5,11.59C11.5,11.59 10.65,12.55 9.79,13.81C8.93,15.06 8,16.56 8,18A4,4 0 0,0 12,22A4,4 0 0,0 16,18C16,16.56 15.07,15.06 14.21,13.81C13.35,12.55 12.5,11.59 12.5,11.59',
  sunnyAlert:'M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56M19,13V7H21V13H19M19,17V15H21V17',
  night:'M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C19.8,15.87 20.69,17.05 20.16,17.8C19.84,18.25 19.5,18.67 19.08,19.07C15.17,23 8.84,23 4.94,19.07C1.03,15.17 1.03,8.83 4.94,4.93C5.34,4.53 5.76,4.17 6.21,3.85C6.96,3.32 8.14,4.21 8.06,5.04C7.79,7.9 8.75,10.87 10.95,13.06C13.14,15.26 16.1,16.22 18.97,15.95M17.33,17.97C14.5,17.81 11.7,16.64 9.53,14.5C7.36,12.31 6.2,9.5 6.04,6.68C3.23,9.82 3.34,14.64 6.35,17.66C9.37,20.67 14.19,20.78 17.33,17.97Z',
  sunny:'M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z',
  windy:'M4,10A1,1 0 0,1 3,9A1,1 0 0,1 4,8H12A2,2 0 0,0 14,6A2,2 0 0,0 12,4C11.45,4 10.95,4.22 10.59,4.59C10.2,5 9.56,5 9.17,4.59C8.78,4.2 8.78,3.56 9.17,3.17C9.9,2.45 10.9,2 12,2A4,4 0 0,1 16,6A4,4 0 0,1 12,10H4M19,12A1,1 0 0,0 20,11A1,1 0 0,0 19,10C18.72,10 18.47,10.11 18.29,10.29C17.9,10.68 17.27,10.68 16.88,10.29C16.5,9.9 16.5,9.27 16.88,8.88C17.42,8.34 18.17,8 19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14H5A1,1 0 0,1 4,13A1,1 0 0,1 5,12H19M18,18H4A1,1 0 0,1 3,17A1,1 0 0,1 4,16H18A3,3 0 0,1 21,19A3,3 0 0,1 18,22C17.17,22 16.42,21.66 15.88,21.12C15.5,20.73 15.5,20.1 15.88,19.71C16.27,19.32 16.9,19.32 17.29,19.71C17.47,19.89 17.72,20 18,20A1,1 0 0,0 19,19A1,1 0 0,0 18,18Z',
  radar:'M19.07,4.93L17.66,6.34C19.1,7.79 20,9.79 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12C4,7.92 7.05,4.56 11,4.07V6.09C8.16,6.57 6,9.03 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12C18,10.34 17.33,8.84 16.24,7.76L14.83,9.17C15.55,9.9 16,10.9 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12C8,10.14 9.28,8.59 11,8.14V10.28C10.4,10.63 10,11.26 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12C14,11.26 13.6,10.62 13,10.28V2H12A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,9.24 20.88,6.74 19.07,4.93Z',
  airFilter:'M19,18.31V20A2,2 0 0,1 17,22H7A2,2 0 0,1 5,20V16.3C4.54,16.12 3.95,16 3,16A1,1 0 0,1 2,15A1,1 0 0,1 3,14C3.82,14 4.47,14.08 5,14.21V12.3C4.54,12.12 3.95,12 3,12A1,1 0 0,1 2,11A1,1 0 0,1 3,10C3.82,10 4.47,10.08 5,10.21V8.3C4.54,8.12 3.95,8 3,8A1,1 0 0,1 2,7A1,1 0 0,1 3,6C3.82,6 4.47,6.08 5,6.21V4A2,2 0 0,1 7,2H17A2,2 0 0,1 19,4V6.16C20.78,6.47 21.54,7.13 21.71,7.29C22.1,7.68 22.1,8.32 21.71,8.71C21.32,9.1 20.8,9.09 20.29,8.71V8.71C20.29,8.71 19.25,8 17,8C15.74,8 14.91,8.41 13.95,8.9C12.91,9.41 11.74,10 10,10C9.64,10 9.31,10 9,9.96V7.95C9.3,8 9.63,8 10,8C11.26,8 12.09,7.59 13.05,7.11C14.09,6.59 15.27,6 17,6V4H7V20H17V18C18.5,18 18.97,18.29 19,18.31M17,10C15.27,10 14.09,10.59 13.05,11.11C12.09,11.59 11.26,12 10,12C9.63,12 9.3,12 9,11.95V13.96C9.31,14 9.64,14 10,14C11.74,14 12.91,13.41 13.95,12.9C14.91,12.42 15.74,12 17,12C19.25,12 20.29,12.71 20.29,12.71V12.71C20.8,13.1 21.32,13.1 21.71,12.71C22.1,12.32 22.1,11.69 21.71,11.29C21.5,11.08 20.25,10 17,10M17,14C15.27,14 14.09,14.59 13.05,15.11C12.09,15.59 11.26,16 10,16C9.63,16 9.3,16 9,15.95V17.96C9.31,18 9.64,18 10,18C11.74,18 12.91,17.41 13.95,16.9C14.91,16.42 15.74,16 17,16C19.25,16 20.29,16.71 20.29,16.71V16.71C20.8,17.1 21.32,17.1 21.71,16.71C22.1,16.32 22.1,15.69 21.71,15.29C21.5,15.08 20.25,14 17,14Z',
  eyeOutline:'M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M12,4.5C17,4.5 21.27,7.61 23,12C21.27,16.39 17,19.5 12,19.5C7,19.5 2.73,16.39 1,12C2.73,7.61 7,4.5 12,4.5M3.18,12C4.83,15.36 8.24,17.5 12,17.5C15.76,17.5 19.17,15.36 20.82,12C19.17,8.64 15.76,6.5 12,6.5C8.24,6.5 4.83,8.64 3.18,12Z',
  flower:'M3,13A9,9 0 0,0 12,22C12,17 7.97,13 3,13M12,5.5A2.5,2.5 0 0,1 14.5,8A2.5,2.5 0 0,1 12,10.5A2.5,2.5 0 0,1 9.5,8A2.5,2.5 0 0,1 12,5.5M5.6,10.25A2.5,2.5 0 0,0 8.1,12.75C8.63,12.75 9.12,12.58 9.5,12.31C9.5,12.37 9.5,12.43 9.5,12.5A2.5,2.5 0 0,0 12,15A2.5,2.5 0 0,0 14.5,12.5C14.5,12.43 14.5,12.37 14.5,12.31C14.88,12.58 15.37,12.75 15.9,12.75C17.28,12.75 18.4,11.63 18.4,10.25C18.4,9.25 17.81,8.4 16.97,8C17.81,7.6 18.4,6.74 18.4,5.75C18.4,4.37 17.28,3.25 15.9,3.25C15.37,3.25 14.88,3.41 14.5,3.69C14.5,3.63 14.5,3.56 14.5,3.5A2.5,2.5 0 0,0 12,1A2.5,2.5 0 0,0 9.5,3.5C9.5,3.56 9.5,3.63 9.5,3.69C9.12,3.41 8.63,3.25 8.1,3.25A2.5,2.5 0 0,0 5.6,5.75C5.6,6.74 6.19,7.6 7.03,8C6.19,8.4 5.6,9.25 5.6,10.25M12,22A9,9 0 0,0 21,13C16,13 12,17 12,22Z'
};

// The patch's English text (ui.card.weather.*); placeholders in braces
const T={
  // the XL widgets' callout rows (Matt, 9 Nov)
  callout:{sunrise:'Sunrise',sunset:'Sunset',noon:'Solar noon',riseTomorrow:'Sunrise tomorrow',setTomorrow:'Sunset tomorrow',dayTomorrow:'Daylight tomorrow',moonrise:'Moonrise',moonset:'Moonset',lit:'Lit',now:'Now',peak:'Peak today'},
  now:'Now',today:'Today',tomorrow:'Tomorrow',back:'Back',nextHours:'Next hours',nextDays:'Next days',views:{strip:'Hours',bars:'Days'},showAs:'Show as',
  rangeRow:'{day}: low {low}, high {high}',humidity:'Humidity',high:'High',low:'Low',
  modes:{temperature:'Temperature',precipitation:'Rain',wind:'Wind'},
  range:'H {high}   L {low}',highLow:'{high} / {low}',noHourly:'No hourly forecast for this day',noRain:'No rain expected',
  sun:'Sun',daylightShort:'{hours}h {minutes}m daylight',
  moon:'Moon',moonriseAt:'Moonrise {time}',moonsetAt:'Moonset {time}',lit:'{illumination} lit',
  phases:{new_moon:'New moon',waxing_crescent:'Waxing crescent',first_quarter:'First quarter',waxing_gibbous:'Waxing gibbous',full_moon:'Full moon',waning_gibbous:'Waning gibbous',last_quarter:'Last quarter',waning_crescent:'Waning crescent'},
  wind:'Wind',windFrom:'From {direction}',beaufort:'Bft',
  cardinal:{n:'N',nne:'NNE',ne:'NE',ene:'ENE',e:'E',ese:'ESE',se:'SE',sse:'SSE',s:'S',ssw:'SSW',sw:'SW',wsw:'WSW',w:'W',wnw:'WNW',nw:'NW',nnw:'NNW'},
  metrics:{humidity:'Humidity',pressure:'Pressure',uv_index:'UV index',precipitation:'Precipitation',compared_to_average:'Compared to average',visibility:'Visibility'},
  dewPoint:'Dew point {dew_point}',
  pressure:{rising:'Rising over 3 hours',falling:'Falling over 3 hours',steady:'Steady over 3 hours'},
  uvLevel:{low:'Low',moderate:'Moderate',high:'High',very_high:'Very high',extreme:'Extreme'},
  visibilityLevel:{very_poor:'Very poor',poor:'Poor',moderate:'Moderate',good:'Good',very_good:'Very good',excellent:'Excellent'},
  visibilityLandmarks:'As far as {from} is from {to}',walkMinutes:'A {minutes}-minute walk',walkHours:'A {hours}-hour walk',walkDay:"A day's walk",uvPeak:'{level} · up to {uv_index} at {time}',
  rainExpected:'{amount} in the next 24 hours',rainLast24h:'Last 24 hours',
  average:{above:'above the average high',below:'below the average high',same:'same as the average high'},
  highsLastDays:'Highs of the last {days} days',openPage:'Open the weather page',todayVsAverage:'Today {today} · average {average}',
  airQuality:'Air quality',pollen:'Pollen',rainRadar:'Rain radar',noAir:'No air quality sensor yet',noPollen:'No pollen sensor yet',
  rainFrom:'Rain from {time}',noRain12:'No rain in the next 12 hours',fineParticles:'fine particles',
  aqLevel:{good:'Good',fair:'Fair',moderate:'Moderate',poor:'Poor',very_poor:'Very poor',extremely_poor:'Extremely poor'}
};
// Condition names as Home Assistant shows them, when hass can't format the state itself
const CONDITIONS={'clear-night':'Clear, night',cloudy:'Cloudy',exceptional:'Exceptional',fog:'Fog',hail:'Hail',lightning:'Lightning','lightning-rainy':'Lightning, rainy',
  partlycloudy:'Partly cloudy',pouring:'Pouring',rainy:'Rainy',snowy:'Snowy','snowy-rainy':'Snowy, rainy',sunny:'Sunny',windy:'Windy','windy-variant':'Windy, cloudy'};
const CARDINALS=['n','nne','ne','ene','e','ese','se','sse','s','ssw','sw','wsw','w','wnw','nw','nnw'];
const MOON_PHASES=Object.keys(T.phases);

// Home Assistant's theme colours for levels, with its defaults for when they aren't there
const UV_COLORS={low:'var(--success-color, #43a047)',moderate:'var(--warning-color, #ffa600)',high:'var(--orange-color, #ff9800)',very_high:'var(--error-color, #db4437)',extreme:'var(--purple-color, #926bc7)'};
const AQ_COLORS={good:'var(--success-color, #43a047)',fair:'var(--lime-color, #cddc39)',moderate:'var(--warning-color, #ffa600)',poor:'var(--orange-color, #ff9800)',very_poor:'var(--error-color, #db4437)',extremely_poor:'var(--purple-color, #926bc7)'};
const PM25_LIMITS=[['good',15],['fair',25],['moderate',37.5],['poor',50],['very_poor',75],['extremely_poor',Infinity]];
const PM25_SCALE_MAX=100,PM25_UNIT='µg/m³';
const AIR_QUALITY_CATEGORY='weather_alerts.air_quality_pollen';
const AIR_QUALITY_DEVICE_CLASSES=['aqi','pm25','pm10','nitrogen_dioxide','ozone'];
const WIND_TO_MS={'m/s':1,'km/h':1/3.6,mph:.44704,kn:.514444,'ft/s':.3048};
const BEAUFORT_LIMITS=[.5,1.6,3.4,5.5,8,10.8,13.9,17.2,20.8,24.5,28.5,32.7];
const PRESSURE_TO_HPA={hPa:1,mbar:1,kPa:10,inHg:33.8639,mmHg:1.33322};
const FORECAST_FEATURE={daily:1,hourly:2};

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fill=(text,vars)=>text.replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
const svgIcon=path=>'<svg class="wbIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';
// a tile's icon, fitted as every tile's is (Matt, 31 Oct): Material Design Icons draw at different sizes in their 24 grid,
// so each is measured once and sized so its longest side is 26, centred on what's drawn
const FITTED=new Map();
function fittedIcon(path){
  let style=FITTED.get(path);
  if(style===undefined){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),shape=document.createElementNS(ns,'path');
    svg.setAttribute('viewBox','0 0 24 24');svg.style.cssText='position:absolute;width:24px;height:24px;visibility:hidden;pointer-events:none';
    shape.setAttribute('d',path);svg.append(shape);document.body.append(svg);
    const b=shape.getBBox();svg.remove();
    const side=Math.max(b.width,b.height),size=side?26*24/side:0,at=size/24;
    style=side?'width:'+size.toFixed(2)+'px;height:'+size.toFixed(2)+'px;translate:'+((12-b.x-b.width/2)*at).toFixed(2)+'px '+((12-b.y-b.height/2)*at).toFixed(2)+'px':'';
    FITTED.set(path,style);
  }
  return style?'<svg class="wbIcon" viewBox="0 0 24 24" aria-hidden="true" style="'+style+'"><path d="'+path+'"/></svg>':svgIcon(path);
}
const reduceMotion=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

/* ---- Numbers, times and days, as Home Assistant formats them for the user's language and settings ---- */
const NF=new Map(),DTF=new Map(),AMPM=new WeakMap();
const numberLocale=l=>{switch(l?.number_format){case 'comma_decimal':return ['en-US','en'];case 'decimal_comma':return ['de','es','it'];
  case 'space_comma':return ['fr','sv','cs'];case 'quote_decimal':return ['de-CH'];case 'system':return undefined;default:return l?.language}};
function fmtNum(value,locale,options){
  const n=Number(value);if(Number.isNaN(n))return String(value);
  const none=locale?.number_format==='none',opts={maximumFractionDigits:2,...options,...(none?{useGrouping:false}:{})};
  const loc=none?'en-US':numberLocale(locale),key=JSON.stringify([loc,opts]);
  let f=NF.get(key);
  if(!f){try{f=new Intl.NumberFormat(loc,opts)}catch(_e){f=new Intl.NumberFormat(undefined,opts)}NF.set(key,f)}
  return f.format(n);
}
const lang=h=>h?.locale?.language||h?.language||undefined;
function useAmPm(locale){
  if(!locale)return new Date('January 1, 2023 22:00:00').toLocaleString().includes('10');
  if(AMPM.has(locale))return AMPM.get(locale);
  const f=locale.time_format;
  const v=f==='language'||f==='system'||!f?new Date('January 1, 2023 22:00:00').toLocaleString(f==='language'?locale.language:undefined).includes('10'):f==='12';
  AMPM.set(locale,v);return v;
}
const timeZone=h=>h?.locale?.time_zone==='server'&&h?.config?.time_zone?h.config.time_zone:undefined;
function dtf(language,opts){
  const key=JSON.stringify([language,opts]);let f=DTF.get(key);
  if(!f){try{f=new Intl.DateTimeFormat(language,opts)}catch(_e){f=new Intl.DateTimeFormat(undefined,{...opts,timeZone:undefined})}DTF.set(key,f)}
  return f;
}
const fmtTime=(d,h)=>dtf(lang(h),{hour:'numeric',minute:'2-digit',hourCycle:useAmPm(h?.locale)?'h12':'h23',timeZone:timeZone(h)}).format(d);
const fmtWeekday=(d,h)=>dtf(lang(h),{weekday:'short',timeZone:timeZone(h)}).format(d);
const fmtWeekdayNarrow=(d,h)=>d.toLocaleDateString(lang(h),{weekday:'narrow'});
// A whole number with a degree sign, as weather apps show temperatures
const deg=(h,v)=>num(v)?fmtNum(Math.round(Number(v)),h.locale)+'°':'–';
const startOfDay=d=>{const s=new Date(d);s.setHours(0,0,0,0);return s};
const sameDay=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();

/* ---- Sun and moon, worked out from the home location (low precision, about a minute; as the patch's sun_moon.ts) ---- */
const RAD=Math.PI/180,J1970=2440588,J2000=2451545,OBLIQUITY=RAD*23.4397,SUN_DISTANCE_KM=149598000;
const SUN_HORIZON=-.833*RAD,MOON_HORIZON=.133*RAD,SAMPLE_STEP=5*MINUTE;
const toDays=d=>d.getTime()/DAY-.5+J1970-J2000;
const rightAscension=(l,b)=>Math.atan2(Math.sin(l)*Math.cos(OBLIQUITY)-Math.tan(b)*Math.sin(OBLIQUITY),Math.cos(l));
const declination=(l,b)=>Math.asin(Math.sin(b)*Math.cos(OBLIQUITY)+Math.cos(b)*Math.sin(OBLIQUITY)*Math.sin(l));
const siderealTime=(days,lw)=>RAD*(280.16+360.9856235*days)-lw;
const altitudeAt=(ha,phi,dec)=>Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(ha));
function sunCoords(days){
  const m=RAD*(357.5291+.98560028*days),c=RAD*(1.9148*Math.sin(m)+.02*Math.sin(2*m)+.0003*Math.sin(3*m)),l=m+c+RAD*102.9372+Math.PI;
  return {ra:rightAscension(l,0),dec:declination(l,0),dist:SUN_DISTANCE_KM};
}
function moonCoords(days){
  const ml=RAD*(218.316+13.176396*days),m=RAD*(134.963+13.064993*days),f=RAD*(93.272+13.22935*days);
  const l=ml+RAD*6.289*Math.sin(m),b=RAD*5.128*Math.sin(f);
  return {ra:rightAscension(l,b),dec:declination(l,b),dist:385001-20905*Math.cos(m)};
}
const bodyAltitude=(coords,date,lat,lon)=>{const days=toDays(date),c=coords(days);return altitudeAt(siderealTime(days,RAD*-lon)-c.ra,RAD*lat,c.dec)};
const sunAltitude=(d,lat,lon)=>bodyAltitude(sunCoords,d,lat,lon);
const moonAltitude=(d,lat,lon)=>bodyAltitude(moonCoords,d,lat,lon);
function findRiseSet(altitude,horizon,start,end){
  const out={};let prevTime=start.getTime(),prevAlt=altitude(start)-horizon;
  for(let t=prevTime+SAMPLE_STEP;t<=end.getTime();t+=SAMPLE_STEP){
    const alt=altitude(new Date(t))-horizon;
    if(prevAlt<0!==alt<0){const crossing=new Date(prevTime+((t-prevTime)*prevAlt)/(prevAlt-alt));if(alt>0)out.rise??=crossing;else out.set??=crossing}
    prevTime=t;prevAlt=alt;
  }
  return out;
}
const dayBounds=d=>{const s=startOfDay(d);return [s,new Date(s.getTime()+DAY)]};
const getSunTimes=(d,lat,lon)=>findRiseSet(x=>sunAltitude(x,lat,lon),SUN_HORIZON,...dayBounds(d));
const getMoonTimes=(d,lat,lon)=>findRiseSet(x=>moonAltitude(x,lat,lon),MOON_HORIZON,...dayBounds(d));
function moonIllumination(date){
  const days=toDays(date),s=sunCoords(days),m=moonCoords(days);
  const elongation=Math.acos(Math.sin(s.dec)*Math.sin(m.dec)+Math.cos(s.dec)*Math.cos(m.dec)*Math.cos(s.ra-m.ra));
  const inclination=Math.atan2(s.dist*Math.sin(elongation),m.dist-s.dist*Math.cos(elongation));
  const angle=Math.atan2(Math.cos(s.dec)*Math.sin(s.ra-m.ra),Math.sin(s.dec)*Math.cos(m.dec)-Math.cos(s.dec)*Math.sin(m.dec)*Math.cos(s.ra-m.ra));
  return {fraction:(1+Math.cos(inclination))/2,phase:.5+(.5*inclination*(angle<0?-1:1))/Math.PI};
}
// Same boundaries as the moon integration (a 0 to 28 scale), so the worked-out phase matches the moon sensor
const moonPhaseName=p=>{const v=p*28;return v<.5||v>27.5?'new_moon':v<6.5?'waxing_crescent':v<7.5?'first_quarter':v<13.5?'waxing_gibbous'
  :v<14.5?'full_moon':v<20.5?'waning_gibbous':v<21.5?'last_quarter':'waning_crescent'};
const home=h=>{const c=h?.config;return c&&num(c.latitude)&&num(c.longitude)?{lat:Number(c.latitude),lon:Number(c.longitude)}:null};
// Sunrise and sunset on a day: sun.sun when its next rising or setting falls on that day, otherwise worked out
function sunTimes(h,date){
  const at=home(h),out=at?getSunTimes(date,at.lat,at.lon):{};
  const sun=h?.states?.['sun.sun'],day=startOfDay(date).getTime();
  const onDay=v=>{const d=v?new Date(v):null;return d&&Number.isFinite(d.getTime())&&startOfDay(d).getTime()===day?d:null};
  const rise=onDay(sun?.attributes?.next_rising),set=onDay(sun?.attributes?.next_setting);
  if(rise)out.rise=rise;
  if(set)out.set=set;
  return out;
}
function isNight(h){
  const sun=h?.states?.['sun.sun'];
  if(sun?.state==='below_horizon'||sun?.state==='above_horizon')return sun.state==='below_horizon';
  const at=home(h);return at?sunAltitude(new Date(),at.lat,at.lon)<0:false;
}

/* ---- Weather data (the patch's weather_page.ts) ---- */
const available=s=>!!s&&s.state!=='unavailable'&&s.state!=='unknown';
const userFacing=(h,id)=>{const e=h.entities?.[id];return !e||(!e.hidden&&!e.entity_category)};
const value=(h,src,attribute)=>{
  for(const id of src){const s=h.states?.[id];if(!available(s))continue;const v=s.attributes?.[attribute];if(v!==undefined&&v!==null&&v!=='')return {stateObj:s,value:v}}
  return undefined;
};
const primaryOf=(h,src)=>src.map(id=>h.states?.[id]).find(available);
// The first source with this kind of forecast (supported_features), or the first source when it doesn't say
const forecastSource=(h,src,type)=>src.map(id=>h.states?.[id]).find(s=>available(s)&&(s.attributes?.supported_features==null||(Number(s.attributes.supported_features)&FORECAST_FEATURE[type])));
function weatherUnit(h,s,measure){
  const length=h.config?.unit_system?.length||'',a=s?.attributes||{};
  switch(measure){
    case 'precipitation':return a.precipitation_unit||(length==='km'?'mm':'in');
    case 'pressure':return a.pressure_unit||(length==='km'?'hPa':'inHg');
    case 'wind_speed':case 'wind_gust_speed':return a.wind_speed_unit||length+'/h';
    case 'visibility':return a.visibility_unit||length;
    default:return a.temperature_unit||h.config?.unit_system?.temperature||'';
  }
}
// A value and its unit, as Home Assistant writes them
function attrParts(h,s,attribute,v){
  try{
    if(typeof h.formatEntityAttributeValueToParts==='function'){
      const [number,...unit]=h.formatEntityAttributeValueToParts(s,attribute,v).map(p=>p.value);
      return {number,unit:unit.join('').trim()};
    }
  }catch(_e){/* older Home Assistant: format here */}
  return {number:fmtNum(v,h.locale),unit:weatherUnit(h,s,attribute)};
}
function attrText(h,s,attribute,v){
  try{if(typeof h.formatEntityAttributeValue==='function')return h.formatEntityAttributeValue(s,attribute,v)}catch(_e){/* format here */}
  const p=attrParts(h,s,attribute,v);return (p.number+' '+p.unit).trim();
}
function stateText(h,s){
  try{if(typeof h.formatEntityState==='function')return h.formatEntityState(s)}catch(_e){/* format here */}
  const unit=s.attributes?.unit_of_measurement;
  return CONDITIONS[s.state]||(unit&&num(s.state)?fmtNum(s.state,h.locale)+' '+unit:s.state);
}
function entityName(h,s){
  try{if(typeof h.formatEntityName==='function')return h.formatEntityName(s,{type:'entity'})}catch(_e){/* name here */}
  return s.attributes?.friendly_name||s.entity_id;
}
const uvLevel=v=>v<3?'low':v<6?'moderate':v<8?'high':v<11?'very_high':'extreme';
const pm25Level=v=>PM25_LIMITS.find(([,limit])=>v<=limit)[0];
function beaufortOf(speed,unit){
  if(unit==='Beaufort')return Math.round(speed);
  const f=unit?WIND_TO_MS[unit]:undefined;if(f===undefined)return undefined;
  const i=BEAUFORT_LIMITS.findIndex(limit=>speed*f<limit);return i===-1?12:i;
}
const toHpa=(v,unit)=>{const f=unit?PRESSURE_TO_HPA[unit]:undefined;return f===undefined?undefined:v*f};
const findMoonEntity=h=>Object.keys(h.states||{}).find(id=>id.startsWith('sensor.')&&h.entities?.[id]?.platform==='moon');
// A rain gauge adds up rain over time; weather services report a rate or a forecast, so those are skipped
const findRainGauge=h=>Object.values(h.states||{}).filter(s=>s.entity_id.startsWith('sensor.')&&s.attributes?.device_class==='precipitation'
  &&['total','total_increasing'].includes(s.attributes?.state_class??'')&&userFacing(h,s.entity_id)).map(s=>s.entity_id).sort()[0];
function collectCategories(d){
  const out={};
  for(const [domain,b] of Object.entries(d?.core?.integration??{})){
    if(b&&'integration_type' in b){out[domain]=b.categories;continue}
    for(const [sub,integration] of Object.entries(b?.integrations??{}))out[sub]=integration?.categories;
  }
  return out;
}
const fromAirQualityService=(h,cats,id)=>{const p=h.entities?.[id]?.platform;return !!p&&!!cats[p]?.includes(AIR_QUALITY_CATEGORY)};
// Air quality sensors from air quality services, one per kind; pollen by translation key or entity ID
function airQualityEntities(h,cats){
  const byClass=new Map();
  Object.values(h.states||{}).filter(s=>s.entity_id.startsWith('sensor.')&&AIR_QUALITY_DEVICE_CLASSES.includes(s.attributes?.device_class??'')
    &&userFacing(h,s.entity_id)&&fromAirQualityService(h,cats,s.entity_id))
    .sort((a,b)=>a.entity_id.localeCompare(b.entity_id))
    .forEach(s=>{if(!byClass.has(s.attributes.device_class))byClass.set(s.attributes.device_class,s.entity_id)});
  return AIR_QUALITY_DEVICE_CLASSES.map(c=>byClass.get(c)).filter(Boolean);
}
const pollenEntities=(h,cats)=>Object.values(h.states||{}).filter(s=>s.entity_id.startsWith('sensor.')&&userFacing(h,s.entity_id)
  &&fromAirQualityService(h,cats,s.entity_id)&&(h.entities?.[s.entity_id]?.translation_key??s.entity_id).toLowerCase().includes('pollen')).map(s=>s.entity_id).sort();

// Round a range out to 2–5 ticks on one of the given steps
function niceScale(low,high,steps){
  const range=Math.max(high-low,.000001),largest=steps[steps.length-1];
  const step=steps.find(c=>range/c<=4)??largest*Math.ceil(range/(4*largest));
  const min=Math.floor(low/step)*step;let max=Math.ceil(high/step)*step;if(max===min)max=min+step;
  const ticks=[];for(let v=min;v<=max+step/1000;v+=step)ticks.push(v);
  return {min,max,ticks};
}
const rgbMix=(from,to,t)=>{const p=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16)),a=p(from),b=p(to);return 'rgb('+a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(', ')+')'};
const moonShadowPath=(cx,cy,r,f)=>{const rx=r*Math.abs(1-2*f),sweep=f<.5?0:1;return 'M '+cx+' '+(cy-r)+' A '+r+' '+r+' 0 0 0 '+cx+' '+(cy+r)+' A '+rx+' '+r+' 0 0 '+sweep+' '+cx+' '+(cy-r)+' Z'};

/* ---- Pieces every card uses (homecore.ts) ---- */
// Square data tile: chip, name and subdata, then one drawing that fills the rest
// A widget with an action zone (Matt, 9 Nov; Figma 986:10196): the head, then the zone, 216 x 198 at the drawn 252
// (the whole of an L's space); at XL the same zone, then up to three lines of data callouts under it
const tile=({icon,name,sub,visual,double,backdrop,cls,zone,callouts})=>'<div class="wbCard wbSquare'+(double?' wbDouble':'')+(backdrop?' wbHasBackdrop':'')+(zone!=null?' wbZoned':'')+(cls?' '+cls:'')+'">'+
  (backdrop?'<div class="wbBackdrop" aria-hidden="true">'+backdrop+'</div>':'')+
  '<div class="wbHead"><div class="wbChip wbPlain">'+fittedIcon(icon)+'</div><div class="wbText"><span class="wbName">'+esc(name)+'</span>'+
  (sub?'<span class="wbSub">'+esc(sub)+'</span>':'')+'</div></div>'+
  (zone!=null?'<div class="wbZone">'+zone+'</div>'+(callouts?.length?'<div class="wbCallouts">'+callouts.slice(0,3).map(([a,b])=>'<span class="wbCallout"><span>'+esc(a)+'</span><span>'+esc(b)+'</span></span>').join('')+'</div>':'')
    :'<div class="wbVisual">'+visual+'</div>')+'</div>';
const valueHtml=(n,unit)=>'<div class="wbValue"><span class="wbNum">'+esc(n)+'</span>'+(unit?'<span class="wbUnitV">'+esc(unit)+'</span>':'')+'</div>';

// One day from midnight to midnight: night shaded, sunrise and sunset along the top, the hours along the bottom,
// the scale on the left. The SVG stretches to the space; text, dots and bars are HTML so they stay round.
function dayChartHtml(o){
  const span=o.max-o.min||1,y=v=>100-((Math.min(o.max,Math.max(o.min,v))-o.min)/span)*100;
  const left=t=>(t/DAY_MINUTES)*100+'%',line=pts=>pts.map(p=>p.t+','+y(p.v)).join(' ');
  const forecast=o.kind==='line'?o.points:[];
  let s='<div class="wbDayChart"><div class="wbDcSun">'+o.sun.map(m=>'<span class="wbDcSunMark" style="left:'+left(m.t)+'">'+svgIcon(m.rise?I.sunsetUp:I.sunsetDown)+esc(m.label)+'</span>').join('')+'</div>';
  s+='<div class="wbDcY">'+o.ticks.map(t=>'<span style="top:'+y(t)+'%">'+esc(o.format(t))+'</span>').join('')+'</div>';
  s+='<div class="wbDcPlot"><svg viewBox="0 0 '+DAY_MINUTES+' 100" preserveAspectRatio="none">'+
    o.night.map(([from,to])=>'<rect class="wbDcNight" x="'+from+'" y="0" width="'+(to-from)+'" height="100"></rect>').join('')+
    o.ticks.map(t=>'<line class="wbDcGrid" x1="0" x2="'+DAY_MINUTES+'" y1="'+y(t)+'" y2="'+y(t)+'" vector-effect="non-scaling-stroke"></line>').join('')+
    o.sun.map(m=>'<line class="wbDcSunLine" x1="'+m.t+'" x2="'+m.t+'" y1="0" y2="100" vector-effect="non-scaling-stroke"></line>').join('')+
    (o.past&&o.past.length>1?'<polyline class="wbDcPast" points="'+line(o.past)+'" vector-effect="non-scaling-stroke"></polyline>':'')+
    (forecast.length>1?'<polygon class="wbDcArea" points="'+forecast[0].t+',100 '+line(forecast)+' '+forecast[forecast.length-1].t+',100"></polygon>'+
      '<polyline class="wbDcLine" points="'+line(forecast)+'" vector-effect="non-scaling-stroke"></polyline>':'')+
    (o.now?'<line class="wbDcNow" x1="'+o.now.t+'" x2="'+o.now.t+'" y1="0" y2="100" vector-effect="non-scaling-stroke"></line>':'')+'</svg>'+
    (o.kind==='bars'?o.points.filter(p=>p.v>0).map(p=>'<i class="wbDcBar" style="left:'+left(p.t+12)+';width:'+left(36)+';height:'+(100-y(p.v))+'%"></i>').join(''):'')+
    (o.now&&o.kind==='line'?'<i class="wbDcDot" style="left:'+left(o.now.t)+';top:'+y(o.now.v)+'%"></i>':'')+
    (o.peak?'<span class="wbDcPeak" style="left:'+left(o.peak.t)+';top:'+y(o.peak.v)+'%">'+esc(o.peak.label)+'</span>':'')+
    (o.note?'<span class="wbDcNote">'+esc(o.note)+'</span>':'')+'</div>';
  s+='<div class="wbDcX">'+o.hours.map(hr=>'<span class="'+(hr.minor?'wbMinor':'')+'" style="left:'+left(hr.t)+'">'+esc(hr.label)+'</span>').join('')+'</div></div>';
  return s;
}
// A line over time, filling the graph space, with labels at both ends
function lineChartHtml(points,format){
  const W=300,H=120,top=18,bottom=18,values=points.map(p=>p.value),min=Math.min(...values),max=Math.max(...values),span=max-min||1;
  const x=i=>(i/(points.length-1))*W,y=v=>top+(1-(v-min)/span)*(H-top-bottom),line=points.map((p,i)=>x(i)+','+y(p.value)).join(' ');
  const maxI=values.indexOf(max),minI=values.indexOf(min),anchor=i=>i===0?'start':i===points.length-1?'end':'middle';
  return '<svg class="wbChart" viewBox="0 0 '+W+' '+H+'" aria-hidden="true"><polygon class="wbArea" points="0,'+(H-bottom)+' '+line+' '+W+','+(H-bottom)+'"></polygon>'+
    '<polyline class="wbLine" points="'+line+'" vector-effect="non-scaling-stroke"></polyline>'+
    '<text x="'+x(maxI)+'" y="'+(y(max)-6)+'" text-anchor="'+anchor(maxI)+'">'+esc(format(max))+'</text>'+
    '<text x="'+x(minI)+'" y="'+(y(min)+14)+'" text-anchor="'+anchor(minI)+'">'+esc(format(min))+'</text>'+
    '<text x="0" y="'+H+'" text-anchor="start">'+esc(points[0].label)+'</text><text x="'+W+'" y="'+H+'" text-anchor="end">'+esc(points[points.length-1].label)+'</text></svg>';
}
// Bars, one per value
function barsHtml(bars,guide){
  const W=300,H=120,bottom=16,values=bars.map(b=>b.value).concat(guide??[]),min=Math.min(...values)-2,max=Math.max(...values)+1,span=max-min||1;
  const slot=W/bars.length,y=v=>(1-(v-min)/span)*(H-bottom);
  return '<svg class="wbChart" viewBox="0 0 '+W+' '+H+'" aria-hidden="true">'+bars.map((b,i)=>'<rect class="wbBar'+(b.now?' wbNowBar':'')+'" x="'+(i*slot+slot*.2)+'" y="'+y(b.value)+'" width="'+slot*.6+'" height="'+(H-bottom-y(b.value))+'" rx="6"></rect>'+
    '<text x="'+(i*slot+slot/2)+'" y="'+H+'" text-anchor="middle">'+esc(b.label)+'</text>').join('')+
    (guide!==undefined?'<line class="wbGuide" x1="0" x2="'+W+'" y1="'+y(guide)+'" y2="'+y(guide)+'"></line>':'')+'</svg>';
}

// The moon, seen with north up, on a 122 box. Dark seas: [x, y, rx, ry, rotation, darkness]
const MARIA=[[44.5,40.1,16.5,13.2,-15,.7],[70.9,41.2,8.8,8.2,0,.75],[77.5,56.6,12.1,9.3,20,.7],[97.2,44.5,6.6,5.2,0,.8],[89.5,67.6,6.6,9.9,10,.55],[80.8,75.3,4.9,4.9,0,.6],
  [29.2,59.9,14.3,23.1,10,.45],[51.1,76.4,9.9,7.1,-10,.5],[34.6,78.6,5.2,5.2,0,.6],[58.3,23.7,22,3.8,-5,.4],[61,53.3,5,4,0,.55],[44.5,68.7,6,5,0,.45]];
const CRATERS=[[60,92,2.2],[72,98,1.6],[48,100,1.5],[85,88,1.8],[38,92,1.3],[66,84,1.2],[95,80,1.3],[25,40,1.4],[82,30,1.3],[55,108,1.2]];
// Tycho, Copernicus, Kepler and Aristarchus, and Tycho's rays
const BRIGHT_CRATERS=[[54.4,95,1.8],[44.5,56.6,1.5],[33.5,56.6,1.1],[23.7,40.1,1.1]];
const TYCHO_RAYS=[[30,62],[48,48],[72,60],[96,82],[86,112],[30,108],[16,86]];

let mounts=0;

// cards: only these cards (the dashboard places the weather card, Compared to average and Humidity on their own);
// onOpen: the weather card's Now becomes a button that calls it (the dashboard opens its Weather page)
export function mountWeatherBento(container,{getHass,entityId,style='bitmap',motion=true,cards,onOpen,hoursWindow}={}){
  const P='wb'+(++mounts)+'-';   // SVG ids, unique in the shadow root
  const root=document.createElement('div');
  root.className='wb';
  root.dataset.style=style;   // the CSS's hook for a style's finish (Smooth's grain)
  const bento=document.createElement('div');
  bento.className='wbBento';
  root.appendChild(bento);
  container.replaceChildren(root);

  // The patch's strategy order; sizes from hui-weather-bento-card
  // the new cards (Matt, 1 Nov) end the Weather page and are on the dashboard once added
  const BASE_CARDS=['aq_tile','pollen_tile','radar_tile'];
  const CARDS=['current','hourly','sun','moon','wind','uv_index','compared_to_average','humidity','pressure','precipitation','visibility','air_quality',...BASE_CARDS]
    .filter(name=>!cards||cards.includes(name));
  const SIZES={current:'wide',hourly:'wide',compared_to_average:'double'};
  // the widgets with an action zone are XL on the Weather page, so their callouts show (Matt, 9 Nov)
  const XL=['sun','moon','uv_index','aq_tile','pollen_tile'];
  const items={};
  CARDS.forEach(name=>{
    const el=document.createElement('div');
    el.className='wbItem';el.dataset.card=name;el.dataset.size=SIZES[name]||'tile';el.hidden=true;
    if(XL.includes(name))el.dataset.xl='';
    bento.appendChild(el);items[name]={el,html:null};
  });

  let destroyed=false,lastKey=null,raf=0,lastStep=-1,queued=false,focusAfter=null;
  const VIEW_KEY='homecore-next-view',saved=(()=>{try{return localStorage.getItem(VIEW_KEY)}catch(_e){return null}})();
  const ui={openDay:undefined,opener:undefined,dayMode:'temperature',hourlyMode:'temperature',hourlyView:saved==='bars'?'bars':'strip',aq:undefined};
  const data={todayHistory:undefined,rain:undefined,temperatureHistory:undefined,pressureHistory:undefined,aqHistory:undefined,categories:undefined,lastFetch:0};
  let sunNow=new Date(),moonNow=new Date();
  const strips={};   // the painted skies, by name (Next hours' is hourly)

  /* ---- Forecasts: one subscription per kind, from the first source that has it ---- */
  const subs={},forecasts={};
  const forecast=type=>forecasts[type]?.forecast??[];
  const forecastState=(h,type)=>forecasts[type]?h.states?.[forecasts[type].entityId]:undefined;
  function unsubscribe(type){
    const s=subs[type];
    if(s){s.unsub.then(u=>{if(typeof u==='function')u()}).catch(()=>{});delete subs[type]}
    if(forecasts[type])delete forecasts[type];
  }
  function subscribe(h,type,id){
    if(typeof h.connection?.subscribeMessage!=='function')return;
    const sub={entityId:id};
    try{
      sub.unsub=Promise.resolve(h.connection.subscribeMessage(ev=>{
        if(destroyed||subs[type]!==sub)return;
        if(!ev?.forecast)delete forecasts[type];else forecasts[type]={entityId:id,forecast:ev.forecast};
        queue();
      },{type:'weather/subscribe_forecast',forecast_type:type,entity_id:id}));
    }catch(err){sub.unsub=Promise.reject(err)}
    sub.unsub.catch(()=>{if(subs[type]===sub)delete subs[type]});
    subs[type]=sub;
  }
  function syncForecasts(h,src){
    for(const type of ['daily','hourly']){
      const source=forecastSource(h,src,type);
      if(subs[type]?.entityId===source?.entity_id)continue;
      unsubscribe(type);
      if(source)subscribe(h,type,source.entity_id);
    }
  }

  /* ---- Recorded history behind the data tiles; without the recorder the tiles show what they have ---- */
  const attrHistory=(h,id,start,minimal=false)=>h.callWS({type:'history/history_during_period',start_time:start.toISOString(),end_time:new Date().toISOString(),
    entity_ids:[id],minimal_response:minimal,no_attributes:minimal,significant_changes_only:false});
  async function fetchPressure(h,src){
    const p=value(h,src,'pressure');if(!p)return;
    const id=p.stateObj.entity_id,history=await attrHistory(h,id,new Date(Date.now()-3*HOUR));
    // the first state is the one that was active 3 hours ago
    const v=history?.[id]?.find(item=>typeof item.a?.pressure==='number')?.a?.pressure;
    data.pressureHistory=typeof v==='number'?{entityId:id,value:v}:undefined;
  }
  async function fetchTemperatureHistory(h,src){
    const t=value(h,src,'temperature');if(!t)return;
    const id=t.stateObj.entity_id,todayStart=startOfDay(new Date());
    const history=await attrHistory(h,id,new Date(todayStart.getTime()-AVERAGE_DAYS*DAY));
    const highs=new Map();
    for(const item of history?.[id]??[]){
      const v=item.a?.temperature,time=new Date((item.lc??item.lu)*1000);
      if(typeof v!=='number'||time>=todayStart)continue;
      const day=time.toDateString();highs.set(day,Math.max(highs.get(day)??-Infinity,v));
    }
    data.temperatureHistory={entityId:id,dailyHighs:[...highs.values()],days:[...highs.entries()].map(([day,high])=>({date:new Date(day),high}))};
  }
  async function fetchRain(h){
    const id=findRainGauge(h);if(!id)return;
    const statistic=await h.callWS({type:'recorder/statistic_during_period',statistic_id:id,rolling_window:{duration:{hours:24}}});
    data.rain={entityId:id,change:statistic?.change??undefined};
  }
  function fetchTiles(){
    const h=getHass?.();if(!h||destroyed||typeof h.callWS!=='function')return;
    const src=sources(h);data.lastFetch=Date.now();
    [fetchPressure(h,src),fetchTemperatureHistory(h,src),fetchRain(h)].forEach(p=>p.then(()=>queue(),()=>{}));
  }
  async function fetchTodayHistory(){
    const h=getHass?.();if(!h)return;
    const t=value(h,sources(h),'temperature');if(!t)return;
    const id=t.stateObj.entity_id,start=startOfDay(new Date());
    try{
      const history=await attrHistory(h,id,start);
      const samples=key=>(history?.[id]??[]).map(item=>({time:item.lu*1000,value:item.a?.[key]})).filter(s=>typeof s.value==='number');
      data.todayHistory={day:start.toDateString(),fetched:Date.now(),temperature:samples('temperature'),humidity:samples('humidity')};
      queue();
    }catch(_e){/* without the recorder the graph starts at now */}
  }
  async function fetchAqHistory(id){
    const h=getHass?.();if(!h)return;
    try{
      const result=await attrHistory(h,id,new Date(Date.now()-24*HOUR),true);
      const states=(result?.[id]??[]).filter(item=>num(item.s));
      // at most 48 points, evenly picked
      const step=Math.max(1,Math.ceil(states.length/48));
      data.aqHistory={entityId:id,points:states.filter((_s,i)=>i%step===0).map(item=>({label:fmtTime(new Date(item.lu*1000),h),value:Number(item.s)}))};
      queue();
    }catch(_e){/* no history: the opened tile shows the level instead */}
  }
  function loadCategories(h){
    if(data.categories!==undefined)return;
    data.categories=null;
    Promise.resolve().then(()=>h.callWS({type:'integration/descriptions'})).then(d=>{data.categories=collectCategories(d)},()=>{data.categories={}}).then(()=>queue());
  }

  function sources(h){
    const all=Object.keys(h.states||{}).filter(id=>id.startsWith('weather.')&&userFacing(h,id)).sort();
    return entityId&&h.states?.[entityId]?[entityId,...all.filter(id=>id!==entityId)]:all;
  }
  const aqIds=h=>data.categories?{air:airQualityEntities(h,data.categories),pollen:pollenEntities(h,data.categories)}:{air:[],pollen:[]};

  /* ---- Weather icons: Bitmap and 1-bit are canvases painted by the clock, Smooth is the Figma artwork ---- */
  function wxIcon(condition,size,night,id){
    if(style==='line')return '<span class="wbWx wbS'+size+' wbLineIcon" aria-hidden="true">'+lineIcon(condition,night||condition==='clear-night')+'</span>';
    if(style==='smooth'){
      const a=wbSmoothIcon(condition,size===90,night,P+'g-'+id);
      return '<span class="wbWx wbS'+size+' wb'+a.k[0].toUpperCase()+a.k.slice(1)+(a.night?' wbNight':'')+'" aria-hidden="true">'+a.svg+'</span>';
    }
    return '<span class="wbWx wbS'+size+'" aria-hidden="true"><canvas data-wb-wx="'+esc(wxKey(condition,night))+'" data-size="'+size+'"></canvas></span>';
  }

  /* ---- Weather card: Now, then six days as columns; halves on a narrow card; a tapped day opens over the card ---- */
  const days=()=>forecast('daily').filter(e=>e.templow!=null).slice(0,DAYS);
  function dayName(h,e){
    const d=new Date(e.datetime),now=new Date();
    if(sameDay(d,now))return T.today;
    if(sameDay(d,new Date(now.getTime()+DAY)))return T.tomorrow;
    return fmtWeekday(d,h);
  }
  const shortName=(h,e,i)=>i===0?dayName(h,e):fmtWeekday(new Date(e.datetime),h);
  function renderCurrent(h,src){
    const primary=primaryOf(h,src);if(!primary)return '';
    const list=days(),open=ui.openDay!==undefined?list[ui.openDay]:undefined;
    const temperature=value(h,src,'temperature'),today=list[0],hasToday=today&&sameDay(new Date(today.datetime),new Date());
    const unit=h.config?.unit_system?.temperature||primary.attributes?.temperature_unit||'';
    let s='<div class="wbCard wbWeather'+(open?' wbIsOpen':'')+'"><div class="wbClosed"'+(open?' inert':'')+'>'+
      '<div class="wbNow">'+(onOpen?'<button class="wbCurrent wbOpenPage" data-wb="open-page" data-wb-focus="open-page" aria-label="'+esc(T.openPage)+'">':'<div class="wbCurrent">')+
      wxIcon(primary.state,90,isNight(h),'now')+'<div class="wbTempBlock">'+
      (temperature&&num(temperature.value)?'<div class="wbTemp"><span class="wbDeg">'+esc(fmtNum(Math.round(Number(temperature.value)),h.locale))+'</span><span class="wbUnit">'+esc(unit)+'</span></div>':'')+
      '<div class="wbPlace">'+esc(h.config?.location_name??'')+'</div></div>'+(onOpen?'</button>':'</div>')+
      '<div class="wbCondition"><div class="wbCondName">'+esc(stateText(h,primary))+'</div>'+
      (hasToday&&today.templow!=null?'<div class="wbRange">'+esc(fill(T.range,{high:deg(h,today.temperature),low:deg(h,today.templow)}))+'</div>':'')+'</div></div>';
    s+=forecastSentence(h)+nextHours(h);
    if(list.length){
      // today's column can stand for Now (the medium card, Matt, 6 Nov: only the days, the first one Now): its name and
      // high have a Now form the board shows there
      const nowT=hasToday&&temperature&&num(temperature.value)?deg(h,temperature.value):'';
      const alt=(i,a,b)=>i===0&&nowT?'<span class="wbAsDay">'+esc(a)+'</span><span class="wbAsNow">'+esc(b)+'</span>':esc(a);
      s+='<div class="wbColumns" role="list">'+list.map((e,i)=>'<button class="wbColumn" role="listitem" data-wb="day" data-index="'+i+'" data-wb-focus="col-'+i+'">'+
        '<span class="wbDay">'+alt(i,shortName(h,e,i),T.now)+'</span>'+wxIcon(e.condition??'cloudy',60,false,'col'+i)+
        '<span class="wbTemps"><span class="wbHi">'+alt(i,deg(h,e.temperature),nowT)+'</span><span class="wbLo">'+esc(deg(h,e.templow))+'</span></span></button>').join('')+'</div>';
      s+='<div class="wbHalves" role="list">'+list.map((e,i)=>'<button class="wbTile" role="listitem" data-wb="day" data-index="'+i+'" data-wb-focus="half-'+i+'">'+
        wxIcon(e.condition??'cloudy',40,false,'half'+i)+'<span class="wbText"><span class="wbName">'+esc(dayName(h,e))+'</span>'+
        '<span class="wbSub">'+esc(fill(T.highLow,{high:deg(h,e.temperature),low:deg(h,e.templow)}))+'</span></span></button>').join('')+'</div>';
    }
    return s+'</div>'+(open?renderOpenDay(h,src,open):'')+'</div>';
  }
  /* the forecast in a sentence (Matt, 1 Nov), in the room a large card leaves between Now and the days; it never makes
     a card taller, and it isn't shown where there's no room: the next 12 hours' weather, when it changes, and where the
     temperature goes */
  const SKY_WORDS={sunny:'sunny','clear-night':'clear',partlycloudy:'partly cloudy',cloudy:'cloudy',fog:'foggy',rainy:'rain',pouring:'heavy rain',
    snowy:'snow','snowy-rainy':'sleet',hail:'hail',lightning:'thunder','lightning-rainy':'thunderstorms',windy:'windy','windy-variant':'windy',exceptional:'unsettled'};
  const SKY_KIND={sunny:'clear','clear-night':'clear',partlycloudy:'partly',cloudy:'cloudy',windy:'cloudy','windy-variant':'cloudy',fog:'fog',
    rainy:'rain',pouring:'rain',hail:'rain',snowy:'snow','snowy-rainy':'snow',lightning:'storm','lightning-rainy':'storm'};
  function forecastLine(h){
    const now=Date.now(),next=forecast('hourly').filter(e=>new Date(e.datetime).getTime()>now-HOUR).slice(0,13);
    if(next.length<2)return '';
    const at=e=>fmtTime(new Date(e.datetime),h),word=e=>SKY_WORDS[e.condition]||'',kind=e=>SKY_KIND[e.condition]||e.condition;
    let line=word(next[0]);
    if(!line)return '';
    // up to two changes in the sky
    let was=next[0],changes=0;
    for(const e of next.slice(1)){
      if(changes===2||kind(e)===kind(was)||!word(e))continue;
      line+=(changes?' and ':', ')+word(e)+' from '+at(e);
      was=e;changes++;
    }
    // where the temperature goes, when it goes far enough to say
    const t0=Number(next[0].temperature),temps=next.filter(e=>num(e.temperature));
    if(num(t0)&&temps.length){
      const lo=temps.reduce((a,b)=>Number(b.temperature)<Number(a.temperature)?b:a),hi=temps.reduce((a,b)=>Number(b.temperature)>Number(a.temperature)?b:a);
      if(t0-Number(lo.temperature)>=3)line+=', down to '+deg(h,lo.temperature)+' by '+at(lo);
      else if(Number(hi.temperature)-t0>=3)line+=', up to '+deg(h,hi.temperature)+' by '+at(hi);
    }
    return line[0].toUpperCase()+line.slice(1)+'.';
  }
  const forecastSentence=h=>{const t=forecastLine(h);return t?'<div class="wbSummary"><p class="wbSummaryText">'+esc(t)+'</p></div>':''};
  /* the next four hours beside Now on a small card, three under it on a narrow one (Matt, 6 Nov): each its time, its sky
     and its temperature, the hours in the Next hours setting's window only; the card shows them where there's room */
  function nextHours(h){
    const [ws,we]=WINDOWS[hoursWindow?.()]||WINDOWS.day,now=Date.now();
    const list=forecast('hourly').filter(e=>{const d=new Date(e.datetime),hr=d.getHours();return d.getTime()>now-HOUR/2&&hr>=ws&&hr<we&&num(e.temperature)}).slice(0,4);
    if(!list.length)return '';
    return '<div class="wbNextHours" role="list">'+list.map((e,i)=>'<div class="wbHour" role="listitem"><span class="wbHourTime">'+esc(fmtTime(new Date(e.datetime),h))+'</span>'+
      wxIcon(e.condition??'cloudy',40,e.is_daytime===false,'hr'+i)+'<span class="wbHourTemp">'+esc(deg(h,e.temperature))+'</span></div>').join('')+'</div>';
  }
  // The hourly forecast for a day, from the current hour on
  function hoursOf(dayStart){
    const from=dayStart.getTime(),earliest=Date.now()-HOUR;
    return forecast('hourly').filter(hr=>{const t=new Date(hr.datetime).getTime();return t>=from&&t<from+DAY&&t>earliest});
  }
  function dayModes(hours){
    if(!hours.length)return ['temperature'];
    const modes=['temperature'];
    if(hours.some(hr=>hr.precipitation!=null||hr.precipitation_probability!=null))modes.push('precipitation');
    if(hours.some(hr=>hr.humidity!=null))modes.push('humidity');
    return modes;
  }
  function renderOpenDay(h,src,entry){
    const dayStart=startOfDay(new Date(entry.datetime)),hours=hoursOf(dayStart),modes=dayModes(hours);
    const mode=modes.includes(ui.dayMode)?ui.dayMode:'temperature',label=v=>v==='humidity'?T.humidity:T.modes[v];
    return '<div class="wbOpen" data-wb-open="day"><div class="wbOpenHead">'+wxIcon(entry.condition??'cloudy',40,false,'open')+
      '<div class="wbText"><span class="wbName">'+esc(dayName(h,entry))+'</span><span class="wbSub">'+esc(fill(T.highLow,{high:deg(h,entry.temperature),low:deg(h,entry.templow)}))+'</span></div>'+
      '<button class="wbBack" title="'+esc(T.back)+'" data-wb="close-day" data-wb-focus="back-day">'+svgIcon(I.back)+'</button></div>'+
      (modes.length>1?'<div class="wbDayTabs"><div class="wbSegments" role="group">'+modes.map(v=>'<button aria-pressed="'+(v===mode)+'" data-wb="day-mode" data-mode="'+v+'" data-wb-focus="day-mode-'+v+'">'+esc(label(v))+'</button>').join('')+'</div></div>':'')+
      '<div class="wbGraph">'+dayChartHtml(dayChart(h,src,dayStart,hours,mode))+'</div></div>';
  }
  // Everything one graph of the day needs, on a scale of minutes from midnight
  function dayChart(h,src,dayStart,hours,mode){
    const from=dayStart.getTime(),now=Date.now(),isToday=sameDay(dayStart,new Date());
    const minutes=t=>(t-from)/MINUTE,timeLabel=t=>fmtTime(new Date(t),h),hourOf=hr=>new Date(hr.datetime).getTime();
    // every 3 hours along the bottom; the minor ones go on a phone
    const hourMarks=[0,3,6,9,12,15,18,21].map(hr=>({t:hr*60,label:timeLabel(from+hr*HOUR),minor:hr%6!==0}));
    const {rise,set}=sunTimes(h,dayStart),sun=[],night=[];
    if(rise){sun.push({t:minutes(rise.getTime()),label:timeLabel(rise.getTime()),rise:true});night.push([0,minutes(rise.getTime())])}
    if(set){sun.push({t:minutes(set.getTime()),label:timeLabel(set.getTime()),rise:false});night.push([minutes(set.getTime()),DAY_MINUTES])}
    const at=home(h);
    // polar night: dark all day
    if(!rise&&!set&&at&&sunAltitude(new Date(from+DAY/2),at.lat,at.lon)<0)night.push([0,DAY_MINUTES]);
    const nowT=isToday?minutes(now):undefined,base={hours:hourMarks,sun,night};
    if(!hours.length&&!isToday)return {...base,kind:'line',points:[],min:0,max:1,ticks:[],format:String,note:T.noHourly};
    if(mode==='precipitation'){
      // the chance of rain when the forecast has it, else how much
      const chance=hours.some(hr=>hr.precipitation_probability!=null);
      const points=hours.map(hr=>({t:minutes(hourOf(hr)),v:Number((chance?hr.precipitation_probability:hr.precipitation)??0)}));
      const unit=weatherUnit(h,forecastState(h,'hourly'),'precipitation'),most=Math.max(0,...points.map(p=>p.v));
      const top=chance?100:niceScale(0,Math.max(most,1),[.5,1,2,5,10]).max;
      const format=v=>chance?fmtNum(v,h.locale)+'%':fmtNum(v,h.locale,{maximumFractionDigits:1})+' '+unit;
      const peak=points.find(p=>p.v===most);
      return {...base,kind:'bars',points,min:0,max:top,ticks:[0,top/2,top],format,now:nowT!==undefined?{t:nowT,v:0}:undefined,
        peak:peak&&most>0?{t:peak.t+30,v:peak.v,label:format(peak.v)}:undefined,note:most>0?undefined:T.noRain};
    }
    // temperature or humidity: the forecast as a line, and for today what was recorded up to now, muted, meeting it at the current reading
    const key=mode==='humidity'?'humidity':'temperature';
    const points=hours.filter(hr=>hr[key]!=null&&(!isToday||hourOf(hr)>=now)).map(hr=>({t:minutes(hourOf(hr)),v:Number(hr[key])}));
    let nowPoint,past=[];
    if(nowT!==undefined){
      const current=value(h,src,key);
      if(current&&num(current.value)){nowPoint={t:nowT,v:Number(current.value)};points.unshift(nowPoint)}
      const recorded=data.todayHistory?.day===dayStart.toDateString()?data.todayHistory[key]:[];
      past=recorded.filter(s=>s.time<=now).map(s=>({t:Math.max(0,minutes(s.time)),v:s.value}));
      if(nowPoint&&past.length)past.push(nowPoint);
    }
    const all=[...past,...points];
    if(!all.length)return {...base,kind:'line',points:[],min:0,max:1,ticks:[],format:String,note:T.noHourly};
    const values=all.map(p=>p.v),scale=niceScale(Math.min(...values),Math.max(...values),key==='humidity'?[5,10,20,25]:[1,2,5,10]);
    if(key==='humidity'){scale.min=Math.max(0,scale.min);scale.max=Math.min(100,scale.max);scale.ticks=scale.ticks.filter(t=>t>=0&&t<=100)}
    const format=key==='humidity'?v=>fmtNum(v,h.locale)+'%':v=>deg(h,v);
    // the day's high, named above the line
    const high=key==='temperature'?all.reduce((a,b)=>b.v>a.v?b:a):undefined;
    return {...base,kind:'line',points,past,...scale,format,now:nowPoint,peak:high?{...high,label:format(high.v)}:undefined};
  }

  /* ---- Next hours: the sky over three days, the times along the top and the temperature, rain or wind below ---- */
  function hourlyModes(entries){
    const modes=['temperature'];
    if(entries.some(e=>e.precipitation_probability!=null||e.precipitation!=null))modes.push('precipitation');
    if(entries.some(e=>e.wind_speed!=null))modes.push('wind');
    return modes;
  }
  // The sky for each half: the most common hourly condition in it (rain and snow count double), else that day's forecast
  function halves(start,hours,columns=STRIP_COLUMNS){
    const daily=forecast('daily'),out=[];
    for(let column=0;column<columns;column++)for(const night of [false,true]){
      const from=start.getTime()+(column*24+(night?12:0))*HOUR,to=from+12*HOUR,count={};
      hours.forEach(e=>{const t=new Date(e.datetime).getTime();if(e.condition&&t>=from&&t<to)count[e.condition]=(count[e.condition]??0)+(WET.has(e.condition)?2:1)});
      let cond=Object.entries(count).sort((a,b)=>b[1]-a[1])[0]?.[0];
      if(!cond){const day=new Date(from).toDateString();cond=daily.find(e=>new Date(e.datetime).toDateString()===day)?.condition??'cloudy'}
      out.push({cond:night&&cond==='sunny'?'clear-night':cond,night});
    }
    return out;
  }
  function hourlyValues(h,entry,mode){
    const s=forecastState(h,'hourly');
    const probability=entry.precipitation_probability!=null?fmtNum(entry.precipitation_probability,h.locale)+'%':'';
    const amount=entry.precipitation?fmtNum(entry.precipitation,h.locale)+' '+weatherUnit(h,s,'precipitation'):'';
    switch(mode){
      case 'precipitation':return probability?[probability,amount]:[amount||'–',''];
      case 'wind':return entry.wind_speed!=null?[fmtNum(Math.round(entry.wind_speed),h.locale),weatherUnit(h,s,'wind_speed')]:['–',''];
      // only mention rain when it is likely enough to matter
      default:return [deg(h,entry.temperature),(entry.precipitation_probability??0)>=20?probability:''];
    }
  }
  // the pages: today's chosen hours (until they're over), then the next days', as long as the hourly forecast reaches
  function hourPages(h,hours,now){
    const [ws,we]=WINDOWS[hoursWindow?.()]||WINDOWS.day,out=[];
    for(let i=0;i<4&&out.length<3;i++){
      const a=new Date();a.setHours(0,0,0,0);a.setDate(a.getDate()+i);
      const b=new Date(a);b.setHours(we,0,0,0);a.setHours(ws,0,0,0);
      if(b.getTime()<=now||!hours.some(e=>{const t=new Date(e.datetime).getTime();return t>=a.getTime()&&t<=b.getTime()}))continue;
      out.push({a:a.getTime(),b:b.getTime(),label:dayName(h,{datetime:a.toISOString()})});
    }
    return out;
  }
  /* Line's sky: each day's sun as an arc from its real sunrise to its sunset, highest at noon, on a horizon; the nights
     between shaded, their edges drawn; the sun where it is now; a drawing of the weather at each named time */
  function lineSky(h,first,last,marks,now,pos){
    const total=(last.b-first.a)/HOUR,X=t=>((t-first.a)/HOUR).toFixed(3),HZ=80,TOP=32;
    const suns=[];
    for(const d=new Date(first.a-DAY);d.getTime()<last.b+DAY;d.setDate(d.getDate()+1)){
      const {rise,set}=sunTimes(h,new Date(d));
      if(rise&&set)suns.push({rise:rise.getTime(),set:set.getTime()});
    }
    const yAt=(s,t)=>HZ-(HZ-TOP)*Math.sin(Math.PI*(t-s.rise)/(s.set-s.rise));
    const night=t=>!suns.some(s=>t>=s.rise&&t<=s.set);
    let art='',edges='',times='';
    suns.forEach((s,i)=>{
      const pts=[];for(let t=s.rise;t<=s.set;t+=15*MINUTE)pts.push(X(t)+','+yAt(s,t).toFixed(2));pts.push(X(s.set)+','+HZ);
      art+='<polyline class="wbLineArc" points="'+pts.join(' ')+'"/>';
      const next=suns[i+1];
      if(next)art+='<rect class="wbLineNight" x="'+X(s.set)+'" y="0" width="'+((next.rise-s.set)/HOUR).toFixed(3)+'" height="100"/>';
      [[s.rise,'↑'],[s.set,'↓']].forEach(([t,arrow])=>{
        if(t<first.a||t>last.b)return;
        edges+='<line class="wbLineEdge" x1="'+X(t)+'" x2="'+X(t)+'" y1="0" y2="100"/>';
        times+='<span class="wbLineTime" style="left:'+pos(t)+'">'+arrow+' '+esc(fmtTime(new Date(t),h))+'</span>';
      });
    });
    const sun=suns.find(s=>now>=s.rise&&now<=s.set);
    return '<svg class="wbLineArt" viewBox="0 0 '+total+' 100" preserveAspectRatio="none" aria-hidden="true">'+art+edges+
      '<line class="wbLineHorizon" x1="0" x2="'+total+'" y1="'+HZ+'" y2="'+HZ+'"/></svg>'+times+
      (sun?'<span class="wbLineNow" style="left:'+pos(now)+';top:'+yAt(sun,now)+'%">'+lineIcon('sunny',false)+'</span>':'')+
      marks.filter(m=>m.entry&&!m.now).map(m=>'<span class="wbLineGlyph'+m.edge+'" style="left:'+pos(m.t)+'">'+lineIcon(m.entry.condition??'cloudy',night(m.t))+'</span>').join('');
  }
  function renderHourly(h,src){
    delete strips.hourly;
    const view=ui.hourlyView==='bars'?'bars':'strip';
    const head='<div class="wbHeader"><h2 class="wbTitle">'+esc(view==='bars'?T.nextDays:T.nextHours)+'</h2>'+
      '<div class="wbSegments wbViews" role="group" aria-label="'+esc(T.showAs)+'">'+['strip','bars'].map(v=>'<button aria-pressed="'+(v===view)+'" data-wb="hourly-view" data-view="'+v+'" data-wb-focus="hourly-view-'+v+'">'+esc(T.views[v])+'</button>').join('')+'</div></div>';
    if(view==='bars')return renderBars(h,src,head);
    const hours=forecast('hourly'),now=Math.floor(Date.now()/MINUTE)*MINUTE;
    const coming=hours.filter(e=>new Date(e.datetime).getTime()>now-HOUR);
    if(!coming.length)return '';
    const modes=hourlyModes(coming),mode=modes.includes(ui.hourlyMode)?ui.hourlyMode:'temperature';
    const pages=hourPages(h,hours,now);
    if(!pages.length)return '';
    const first=pages[0],last=pages[pages.length-1],span=(first.b-first.a)/HOUR;
    // a unit of one hour: a page is the strip's width
    const pos=t=>'calc(var(--wb-u) * '+((t-first.a)/HOUR).toFixed(3)+')';
    // the sky from 06:00 on the first page's day (the day before when the page starts earlier), whole days of it
    const art=new Date(first.a);art.setHours(6,0,0,0);if(art.getTime()>first.a)art.setDate(art.getDate()-1);
    const columns=Math.ceil((last.b-art.getTime())/DAY);
    if(style!=='line')strips.hourly={segs:halves(art,hours,columns),seed:art.getDate(),columns};
    const edge=t=>t===first.a?' wbFirst':t===last.b?' wbLast':'';
    // the days it crosses: each named at its left, the name staying at the strip's left while its day is there
    const days=[];
    for(let t=first.a;t<last.b;){const d=new Date(t);d.setHours(24,0,0,0);const end=Math.min(d.getTime(),last.b);days.push({a:t,b:end,label:dayName(h,{datetime:new Date(t).toISOString()}),page:pages.find(p=>p.a>=t&&p.a<end)||pages.find(p=>p.a<end&&p.b>t)});t=end}
    // it opens on the even hour before now
    const startAt=now>first.a&&now<last.b?Math.floor((now-first.a)/(2*HOUR))*2:0;
    const marks=[];
    for(let t=first.a;t<=last.b;t+=HOUR){
      const d=new Date(t),isEdge=edge(t);
      if(!isEdge&&d.getHours()%MARK_EVERY)continue;
      // the strip's first and last hours are always named; a time too close to them gives way
      if(!isEdge&&(Math.abs(first.a-t)<2*HOUR||Math.abs(last.b-t)<2*HOUR))continue;
      if(now>=first.a&&Math.abs(t-now)<1.5*HOUR&&!isEdge)continue;
      marks.push({t,edge:isEdge,label:fmtTime(d,h),entry:t>=now-HOUR?hours.find(e=>new Date(e.datetime).getTime()===t):undefined});
    }
    if(now>first.a&&now<first.b)marks.push({t:now,edge:now-first.a<HOUR?' wbFirst':first.b-now<HOUR?' wbLast':'',label:T.now,entry:coming[0],now:true});
    const mark=(m,content)=>'<span class="wbMark'+m.edge+(m.now?' wbNowMark':'')+'" style="left:'+pos(m.t)+'">'+content+'</span>';
    return '<div class="wbCard wbHc wbHourly">'+head+
      (modes.length>1?'<div class="wbTabs"><div class="wbSegments" role="group">'+modes.map(v=>'<button aria-pressed="'+(v===mode)+'" data-wb="hourly-mode" data-mode="'+v+'" data-wb-focus="hourly-mode-'+v+'">'+esc(T.modes[v])+'</button>').join('')+'</div></div>':'')+
      '<div class="wbStripScroll wbPaged" tabindex="0" aria-label="'+esc(T.nextHours)+'" data-span="'+span+'" data-start="'+startAt+'"><div class="wbStrip" style="--wb-u:calc(100cqw / '+span+');width:calc(var(--wb-u) * '+((last.b-first.a)/HOUR)+')">'+
      // a stop every two hours (Matt, 1 Nov): a swipe settles on one, a flick runs on past several
      [...Array(Math.floor((last.b-first.a)/(2*HOUR))+1)].map((_,i)=>'<i class="wbSnap" style="left:'+pos(first.a+i*2*HOUR)+'"></i>').join('')+
      '<div class="wbDays">'+days.map((d,i)=>'<span class="wbDaySpan" style="width:calc(var(--wb-u) * '+((d.b-d.a)/HOUR).toFixed(3)+')"><button class="wbDayName" data-wb="hours-day" data-hours="'+(i===0?startAt:((d.page?.a??d.a)-first.a)/HOUR)+'" data-wb-focus="hours-day-'+i+'">'+esc(d.label)+'</button></span>').join('')+'</div>'+
      '<div class="wbRow wbTimes">'+marks.map(m=>mark(m,esc(m.label))).join('')+'</div>'+
      (style==='line'?'<div class="wbSky wbLineSky">'+lineSky(h,first,last,marks,now,pos):
        '<div class="wbSky"><div class="wbSkyArt" style="left:'+pos(art.getTime())+';width:calc(var(--wb-u) * '+columns*24+')"><canvas data-wb-strip="hourly"'+(style==='smooth'?'':' class="wbPixels"')+'></canvas></div>')+
      (now>first.a?'<i class="wbPast" style="width:'+pos(Math.min(now,last.b))+'"></i><i class="wbNowLine" style="left:'+pos(now)+'"></i>':'')+
      days.slice(1).map(d=>'<i class="wbMidnight" style="left:'+pos(d.a)+'"></i>').join('')+'</div>'+
      '<div class="wbRow wbValues">'+marks.map(m=>{
        if(!m.entry)return '';
        const [primary,secondary]=hourlyValues(h,m.entry,mode);
        return mark(m,'<span class="wbPrimaryV">'+esc(primary)+'</span><span class="wbSecondary">'+esc(secondary)+'</span>');
      }).join('')+'</div></div></div></div>';
  }
  // a temperature's colour (°C), between the stops
  function tempColour(c){
    const st=TEMP_COLOURS,i=st.findIndex(([t])=>t>=c);
    if(i<=0)return 'rgb('+st[i<0?st.length-1:0][1].join(',')+')';
    const [t0,a]=st[i-1],[t1,b]=st[i],f=(c-t0)/(t1-t0);
    return 'rgb('+a.map((v,k)=>Math.round(v+(b[k]-v)*f)).join(',')+')';
  }
  /* ---- Next days: each day's low to high on one scale for the week, coloured by temperature, now's a dot on today ---- */
  function renderBars(h,src,head){
    const list=forecast('daily').filter(e=>num(e.templow)&&num(e.temperature)).slice(0,7);
    if(!list.length)return '';
    const lo=Math.min(...list.map(e=>Number(e.templow))),hi=Math.max(...list.map(e=>Number(e.temperature))),span=Math.max(1,hi-lo);
    const pct=v=>Math.max(0,Math.min(100,((v-lo)/span)*100)).toFixed(2);
    const fahrenheit=/F/.test(weatherUnit(h,forecastState(h,'daily'),'temperature')),celsius=v=>fahrenheit?(v-32)/1.8:v;
    const grad='linear-gradient(90deg,'+[0,.25,.5,.75,1].map(f=>tempColour(celsius(lo+f*span))+' '+f*100+'%').join(',')+')';
    const current=value(h,src,'temperature')?.value;
    // as tall as Hours would be (its mode tabs counted), the days scrolling inside (Matt, 1 Nov)
    const tabbed=hourlyModes(forecast('hourly').filter(e=>new Date(e.datetime).getTime()>Date.now()-HOUR)).length>1;
    return '<div class="wbCard wbHc wbHourly wbBars'+(tabbed?' wbTabbed':'')+'">'+head+'<div class="wbDayBars" role="list">'+list.map((e,i)=>{
      const d=dayName(h,e),today=sameDay(new Date(e.datetime),new Date()),l=Number(e.templow),t=Number(e.temperature);
      return '<div class="wbDayBar" role="listitem" aria-label="'+esc(fill(T.rangeRow,{day:d,low:deg(h,l),high:deg(h,t)}))+'">'+
        '<span class="wbRangeDay">'+esc(d)+'</span>'+wxIcon(e.condition,40,false,'r'+i)+
        '<span class="wbRangeLo">'+esc(deg(h,l))+'</span>'+
        '<span class="wbRangeTrack"><i class="wbRangeFill" style="background:'+grad+';clip-path:inset(0 '+(100-pct(t))+'% 0 '+pct(l)+'% round 4px)"></i>'+
        (today&&num(current)?'<i class="wbRangeNow" style="left:'+pct(Number(current))+'%"></i>':'')+'</span>'+
        '<span class="wbRangeHi">'+esc(deg(h,t))+'</span></div>';
    }).join('')+'</div></div>';
  }

  /* ---- Sun: a glowing sun on a deep maroon sky, deep red at sunrise and sunset to warm gold at midday ---- */
  function renderSun(h){
    const now=sunNow,{rise,set}=sunTimes(h,now);
    const daylight=rise&&set?Math.round((set.getTime()-rise.getTime())/MINUTE):0,hours=Math.floor(daylight/60),minutes=daylight%60;
    // where the sun is on its path: 0 at sunrise, 1 at sunset
    const progress=rise&&set?(now.getTime()-rise.getTime())/(set.getTime()-rise.getTime()):-1,up=progress>=0&&progress<=1;
    const angle=Math.PI*(1-Math.min(1,Math.max(0,progress))),sunX=100+74*Math.cos(angle),sunY=100-74*Math.sin(angle);
    // how high the sun is: 0 on the horizon, 1 at midday
    const height=up?Math.sin(Math.PI*progress):0;
    const top=up?rgbMix('#2e0a0d','#43180a',height):'#0e0507',bottom=up?rgbMix('#7a1d12','#8f400f',height):'#1c0709';
    const core=rgbMix('#f60c08','#ff8f00',height),edge=rgbMix('#fd9b07','#ffd84a',height),line=up?rgbMix('#fd9b07','#ffd84a',height):'#6b3a2a';
    const time=d=>d?fmtTime(d,h):'–';
    // solar noon, named above the top of the path
    const noon=rise&&set?new Date((rise.getTime()+set.getTime())/2):null;
    // today's times are in the picture; the callouts are tomorrow's (Matt, 9 Nov)
    const next=new Date(now);next.setDate(next.getDate()+1);
    const t2=sunTimes(h,next),day2=t2.rise&&t2.set?Math.round((t2.set.getTime()-t2.rise.getTime())/MINUTE):0;
    return tile({icon:I.sunny,name:T.sun,sub:daylight?fill(T.daylightShort,{hours,minutes}):undefined,
      callouts:[[T.callout.riseTomorrow,time(t2.rise)],[T.callout.setTomorrow,time(t2.set)],...(day2?[[T.callout.dayTomorrow,Math.floor(day2/60)+'h '+(day2%60)+'m']]:[])],
      zone:'<div class="wbSunSky" style="background:linear-gradient(180deg, '+top+', '+bottom+');--wb-sun-line:'+line+'"><svg viewBox="0 0 200 124" aria-hidden="true">'+
        '<defs><radialGradient id="'+P+'sun-glow"><stop offset="0" stop-color="'+core+'"></stop><stop offset="0.45" stop-color="'+core+'"></stop><stop offset="1" stop-color="'+edge+'"></stop></radialGradient>'+
        '<clipPath id="'+P+'above-horizon"><rect x="0" y="0" width="200" height="100"></rect></clipPath></defs>'+
        '<path class="wbSunPath" d="M 26 100 A 74 74 0 0 1 174 100"></path><line class="wbHorizon" x1="0" x2="200" y1="100" y2="100"></line>'+
        (up?'<circle cx="'+sunX+'" cy="'+sunY+'" r="14" fill="url(#'+P+'sun-glow)" clip-path="url(#'+P+'above-horizon)"></circle>':'')+
        (noon?'<text class="wbSunTime wbNoon" x="100" y="1">'+esc(time(noon))+'</text>':'')+
        '<text class="wbSunTime" x="26" y="117">'+esc(time(rise))+'</text><text class="wbSunTime" x="174" y="117">'+esc(time(set))+'</text></svg></div>'});
  }

  /* ---- Moon: phase, how much is lit and moonrise or moonset, worked out from the home location ---- */
  function moonSvg(fraction,litOnLeft,south){
    const id=n=>P+'moon-'+n;
    const shadow=fraction>.995?'':'<path class="wbMoonNight" filter="url(#'+id('terminator')+')" d="'+moonShadowPath(61,61,57.9,fraction)+'"'+(litOnLeft?' transform="translate(122 0) scale(-1 1)"':'')+'></path>';
    const noise=(n,freq,oct,seed,slope,intercept)=>'<filter id="'+id(n)+'" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="'+freq+'" numOctaves="'+oct+'" seed="'+seed+'"></feTurbulence>'+
      '<feColorMatrix values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 0 1"></feColorMatrix><feComponentTransfer>'+
      ['R','G','B'].map(c=>'<feFunc'+c+' type="linear" slope="'+slope+'" intercept="'+intercept+'"></feFunc'+c+'>').join('')+'</feComponentTransfer></filter>';
    return '<svg class="wbMoonArt" width="122" height="122" viewBox="0 0 122 122" aria-hidden="true"><defs>'+
      '<radialGradient id="'+id('fill')+'" cx="0.42" cy="0.38" r="0.68"><stop offset="0" stop-color="#ECECE8"></stop><stop offset="0.7" stop-color="#D2D2CD"></stop><stop offset="1" stop-color="#ACACA7"></stop></radialGradient>'+
      '<clipPath id="'+id('clip')+'"><circle cx="61" cy="61" r="54.9"></circle></clipPath>'+
      '<filter id="'+id('soften')+'" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.6"></feGaussianBlur></filter>'+
      '<filter id="'+id('glow')+'" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"></feGaussianBlur></filter>'+
      '<filter id="'+id('terminator')+'" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1"></feGaussianBlur></filter>'+
      noise('mottle','0.045',4,3,1.8,-.4)+noise('grain','1.2',2,7,2,-.5)+'</defs>'+
      '<g clip-path="url(#'+id('clip')+')"><circle cx="61" cy="61" r="54.9" fill="url(#'+id('fill')+')"></circle>'+
      // seen from the south, the moon is upside down
      '<g'+(south?' transform="rotate(180 61 61)"':'')+'><g class="wbMaria" filter="url(#'+id('soften')+')">'+
      MARIA.map(([x,y,rx,ry,r,d])=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill-opacity="'+d+'" transform="rotate('+r+' '+x+' '+y+')"></ellipse>').join('')+'</g>'+
      CRATERS.map(([x,y,r])=>'<circle class="wbCrater" cx="'+x+'" cy="'+y+'" r="'+r+'"></circle>').join('')+
      '<g class="wbRays" filter="url(#'+id('glow')+')">'+TYCHO_RAYS.map(([x,y])=>'<line x1="54.4" y1="95" x2="'+x+'" y2="'+y+'"></line>').join('')+'</g>'+
      '<g class="wbBrightSpots" filter="url(#'+id('glow')+')">'+BRIGHT_CRATERS.map(([x,y,r])=>'<circle cx="'+x+'" cy="'+y+'" r="'+r*2+'"></circle>').join('')+'</g>'+
      BRIGHT_CRATERS.map(([x,y,r])=>'<circle class="wbBrightCenter" cx="'+x+'" cy="'+y+'" r="'+r+'"></circle>').join('')+'</g>'+
      '<rect class="wbMottle" width="122" height="122" filter="url(#'+id('mottle')+')"></rect><rect class="wbGrain" width="122" height="122" filter="url(#'+id('grain')+')"></rect>'+
      shadow+'</g><circle cx="61" cy="61" r="54.9" fill="none" stroke="#B4B4B4" stroke-width="0.2"></circle></svg>';
  }
  function renderMoon(h){
    const now=moonNow,at=home(h),lat=at?.lat??0,ill=moonIllumination(now);
    const moonId=findMoonEntity(h),moon=moonId?h.states[moonId]:undefined;
    const phase=available(moon)&&MOON_PHASES.includes(moon.state)?moon.state:moonPhaseName(ill.phase);
    const {rise,set}=at?getMoonTimes(now,at.lat,at.lon):{};
    // the lit side is on the right while the moon waxes, seen from the north; it flips while it wanes and south of the equator
    const litOnLeft=ill.phase>.5!==lat<0;
    const lit=fmtNum(Math.round(ill.fraction*100),h.locale)+'%',riseOrSet=rise??set,time=riseOrSet?fmtTime(riseOrSet,h):undefined;
    return tile({icon:I.night,name:T.moon,sub:T.phases[phase],
      callouts:[...(rise?[[T.callout.moonrise,fmtTime(rise,h)]]:[]),...(set?[[T.callout.moonset,fmtTime(set,h)]]:[]),[T.callout.lit,lit]],
      zone:'<div class="wbMoonBox">'+moonSvg(ill.fraction,litOnLeft,lat<0)+'</div>'});
  }

  /* ---- Wind: speed, direction and Beaufort on a round compass ---- */
  function renderWind(h,src){
    const speed=value(h,src,'wind_speed');if(!speed||!num(speed.value))return '';
    const gust=value(h,src,'wind_gust_speed'),bearingValue=value(h,src,'wind_bearing');
    const bearing=bearingValue&&num(bearingValue.value)?Number(bearingValue.value):undefined;
    const beaufort=beaufortOf(Number(speed.value),speed.stateObj.attributes?.wind_speed_unit);
    const parts=attrParts(h,speed.stateObj,'wind_speed',speed.value);
    const direction=bearing!==undefined?T.cardinal[CARDINALS[(((bearing+11.25)/22.5)|0)%16]]:undefined;
    const gusts=gust?attrText(h,gust.stateObj,'wind_gust_speed',gust.value):undefined;
    const sub=[direction?fill(T.windFrom,{direction}):undefined,beaufort!==undefined?beaufort+' '+T.beaufort:undefined].filter(Boolean).join(' · ')||gusts;
    const at=(a,r)=>{const rad=((a-90)*Math.PI)/180;return [100+r*Math.cos(rad),100+r*Math.sin(rad)]};
    const ticks=Array.from({length:36},(_,i)=>i*10).map(a=>{const major=a%90===0,[x1,y1]=at(a,97),[x2,y2]=at(a,major?83:89);
      return '<line class="wbTick'+(major?' wbMajor':'')+'" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'"></line>'}).join('');
    const letters=[['n',0],['e',90],['s',180],['w',270]].map(([k,a])=>{const [x,y]=at(a,64);return '<text class="wbLetter'+(k==='n'?' wbNorth':'')+'" x="'+x+'" y="'+y+'">'+esc(T.cardinal[k])+'</text>'}).join('');
    return tile({icon:I.windy,name:T.wind,sub,cls:'wbWind',visual:'<svg viewBox="0 0 200 200" aria-hidden="true">'+ticks+letters+
      (bearing!==undefined?'<path class="wbMarker" transform="rotate('+bearing+' 100 100)" d="M 100 24 L 91 5 L 109 5 Z"></path>':'')+
      '<circle class="wbDisc" cx="100" cy="100" r="46"></circle><text class="wbSpeed" x="100" y="102">'+esc(parts.number)+'</text>'+
      '<text class="wbSpeedUnit" x="100" y="124">'+esc(parts.unit)+'</text></svg>'});
  }

  /* ---- Data tiles (hui-weather-metric-card) ---- */
  function renderUv(h,src){
    const uv=value(h,src,'uv_index');if(!uv||!num(uv.value))return '';
    const v=Number(uv.value),levelName=T.uvLevel[uvLevel(v)];
    // highest UV index in the coming hours of today, from the hourly forecast
    const endOfDay=new Date();endOfDay.setHours(23,59,59,999);
    const peak=forecast('hourly').filter(e=>e.uv_index!=null&&new Date(e.datetime)>new Date()&&new Date(e.datetime)<=endOfDay)
      .reduce((best,e)=>!best||e.uv_index>best.uv?{uv:e.uv_index,time:new Date(e.datetime)}:best,undefined);
    /* UV (Matt, 9 Nov): a sun in the zone's top-left corner whose size is the intensity, about 40% of the zone at 4-5 and
       nearly 90% at 10; a toned gradient, light at its heart to the level's colour at its edge. The number big in the
       bottom right, its level under it (the rays that fanned from the corner went the same day) */
    const colour=UV_COLORS[uvLevel(v)],sunR=216*Math.min(1,Math.max(.08,.4+(v-4.5)*(.5/5.5)));
    const art='<svg class="wbUvArt" viewBox="0 0 216 198" preserveAspectRatio="xMinYMin slice" aria-hidden="true">'+
      '<defs><radialGradient id="'+P+'uv-sun" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="'+sunR.toFixed(1)+'">'+
        '<stop offset="0" style="stop-color:color-mix(in srgb, '+colour+' 28%, #fff6dd)"></stop><stop offset=".62" style="stop-color:color-mix(in srgb, '+colour+' 62%, #fff6dd)"></stop>'+
        '<stop offset="1" style="stop-color:'+colour+'"></stop></radialGradient></defs>'+
      '<circle class="wbUvSun" cx="0" cy="0" r="'+sunR.toFixed(1)+'" fill="url(#'+P+'uv-sun)"></circle></svg>'+
      '<div class="wbUvBig"><span class="wbUvNum">'+esc(fmtNum(Math.round(v),h.locale))+'</span><span class="wbUvWord">'+esc(levelName)+'</span></div>';
    return tile({icon:I.sunnyAlert,name:T.metrics.uv_index,
      sub:peak&&peak.uv>v?fill(T.uvPeak,{level:levelName,uv_index:fmtNum(Math.round(peak.uv),h.locale),time:fmtTime(peak.time,h)}):levelName,zone:art,cls:'wbUv',
      callouts:[[T.callout.now,fmtNum(Math.round(v),h.locale)+' · '+levelName],[T.callout.peak,peak&&peak.uv>v?fmtNum(Math.round(peak.uv),h.locale)+' at '+fmtTime(peak.time,h):T.callout.now]]});
  }
  function renderCompared(h){
    const today=forecast('daily')[0],history=data.temperatureHistory;
    if(!today||new Date(today.datetime).toDateString()!==new Date().toDateString()||!num(today.temperature)||!history||history.dailyHighs.length<MIN_AVERAGE_DAYS)return '';
    const high=Number(today.temperature),average=history.dailyHighs.reduce((t,v)=>t+v,0)/history.dailyHighs.length;
    // || 0 turns -0 into 0
    const difference=Math.round(high-average)||0,key=difference>0?'above':difference<0?'below':'same';
    const list=[...history.days,{date:new Date(),high,today:true}];
    /* the highs as a line graph (Matt, 9 Nov; were bars) that fills its side of the card to the card's bottom inset: the
       line and the shade under it stretch with the space, the points, values and days stay their size. Today in the
       accent, the average as a dashed line with its value */
    const values=list.map(d=>d.high).concat(average),min=Math.min(...values)-1,max=Math.max(...values)+1;
    const fy=v=>(1-(v-min)/(max-min))*100,fx=i=>(i+.5)/list.length*100;
    const pts=list.map((d,i)=>[fx(i),fy(d.high)]),line=pts.map(([x,y],i)=>(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)).join('');
    const bars='<div class="wbCompareBars wbTrend" aria-hidden="true"><div class="wbTrendPlot">'+
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="'+P+'trend" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--primary)" stop-opacity=".28"></stop><stop offset="1" style="stop-color:var(--primary)" stop-opacity="0"></stop></linearGradient></defs>'+
        '<path class="wbTrendArea" d="'+line+'L'+pts[pts.length-1][0].toFixed(2)+' 100L'+pts[0][0].toFixed(2)+' 100Z" fill="url(#'+P+'trend)"></path>'+
        '<line class="wbAvgLine" x1="0" x2="100" y1="'+fy(average).toFixed(2)+'" y2="'+fy(average).toFixed(2)+'" vector-effect="non-scaling-stroke"></line>'+
        '<path class="wbTrendLine" d="'+line+'" vector-effect="non-scaling-stroke"></path></svg>'+
      '<span class="wbTrendAvg" style="top:'+fy(average).toFixed(2)+'%">'+esc(deg(h,average))+'</span>'+
      list.map((d,i)=>{const t=d.today?' wbToday':'',at='left:'+fx(i).toFixed(2)+'%;top:'+fy(d.high).toFixed(2)+'%';
        return '<i class="wbTrendDot'+t+'" style="'+at+'"></i><span class="wbAvgValue'+t+'" style="'+at+'">'+esc(deg(h,d.high))+'</span>'}).join('')+'</div>'+
      '<div class="wbTrendDays">'+list.map((d,i)=>'<span class="wbAvgDay'+(d.today?' wbToday':'')+'" style="left:'+fx(i).toFixed(2)+'%">'+esc(fmtWeekdayNarrow(d.date,h))+'</span>').join('')+'</div></div>';
    // the big number, then what it means in words and in temperatures; the graph beside them
    return tile({icon:I.chartLine,name:T.metrics.compared_to_average,double:true,sub:fill(T.highsLastDays,{days:history.days.length}),
      visual:'<div class="wbCompare"><div class="wbCompareText"><div class="wbCompareNumber">'+(difference>0?'+':'')+esc(deg(h,difference))+'</div>'+
        '<div class="wbCompareWords">'+esc(T.average[key])+'</div><div class="wbCompareTemps">'+esc(fill(T.todayVsAverage,{today:deg(h,high),average:deg(h,average)}))+'</div></div>'+bars+'</div>'});
  }
  function renderHumidity(h,src){
    const humidity=value(h,src,'humidity');if(!humidity||!num(humidity.value))return '';
    const dewPoint=value(h,src,'dew_point'),level=Math.max(0,Math.min(100,Number(humidity.value)));
    // the whole card is the picture: misty water up to the humidity
    return tile({icon:I.waterPercent,name:T.metrics.humidity,sub:dewPoint&&num(dewPoint.value)?fill(T.dewPoint,{dew_point:deg(h,dewPoint.value)}):undefined,
      backdrop:'<div class="wbWater" style="height:'+level+'%"><div class="wbMist"></div><div class="wbBody"></div><div class="wbHaze wbOne"></div><div class="wbHaze wbTwo"></div></div>',
      visual:'<div class="wbWaterValue">'+valueHtml(fmtNum(Math.round(Number(humidity.value)),h.locale),'%')+'</div>'});
  }
  function renderPressure(h,src){
    const pressure=value(h,src,'pressure');if(!pressure||!num(pressure.value))return '';
    const v=Number(pressure.value),unit=pressure.stateObj.attributes?.pressure_unit,hpa=toHpa(v,unit);
    const previous=data.pressureHistory?.entityId===pressure.stateObj.entity_id?toHpa(data.pressureHistory.value,unit):undefined;
    let trend;
    if(hpa!==undefined&&previous!==undefined){const change=hpa-previous;trend=change>=PRESSURE_TREND_HPA?'rising':change<=-PRESSURE_TREND_HPA?'falling':'steady'}
    const parts=attrParts(h,pressure.stateObj,'pressure',Math.round(v));
    return tile({icon:I.gauge,name:T.metrics.pressure,sub:trend?T.pressure[trend]:undefined,
      visual:'<div class="wbTapeRow"><div class="wbTapeValue">'+valueHtml(parts.number)+'<span class="wbTapeUnit">'+esc(parts.unit)+'</span></div>'+(hpa!==undefined?tapeSvg(h,hpa):'')+'</div>'});
  }
  // Pressure as a vertical tape (an altimeter): a tick per hPa, a label every 5, the red marker at the value; higher is up
  function tapeSvg(h,hpa){
    const STEP=9,centre=100,first=Math.floor(hpa)-11;
    return '<svg class="wbTape" viewBox="0 0 76 200" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">'+
      Array.from({length:24},(_,i)=>first+i).map(v=>{
        const y=centre-(v-hpa)*STEP;if(y<22||y>178)return '';
        const major=v%5===0,opacity=Math.max(.15,1-Math.abs(y-centre)/100);
        return '<g opacity="'+opacity+'"><line class="wbTapeTick" x1="'+(major?2:8)+'" x2="26" y1="'+y+'" y2="'+y+'"></line>'+
          (major?'<text class="wbTapeLabel" x="33" y="'+y+'">'+esc(fmtNum(v,h.locale,{useGrouping:false}))+'</text>':'')+'</g>';
      }).join('')+
      '<text class="wbTapeEnd" x="14" y="8">'+esc(T.high)+'</text><text class="wbTapeEnd" x="14" y="192">'+esc(T.low)+'</text>'+
      '<line class="wbTapeMarker" x1="0" x2="30" y1="'+centre+'" y2="'+centre+'"></line></svg>';
  }
  function renderPrecipitation(h){
    const id=findRainGauge(h),s=id?h.states[id]:undefined;
    // without a rain gauge there is no measured rain, so the tile hides
    if(!s||data.rain?.entityId!==id||!num(data.rain.change))return '';
    const unit=s.attributes?.unit_of_measurement??'',hourlyState=forecastState(h,'hourly'),until=Date.now()+DAY;
    const expected=forecast('hourly').filter(e=>e.precipitation!=null&&new Date(e.datetime).getTime()<=until);
    const total=expected.reduce((t,e)=>t+Number(e.precipitation),0);
    return tile({icon:I.rainy,name:T.metrics.precipitation,
      sub:hourlyState&&expected.length?fill(T.rainExpected,{amount:fmtNum(total,h.locale,{maximumFractionDigits:1})+' '+weatherUnit(h,hourlyState,'precipitation')}):T.rainLast24h,
      visual:valueHtml(fmtNum(data.rain.change,h.locale,{maximumFractionDigits:1}),unit)+(expected.length>1?barsHtml(expected.map(e=>({label:'',value:Number(e.precipitation)}))):'')});
  }

  // Visibility (Matt, 28 Oct, Figma "Visibility tile · proposal"): a ship on the horizon in as much fog as the visibility,
  // the distance as landmarks from the home's country, or as a walk; the Met Office's band under the name
  function renderVisibility(h,src){
    const vis=value(h,src,'visibility');if(!vis||!num(vis.value))return '';
    const parts=attrParts(h,vis.stateObj,'visibility',vis.value),km=visibilityToKm(Number(vis.value),weatherUnit(h,vis.stateObj,'visibility'));
    return tile({icon:I.eyeOutline,name:T.metrics.visibility,sub:T.visibilityLevel[visibilityLevel(km)],
      visual:'<div class="wbSea"><canvas class="wbSeaArt" data-wb-sea="'+km+'" aria-hidden="true"></canvas><div class="wbSeaFact">'+esc(distanceFact(h,km))+'</div>'+
        '<div class="wbSeaValue">'+valueHtml(parts.number,parts.unit)+'</div></div>'});
  }
  // a distance people can picture: landmarks, or the walk when there are none (whole minutes for short walks, then fives)
  function distanceFact(h,km){
    const pair=nearestLandmarks(h.config?.country,km);
    if(pair)return fill(T.visibilityLandmarks,{from:pair.from,to:pair.to});
    const minutes=(km/WALKING_KMH)*60;
    if(minutes<60){
      const rounded=minutes<5?Math.max(1,Math.round(minutes)):5*Math.round(minutes/5);
      if(rounded<60)return fill(T.walkMinutes,{minutes:fmtNum(rounded,h.locale)});
    }
    const hours=Math.max(1,Math.round(minutes/30)/2);
    return hours<8?fill(T.walkHours,{hours:fmtNum(hours,h.locale)}):T.walkDay;
  }

  /* ---- Air quality and pollen: tiles in halves; a tapped tile opens inside the card ---- */
  function renderAirQuality(h){
    if(data.categories===undefined)loadCategories(h);
    const ids=aqIds(h),list=id=>id.map(x=>h.states[x]).filter(available);
    const air=list(ids.air),pollen=list(ids.pollen);
    if(!air.length&&!pollen.length)return '';
    const all=[...air,...pollen],icon=s=>pollen.includes(s)?I.flower:I.airFilter;
    const open=all.find(s=>s.entity_id===ui.aq);
    if(open)return renderAirQualityOpen(h,open,icon(open));
    return '<div class="wbCard wbHc wbAq"><div class="wbHeader"><h2 class="wbTitle">'+esc(T.airQuality)+'</h2></div><div class="wbAqTiles">'+
      all.map(s=>'<button class="wbTile" data-wb="aq-open" data-entity="'+esc(s.entity_id)+'"><span class="wbChip">'+svgIcon(icon(s))+'</span>'+
        '<span class="wbText"><span class="wbName">'+esc(entityName(h,s))+'</span><span class="wbSub">'+esc(stateText(h,s))+'</span></span></button>').join('')+'</div></div>';
  }
  function renderAirQualityOpen(h,s,icon){
    const unit=s.attributes?.unit_of_measurement??'',isPm25=s.attributes?.device_class==='pm25'&&unit===PM25_UNIT&&num(s.state);
    const v=Number(s.state),level=isPm25?pm25Level(v):undefined;
    const history=data.aqHistory?.entityId===s.entity_id?data.aqHistory.points:undefined;
    const pct=x=>Math.min(100,Math.max(0,(x/PM25_SCALE_MAX)*100));
    let graph;
    if(history&&history.length>1)graph=lineChartHtml(history,x=>(fmtNum(x,h.locale,{maximumFractionDigits:1})+' '+unit).trim());
    else if(level){
      let start=0;
      const stops=PM25_LIMITS.map(([k,limit])=>{const end=pct(Math.min(limit,PM25_SCALE_MAX)),stop=AQ_COLORS[k]+' '+start+'% '+end+'%';start=end;return stop});
      graph='<div class="wbScale" role="meter" aria-label="'+esc(T.fineParticles)+'" aria-valuemin="0" aria-valuemax="'+PM25_SCALE_MAX+'" aria-valuenow="'+v+'" style="background:linear-gradient(to right, '+stops.join(', ')+')">'+
        '<i style="left:'+pct(v)+'%"></i></div><div class="wbGraphNote"><span>0</span><span>'+PM25_SCALE_MAX+' '+PM25_UNIT+'</span></div>';
    }else graph='<span class="wbGraphNote"><span>'+esc(stateText(h,s))+'</span></span>';
    return '<div class="wbCard wbHc wbAq wbAqOpen"><div class="wbOpen"><div class="wbOpenHead"><span class="wbChip">'+svgIcon(icon)+'</span>'+
      '<span class="wbText"><span class="wbName">'+esc(entityName(h,s))+'</span><span class="wbSub">'+esc(stateText(h,s))+(level?' · '+esc(T.aqLevel[level]):'')+'</span></span>'+
      '<button class="wbBack" title="'+esc(T.back)+'" data-wb="aq-close">'+svgIcon(I.back)+'</button></div><div class="wbGraph">'+graph+'</div></div></div>';
  }

  /* ---- New cards (Matt, 1 Nov): base elements in the data tiles' shape, a head and a large area for the data; their
     looks come later. Any air quality or pollen sensor will do (not only an air quality service's) ---- */
  const AQ_WORDS={good:'Good',fair:'Fair',moderate:'Moderate',poor:'Poor',very_poor:'Very poor',extremely_poor:'Extremely poor'};
  const aqiWord=v=>v<=50?'Good':v<=100?'Moderate':v<=150?'Unhealthy for some':v<=200?'Unhealthy':v<=300?'Very unhealthy':'Hazardous';
  function anyAir(h){
    const by=new Map();
    Object.values(h.states||{}).filter(s=>s.entity_id.startsWith('sensor.')&&AIR_QUALITY_DEVICE_CLASSES.includes(s.attributes?.device_class??'')&&available(s)&&userFacing(h,s.entity_id))
      .sort((a,b)=>a.entity_id.localeCompare(b.entity_id)).forEach(s=>{if(!by.has(s.attributes.device_class))by.set(s.attributes.device_class,s)});
    return AIR_QUALITY_DEVICE_CLASSES.map(c=>by.get(c)).filter(Boolean);
  }
  const anyPollen=h=>Object.values(h.states||{}).filter(s=>s.entity_id.startsWith('sensor.')&&available(s)&&userFacing(h,s.entity_id)
    &&(h.entities?.[s.entity_id]?.translation_key??s.entity_id).toLowerCase().includes('pollen'));
  const POLLEN_RANK=['none','very_low','low','moderate','high','very_high'];
  const pollenRank=s=>num(s.state)?Number(s.state):POLLEN_RANK.indexOf(String(s.state).toLowerCase().replace(/ /g,'_'));
  const sayLevel=t=>{const w=String(t).replace(/_/g,' ');return w[0].toUpperCase()+w.slice(1)};
  function renderAqTile(h){
    const air=anyAir(h),main=air[0];
    if(!main)return tile({icon:I.airFilter,name:T.airQuality,sub:T.noAir,visual:valueHtml('–',''),cls:'wbBase'});
    const dc=main.attributes.device_class,v=Number(main.state),n=num(main.state);
    const sub=dc==='aqi'&&n?aqiWord(v):dc==='pm25'&&n?AQ_WORDS[pm25Level(v)]:stateText(h,main);
    return tile({icon:I.airFilter,name:T.airQuality,sub,cls:'wbBase',
      zone:valueHtml(n?fmtNum(Math.round(v),h.locale):String(main.state),dc==='aqi'?'AQI':main.attributes.unit_of_measurement||''),
      callouts:air.slice(1,4).map(s=>[entityName(h,s),stateText(h,s)])});
  }
  /* Pollen (Matt, 9 Nov): seeds, pollen grains and grass seed-heads floating across the gap between the head and the
     level, more of them the higher it is; placed by a fixed pattern, so a redraw doesn't make them jump */
  const POLLEN_GLYPHS=[
    ['wbSeed','<svg viewBox="0 0 22 30" aria-hidden="true"><path d="M11 28V11" fill="none" stroke="currentColor" stroke-width="1"></path><path d="M11 11L3 6M11 11L5 2.5M11 11L8.5 1M11 11L13.5 1M11 11L17 2.5M11 11L19 6" fill="none" stroke="currentColor" stroke-width=".8" stroke-linecap="round"></path><circle cx="11" cy="28.5" r="1.4" fill="currentColor"></circle></svg>'],
    ['wbGrain','<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.3" fill="currentColor"></circle><path d="M6 1.2v1.4M6 9.4v1.4M1.2 6h1.4M9.4 6h1.4M2.6 2.6l1 1M8.4 8.4l1 1M2.6 9.4l1-1M8.4 3.6l1-1" stroke="currentColor" stroke-width=".9" stroke-linecap="round"></path></svg>'],
    ['wbStem','<svg viewBox="0 0 10 30" aria-hidden="true"><path d="M5 29Q3.6 18 5 8" fill="none" stroke="currentColor" stroke-width="1"></path><ellipse cx="5" cy="6" rx="2.3" ry="4.6" fill="currentColor"></ellipse></svg>'],
  ];
  const pollenAir=rank=>{
    const n=[1,3,5,7,10,13][Math.max(0,Math.min(5,Number.isFinite(rank)?Math.round(rank):0))];
    return '<div class="wbPollenAir" aria-hidden="true">'+Array.from({length:n},(_,i)=>{
      const [cls,svg]=POLLEN_GLYPHS[i%3],dur=10+(i*7)%9,bob=2.6+(i*5)%4*.4;
      return '<span class="wbFloat '+cls+'" style="top:'+(4+(i*37)%52)+'%;--x:'+((i*29)%90+4)+'%;--s:'+(.8+((i*13)%5)/10).toFixed(1)+';animation-duration:'+dur+'s;animation-delay:-'+((i*2.3)%dur).toFixed(1)+'s">'+
        '<span class="wbPush"><span class="wbBob" style="animation-duration:'+bob.toFixed(1)+'s;animation-delay:-'+((i*.7)%bob).toFixed(1)+'s">'+svg+'</span></span></span>'}).join('')+'</div>';
  };
  function renderPollenTile(h){
    const all=anyPollen(h).sort((a,b)=>pollenRank(b)-pollenRank(a));
    if(!all.length)return tile({icon:I.flower,name:T.pollen,sub:T.noPollen,visual:valueHtml('–',''),cls:'wbBase'});
    const top=all[0],level=s=>num(s.state)?stateText(h,s):sayLevel(s.state);
    return tile({icon:I.flower,name:T.pollen,sub:entityName(h,top)+' · '+level(top),cls:'wbBase wbPollen',
      zone:pollenAir(pollenRank(top))+valueHtml(level(top),''),callouts:all.slice(0,3).map(s=>[entityName(h,s),level(s)])});
  }
  function renderRadarTile(h){
    const now=Date.now(),hours=forecast('hourly').filter(e=>{const t=new Date(e.datetime).getTime();return t>now-HOUR&&t<now+12*HOUR});
    const wet=hours.find(e=>(e.precipitation_probability??0)>=50||(e.precipitation??0)>=.2);
    const sub=wet?fill(T.rainFrom,{time:fmtTime(new Date(Math.max(now,new Date(wet.datetime).getTime())),h)}):hours.length?T.noRain12:undefined;
    // where the radar's map goes: home in the middle, rings round it
    return tile({icon:I.radar,name:T.rainRadar,sub,cls:'wbBase',visual:'<div class="wbRadar" aria-hidden="true"><i class="wbRadarRing"></i><i class="wbRadarHome"></i></div>'});
  }
  const RENDER={current:renderCurrent,hourly:renderHourly,sun:renderSun,moon:renderMoon,wind:renderWind,uv_index:renderUv,
    compared_to_average:renderCompared,humidity:renderHumidity,pressure:renderPressure,precipitation:renderPrecipitation,visibility:renderVisibility,air_quality:renderAirQuality,
    aq_tile:renderAqTile,pollen_tile:renderPollenTile,radar_tile:renderRadarTile};

  /* ---- Drawing: each card is redrawn only when its markup changes; focus and the strip's scroll stay put ---- */
  function render(force){
    const h=getHass?.();
    if(!h||destroyed)return;
    const src=sources(h);
    syncForecasts(h,src);
    if(!data.lastFetch)fetchTiles();
    const ids=aqIds(h),moonId=findMoonEntity(h),gauge=findRainGauge(h);
    const key=[...src.map(id=>h.states[id]),h.states['sun.sun'],moonId&&h.states[moonId],gauge&&h.states[gauge],...ids.air.map(id=>h.states[id]),...ids.pollen.map(id=>h.states[id]),
      ...(CARDS.some(c=>BASE_CARDS.includes(c))?[...anyAir(h),...anyPollen(h)]:[]),
      h.locale,h.config,h.entities,Math.floor(Date.now()/MINUTE)];
    if(!force&&lastKey&&key.length===lastKey.length&&key.every((v,i)=>v===lastKey[i]))return;
    lastKey=key;
    const shadow=root.getRootNode(),active=shadow.activeElement||document.activeElement;
    for(const name of CARDS){
      const it=items[name];
      let html='';
      try{html=RENDER[name](h,src)||''}catch(_e){html=''}   // a card that can't draw hides; the bento never throws
      if(html===it.html)continue;
      const focused=active&&it.el.contains(active)?active.dataset?.wbFocus:undefined;
      const scroller=it.el.querySelector('.wbStripScroll'),scroll=scroller?scroller.scrollLeft:null;
      it.html=html;it.el.hidden=!html;it.el.innerHTML=html;
      const sc=it.el.querySelector('.wbStripScroll');
      if(sc&&scroll!=null)sc.scrollTo({left:scroll});
      else if(sc?.dataset.start)sc.scrollTo({left:Number(sc.dataset.start)*sc.clientWidth/Number(sc.dataset.span)});
      if(focused&&!focusAfter)it.el.querySelector('[data-wb-focus="'+focused+'"]')?.focus();
    }
    if(focusAfter){root.querySelector('[data-wb-focus="'+focusAfter+'"]')?.focus();focusAfter=null}
    paint(performance.now());
  }
  function queue(){
    if(queued||destroyed)return;
    queued=true;
    queueMicrotask(()=>{queued=false;render(true)});
  }

  /* ---- Weather art: one clock repaints what shows, ten times a second; it stops when motion is off or reduced ---- */
  function artColors(){
    const cs=getComputedStyle(root),v=n=>cs.getPropertyValue(n).trim(),colors={};
    [['skyClearDay','--wx-clear'],['skyClearNight','--wx-night'],['skyCloudyDay','--wx-cloudy'],['cloudDay','--wx-cloud-bright'],['cloudNight','--wx-cloudy'],['rain','--primary']]
      .forEach(([k,n])=>{if(v(n))colors[k]=v(n)});
    const text=v('--color-text-primary')||'#f1f1f1',card=v('--color-bg-card')||'#222222',light=!!root.closest('.light');
    return {colors:{...WX_PALETTE,...colors},ink:light?text:card,paper:light?card:text};
  }
  const putImage=(cv,img)=>{
    if(cv.width!==img.w)cv.width=img.w;
    if(cv.height!==img.h)cv.height=img.h;
    cv.getContext('2d')?.putImageData(new ImageData(img.data,img.w,img.h),0,0);
  };
  const moving=()=>motion&&!reduceMotion();
  function paintStrip(t,c){
    root.querySelectorAll('canvas[data-wb-strip]').forEach(cv=>paintSky(cv,strips[cv.dataset.wbStrip],t,c));
  }
  function paintSky(cv,strip,t,c){
    if(!strip||!cv.getClientRects().length)return;
    const w=cv.clientWidth,hgt=cv.clientHeight;if(!w||!hgt)return;
    // day and night more clearly apart (Matt, 1 Nov): a crisp edge where they meet
    const o={width:w,height:hgt,columns:strip.columns||STRIP_COLUMNS,colors:c.colors,clock:t,ambient:moving(),seed:strip.seed,soft:1.5};
    if(style==='smooth'){
      const dpr=Math.min(2,window.devicePixelRatio||1),pw=Math.round(w*dpr),ph=Math.round(hgt*dpr);
      if(cv.width!==pw)cv.width=pw;
      if(cv.height!==ph)cv.height=ph;
      const ctx=cv.getContext('2d');if(!ctx)return;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      wbStripSmooth(ctx,strip.segs,o);
    }else putImage(cv,wbStripBitmap(strip.segs,{...o,px:2,oneBit:style==='onebit',ink:c.ink,paper:c.paper}));
  }
  function paint(t){
    if(destroyed)return;
    const c=artColors();
    if(style!=='smooth'){
      const idle=moving();
      root.querySelectorAll('canvas[data-wb-wx]').forEach(cv=>{
        if(!cv.getClientRects().length)return;
        putImage(cv,wxBitmap(wxPose(cv.dataset.wbWx,c.colors),{size:Number(cv.dataset.size)||40,px:2,oneBit:style==='onebit',colors:c.colors,ink:c.ink,paper:c.paper,clock:t,idle}));
      });
    }
    // the visibility tile's sea doesn't move: it repaints only when its size, the visibility or the sky's colour changes
    root.querySelectorAll('canvas[data-wb-sea]').forEach(cv=>{
      const w=cv.clientWidth,hgt=cv.clientHeight,km=Number(cv.dataset.wbSea),at=w+'x'+hgt+':'+km+':'+c.colors.skyClearDay;
      if(!w||!hgt||!(km>0)||cv.dataset.painted===at)return;
      cv.dataset.painted=at;
      putImage(cv,visibilityBitmap(w,hgt,km,c.colors));
    });
    paintStrip(t,c);
  }
  // Bitmap and 1-bit step ten times a second; the Smooth sky drifts every frame
  function tick(t){
    raf=0;
    if(destroyed||!moving())return;
    if(!document.hidden){
      if(style==='smooth')paintStrip(t,artColors());
      else{const step=Math.floor(t/100);if(step!==lastStep){lastStep=step;paint(t)}}
    }
    raf=requestAnimationFrame(tick);
  }
  function wake(){
    root.classList.toggle('wbMotion',moving());
    if(!raf&&!destroyed&&moving())raf=requestAnimationFrame(tick);
  }

  /* ---- What you can do: open a day, switch a graph, scroll the hours, open an air quality tile ---- */
  function onClick(ev){
    const el=ev.target.closest?.('[data-wb]');
    if(!el||!root.contains(el))return;
    switch(el.dataset.wb){
      case 'day':{
        ui.openDay=Number(el.dataset.index);ui.opener=el.dataset.wbFocus;focusAfter='back-day';
        const entry=days()[ui.openDay],stale=!data.todayHistory||data.todayHistory.day!==new Date().toDateString()||Date.now()-data.todayHistory.fetched>HISTORY_MAX_AGE;
        if(entry&&sameDay(new Date(entry.datetime),new Date())&&stale)fetchTodayHistory();
        break;
      }
      case 'close-day':ui.openDay=undefined;focusAfter=ui.opener;ui.opener=undefined;break;
      case 'open-page':onOpen?.();return;
      case 'day-mode':ui.dayMode=el.dataset.mode;break;
      case 'hourly-mode':ui.hourlyMode=el.dataset.mode;break;
      case 'hourly-view':ui.hourlyView=el.dataset.view;try{localStorage.setItem(VIEW_KEY,ui.hourlyView)}catch(_e){/* this visit only */}break;
      case 'hours-day':{const sc=root.querySelector('.wbStripScroll');if(sc)sc.scrollTo({left:Number(el.dataset.hours)*sc.clientWidth/Number(sc.dataset.span),behavior:'smooth'});return}
      case 'aq-open':ui.aq=el.dataset.entity;fetchAqHistory(ui.aq);break;
      case 'aq-close':ui.aq=undefined;break;
      default:return;
    }
    render(true);
  }
  function onKeyDown(ev){
    if(ev.key==='Escape'&&ui.openDay!==undefined&&ev.target.closest?.('[data-wb-open="day"]')){ui.openDay=undefined;focusAfter=ui.opener;ui.opener=undefined;render(true)}
  }
  // Drag the hours sideways with a mouse (touch scrolls by itself)
  let drag=null;
  function onMouseDown(ev){
    const sc=ev.target.closest?.('.wbStripScroll');
    if(!sc||ev.button!==0)return;
    drag={startX:ev.pageX,left:sc.scrollLeft,moved:false};
    sc.classList.add('wbHeld');
    window.addEventListener('mousemove',onMouseMove);
    window.addEventListener('mouseup',onMouseUp,{once:true});
  }
  function onMouseMove(ev){
    const sc=root.querySelector('.wbStripScroll');
    if(!drag||!sc)return;
    const delta=ev.pageX-drag.startX;
    if(!drag.moved&&Math.abs(delta)>1){drag.moved=true;sc.classList.add('wbDragging')}
    sc.scrollLeft=drag.left-delta;
  }
  function onMouseUp(){
    drag=null;
    window.removeEventListener('mousemove',onMouseMove);
    const sc=root.querySelector('.wbStripScroll');
    if(!sc)return;
    sc.classList.remove('wbDragging','wbHeld');
    // let go: it settles on the nearest page
    const snaps=[...sc.querySelectorAll('.wbSnap')];
    if(snaps.length){const to=snaps.reduce((a,b)=>Math.abs(b.offsetLeft-sc.scrollLeft)<Math.abs(a.offsetLeft-sc.scrollLeft)?b:a);sc.scrollTo({left:to.offsetLeft,behavior:'smooth'})}
  }
  root.addEventListener('click',onClick);
  root.addEventListener('keydown',onKeyDown);
  root.addEventListener('mousedown',onMouseDown);

  /* Pollen's seeds move away from the pointer (Matt, 9 Nov): while it's over the card, each one near it is pushed
     away, more the closer it is; once it leaves they ease back into their drift. Not with Reduce motion */
  const PUSH_R=64,PUSH_MOST=30;let pushAt=null,pushRaf=0;
  const pushFrame=()=>{
    pushRaf=0;
    root.querySelectorAll('.wbPollen .wbPush').forEach(el=>{
      let x=0,y=0;
      if(pushAt){const b=el.parentElement.getBoundingClientRect(),dx=b.left+b.width/2-pushAt.x,dy=b.top+b.height/2-pushAt.y,d=Math.hypot(dx,dy)||1;
        if(d<PUSH_R){const f=(1-d/PUSH_R)*PUSH_MOST;x=dx/d*f;y=dy/d*f}}
      el.style.transform=x||y?'translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)':'';
    });
    if(pushAt)pushRaf=requestAnimationFrame(pushFrame); // the seeds keep drifting under a still pointer
  };
  const onPointerMove=e=>{
    const card=e.target.closest?.('.wbPollen');
    if(!card||motionQuery?.matches){if(pushAt){pushAt=null;if(!pushRaf)pushRaf=requestAnimationFrame(pushFrame)}return}
    pushAt={x:e.clientX,y:e.clientY};
    if(!pushRaf)pushRaf=requestAnimationFrame(pushFrame);
  };
  const onPointerLeave=()=>{pushAt=null;if(!pushRaf)pushRaf=requestAnimationFrame(pushFrame)};
  root.addEventListener('pointermove',onPointerMove);
  root.addEventListener('pointerleave',onPointerLeave);

  // Sizes change (phone and desktop, or the page comes into view): repaint the art at its new size
  const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>paint(performance.now())):null;
  resize?.observe(root);
  const motionQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const onMotionChange=()=>{wake();paint(performance.now())};
  motionQuery?.addEventListener?.('change',onMotionChange);
  // The sun moves every minute and the moon every 15; the history behind the tiles every 30
  const timers=[
    setInterval(()=>{sunNow=new Date();render(true)},SUN_TICK),
    setInterval(()=>{moonNow=new Date();render(true)},MOON_TICK),
    setInterval(fetchTiles,REFRESH)
  ];

  render(true);
  wake();

  return {
    update(){render(false)},
    // a choice in Settings changed (Next hours' window)
    refresh(){render(true)},
    setStyle(next){
      if(!next||next===style)return;
      style=next;root.dataset.style=style;
      render(true);wake();
    },
    destroy(){
      cancelAnimationFrame(pushRaf);root.removeEventListener('pointermove',onPointerMove);root.removeEventListener('pointerleave',onPointerLeave);
      destroyed=true;
      timers.forEach(clearInterval);
      if(raf)cancelAnimationFrame(raf);
      raf=0;
      resize?.disconnect();
      motionQuery?.removeEventListener?.('change',onMotionChange);
      onMouseUp();
      root.removeEventListener('click',onClick);
      root.removeEventListener('keydown',onKeyDown);
      root.removeEventListener('mousedown',onMouseDown);
      ['daily','hourly'].forEach(unsubscribe);
      root.remove();
    }
  };
}
