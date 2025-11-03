/**
 * Iop Boosts Tracker - Suivi des boosts Iop en temps réel
 * Concentration, Courroux, Puissance, Préparation, Égaré
 */

import {
  setupTrackerEventListeners,
  updateBooleanIndicator,
  updateProgressBar,
  updateStackIndicator,
} from "../../core/ui-helpers.js";

class IopBoostsTracker {
  private concentration: number = 0;
  private courroux: number = 0;
  private puissance: number = 0;
  private preparation: number = 0;
  private egare: boolean = false;

  private inCombat: boolean = false;
  private trackedPlayerName: string | null = null;

  private pendingPreparationLoss: boolean = false;
  private preparationLossCaster: string | null = null;
  private preparationLossSpell: string | null = null;
  private debugMode: boolean = false;

  constructor() {
    // Détecter le mode debug
    const urlParams = new URLSearchParams(window.location.search);
    this.debugMode = urlParams.get("debug") === "true";

    this.setupEventListeners();
    if (this.debugMode) {
      this.setupDebugMode();
    }
    this.updateUI();
  }

  private setupEventListeners(): void {
    setupTrackerEventListeners(
      (line: string, parsed: any) => this.processLogLine(line, parsed),
      () => {
        this.inCombat = false;
        this.resetResources();
      },
      () => {
        this.inCombat = true;
      }
    );
  }

  private resetResources(): void {
    this.concentration = 0;
    this.courroux = 0;
    this.puissance = 0;
    this.preparation = 0;
    this.egare = false;
    this.pendingPreparationLoss = false;
    this.preparationLossCaster = null;
    this.preparationLossSpell = null;
    this.updateUI();
  }

  private processLogLine(line: string, parsed: any): void {
    // Parse resource gains FIRST (before spell casts that might consume them)
    // Parse Concentration
    this.parseConcentration(line);

    // Parse Courroux (MUST be before handleSpellCast which might reset it)
    this.parseCourroux(line);

    // Parse Puissance
    this.parsePuissance(line);

    // Parse Préparation
    this.parsePreparation(line);

    // Parse Égaré
    this.parseEgare(line);

    // Parse spell consumption (after resource parsing to avoid resetting before gain)
    if (parsed.isSpellCast && parsed.spellCast) {
      this.handleSpellCast(parsed.spellCast, line);
    }

    // Parse damage for Préparation consumption
    this.parseDamage(line);
  }

  private parseConcentration(line: string): void {
    // Check for concentration in combat lines
    if (
      !line.includes("[Information (combat)]") ||
      !line.includes("Concentration")
    ) {
      return;
    }

    const concentrationMatch = line.match(/Concentration \(\+(\d+) Niv\.\)/);
    if (concentrationMatch) {
      const concentrationValue = parseInt(concentrationMatch[1], 10);

      // Extract player name
      const playerMatch = line.match(
        /\[Information \(combat\)\] ([^:]+): Concentration/
      );
      if (playerMatch) {
        this.trackedPlayerName = playerMatch[1].trim();
      }

      // Check if concentration reaches 100+ (triggers overflow and égaré loss)
      if (concentrationValue >= 100) {
        this.concentration = concentrationValue % 100;
        if (this.egare) {
          this.egare = false;
        }
      } else {
        this.concentration = concentrationValue;
      }

      this.updateUI();
    }
  }

  private parseCourroux(line: string): void {
    // Only process combat lines
    if (!line.includes("[Information (combat)]")) {
      return;
    }

    // Parse Courroux gains FIRST - "Courroux (+X Niv.) (Compulsion)" OR "Courroux (+X Niv.) (Concentration)"
    // Note: The number in (+X Niv.) is the TOTAL current amount, not the amount gained
    const courrouxGainMatch = line.match(
      /Courroux \(\+(\d+) Niv\.\) \((Compulsion|Concentration)\)/
    );
    if (courrouxGainMatch) {
      const courrouxTotal = parseInt(courrouxGainMatch[1], 10);
      const oldCourroux = this.courroux;
      this.courroux = Math.min(courrouxTotal, 4); // Max 4 stacks
      if (this.courroux !== oldCourroux) {
        this.updateUI();
      }
      return; // Return early to avoid checking loss patterns
    }

    // Parse Courroux loss from damage - damage dealt with (Courroux) tag
    // Pattern: "[Information (combat)] monster: -xx PV (element) (Courroux)"
    if (line.includes("(Courroux)") && line.includes("PV")) {
      const courrouxDamageMatch = line.match(
        /\[Information \(combat\)\] .*: -(\d+) PV \([^)]+\) \(Courroux\)/
      );
      if (courrouxDamageMatch && this.courroux > 0) {
        this.courroux = 0; // Lose ALL stacks when damage is dealt with courroux
        this.updateUI();
        return;
      }
    }

    // Parse Courroux loss - "n'est plus sous l'emprise de 'Courroux' (Compulsion)"
    if (line.includes("n'est plus sous l'emprise de 'Courroux' (Compulsion)")) {
      const playerMatch = line.match(/\[Information \(combat\)\] ([^:]+):/);
      if (
        playerMatch &&
        this.trackedPlayerName &&
        playerMatch[1].trim() === this.trackedPlayerName.trim()
      ) {
        if (this.courroux > 0) {
          this.courroux = 0; // Lose ALL stacks
          this.updateUI();
        }
        return;
      }
    }
  }

  private parsePuissance(line: string): void {
    const puissanceMatch = line.match(/Puissance \(\+(\d+) Niv\.\)/);
    if (puissanceMatch) {
      const puissanceValue = parseInt(puissanceMatch[1], 10);
      const oldPuissance = this.puissance;
      this.puissance = Math.min(puissanceValue, 50);
      if (this.puissance !== oldPuissance) {
        this.updateUI();
      }
    }

    if (line.includes("n'est plus sous l'emprise de 'Puissance' (Iop isolé)")) {
      const playerMatch = line.match(/\[Information \(combat\)\] ([^:]+):/);
      if (playerMatch && playerMatch[1] === this.trackedPlayerName) {
        const oldPuissance = this.puissance;
        this.puissance = Math.max(0, this.puissance - 10);
        if (this.puissance !== oldPuissance) {
          this.updateUI();
        }
      }
    }
  }

  private parsePreparation(line: string): void {
    const preparationGainMatch = line.match(/Préparation \(\+(\d+) Niv\.\)/);
    if (preparationGainMatch) {
      const preparationTotal = parseInt(preparationGainMatch[1], 10);
      const oldPreparation = this.preparation;
      this.preparation = preparationTotal;
      if (this.preparation !== oldPreparation) {
        this.updateUI();
      }
    }
  }

  private parseEgare(line: string): void {
    // Égaré loss - turn passing
    if (
      line.includes("reportée pour le tour suivant") ||
      line.includes("reportées pour le tour suivant")
    ) {
      if (this.egare) {
        this.egare = false;
        this.updateUI();
      }
    }
  }

  private handleSpellCast(
    spellCast: { playerName: string; spellName: string },
    line: string
  ): void {
    if (spellCast.playerName !== this.trackedPlayerName) {
      return;
    }

    // Initialize puissance on first spell cast in combat
    if (!this.inCombat) {
      this.inCombat = true;
      this.puissance = 30;
      this.updateUI();
    }

    // Handle Courroux loss spells
    if (
      ["Super Iop Punch", "Roknocerok", "Tannée"].includes(spellCast.spellName)
    ) {
      if (this.courroux > 0) {
        this.courroux = 0;
        this.updateUI();
      }
    }

    // Handle Préparation loss
    if (this.preparation > 0) {
      this.pendingPreparationLoss = true;
      this.preparationLossCaster = spellCast.playerName;
      this.preparationLossSpell = spellCast.spellName;
    }

    // Handle Égaré gain spells
    if (["Fulgur", "Colère de Iop"].includes(spellCast.spellName)) {
      this.egare = true;
      this.updateUI();
    }
  }

  private parseDamage(line: string): void {
    if (!this.pendingPreparationLoss) {
      return;
    }

    const damageMatch = line.match(
      /\[Information \(combat\)\] ([^:]+):\s+-(\d+)\s*PV/
    );
    if (damageMatch && damageMatch[1] === this.preparationLossCaster) {
      this.preparation = 0;
      this.pendingPreparationLoss = false;
      this.preparationLossCaster = null;
      this.preparationLossSpell = null;
      this.updateUI();
    }
  }

  private setupDebugMode(): void {
    window.addEventListener("message", (event) => {
      if (event.data.type === "debug-init") {
        // Initialiser avec toutes les valeurs
        const values = event.data.values;
        if (values.concentration !== undefined)
          this.concentration = Number(values.concentration);
        if (values.courroux !== undefined)
          this.courroux = Number(values.courroux);
        if (values.puissance !== undefined)
          this.puissance = Number(values.puissance);
        if (values.preparation !== undefined)
          this.preparation = Number(values.preparation);
        if (values.egare !== undefined) this.egare = Boolean(values.egare);
        this.updateUI();
      } else if (event.data.type === "debug-update") {
        // Mettre à jour une valeur spécifique
        const { key, value } = event.data;
        switch (key) {
          case "concentration":
            this.concentration = Number(value);
            break;
          case "courroux":
            this.courroux = Number(value);
            break;
          case "puissance":
            this.puissance = Number(value);
            break;
          case "preparation":
            this.preparation = Number(value);
            break;
          case "egare":
            this.egare = Boolean(value);
            break;
        }
        this.updateUI();
      }
    });
  }

  private updateUI(): void {
    updateProgressBar(
      "concentration-fill",
      "concentration-value",
      this.concentration,
      100
    );
    updateStackIndicator("courroux-stacks", this.courroux, 4, "Courroux");
    updateStackIndicator("puissance-stacks", this.puissance, 50, "Puissance");

    const prepElement = document.getElementById("preparation-stacks");
    if (prepElement) {
      prepElement.textContent =
        this.preparation > 0 ? `Préparation: ${this.preparation}` : "";
    }

    updateBooleanIndicator(
      "egare-indicator",
      this.egare && this.inCombat,
      "Égaré actif"
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new IopBoostsTracker();
});
