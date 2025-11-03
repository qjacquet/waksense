/**
 * Iop Boosts Tracker - Suivi des boosts Iop en temps réel
 * Concentration, Courroux, Puissance, Préparation, Égaré
 */

import {
  setupTrackerEventListeners,
  updateProgressBar,
  updateStackIndicator,
} from "../../core/ui-helpers.js";

class IopBoostsTracker {
  private concentration: number = 0;
  private courroux: boolean = false;
  private puissance: number = 0;
  private preparation: boolean = false;
  private egare: boolean = false;

  private inCombat: boolean = false;
  private trackedPlayerName: string | null = null;

  private debugMode: boolean = false;

  // Mapping des coûts de sorts Iop (pour détection des sorts 4 PA)
  private readonly spellCostMap: Map<string, string> = new Map([
    ["Épée céleste", "2PA"],
    ["Fulgur", "3PA"],
    ["Super Iop Punch", "4PA"],
    ["Jugement", "1PA"],
    ["Colère de Iop", "6PA"],
    ["Ébranler", "2PA"],
    ["Roknocerok", "4PA"],
    ["Fendoir", "3PA"],
    ["Ravage", "5PA"],
    ["Jabs", "3PA"],
    ["Rafale", "1PA"],
    ["Torgnole", "2PA"],
    ["Tannée", "4PA"],
    ["Épée de Iop", "3PA"],
    ["Bond", "4PA"],
    ["Focus", "2PA"],
    ["Éventrail", "1PM"],
    ["Uppercut", "1PW"],
    ["Amplification", "2PM"],
    ["Duel", "1PA"],
    ["Étendard de bravoure", "3PA"],
    ["Vertu", "2PA"],
    ["Charge", "1PA"],
  ]);

  constructor() {
    // Détecter le mode debug
    const urlParams = new URLSearchParams(window.location.search);
    this.debugMode = urlParams.get("debug") === "true";

    this.loadIcons();
    this.setupEventListeners();
    if (this.debugMode) {
      this.setupDebugMode();
    }
    this.updateUI();
  }

  private loadIcons(): void {
    // Utiliser les assets globaux depuis dist/assets/
    // Chemin relatif depuis dist/renderer/trackers/iop/ vers dist/assets/classes/iop/
    const concentrationIcon = document.getElementById("concentration-icon");
    const courrouxIcon = document.getElementById("courroux-icon");
    const preparationIcon = document.getElementById("preparation-icon");
    const egareIcon = document.getElementById("egare-icon");

    if (concentrationIcon) {
      (concentrationIcon as HTMLImageElement).src =
        "../../../assets/classes/iop/concentration.png";
    }
    if (courrouxIcon) {
      (courrouxIcon as HTMLImageElement).src =
        "../../../assets/classes/iop/Couroux.png";
    }
    if (preparationIcon) {
      (preparationIcon as HTMLImageElement).src =
        "../../../assets/classes/iop/preparation.png";
    }
    if (egareIcon) {
      (egareIcon as HTMLImageElement).src =
        "../../../assets/classes/iop/égaré.png";
    }
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
    this.courroux = false;
    this.puissance = 0;
    this.preparation = false;
    this.egare = false;
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

    // Parse Courroux gains - "Courroux (+X Niv.) (Compulsion)" OR "Courroux (+X Niv.) (Concentration)"
    // Courroux est toujours actif quand il est acquis, on l'active simplement
    const courrouxGainMatch = line.match(
      /Courroux \(\+(\d+) Niv\.\) \((Compulsion|Concentration)\)/
    );
    if (courrouxGainMatch) {
      this.courroux = true;
      this.updateUI();
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
      // Préparation est toujours 40, on l'active simplement
      this.preparation = true;
      this.updateUI();
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

    // Handle Courroux loss - disparaît dès le premier sort coûtant 4 PA
    if (this.courroux) {
      const spellCost = this.spellCostMap.get(spellCast.spellName);
      if (spellCost === "4PA") {
        this.courroux = false;
        this.updateUI();
      }
    }

    // Handle Préparation loss - disparaît dès le premier sort
    if (this.preparation) {
      this.preparation = false;
      this.updateUI();
    }

    // Handle Égaré gain spells
    if (["Fulgur", "Colère de Iop"].includes(spellCast.spellName)) {
      this.egare = true;
      this.updateUI();
    }
  }

  private setupDebugMode(): void {
    // En mode debug, on force inCombat à true pour que les indicateurs s'affichent
    this.inCombat = true;

    window.addEventListener("message", (event) => {
      if (event.data.type === "debug-init") {
        // Initialiser avec toutes les valeurs
        const values = event.data.values;
        if (values.concentration !== undefined)
          this.concentration = Number(values.concentration);
        if (values.courroux !== undefined)
          this.courroux = Boolean(values.courroux);
        if (values.puissance !== undefined)
          this.puissance = Number(values.puissance);
        if (values.preparation !== undefined)
          this.preparation = Boolean(values.preparation);
        if (values.egare !== undefined) this.egare = Boolean(values.egare);
        this.updateUI();
      } else if (event.data.type === "debug-update") {
        // Mettre à jour une valeur spécifique
        const { key, value } = event.data;
        switch (key) {
          case "concentration":
            this.concentration = Number(value);
            this.updateUI();
            break;
          case "courroux":
            this.courroux = Boolean(value);
            this.updateUI();
            break;
          case "puissance":
            this.puissance = Number(value);
            this.updateUI();
            break;
          case "preparation":
            this.preparation = Boolean(value);
            this.updateUI();
            break;
          case "egare":
            this.egare = Boolean(value);
            this.updateUI();
            break;
        }
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
    updateStackIndicator("puissance-stacks", this.puissance, 50, "Puissance");

    const courrouxIndicator = document.getElementById("courroux-indicator");
    if (courrouxIndicator) {
      if (this.courroux && this.inCombat) {
        courrouxIndicator.style.display = "flex";
      } else {
        courrouxIndicator.style.display = "none";
      }
    }

    const preparationIndicator = document.getElementById("preparation-indicator");
    if (preparationIndicator) {
      if (this.preparation && this.inCombat) {
        preparationIndicator.style.display = "flex";
      } else {
        preparationIndicator.style.display = "none";
      }
    }

    const egareIndicator = document.getElementById("egare-indicator");
    if (egareIndicator) {
      if (this.egare && this.inCombat) {
        egareIndicator.style.display = "flex";
      } else {
        egareIndicator.style.display = "none";
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new IopBoostsTracker();
});
