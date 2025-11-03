/**
 * Iop Jauge Tracker - Suivi visuel des boosts Iop avec SVG
 * Réutilise toute la logique de boosts.ts mais avec un visuel basé sur le SVG
 */

import { setupTrackerEventListeners } from "../../core/ui-helpers.js";

class IopJaugeTracker {
  private concentration: number = 0;
  private courroux: boolean = false;
  private puissance: number = 0;
  private preparation: boolean = false;
  private egare: boolean = false;
  private activePosture: "contre" | "défense" | "vivacité" | null = null;

  private inCombat: boolean = false;
  private trackedPlayerName: string | null = null;
  private lastSpellCaster: string | null = null;

  private debugMode: boolean = false;

  private svgElement: SVGElement | null = null;
  private baseLayer: SVGGElement | null = null;
  private concentrationLayer: SVGGElement | null = null;
  private courrouxLayer: SVGGElement | null = null;
  private puissanceLayer: SVGGElement | null = null;
  private preparationLayer: SVGGElement | null = null;
  private egareLayer: SVGGElement | null = null;
  private postureContreLayer: SVGGElement | null = null;
  private postureDefenseLayer: SVGGElement | null = null;
  private postureVivaciteLayer: SVGGElement | null = null;

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
    this.debugMode = urlParams.get("debug") === "true";

    this.initializeSVG();
    this.setupEventListeners();
    if (this.debugMode) {
      this.setupDebugMode();
    }
    this.updateUI();
  }

  private initializeSVG(): void {
    this.svgElement = document.querySelector<SVGElement>("#iop-logo-svg");
    this.baseLayer = document.querySelector<SVGGElement>("#base-layer");
    this.concentrationLayer = document.querySelector<SVGGElement>(
      "#concentration-layer"
    );
    this.courrouxLayer = document.querySelector<SVGGElement>("#courroux-layer");
    this.puissanceLayer = document.querySelector<SVGGElement>("#puissance-layer");
    this.preparationLayer = document.querySelector<SVGGElement>(
      "#preparation-layer"
    );
    this.egareLayer = document.querySelector<SVGGElement>("#egare-layer");
    this.postureContreLayer = document.querySelector<SVGGElement>(
      "#posture-contre-layer"
    );
    this.postureDefenseLayer = document.querySelector<SVGGElement>(
      "#posture-défense-layer"
    );
    this.postureVivaciteLayer = document.querySelector<SVGGElement>(
      "#posture-vivacité-layer"
    );

    if (!this.svgElement) {
      console.error("[IOP JAUGE] SVG element not found");
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
        console.log(`[IOP JAUGE] Fin de tour détectée, désactivation de la posture`);
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

    // Handle Préparation loss - disparaît dès le lancement d'un sort infligeant des dégâts
    if (this.preparation && this.damageSpells.has(spellCast.spellName)) {
      console.log(`[IOP JAUGE] Sort infligeant des dégâts détecté: ${spellCast.spellName}, désactivation de la préparation`);
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

        // For posture: check if the tracked player receives damage
        if (
          this.trackedPlayerName &&
          targetName === this.trackedPlayerName.trim() &&
          this.activePosture !== null
        ) {
          console.log(`[IOP JAUGE] Dégâts reçus par ${targetName}, désactivation de la posture`);
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
    if (!this.svgElement) {
      return;
    }

    // Retirer toutes les classes d'état du SVG
    const allClasses = [
      "inactive",
      "has-concentration",
      "has-courroux",
      "has-puissance",
      "has-preparation",
      "has-egare",
    ];

    this.svgElement.classList.remove(...allClasses);

    // Masquer toutes les couches d'état
    this.hideLayer(this.concentrationLayer);
    this.hideLayer(this.courrouxLayer);
    this.hideLayer(this.puissanceLayer);
    this.hideLayer(this.preparationLayer);
    this.hideLayer(this.egareLayer);
    this.hideLayer(this.postureContreLayer);
    this.hideLayer(this.postureDefenseLayer);
    this.hideLayer(this.postureVivaciteLayer);

    // Retirer toutes les classes de niveau des couches
    this.removeLayerClasses(this.concentrationLayer, [
      "active",
      "concentration-low",
      "concentration-medium",
      "concentration-high",
    ]);
    this.removeLayerClasses(this.puissanceLayer, [
      "active",
      "puissance-low",
      "puissance-medium",
      "puissance-high",
    ]);

    // Si pas en combat, appliquer l'état inactif
    if (!this.inCombat) {
      this.svgElement.classList.add("inactive");
      return;
    }

    // Appliquer les effets selon les états

    // Concentration
    if (this.concentration > 0 && this.concentrationLayer) {
      this.svgElement.classList.add("has-concentration");
      this.showLayer(this.concentrationLayer);
      this.concentrationLayer.classList.add("active");

      // Ajouter la classe basée sur la valeur de concentration
      if (this.concentration <= 25) {
        this.concentrationLayer.classList.add("concentration-low");
      } else if (this.concentration <= 50) {
        this.concentrationLayer.classList.add("concentration-medium");
      } else {
        this.concentrationLayer.classList.add("concentration-high");
      }

      // Ajuster dynamiquement l'opacité et le fill selon la valeur exacte
      const concentrationPaths = this.concentrationLayer.querySelectorAll(
        ".concentration-path"
      ) as NodeListOf<SVGPathElement>;
      const normalizedConcentration = this.concentration / 100;
      
      concentrationPaths.forEach((path) => {
        // Ajuster l'opacité selon la valeur (0.4 à 1.0)
        path.style.opacity = String(0.4 + normalizedConcentration * 0.6);
        
        // Ajuster le fill pour des nuances selon la valeur
        if (this.concentration <= 25) {
          path.style.fill = "#64b5f6"; // Bleu clair
        } else if (this.concentration <= 50) {
          path.style.fill = "#2196f3"; // Bleu standard
        } else if (this.concentration <= 75) {
          path.style.fill = "#1976d2"; // Bleu foncé
        } else {
          path.style.fill = "#0d47a1"; // Bleu très foncé
        }
      });
    }

    // Courroux
    if (this.courroux && this.courrouxLayer) {
      this.svgElement.classList.add("has-courroux");
      this.showLayer(this.courrouxLayer);
      this.courrouxLayer.classList.add("active");
    }

    // Puissance
    if (this.puissance > 0 && this.puissanceLayer) {
      this.svgElement.classList.add("has-puissance");
      this.showLayer(this.puissanceLayer);
      this.puissanceLayer.classList.add("active");

      // Ajouter la classe basée sur la valeur de puissance
      if (this.puissance <= 10) {
        this.puissanceLayer.classList.add("puissance-low");
      } else if (this.puissance <= 25) {
        this.puissanceLayer.classList.add("puissance-medium");
      } else {
        this.puissanceLayer.classList.add("puissance-high");
      }

      // Ajuster dynamiquement l'opacité et le fill selon la valeur exacte
      const puissancePaths = this.puissanceLayer.querySelectorAll(
        ".puissance-path"
      ) as NodeListOf<SVGPathElement>;
      const normalizedPuissance = this.puissance / 50;
      
      puissancePaths.forEach((path) => {
        // Ajuster l'opacité selon la valeur (0.5 à 1.0)
        path.style.opacity = String(0.5 + normalizedPuissance * 0.5);
        
        // Ajuster le fill pour des nuances selon la valeur
        if (this.puissance <= 10) {
          path.style.fill = "#ffeb3b"; // Doré clair
        } else if (this.puissance <= 25) {
          path.style.fill = "#ffd700"; // Doré standard
        } else if (this.puissance <= 40) {
          path.style.fill = "#ffc107"; // Doré foncé
        } else {
          path.style.fill = "#ff8f00"; // Doré très intense
        }
      });
    }

    // Préparation
    if (this.preparation && this.preparationLayer) {
      this.svgElement.classList.add("has-preparation");
      this.showLayer(this.preparationLayer);
      this.preparationLayer.classList.add("active");
    }

    // Égaré
    if (this.egare && this.egareLayer) {
      this.svgElement.classList.add("has-egare");
      this.showLayer(this.egareLayer);
      this.egareLayer.classList.add("active");
    }

    // Posture
    if (this.activePosture) {
      if (this.activePosture === "contre" && this.postureContreLayer) {
        this.showLayer(this.postureContreLayer);
        this.postureContreLayer.classList.add("active");
      } else if (
        this.activePosture === "défense" &&
        this.postureDefenseLayer
      ) {
        this.showLayer(this.postureDefenseLayer);
        this.postureDefenseLayer.classList.add("active");
      } else if (
        this.activePosture === "vivacité" &&
        this.postureVivaciteLayer
      ) {
        this.showLayer(this.postureVivaciteLayer);
        this.postureVivaciteLayer.classList.add("active");
      }
    }
  }

  private showLayer(layer: SVGGElement | null): void {
    if (layer) {
      layer.style.display = "block";
    }
  }

  private hideLayer(layer: SVGGElement | null): void {
    if (layer) {
      layer.style.display = "none";
    }
  }

  private removeLayerClasses(
    layer: SVGGElement | null,
    classes: string[]
  ): void {
    if (layer) {
      layer.classList.remove(...classes);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new IopJaugeTracker();
});

