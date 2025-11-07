/**
 * Debug UI - Interface de debug pour prévisualiser les trackers
 */

interface DebugControl {
  id: string;
  label: string;
  type: "slider" | "checkbox" | "select";
  min?: number;
  max?: number;
  step?: number;
  default?: number | boolean | string;
  options?: { value: string | number; label: string }[];
}

interface TrackerConfig {
  [key: string]: DebugControl[];
}

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
  private trackerConfigs: TrackerConfig = {
    "cra/index.html": [
      {
        id: "affutage",
        label: "Affûtage",
        type: "slider",
        min: 0,
        max: 100,
        default: 0,
      },
      {
        id: "precision",
        label: "Précision",
        type: "slider",
        min: 0,
        max: 300,
        default: 0,
      },
      {
        id: "precisionMax",
        label: "Précision Max",
        type: "select",
        default: 300,
        options: [
          { value: 200, label: "200" },
          { value: 300, label: "300" },
        ],
      },
      {
        id: "pointeAffuteeStacks",
        label: "Pointe Affûtée",
        type: "slider",
        min: 0,
        max: 3,
        default: 0,
      },
      {
        id: "baliseAffuteeStacks",
        label: "Balise Affûtée",
        type: "slider",
        min: 0,
        max: 3,
        default: 0,
      },
      {
        id: "tirPrecisActive",
        label: "Tir Précis Actif",
        type: "checkbox",
        default: false,
      },
    ],
    "cra/jauge.html": [
      {
        id: "affutage",
        label: "Affûtage",
        type: "slider",
        min: 0,
        max: 100,
        default: 0,
      },
      {
        id: "precision",
        label: "Précision",
        type: "slider",
        min: 0,
        max: 300,
        default: 0,
      },
      {
        id: "precisionMax",
        label: "Précision Max",
        type: "select",
        default: 300,
        options: [
          { value: 200, label: "200" },
          { value: 300, label: "300" },
        ],
      },
      {
        id: "pointeAffuteeStacks",
        label: "Pointe Affûtée",
        type: "slider",
        min: 0,
        max: 3,
        default: 0,
      },
      {
        id: "baliseAffuteeStacks",
        label: "Balise Affûtée",
        type: "slider",
        min: 0,
        max: 3,
        default: 0,
      },
      {
        id: "tirPrecisActive",
        label: "Tir Précis Actif",
        type: "checkbox",
        default: false,
      },
    ],
    "iop/boosts.html": [
      {
        id: "concentration",
        label: "Concentration",
        type: "slider",
        min: 0,
        max: 100,
        default: 0,
      },
      {
        id: "courroux",
        label: "Courroux Actif",
        type: "checkbox",
        default: false,
      },
      {
        id: "puissance",
        label: "Puissance",
        type: "slider",
        min: 0,
        max: 50,
        default: 0,
      },
      {
        id: "preparation",
        label: "Préparation Actif",
        type: "checkbox",
        default: false,
      },
      { id: "egare", label: "Égaré Actif", type: "checkbox", default: false },
      {
        id: "activePosture",
        label: "Posture",
        type: "select",
        default: "",
        options: [
          { value: "", label: "Aucune" },
          { value: "contre", label: "Posture de contre" },
          { value: "défense", label: "Posture de défense" },
          { value: "vivacité", label: "Posture de vivacité" },
        ],
      },
    ],
    "iop/combos.html": [
      {
        id: "comboName",
        label: "Combo",
        type: "select",
        default: "combo1",
        options: [
          { value: "combo1", label: "Vol de vie" },
          { value: "combo2", label: "Poussée" },
          { value: "combo3", label: "Préparation" },
          { value: "combo4", label: "Dommages supplémentaires" },
          { value: "combo5", label: "Combo PA" },
        ],
      },
      {
        id: "currentStep",
        label: "Étape Actuelle",
        type: "slider",
        min: 0,
        max: 5,
        default: 0,
      },
      {
        id: "readyToComplete",
        label: "Prêt à Compléter",
        type: "checkbox",
        default: false,
      },
    ],
    "iop/jauge.html": [
      {
        id: "concentration",
        label: "Concentration",
        type: "slider",
        min: 0,
        max: 100,
        default: 0,
      },
      {
        id: "courroux",
        label: "Courroux Actif",
        type: "checkbox",
        default: false,
      },
      {
        id: "puissance",
        label: "Puissance",
        type: "slider",
        min: 0,
        max: 50,
        default: 0,
      },
      {
        id: "preparation",
        label: "Préparation Actif",
        type: "checkbox",
        default: false,
      },
      { id: "egare", label: "Égaré Actif", type: "checkbox", default: false },
      {
        id: "activePosture",
        label: "Posture",
        type: "select",
        default: "",
        options: [
          { value: "", label: "Aucune" },
          { value: "contre", label: "Posture de contre" },
          { value: "défense", label: "Posture de défense" },
          { value: "vivacité", label: "Posture de vivacité" },
        ],
      },
    ],
    "ouginak/index.html": [
      {
        id: "rage",
        label: "Rage",
        type: "slider",
        min: 0,
        max: 30,
        default: 0,
      },
      {
        id: "ougigarouActive",
        label: "Ougigarou Actif",
        type: "checkbox",
        default: false,
      },
      { id: "inCombat", label: "En Combat", type: "checkbox", default: true },
      {
        id: "overlayVisible",
        label: "Overlay Visible",
        type: "checkbox",
        default: true,
      },
    ],
  };

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
