// Icons the demo's own pages use (Material Design Icons, as Home Assistant). Paths by name, for the rail's inline icons
// and, merged into the fake ha-icon, for tiles.
import {
  mdiHomeAssistant, mdiMagnify, mdiHome, mdiWeatherPartlyCloudy, mdiDevices, mdiDotsHorizontal, mdiMenu, mdiClose,
  mdiFilterVariant, mdiCogOutline, mdiFormatListBulleted, mdiViewGridOutline, mdiPlus, mdiMicrophone,
  mdiLightningBolt, mdiFormatListBulletedType, mdiChartLine, mdiPlayBoxMultiple, mdiMap, mdiCog,
  mdiLightbulb, mdiToggleSwitchVariant, mdiCast, mdiLock, mdiThermostat, mdiCurtains, mdiRobotVacuum, mdiValve,
  mdiAirHumidifier, mdiShieldHome, mdiFlower, mdiThermometer, mdiWaterPercent, mdiFlash, mdiMotionSensor,
  mdiDoorClosed, mdiWindowClosed, mdiGauge, mdiFan, mdiSmokeDetector, mdiWater, mdiTelevision, mdiSpeaker,
  mdiCurtainsClosed, mdiRollerShade, mdiRollerShadeClosed, mdiBlindsHorizontal, mdiBlindsHorizontalClosed,
  mdiWindowShutter, mdiWindowShutterOpen, mdiUpdate, mdiAccountCircleOutline, mdiMapMarker, mdiHeartPulse, mdiCalendar,
  mdiShieldAccount, mdiPalette, mdiHuman, mdiBell, mdiCart, mdiChartBoxOutline, mdiTooltipAccount, mdiAccountMultiple, mdiDoorOpen,
  // Home Assistant's Settings and About (9 Nov)
  mdiCloudLock, mdiRobot, mdiSofa, mdiPuzzle, mdiViewDashboard, mdiAccessPointNetwork, mdiAccount, mdiHammer, mdiInformationOutline, mdiNewspaperVariant, mdiHandsPray, mdiTshirtCrew, mdiBug, mdiHelp, mdiFileDocument, mdiKeyboard, mdiOpenInNew, mdiTuneVariant, mdiChevronRight, mdiImage,
} from '@mdi/js';

export const DEMO_ICONS = {
  'mdi:home-assistant': mdiHomeAssistant, 'mdi:magnify': mdiMagnify, 'mdi:home': mdiHome,
  'mdi:weather-partly-cloudy': mdiWeatherPartlyCloudy, 'mdi:devices': mdiDevices, 'mdi:dots-horizontal': mdiDotsHorizontal,
  'mdi:menu': mdiMenu, 'mdi:close': mdiClose, 'mdi:filter-variant': mdiFilterVariant, 'mdi:cog-outline': mdiCogOutline,
  'mdi:format-list-bulleted': mdiFormatListBulleted, 'mdi:view-grid-outline': mdiViewGridOutline, 'mdi:plus': mdiPlus,
  'mdi:microphone': mdiMicrophone, 'mdi:lightning-bolt': mdiLightningBolt, 'mdi:format-list-bulleted-type': mdiFormatListBulletedType,
  'mdi:chart-line': mdiChartLine, 'mdi:play-box-multiple': mdiPlayBoxMultiple, 'mdi:map': mdiMap, 'mdi:cog': mdiCog,
  'mdi:lightbulb': mdiLightbulb, 'mdi:toggle-switch-variant': mdiToggleSwitchVariant, 'mdi:cast': mdiCast, 'mdi:lock': mdiLock,
  'mdi:thermostat': mdiThermostat, 'mdi:curtains': mdiCurtains, 'mdi:robot-vacuum': mdiRobotVacuum, 'mdi:valve': mdiValve,
  'mdi:air-humidifier': mdiAirHumidifier, 'mdi:shield-home': mdiShieldHome, 'mdi:flower': mdiFlower,
  'mdi:thermometer': mdiThermometer, 'mdi:water-percent': mdiWaterPercent, 'mdi:flash': mdiFlash,
  'mdi:motion-sensor': mdiMotionSensor, 'mdi:door-closed': mdiDoorClosed, 'mdi:window-closed': mdiWindowClosed,
  'mdi:gauge': mdiGauge, 'mdi:fan': mdiFan, 'mdi:smoke-detector': mdiSmokeDetector, 'mdi:water': mdiWater,
  'mdi:television': mdiTelevision, 'mdi:speaker': mdiSpeaker, 'mdi:curtains-closed': mdiCurtainsClosed,
  'mdi:roller-shade': mdiRollerShade, 'mdi:roller-shade-closed': mdiRollerShadeClosed, 'mdi:blinds-horizontal': mdiBlindsHorizontal,
  'mdi:blinds-horizontal-closed': mdiBlindsHorizontalClosed, 'mdi:window-shutter': mdiWindowShutter, 'mdi:window-shutter-open': mdiWindowShutterOpen,
  'mdi:update': mdiUpdate, 'mdi:account-circle-outline': mdiAccountCircleOutline, 'mdi:map-marker': mdiMapMarker, 'mdi:heart-pulse': mdiHeartPulse,
  'mdi:calendar': mdiCalendar, 'mdi:shield-account': mdiShieldAccount, 'mdi:palette': mdiPalette, 'mdi:human': mdiHuman, 'mdi:bell': mdiBell,
  'mdi:cart': mdiCart, 'mdi:chart-box-outline': mdiChartBoxOutline, 'mdi:tooltip-account': mdiTooltipAccount,
  'mdi:account-multiple': mdiAccountMultiple, 'mdi:door-open': mdiDoorOpen,
  'mdi:cloud-lock': mdiCloudLock, 'mdi:robot': mdiRobot, 'mdi:sofa': mdiSofa, 'mdi:puzzle': mdiPuzzle, 'mdi:view-dashboard': mdiViewDashboard, 'mdi:access-point-network': mdiAccessPointNetwork, 'mdi:account': mdiAccount, 'mdi:hammer': mdiHammer, 'mdi:information-outline': mdiInformationOutline, 'mdi:newspaper-variant': mdiNewspaperVariant, 'mdi:hands-pray': mdiHandsPray, 'mdi:tshirt-crew': mdiTshirtCrew, 'mdi:bug': mdiBug, 'mdi:help': mdiHelp, 'mdi:file-document': mdiFileDocument, 'mdi:keyboard': mdiKeyboard, 'mdi:open-in-new': mdiOpenInNew, 'mdi:tune-variant': mdiTuneVariant, 'mdi:chevron-right': mdiChevronRight, 'mdi:image': mdiImage,
};

// an inline icon, filled like Home Assistant's
export const icon = (name, cls = 'hcI') =>
  '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (DEMO_ICONS[name] || '') + '"/></svg>';

// Home Assistant's logo, as the foundation publishes it (home-assistant/assets, logomark, colour)
export const HA_LOGO = '<svg class="hcLogoMark" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M240 224.762C240 233.012 233.25 239.762 225 239.762H15C6.75 239.762 0 233.012 0 224.762V134.762C0 126.512 4.77 114.993 10.61 109.153L109.39 10.3725C115.22 4.5425 124.77 4.5425 130.6 10.3725L229.39 109.162C235.22 114.992 240 126.522 240 134.772V224.772V224.762Z" fill="#F2F4F9"/><path d="M229.39 109.153L130.61 10.3725C124.78 4.5425 115.23 4.5425 109.4 10.3725L10.61 109.153C4.78 114.983 0 126.512 0 134.762V224.762C0 233.012 6.75 239.762 15 239.762H107.27L66.64 199.132C64.55 199.852 62.32 200.262 60 200.262C48.7 200.262 39.5 191.062 39.5 179.762C39.5 168.462 48.7 159.262 60 159.262C71.3 159.262 80.5 168.462 80.5 179.762C80.5 182.092 80.09 184.322 79.37 186.412L111 218.042V102.162C104.2 98.8225 99.5 91.8425 99.5 83.7725C99.5 72.4725 108.7 63.2725 120 63.2725C131.3 63.2725 140.5 72.4725 140.5 83.7725C140.5 91.8425 135.8 98.8225 129 102.162V183.432L160.46 151.972C159.84 150.012 159.5 147.932 159.5 145.772C159.5 134.472 168.7 125.272 180 125.272C191.3 125.272 200.5 134.472 200.5 145.772C200.5 157.072 191.3 166.272 180 166.272C177.5 166.272 175.12 165.802 172.91 164.982L129 208.892V239.772H225C233.25 239.772 240 233.022 240 224.772V134.772C240 126.522 235.23 115.002 229.39 109.162V109.153Z" fill="#18BCF2"/></svg>';
