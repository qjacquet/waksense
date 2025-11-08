/**
 * Iop Boosts Tracker - Suivi des boosts Iop en temps réel
 * Concentration, Courroux, Puissance, Préparation, Égaré
 */

import {
  setupTrackerEventListeners,
  updateProgressBar,
  updateStackIndicator,
} from "../../core/ui-helpers.js";
import { PATTERNS } from "../../../shared/constants/patterns.js";

class IopBoostsTracker {
  private concentration: number = 0;
  private courroux: boolean = false;
  private puissance: number = 0;
  private preparation: boolean = false;
  private egare: boolean = false;
  private activePosture: "contre" | "défense" | "vivacité" | null = null;

  private inCombat: boolean = false;
  private trackedPlayerName: string | null = null;
  private lastSpellCaster: string | null = null; // Dernier joueur qui a lancé un sort (pour détecter le début de tour)
  private lastSpellCost: string | null = null; // Coût du dernier sort lancé par le joueur tracké

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

  // Liste des sorts qui infligent des dégâts (pour la préparation)
  private readonly damageSpells: Set<string> = new Set([
    "Épée céleste",
    "Fulgur",
    "Super Iop Punch",
    "Jugement",
    "Colère de Iop",
    "Ébranler",
    "Roknocerok",
    "Fendoir",
    "Ravage",
    "Jabs",
    "Rafale",
    "Torgnole",
    "Tannée",
    "Épée de Iop",
    "Uppercut",
    "Charge",
    "Éventrail",
  ]);

  constructor() {
    // Détecter le mode debug
    const urlParams = new URLSearchParams(window.location.search);
    this.debugMode = urlParams.get(PATTERNS.DEBUG_URL_PARAM) === "true";

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
    this.activePosture = null;
    this.lastSpellCaster = null;
    this.lastSpellCost = null;
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

    // Parse Postures (must be before spell casts)
    this.parsePosture(line);

    // Parse spell consumption (after resource parsing to avoid resetting before gain)
    if (parsed.isSpellCast && parsed.spellCast) {
      this.handleSpellCast(parsed.spellCast, line);
    }

    // Parse damage received (for posture deactivation)
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

      // Désactiver la posture à la fin du tour
      // Si une posture est active, c'est forcément celle du joueur tracké qui vient de finir son tour
      if (this.activePosture !== null) {
        console.log(`[IOP BOOSTS] Fin de tour détectée, désactivation de la posture`);
        this.activePosture = null;
        this.updateUI();
      }
    }
  }

  private parsePosture(line: string): void {
    // Only process combat lines
    if (!line.includes("[Information (combat)]")) {
      return;
    }

    // Détection de la perte de posture - "n'est plus sous l'emprise de 'Posture de contre/défense/vivacité'"
    // (pour détecter les cas où la posture se termine avant le début du tour suivant)
    if (
      line.includes("n'est plus sous l'emprise de 'Posture de contre'") ||
      line.includes("n'est plus sous l'emprise de 'Posture de défense'") ||
      line.includes("n'est plus sous l'emprise de 'Posture de vivacité'")
    ) {
      const playerMatch = line.match(/\[Information \(combat\)\] ([^:]+):/);
      if (
        playerMatch &&
        this.trackedPlayerName &&
        playerMatch[1].trim() === this.trackedPlayerName.trim()
      ) {
        this.activePosture = null;
        this.updateUI();
      }
      return;
    }

    // Pattern: [Information (combat)] PlayerName: Posture de contre/défense/vivacité
    const postureMatch = line.match(
      /\[Information \(combat\)\] ([^:]+):\s+(Posture de contre|Posture de défense|Posture de vivacité)/
    );
    if (postureMatch) {
      const playerName = postureMatch[1].trim();
      const postureName = postureMatch[2].trim();

      // Si le joueur n'est pas encore tracké, le définir maintenant
      if (!this.trackedPlayerName) {
        this.trackedPlayerName = playerName;
      }

      // Vérifier que c'est le joueur tracké
      if (playerName === this.trackedPlayerName.trim()) {
        if (postureName === "Posture de contre") {
          this.activePosture = "contre";
        } else if (postureName === "Posture de défense") {
          this.activePosture = "défense";
        } else if (postureName === "Posture de vivacité") {
          this.activePosture = "vivacité";
        }
        this.updateUI();
      }
    }
  }

  private handleSpellCast(
    spellCast: { playerName: string; spellName: string },
    line: string
  ): void {
    // Mémoriser le dernier joueur qui a lancé un sort
    this.lastSpellCaster = spellCast.playerName;

    if (spellCast.playerName !== this.trackedPlayerName) {
      // Si un autre joueur lance un sort, réinitialiser lastSpellCost pour éviter les faux positifs
      this.lastSpellCost = null;
      return;
    }

    // Mémoriser le coût du dernier sort lancé par le joueur tracké
    const spellCost = this.spellCostMap.get(spellCast.spellName);
    this.lastSpellCost = spellCost || null;
    
    if (spellCost === "4PA" && this.courroux) {
      console.log(`[IOP BOOSTS] Sort de 4 PA détecté: ${spellCast.spellName}, en attente de dégâts pour désactiver le courroux`);
    }

    // Initialize puissance on first spell cast in combat
    if (!this.inCombat) {
      this.inCombat = true;
      this.puissance = 30;
      this.updateUI();
    }

    // Note: Le courroux n'est plus géré ici, il sera désactivé dans parseDamage
    // quand des dégâts seront réellement infligés

    // Handle Préparation loss - disparaît dès le lancement d'un sort infligeant des dégâts
    if (this.preparation && this.damageSpells.has(spellCast.spellName)) {
      console.log(`[IOP BOOSTS] Sort infligeant des dégâts détecté: ${spellCast.spellName}, désactivation de la préparation`);
      this.preparation = false;
      this.updateUI();
    }

    // Handle Égaré gain spells
    if (["Fulgur", "Colère de Iop"].includes(spellCast.spellName)) {
      this.egare = true;
      this.updateUI();
    }

  }

  private parseDamage(line: string): void {
    // Only process combat lines
    if (!line.includes("[Information (combat)]")) {
      return;
    }

    // Pattern pour les dégâts : [Information (combat)] TargetName: -XX PV (element)
    // Note: Le nom dans le pattern est celui qui reçoit les dégâts (la cible)
    if (line.includes("PV") && line.includes("-")) {
      const damageMatch = line.match(
        /\[Information \(combat\)\] ([^:]+):\s+-(\d+)\s*PV/
      );
      
      if (damageMatch) {
        const targetName = damageMatch[1].trim();
        
        // For courroux: check if damage is dealt by tracked player (not received)
        // Si le courroux est actif et que le dernier sort était un sort de 4 PA par le joueur tracké
        // ET que la ligne contient "(Courroux)" entre parenthèses
        if (
          this.courroux &&
          this.lastSpellCaster === this.trackedPlayerName &&
          this.lastSpellCost === "4PA" &&
          line.includes("(Courroux)") &&
          this.trackedPlayerName &&
          targetName !== this.trackedPlayerName.trim()
        ) {
          console.log(`[IOP BOOSTS] Dégâts infligés détectés avec Courroux (${targetName} reçoit des dégâts), désactivation du courroux`);
          this.courroux = false;
          this.updateUI();
        }
        
        // For posture: check if the tracked player receives damage
        if (
          this.trackedPlayerName &&
          targetName === this.trackedPlayerName.trim() &&
          this.activePosture !== null
        ) {
          console.log(`[IOP BOOSTS] Dégâts reçus par ${targetName}, désactivation de la posture`);
          this.activePosture = null;
          this.updateUI();
        }
      }
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
        if (values.activePosture !== undefined) {
          this.activePosture =
            values.activePosture === "" || values.activePosture === null
              ? null
              : values.activePosture;
        }
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
          case "activePosture":
            this.activePosture =
              value === "" || value === null ? null : value;
            this.updateUI();
            break;
        }
      }
    });
  }

  private updateUI(): void {
    if (!this.debugMode) {
      return;
    }
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

    const postureIndicator = document.getElementById("posture-indicator");
    if (postureIndicator) {
      if (this.activePosture && this.inCombat) {
        postureIndicator.style.display = "flex";
        postureIndicator.className = `egare-indicator posture-${this.activePosture}`;
        const postureText = document.getElementById("posture-text");
        if (postureText) {
          if (this.activePosture === "contre") {
            postureText.textContent = "Posture de contre";
          } else if (this.activePosture === "défense") {
            postureText.textContent = "Posture de défense";
          } else if (this.activePosture === "vivacité") {
            postureText.textContent = "Posture de vivacité";
          }
        }
      } else {
        postureIndicator.style.display = "none";
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new IopBoostsTracker();
});
