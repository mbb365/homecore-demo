import css from "./styles.css?inline";
import displayCss from "./display.css?inline";
import bentoCss from "./weather-bento.css?inline";
import template from "./template.html?raw";
import { mountMoveAssistant } from "./app.js";
import { mountTestFocus } from "./test-focus.js";

const VERSION = "0.69.0";
const STORAGE_KEY = "move_assistant";
const EVENT_TYPE = "move_assistant";
const REMINDER_ID = "move_assistant_checkin_reminder";

// Fonts declared inside a shadow root are ignored, so Inter (and Geist, for tile text) is added to the page once.
function loadInter() {
  if (document.getElementById("move-assistant-inter")) return;
  const link = document.createElement("link");
  link.id = "move-assistant-inter";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Geist:wght@200;300;400;500;600;700&family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&display=swap";
  document.head.appendChild(link);
}

class MoveAssistantCard extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
  }

  static getStubConfig() {
    return {};
  }

  getCardSize() {
    return 12;
  }

  getGridOptions() {
    return { columns: "full", min_columns: 12 };
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
    loadInter();
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${css}${displayCss}${bentoCss}</style>${template}`;
    const app = root.getElementById("app");
    app.style.opacity = "0";

    let data = null;
    try {
      const result = await this._hass.callWS({
        type: "frontend/get_user_data",
        key: STORAGE_KEY,
      });
      data = result?.value ?? null;
    } catch (_err) {
      // First run, or an older Home Assistant: start from the built-in moves.
    }
    this._lastSaved = JSON.stringify(data);

    this._app = mountMoveAssistant(root, {
      data,
      save: (value) => this._save(value),
      fire: (action, payload) => this._fire(action, payload),
      ws: (msg) => this._hass.callWS(msg),
      subscribe: (msg, cb) =>
        this._hass?.connection?.subscribeMessage
          ? this._hass.connection.subscribeMessage(cb, msg)
          : Promise.reject(new Error("no connection")),
      notifyServices: () => Object.keys(this._hass?.services?.notify || {}).sort(),
      setReminderAutomation: (config) => this._setReminderAutomation(config),
      setLight: (isLight) => this.classList.toggle("lightBody", isLight),
      fullscreenSupported: Boolean(
        this.requestFullscreen || this.webkitRequestFullscreen
      ),
      toggleFullscreen: () => this._toggleFullscreen(),
    });
    this._lastStates = this._hass.states;
    this._app.updateStates(this._hass.states);
    // With `layout: test-focus`, more Home Assistant entities on Home; Settings → Appearance → Show density
    this._test = mountTestFocus(root, { config: this._config, getHass: () => this._hass });
    this._test.update(this._hass.states);
    if (!this.isConnected) { this._app.suspend(); this._test.suspend(); }
    app.style.transition = "opacity .2s ease";
    app.style.opacity = "";

    this._subscribe();
  }

  _subscribe() {
    const conn = this._hass?.connection;
    if (!conn?.subscribeMessage) return;
    conn
      .subscribeMessage(
        (msg) => {
          const json = JSON.stringify(msg?.value ?? null);
          if (json === this._lastSaved || json === this._pendingJson) return;
          this._lastSaved = json;
          this._app?.applyRemoteData(msg.value);
        },
        { type: "frontend/subscribe_user_data", key: STORAGE_KEY }
      )
      .catch(() => {
        // Live sync needs a recent Home Assistant; everything else still works.
      });
  }

  _save(value) {
    this._pendingJson = JSON.stringify(value);
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      const json = this._pendingJson;
      try {
        await this._hass.callWS({
          type: "frontend/set_user_data",
          key: STORAGE_KEY,
          value: JSON.parse(json),
        });
        this._lastSaved = json;
      } catch (_err) {
        this._toast("Couldn't save to Home Assistant");
      }
    }, 400);
  }

  _fire(action, payload = {}) {
    if (this._config?.events === false) return;
    this._hass
      ?.callWS({
        type: "fire_event",
        event_type: EVENT_TYPE,
        event_data: { action, ...payload },
      })
      .catch(() => {
        // Firing events needs an admin user; ignore otherwise.
      });
  }

  // Keeps one Home Assistant automation in sync with the check-in times.
  // Passing null removes it.
  async _setReminderAutomation(config) {
    const path = `config/automation/config/${REMINDER_ID}`;
    if (!config) {
      try {
        await this._hass.callApi("DELETE", path);
      } catch (err) {
        if (err?.status_code !== 404 && err?.status !== 404) throw err;
      }
      return;
    }
    const at = (hhmm) => `${hhmm}:00`;
    const openPath = window.location.pathname;
    await this._hass.callApi("POST", path, {
      id: REMINDER_ID,
      alias: "Move Assistant check-in reminder",
      description:
        "Created by Move Assistant. Change it in Move Assistant → Settings → Check-in.",
      mode: "single",
      triggers: [
        { trigger: "time", at: at(config.times.morning), id: "morning" },
        { trigger: "time", at: at(config.times.evening), id: "evening" },
      ],
      conditions: [],
      actions: [
        {
          action: `notify.${config.target}`,
          data: {
            title: "Move Assistant",
            message:
              "{{ 'Morning' if trigger.id == 'morning' else 'Evening' }} check-in is ready",
            data: { url: openPath, clickAction: openPath },
          },
        },
      ],
    });
  }

  _toggleFullscreen() {
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
      return;
    }
    const request = this.requestFullscreen || this.webkitRequestFullscreen;
    Promise.resolve(request.call(this)).catch(() =>
      this._toast("Full screen isn't available here")
    );
  }

  _toast(message) {
    const toast = this.shadowRoot?.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2600);
  }
}

if (!customElements.get("move-assistant-card")) {
  customElements.define("move-assistant-card", MoveAssistantCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "move-assistant-card",
    name: "Move Assistant",
    description: "Guided movement timer with your Home Assistant activity data.",
    preview: false,
  });
  // eslint-disable-next-line no-console
  console.info(`%c MOVE ASSISTANT %c ${VERSION} `, "background:#D0FF00;color:#090909;font-weight:700", "");
}
