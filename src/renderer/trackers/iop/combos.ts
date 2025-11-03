/**
 * Iop Combos Tracker - Suivi des combos Iop en temps réel
 * 5 colonnes de combos avec leurs étapes PA/PM/PW
 */

interface ComboDefinition {
  name: string;
  steps: string[];
  icon: string;
}

interface ComboProgress {
  currentStep: number;
  isReadyToComplete: boolean;
}

class IopCombosTracker {
  private comboDefinitions: ComboDefinition[] = [
    { name: "Vol de vie", steps: ["1PM", "3PA", "3PA"], icon: "combo1.png" },
    { name: "Poussée", steps: ["1PA", "1PA", "2PA"], icon: "combo2.png" },
    { name: "Préparation", steps: ["1PM", "1PM", "1PW"], icon: "combo3.png" },
    {
      name: "Dommages supplémentaires",
      steps: ["2PA", "1PA", "1PM"],
      icon: "combo4.png",
    },
    {
      name: "Combo PA",
      steps: ["1PW", "3PA", "1PW", "1PA"],
      icon: "combo5.png",
    },
  ];

  private comboProgress: Map<string, ComboProgress> = new Map();
  private currentTurnSpells: string[] = [];
  private completedCombosThisTurn: Set<string> = new Set();

  private combosContainer: HTMLElement | null = null;
  private spellCostMap: Map<string, string> = new Map();
  private debugMode: boolean = false;

  constructor() {
    // Détecter le mode debug
    const urlParams = new URLSearchParams(window.location.search);
    this.debugMode = urlParams.get("debug") === "true";
    // Initialize spell cost map
    this.spellCostMap.set("Épée céleste", "2PA");
    this.spellCostMap.set("Fulgur", "3PA");
    this.spellCostMap.set("Super Iop Punch", "4PA");
    this.spellCostMap.set("Jugement", "1PA");
    this.spellCostMap.set("Colère de Iop", "6PA");
    this.spellCostMap.set("Ébranler", "2PA");
    this.spellCostMap.set("Roknocerok", "4PA");
    this.spellCostMap.set("Fendoir", "3PA");
    this.spellCostMap.set("Ravage", "5PA");
    this.spellCostMap.set("Jabs", "3PA");
    this.spellCostMap.set("Rafale", "1PA");
    this.spellCostMap.set("Torgnole", "2PA");
    this.spellCostMap.set("Tannée", "4PA");
    this.spellCostMap.set("Épée de Iop", "3PA");
    this.spellCostMap.set("Bond", "4PA");
    this.spellCostMap.set("Focus", "2PA");
    this.spellCostMap.set("Éventrail", "1PM");
    this.spellCostMap.set("Uppercut", "1PW");
    this.spellCostMap.set("Amplification", "2PM");
    this.spellCostMap.set("Duel", "1PA");
    this.spellCostMap.set("Étendard de bravoure", "3PA");
    this.spellCostMap.set("Vertu", "2PA");
    this.spellCostMap.set("Charge", "1PA");

    // Initialize combo progress
    for (const combo of this.comboDefinitions) {
      this.comboProgress.set(combo.name, {
        currentStep: 0,
        isReadyToComplete: false,
      });
    }

    this.initializeUI();
    this.setupEventListeners();
    if (this.debugMode) {
      this.setupDebugMode();
    }
    this.updateUI();
  }

  private initializeUI(): void {
    this.combosContainer = document.getElementById("combos-container");
    if (!this.combosContainer) {
      console.error("[IOP COMBOS] Could not find combos-container");
      return;
    }

    // Create combo columns
    for (const combo of this.comboDefinitions) {
      const comboColumn = this.createComboColumn(combo);
      this.combosContainer.appendChild(comboColumn);
    }
  }

  private createComboColumn(combo: ComboDefinition): HTMLElement {
    const column = document.createElement("div");
    column.className = "combo-column";
    column.id = `combo-column-${combo.name}`;

    // Combo icon
    const icon = document.createElement("div");
    icon.className = "combo-icon";
    const img = document.createElement("img");
    img.src = `img/${combo.icon}`;
    img.alt = combo.name;
    img.onerror = () => {
      // Fallback to text if image not found
      icon.textContent = combo.name.substring(0, 3);
    };
    icon.appendChild(img);
    column.appendChild(icon);

    // Combo steps
    for (let i = 0; i < 4; i++) {
      if (i < combo.steps.length) {
        const step = document.createElement("div");
        step.className = "combo-step future";
        step.id = `combo-step-${combo.name}-${i}`;
        step.textContent = combo.steps[i];

        // Determine resource type for color
        if (combo.steps[i].includes("PA")) {
          step.classList.add("pa");
        } else if (combo.steps[i].includes("PM")) {
          step.classList.add("pm");
        } else if (combo.steps[i].includes("PW")) {
          step.classList.add("pw");
        }

        column.appendChild(step);
      }
    }

    return column;
  }

  private setupEventListeners(): void {
    window.electronAPI.onLogLine((line: string, parsed: any) => {
      this.processLogLine(line, parsed);
    });

    window.electronAPI.onCombatEnded(() => {
      this.resetCombos();
      this.updateUI();
    });
  }

  private processLogLine(line: string, parsed: any): void {
    // Handle turn end
    if (
      line.includes("reportée pour le tour suivant") ||
      line.includes("reportées pour le tour suivant")
    ) {
      this.resetCombos();
      this.updateUI();
      return;
    }

    // Handle spell cast
    if (parsed.isSpellCast && parsed.spellCast) {
      const spellName = parsed.spellCast.spellName;
      const cost = this.spellCostMap.get(spellName);

      if (cost) {
        this.handleSpellCast(cost);
      }
    }
  }

  private handleSpellCast(spellCost: string): void {
    const compactCost = spellCost.replace(" ", ""); // e.g., "2 PA" -> "2PA"

    // Find matching combos that are in progress
    const matchingCombos: string[] = [];

    for (const [comboName, progress] of this.comboProgress.entries()) {
      const combo = this.comboDefinitions.find((c) => c.name === comboName);
      if (!combo) continue;

      if (progress.currentStep < combo.steps.length) {
        const expectedStep = combo.steps[progress.currentStep];
        if (compactCost === expectedStep) {
          matchingCombos.push(comboName);
        }
      }
    }

    if (matchingCombos.length > 0) {
      // Progress all matching combos
      for (const comboName of matchingCombos) {
        const progress = this.comboProgress.get(comboName)!;
        progress.currentStep += 1;

        // Check if combo is completed
        const combo = this.comboDefinitions.find((c) => c.name === comboName)!;
        if (progress.currentStep >= combo.steps.length) {
          this.completedCombosThisTurn.add(comboName);
          progress.currentStep = 0;
        } else {
          progress.isReadyToComplete =
            progress.currentStep === combo.steps.length - 1;
        }
      }

      // Reset all other combos that were in progress
      for (const [comboName, progress] of this.comboProgress.entries()) {
        if (!matchingCombos.includes(comboName) && progress.currentStep > 0) {
          progress.currentStep = 0;
          progress.isReadyToComplete = false;
        }
      }
    } else {
      // Reset all combos in progress
      for (const [comboName, progress] of this.comboProgress.entries()) {
        if (progress.currentStep > 0) {
          progress.currentStep = 0;
          progress.isReadyToComplete = false;
        }
      }

      // Check if this spell starts any combo
      for (const combo of this.comboDefinitions) {
        if (combo.steps.length > 0 && compactCost === combo.steps[0]) {
          const progress = this.comboProgress.get(combo.name)!;
          progress.currentStep = 1;
          progress.isReadyToComplete =
            progress.currentStep === combo.steps.length - 1;
          break;
        }
      }
    }

    // Add to current turn spells
    this.currentTurnSpells.push(compactCost);

    this.updateUI();
  }

  private resetCombos(): void {
    for (const [comboName, progress] of this.comboProgress.entries()) {
      progress.currentStep = 0;
      progress.isReadyToComplete = false;
    }
    this.currentTurnSpells = [];
    this.completedCombosThisTurn.clear();
  }

  private setupDebugMode(): void {
    let currentComboId: string = "combo1";

    window.addEventListener("message", (event) => {
      if (event.data.type === "debug-init") {
        // Initialiser avec toutes les valeurs
        const values = event.data.values;
        if (values.comboName) {
          currentComboId = String(values.comboName);
          const comboName = this.getComboNameById(currentComboId);
          const progress = this.comboProgress.get(comboName);
          if (progress) {
            if (values.currentStep !== undefined) {
              progress.currentStep = Number(values.currentStep);
            }
            if (values.readyToComplete !== undefined) {
              progress.isReadyToComplete = Boolean(values.readyToComplete);
            }
          }
        }
        this.updateUI();
      } else if (event.data.type === "debug-update") {
        // Mettre à jour une valeur spécifique
        const { key, value } = event.data;
        switch (key) {
          case "comboName":
            currentComboId = String(value);
            // Quand on change de combo, mettre à jour l'UI pour afficher le nouveau combo
            this.updateUI();
            break;
          case "currentStep":
            const comboName = this.getComboNameById(currentComboId);
            const progress = this.comboProgress.get(comboName);
            if (progress) {
              progress.currentStep = Number(value);
              this.updateUI();
            }
            break;
          case "readyToComplete":
            const comboName2 = this.getComboNameById(currentComboId);
            const progress2 = this.comboProgress.get(comboName2);
            if (progress2) {
              progress2.isReadyToComplete = Boolean(value);
              this.updateUI();
            }
            break;
        }
      }
    });
  }

  private getComboNameById(id: string): string {
    const comboMap: { [key: string]: string } = {
      combo1: "Vol de vie",
      combo2: "Poussée",
      combo3: "Préparation",
      combo4: "Dommages supplémentaires",
      combo5: "Combo PA",
    };
    return comboMap[id] || "Vol de vie";
  }

  private updateUI(): void {
    for (const combo of this.comboDefinitions) {
      const column = document.getElementById(`combo-column-${combo.name}`);
      const progress = this.comboProgress.get(combo.name)!;

      if (!column) continue;

      // Update column styling
      if (progress.isReadyToComplete) {
        column.classList.add("ready-to-complete");
      } else {
        column.classList.remove("ready-to-complete");
      }

      // Update step styling
      for (let i = 0; i < combo.steps.length; i++) {
        const step = document.getElementById(`combo-step-${combo.name}-${i}`);
        if (!step) continue;

        // Remove all state classes
        step.classList.remove(
          "completed",
          "next-step",
          "future",
          "animating-out"
        );

        if (i < progress.currentStep) {
          // Completed steps
          step.classList.add("completed");
        } else if (i === progress.currentStep) {
          // Next step (highlighted)
          step.classList.add("next-step");
        } else {
          // Future steps
          step.classList.add("future");
        }
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new IopCombosTracker();
});
