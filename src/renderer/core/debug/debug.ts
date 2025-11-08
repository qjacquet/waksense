/**
 * Debug UI - Interface de debug pour prévisualiser les trackers
 */

import { TRACKER_CONFIGS, TrackerConfig } from "./tracker-configs";

class DebugUI {
  private trackerSelect: HTMLSelectElement | null = null;
  private previewIframe: HTMLIFrameElement | null = null;
  private previewPlaceholder: HTMLElement | null = null;
  private debugControls: HTMLElement | null = null;
  private controlsContainer: HTMLElement | null = null;
  private themeSwitch: HTMLInputElement | null = null;
  private currentTracker: string = "";
  private currentValues: { [key: string]: any } = {};

  // Configuration des paramètres par tracker
  private trackerConfigs: TrackerConfig = TRACKER_CONFIGS;

  constructor() {
    this.init();
  }

  private init(): void {
    this.trackerSelect = document.getElementById(
      "tracker-select"
    ) as HTMLSelectElement;
    this.previewIframe = document.getElementById(
      "tracker-preview"
    ) as HTMLIFrameElement;
    this.previewPlaceholder = document.getElementById("preview-placeholder");
    this.debugControls = document.getElementById("debug-controls");
    this.controlsContainer = document.getElementById("controls-container");
    this.themeSwitch = document.getElementById("theme-switch") as HTMLInputElement | null;

    if (
      !this.trackerSelect ||
      !this.previewIframe ||
      !this.debugControls ||
      !this.controlsContainer
    ) {
      console.error("Debug UI: Required elements not found");
      return;
    }

    // Init theme from localStorage
    const savedTheme = localStorage.getItem("debugTheme");
    if (savedTheme === "light") {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
    if (this.themeSwitch) {
      this.themeSwitch.checked = document.body.classList.contains("light-theme");
      this.themeSwitch.addEventListener("change", () => {
        const useLight = this.themeSwitch!.checked;
        document.body.classList.toggle("light-theme", useLight);
        localStorage.setItem("debugTheme", useLight ? "light" : "dark");
      });
    }

    this.trackerSelect.addEventListener("change", () =>
      this.handleTrackerChange()
    );
  }

  private handleTrackerChange(): void {
    const selectedValue = this.trackerSelect?.value;

    if (!selectedValue) {
      this.previewPlaceholder!.style.display = "flex";
      this.previewIframe!.style.display = "none";
      this.debugControls!.style.display = "none";
      this.currentTracker = "";
      return;
    }

    if (!this.previewIframe || !this.previewPlaceholder) {
      return;
    }

    this.currentTracker = selectedValue;

    // Construire le chemin vers le tracker
    const trackerPath = `../../trackers/${selectedValue}?debug=true`;

    // Charger le tracker dans l'iframe
    this.previewIframe.src = trackerPath;
    this.previewIframe.style.display = "block";
    this.previewPlaceholder.style.display = "none";

    // Générer les contrôles pour ce tracker
    this.generateControls(selectedValue);

    // Attendre que l'iframe soit chargée
    this.previewIframe.onload = () => {
      // Envoyer les valeurs par défaut après le chargement
      setTimeout(() => {
        this.sendValuesToTracker();
      }, 100);
    };
  }

  private generateControls(trackerPath: string): void {
    const config = this.trackerConfigs[trackerPath];

    if (!config || !this.controlsContainer) {
      this.debugControls!.style.display = "none";
      return;
    }

    this.controlsContainer.innerHTML = "";
    this.currentValues = {};

    config.forEach((control) => {
      const controlDiv = document.createElement("div");
      controlDiv.className = "control-item";

      const label = document.createElement("label");
      label.textContent = control.label;
      label.htmlFor = control.id;
      controlDiv.appendChild(label);

      let input: HTMLElement;

      if (control.type === "slider") {
        input = document.createElement("input");
        (input as HTMLInputElement).type = "range";
        (input as HTMLInputElement).id = control.id;
        (input as HTMLInputElement).min = String(control.min || 0);
        (input as HTMLInputElement).max = String(control.max || 100);
        (input as HTMLInputElement).step = String(control.step || 1);
        (input as HTMLInputElement).value = String(control.default || 0);

        const valueDisplay = document.createElement("span");
        valueDisplay.className = "control-value";
        valueDisplay.textContent = String(control.default || 0);
        (input as HTMLInputElement).addEventListener("input", (e) => {
          const value = (e.target as HTMLInputElement).value;
          valueDisplay.textContent = value;
          this.currentValues[control.id] = Number(value);
          this.sendValueToTracker(control.id, Number(value));
        });

        this.currentValues[control.id] = control.default || 0;
        controlDiv.appendChild(input);
        controlDiv.appendChild(valueDisplay);
      } else if (control.type === "checkbox") {
        input = document.createElement("input");
        (input as HTMLInputElement).type = "checkbox";
        (input as HTMLInputElement).id = control.id;
        (input as HTMLInputElement).checked = Boolean(control.default);
        (input as HTMLInputElement).addEventListener("change", (e) => {
          const value = (e.target as HTMLInputElement).checked;
          this.currentValues[control.id] = value;
          this.sendValueToTracker(control.id, value);
        });

        this.currentValues[control.id] = Boolean(control.default);
        controlDiv.appendChild(input);
      } else if (control.type === "select") {
        input = document.createElement("select");
        (input as HTMLSelectElement).id = control.id;
        control.options?.forEach((option) => {
          const opt = document.createElement("option");
          opt.value = String(option.value);
          opt.textContent = option.label;
          (input as HTMLSelectElement).appendChild(opt);
        });
        (input as HTMLSelectElement).value = String(control.default || "");
        (input as HTMLSelectElement).addEventListener("change", (e) => {
          const value = (e.target as HTMLSelectElement).value;
          this.currentValues[control.id] = value;
          this.sendValueToTracker(control.id, value);
        });

        this.currentValues[control.id] = control.default;
        controlDiv.appendChild(input);
      }

      if (this.controlsContainer) {
        this.controlsContainer.appendChild(controlDiv);
      }
    });

    if (this.debugControls) {
      this.debugControls.style.display = "block";
    }
  }

  private sendValueToTracker(key: string, value: any): void {
    if (!this.previewIframe?.contentWindow) {
      return;
    }

    this.previewIframe.contentWindow.postMessage(
      {
        type: "debug-update",
        key,
        value,
      },
      "*"
    );
  }

  private sendValuesToTracker(): void {
    if (!this.previewIframe?.contentWindow) {
      return;
    }

    this.previewIframe.contentWindow.postMessage(
      {
        type: "debug-init",
        values: this.currentValues,
      },
      "*"
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new DebugUI();
});
