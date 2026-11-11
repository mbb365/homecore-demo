// HomeCore demo: the HomeCore house page on its own, outside Home Assistant.
// Built from Move Assistant v0.69.0. The Move Assistant card wrapper is gone (no card API, no events, no check-in
// automation); app.js still runs underneath because HomeCore shares its views, settings and theme.
import css from "./styles.css?inline";
import displayCss from "./display.css?inline";
import bentoCss from "./weather-bento.css?inline";
import demoCss from "./demo.css?inline";
import motionCss from "./motion.css?inline";
import haTodayCss from "./ha-today.css?inline";
import template from "./template.html?raw";
import { mountMoveAssistant } from "./app.js";
import { mountTestFocus } from "./test-focus.js";
import { mountDemoShell } from "./demo-shell.js";
import { installMotion, installSegments } from "./motion.js";

// The saved-data key app.js reads and writes. Kept as it was so HomeCore's own keys stay unchanged.
const STORAGE_KEY = "move_assistant";

// Fonts declared inside a shadow root are ignored, so Geist is added to the page once (the one font: Matt, 9 Nov).
function loadFonts() {
  if (document.getElementById("homecore-fonts")) return;
  const link = document.createElement("link");
  link.id = "homecore-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Geist:wght@200;300;400;500;600;700;800&display=swap"; // Geist only (Matt, 9 Nov)
  document.head.appendChild(link);
}

class HomeCoreApp extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._init();
      return;
    }
    if (this._app && hass.states !== this._lastStates) {
      this._lastStates = hass.states;
      this._app.updateStates(hass.states);
      this._test?.update(hass.states);
    }
  }

  connectedCallback() {
    this._app?.resume();
    this._test?.resume();
  }

  disconnectedCallback() {
    this._app?.suspend();
    this._test?.suspend();
  }

  async _init() {
    loadFonts();
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${css}${displayCss}${bentoCss}${demoCss}${motionCss}${haTodayCss}</style>${template}`;
    const app = root.getElementById("app");
    app.style.opacity = "0";

    let data = null;
    try {
      const result = await this._hass.callWS({ type: "frontend/get_user_data", key: STORAGE_KEY });
      data = result?.value ?? null;
    } catch (_err) {
      // nothing saved yet
    }

    this._app = mountMoveAssistant(root, {
      data,
      save: (value) => this._save(value),
      fire: () => {},
      ws: (msg) => this._hass.callWS(msg),
      subscribe: (msg, cb) =>
        this._hass?.connection?.subscribeMessage
          ? this._hass.connection.subscribeMessage(cb, msg)
          : Promise.reject(new Error("no connection")),
      notifyServices: () => [],
      setReminderAutomation: async () => {},
      setLight: (isLight) => this.classList.toggle("lightBody", isLight),
      fullscreenSupported: Boolean(this.requestFullscreen || this.webkitRequestFullscreen),
      toggleFullscreen: () => this._toggleFullscreen(),
    });
    this._lastStates = this._hass.states;
    this._app.updateStates(this._hass.states);
    this._test = mountTestFocus(root, { config: this._config, getHass: () => this._hass });
    this._test.update(this._hass.states);
    this._shell = mountDemoShell(root, { getHass: () => this._hass, homecore: this._test });
    installMotion(root, app);
    installSegments(root);
    if (!this.isConnected) { this._app.suspend(); this._test.suspend(); }
    app.style.transition = "opacity .2s ease";
    app.style.opacity = "";
  }

  _save(value) {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._hass.callWS({ type: "frontend/set_user_data", key: STORAGE_KEY, value }).catch(() => {});
    }, 400);
  }

  _toggleFullscreen() {
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
      return;
    }
    const request = this.requestFullscreen || this.webkitRequestFullscreen;
    Promise.resolve(request.call(this)).catch(() => this._toast("Full screen isn't available here"));
  }

  _toast(message) {
    const toast = this.shadowRoot?.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2600);
  }
}

if (!customElements.get("homecore-app")) customElements.define("homecore-app", HomeCoreApp);
