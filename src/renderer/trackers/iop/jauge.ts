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

  private courrouxLottieContainer: HTMLElement | null = null;
  private courrouxLottieAnimation: any = null;

  private preparationLottieContainer: HTMLElement | null = null;
  private preparationLottieAnimation: any = null;

  // Mapping des coûts de sorts Iop (pour détection des sorts 4 PA)
  // Animation state for concentration fill (0..1)
  private currentFillNormalized: number = 0;
  private targetFillNormalized: number = 0;
  private fillAnimationFrame: number | null = null;
  private concentrationFillRect: SVGRectElement | null = null;

  private animateFillTo(target: number): void {
    this.targetFillNormalized = Math.max(0, Math.min(1, target));
    if (this.fillAnimationFrame !== null) {
      return; // already animating; the loop will pick up the new target
    }
    const step = () => {
      const diff = this.targetFillNormalized - this.currentFillNormalized;
      if (Math.abs(diff) < 0.002) {
        this.currentFillNormalized = this.targetFillNormalized;
      } else {
        // ease towards target
        this.currentFillNormalized += diff * 0.15;
      }
      if (!this.concentrationFillRect && this.svgElement) {
        this.concentrationFillRect = this.svgElement.querySelector(
          "#concentration-fill-rect"
        ) as SVGRectElement | null;
      }
      if (this.concentrationFillRect) {
        this.concentrationFillRect.setAttribute("x", "0");
        this.concentrationFillRect.setAttribute("y", "0");
        this.concentrationFillRect.setAttribute(
          "width",
          "1"
        );
        this.concentrationFillRect.setAttribute(
          "height",
          String(this.currentFillNormalized)
        );
      }
      if (this.currentFillNormalized !== this.targetFillNormalized) {
        this.fillAnimationFrame = requestAnimationFrame(step);
      } else {
        if (this.fillAnimationFrame !== null) {
          cancelAnimationFrame(this.fillAnimationFrame);
        }
        this.fillAnimationFrame = null;
      }
    };
    this.fillAnimationFrame = requestAnimationFrame(step);
  }
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
    this.courrouxLottieContainer = document.getElementById("courroux-lottie-container");
    this.preparationLottieContainer = document.getElementById("preparation-lottie-container");
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

      // Ajuster dynamiquement l'opacité selon la valeur exacte
      const concentrationPaths = this.concentrationLayer.querySelectorAll(
        ".concentration-path"
      ) as NodeListOf<SVGPathElement>;
      const normalizedConcentration = this.concentration / 100;
      
      concentrationPaths.forEach((path) => {
        // Ajuster l'opacité selon la valeur (0.4 à 1.0)
        path.style.opacity = String(0.4 + normalizedConcentration * 0.6);
      });
    }

    // Courroux
    if (this.courroux && this.courrouxLayer) {
      this.svgElement.classList.add("has-courroux");
      this.showLayer(this.courrouxLayer);
      this.courrouxLayer.classList.add("active");
      
      // Charger l'animation Lottie
      this.loadCourrouxLottie();
    } else {
      // Arrêter et cacher l'animation Lottie
      this.stopCourrouxLottie();
    }

    // Puissance - maintenant utilise l'effet de remplissage de concentration
    if (this.concentration > 0 && this.puissanceLayer) {
      this.svgElement.classList.add("has-puissance");
      this.showLayer(this.puissanceLayer);
      this.puissanceLayer.classList.add("active");

      // Calculer le pourcentage de remplissage basé sur la concentration (0-100%)
      const normalizedConcentration = Math.min(this.concentration / 100, 1);
      // Démarrer/mettre à jour l'animation de remplissage vers la cible
      this.animateFillTo(normalizedConcentration);

      // Ajuster l'opacité et la couleur selon la concentration
      const puissancePaths = this.puissanceLayer.querySelectorAll(
        ".puissance-path"
      ) as NodeListOf<SVGPathElement>;
      
      const effectiveConcentration = this.currentFillNormalized;
      puissancePaths.forEach((path) => {
        // Opacité basée sur la concentration (0.6 à 1.0)
        path.style.opacity = String(0.6 + effectiveConcentration * 0.4);

        const filters: string[] = [];

        // Lueur acier progressive (plus prononcée)
        if (effectiveConcentration > 0.7) {
          filters.push(
            `drop-shadow(0 0 2.5px rgba(140, 160, 180, 0.45))`,
            `drop-shadow(0 0 5px rgba(140, 160, 180, 0.35))`
          );
        } else if (effectiveConcentration > 0.4) {
          filters.push(`drop-shadow(0 0 2px rgba(140, 160, 180, 0.35))`);
        }

        // Relief (biseau) avec ombres superposées, croît avec la concentration
        const baseShadowAlpha = 0.15 + 0.25 * effectiveConcentration; // 0.15 -> 0.40
        const highlightAlpha = 0.05 + 0.15 * effectiveConcentration; // 0.05 -> 0.20
        filters.push(
          `drop-shadow(0 1px 1px rgba(0, 0, 0, ${baseShadowAlpha.toFixed(3)}))`,
          `drop-shadow(0 -1px 1px rgba(255, 255, 255, ${highlightAlpha.toFixed(3)}))`
        );

        // Éclat spéculaire à partir de 90%, plus marqué
        if (effectiveConcentration >= 0.9) {
          const t = (effectiveConcentration - 0.9) / 0.1; // 0..1
          const glowSize = 3 + 9 * t; // 3px -> 12px
          const glowAlpha = 0.15 + 0.35 * t; // 0.15 -> 0.50
          const streakAlpha = 0.10 + 0.25 * t; // 0.10 -> 0.35
          filters.push(
            `drop-shadow(0 0 ${glowSize.toFixed(1)}px rgba(255, 255, 255, ${glowAlpha.toFixed(3)}))`,
            // léger streak vers le haut pour simuler un reflet
            `drop-shadow(0 -2px ${(2 + 4 * t).toFixed(1)}px rgba(255, 255, 255, ${streakAlpha.toFixed(3)}))`
          );
        }

        path.style.filter = filters.join(" ") || "none";
      });
    } else if (this.puissanceLayer) {
      // Cacher le layer si pas de concentration
      this.hideLayer(this.puissanceLayer);
      this.puissanceLayer.classList.remove("active");
      // Stopper l'animation et réinitialiser
      this.targetFillNormalized = 0;
      this.currentFillNormalized = 0;
      if (this.concentrationFillRect) {
        this.concentrationFillRect.setAttribute("height", "0");
      }
    }

    // Préparation
    if (this.preparation && this.preparationLayer) {
      this.svgElement.classList.add("has-preparation");
      this.showLayer(this.preparationLayer);
      this.preparationLayer.classList.add("active");
      
      // Charger l'animation Lottie
      this.loadPreparationLottie();
    } else {
      // Arrêter et cacher l'animation Lottie
      this.stopPreparationLottie();
    }

    // Égaré
    if (this.egare && this.egareLayer) {
      this.svgElement.classList.add("has-egare");
      this.showLayer(this.egareLayer);
      this.egareLayer.classList.add("active");
    }
    
    // Mettre à jour la vitesse des animations Lottie selon l'état Égaré
    this.updateLottieSpeed();

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

  private async loadCourrouxLottie(): Promise<void> {
    if (!this.courrouxLottieContainer) {
      return;
    }

    // Attendre que lottie soit disponible (chargé depuis le CDN)
    let retries = 0;
    while (typeof (window as any).lottie === "undefined" && retries < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    // Vérifier que lottie est disponible
    if (typeof (window as any).lottie === "undefined") {
      console.error("Lottie n'est pas disponible après le chargement. Vérifiez que le script est chargé.");
      return;
    }

    // Si l'animation est déjà chargée, ne pas la recharger
    if (this.courrouxLottieAnimation) {
      this.courrouxLottieContainer.style.display = "block";
      this.courrouxLottieAnimation.play();
      // Mettre à jour la vitesse selon l'état Égaré
      this.updateLottieSpeed();
      return;
    }

    // Afficher le conteneur
    this.courrouxLottieContainer.style.display = "block";

    try {
      // Utiliser lottie chargé depuis le CDN
      const lottie = (window as any).lottie;
      
      // Charger le JSON via fetch avec un chemin relatif (comme pour les images)
      // Le tracker est dans dist/renderer/trackers/iop/, donc on remonte de 3 niveaux
      const response = await fetch("../../../assets/classes/iop/blue-fire.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const animationData = await response.json();
      
      // Charger l'animation Lottie avec les données JSON
      this.courrouxLottieAnimation = lottie.loadAnimation({
        container: this.courrouxLottieContainer,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: animationData
      });
      
      // Mettre à jour la vitesse selon l'état Égaré
      this.updateLottieSpeed();
    } catch (error) {
      console.error("Erreur lors du chargement de l'animation Lottie:", error);
    }
  }

  private stopCourrouxLottie(): void {
    if (this.courrouxLottieAnimation) {
      this.courrouxLottieAnimation.stop();
      this.courrouxLottieAnimation = null;
    }
    if (this.courrouxLottieContainer) {
      this.courrouxLottieContainer.style.display = "none";
      // Vider le conteneur
      this.courrouxLottieContainer.innerHTML = "";
    }
  }

  private async loadPreparationLottie(): Promise<void> {
    if (!this.preparationLottieContainer) {
      return;
    }

    // Attendre que lottie soit disponible (chargé depuis le CDN)
    let retries = 0;
    while (typeof (window as any).lottie === "undefined" && retries < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    // Vérifier que lottie est disponible
    if (typeof (window as any).lottie === "undefined") {
      console.error("Lottie n'est pas disponible après le chargement. Vérifiez que le script est chargé.");
      return;
    }

    // Si l'animation est déjà chargée, ne pas la recharger
    if (this.preparationLottieAnimation) {
      this.preparationLottieContainer.style.display = "block";
      this.preparationLottieAnimation.play();
      // Mettre à jour la vitesse selon l'état Égaré
      this.updateLottieSpeed();
      return;
    }

    // Afficher le conteneur
    this.preparationLottieContainer.style.display = "block";

    try {
      // Utiliser lottie chargé depuis le CDN
      const lottie = (window as any).lottie;
      
      // Charger le JSON via fetch avec un chemin relatif (comme pour les images)
      // Le tracker est dans dist/renderer/trackers/iop/, donc on remonte de 3 niveaux
      const response = await fetch("../../../assets/classes/iop/lightning-neon.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const animationData = await response.json();
      
      // Charger l'animation Lottie avec les données JSON
      this.preparationLottieAnimation = lottie.loadAnimation({
        container: this.preparationLottieContainer,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: animationData
      });
      
      // Mettre à jour la vitesse selon l'état Égaré
      this.updateLottieSpeed();
    } catch (error) {
      console.error("Erreur lors du chargement de l'animation Lottie de préparation:", error);
    }
  }

  private stopPreparationLottie(): void {
    if (this.preparationLottieAnimation) {
      this.preparationLottieAnimation.stop();
      this.preparationLottieAnimation = null;
    }
    if (this.preparationLottieContainer) {
      this.preparationLottieContainer.style.display = "none";
      // Vider le conteneur
      this.preparationLottieContainer.innerHTML = "";
    }
  }

  private updateLottieSpeed(): void {
    // Accélérer les animations quand Égaré est actif (vitesse x2)
    const speed = this.egare ? 2.0 : 1.0;
    
    if (this.courrouxLottieAnimation && this.courrouxLottieAnimation.setSpeed) {
      this.courrouxLottieAnimation.setSpeed(speed);
    }
    
    if (this.preparationLottieAnimation && this.preparationLottieAnimation.setSpeed) {
      this.preparationLottieAnimation.setSpeed(speed);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new IopJaugeTracker();
});

