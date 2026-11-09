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
  mdiShieldAccount, mdiPalette, mdiHuman, mdiBell, mdiCart, mdiChartBoxOutline, mdiTooltipAccount,
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
};

// an inline icon, filled like Home Assistant's
export const icon = (name, cls = 'hcI') =>
  '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (DEMO_ICONS[name] || '') + '"/></svg>';
