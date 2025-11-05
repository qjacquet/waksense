/**
 * Cra Jauge Tracker - Suivi visuel des ressources Cra avec SVG
 * Réutilise toute la logique de tracker.ts mais avec un visuel basé sur le SVG
 */

import { setupTrackerEventListeners } from "../../core/ui-helpers.js";

class CraJaugeTracker {
  private affutage: number = 0;
  private precision: number = 0;
  private pointeAffuteeStacks: number = 0;
  private baliseAffuteeStacks: number = 0;
  private tirPrecisActive: boolean = false;
  private hasEspritAffute: boolean = false;
  private precisionMax: number = 300;
  private recentPrecisionGains: number[] = [];
  private maxRecentGains: number = 5;

  private debugMode: boolean = false;

  private svgElement: SVGElement | null = null;
  private arcBaseLayer: SVGGElement | null = null;
  private cibleBaseLayer: SVGGElement | null = null;
  private affutageLayer: SVGGElement | null = null;
  private precisionLayer: SVGGElement | null = null;

  private tirPrecisLottieContainer: HTMLElement | null = null;
  private tirPrecisLottieAnimation: any = null;
  private tirPrecisAnimationDirection: number = 1; // 1 = forward, -1 = backward
  private tirPrecisRollbackHandler: (() => void) | null = null;

  // Animation state for affutage fill (0..1)
  private currentAffutageFillNormalized: number = 0;
  private targetAffutageFillNormalized: number = 0;
  private affutageFillAnimationFrame: number | null = null;
  private affutageFillRect: SVGRectElement | null = null;

  // Animation state for precision fill (0..1)
  private currentPrecisionFillNormalized: number = 0;
  private targetPrecisionFillNormalized: number = 0;
  private precisionFillAnimationFrame: number | null = null;
  private precisionFillRect: SVGRectElement | null = null;

  private animateAffutageFillTo(target: number): void {
    this.targetAffutageFillNormalized = Math.max(0, Math.min(1, target));
    if (this.affutageFillAnimationFrame !== null) {
      return; // already animating; the loop will pick up the new target
    }
    const step = () => {
      const diff = this.targetAffutageFillNormalized - this.currentAffutageFillNormalized;
      if (Math.abs(diff) < 0.002) {
        this.currentAffutageFillNormalized = this.targetAffutageFillNormalized;
      } else {
        // ease towards target
        this.currentAffutageFillNormalized += diff * 0.15;
      }
      if (!this.affutageFillRect && this.svgElement) {
        this.affutageFillRect = this.svgElement.querySelector(
          "#affutage-fill-rect"
        ) as SVGRectElement | null;
      }
      if (this.affutageFillRect) {
        this.affutageFillRect.setAttribute("x", "0");
        this.affutageFillRect.setAttribute("y", "0");
        this.affutageFillRect.setAttribute("width", "1");
        this.affutageFillRect.setAttribute(
          "height",
          String(this.currentAffutageFillNormalized)
        );
      }
      if (this.currentAffutageFillNormalized !== this.targetAffutageFillNormalized) {
        this.affutageFillAnimationFrame = requestAnimationFrame(step);
      } else {
        if (this.affutageFillAnimationFrame !== null) {
          cancelAnimationFrame(this.affutageFillAnimationFrame);
        }
        this.affutageFillAnimationFrame = null;
      }
    };
    this.affutageFillAnimationFrame = requestAnimationFrame(step);
  }

  private animatePrecisionFillTo(target: number): void {
    this.targetPrecisionFillNormalized = Math.max(0, Math.min(1, target));
    if (this.precisionFillAnimationFrame !== null) {
      return; // already animating; the loop will pick up the new target
    }
    const step = () => {
      const diff = this.targetPrecisionFillNormalized - this.currentPrecisionFillNormalized;
      if (Math.abs(diff) < 0.002) {
        this.currentPrecisionFillNormalized = this.targetPrecisionFillNormalized;
      } else {
        // ease towards target
        this.currentPrecisionFillNormalized += diff * 0.15;
      }
      if (!this.precisionFillRect && this.svgElement) {
        this.precisionFillRect = this.svgElement.querySelector(
          "#precision-fill-rect"
        ) as SVGRectElement | null;
      }
      if (this.precisionFillRect) {
        this.precisionFillRect.setAttribute("x", "0");
        this.precisionFillRect.setAttribute("y", "0");
        this.precisionFillRect.setAttribute("width", "1");
        this.precisionFillRect.setAttribute(
          "height",
          String(this.currentPrecisionFillNormalized)
        );
      }
      if (this.currentPrecisionFillNormalized !== this.targetPrecisionFillNormalized) {
        this.precisionFillAnimationFrame = requestAnimationFrame(step);
      } else {
        if (this.precisionFillAnimationFrame !== null) {
          cancelAnimationFrame(this.precisionFillAnimationFrame);
        }
        this.precisionFillAnimationFrame = null;
      }
    };
    this.precisionFillAnimationFrame = requestAnimationFrame(step);
  }

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
    this.svgElement = document.querySelector<SVGElement>("#cra-logo-svg");
    this.arcBaseLayer = document.querySelector<SVGGElement>("#arc-base-layer");
    this.cibleBaseLayer = document.querySelector<SVGGElement>("#cible-base-layer");
    this.affutageLayer = document.querySelector<SVGGElement>("#affutage-layer");
    this.precisionLayer = document.querySelector<SVGGElement>("#precision-layer");
    this.tirPrecisLottieContainer = document.getElementById("tir-precis-lottie-container");

    if (!this.svgElement) {
      console.error("[CRA JAUGE] SVG element not found");
    }
  }

  private setupEventListeners(): void {
    setupTrackerEventListeners(
      (line: string, parsed: any) => this.processLogLine(line, parsed),
      () => this.resetResources()
    );
  }

  private resetResources(): void {
    this.affutage = 0;
    this.precision = 0;
    this.pointeAffuteeStacks = 0;
    this.baliseAffuteeStacks = 0;
    this.tirPrecisActive = false;
    this.precisionMax = 300;
    this.hasEspritAffute = false;
    this.recentPrecisionGains = [];
    this.updateUI();
  }

  private processLogLine(line: string, parsed: any): void {
    // Parse Affûtage (peut être dans ou hors combat)
    this.parseAffutage(line);

    // Parse Précision (peut être dans ou hors combat)
    this.parsePrecision(line);

    // Les autres parsers nécessitent des lignes de combat
    if (!line.includes("[Information (combat)]")) {
      return;
    }

    // Parse Pointe affûtée consumption
    this.parsePointeAffutee(line);

    // Parse Balise affûtée consumption
    this.parseBaliseAffutee(line);

    // Parse Tir précis buff
    this.parseTirPrecis(line);

    // Parse Précision buff removal
    this.parsePrecisionBuffRemoval(line);

    // Parse spell consumption with Tir précis active
    this.parseSpellConsumption(line, parsed);
  }

  private parseAffutage(line: string): void {
    // Format: "Affûtage (+X Niv.)"
    const match = line.match(/Affûtage\s*\(\+(\d+)\s*Niv\.\)/i);
    if (match) {
      const newAffutage = parseInt(match[1], 10);

      // Handle Affûtage reaching 100+ - gain stacks and carry over excess
      if (newAffutage >= 100) {
        const stacksGained = Math.floor(newAffutage / 100);

        // Gain Pointe affûtée stacks (max 3)
        if (this.pointeAffuteeStacks < 3) {
          const stacksToAdd = Math.min(
            stacksGained,
            3 - this.pointeAffuteeStacks
          );
          this.pointeAffuteeStacks += stacksToAdd;
        }

        // Gain Balise affûtée stacks (max 3)
        if (this.baliseAffuteeStacks < 3) {
          const stacksToAdd = Math.min(
            stacksGained,
            3 - this.baliseAffuteeStacks
          );
          this.baliseAffuteeStacks += stacksToAdd;
        }

        // Keep remainder (ex: 150 → 1 stack, 50 remaining)
        this.affutage = newAffutage % 100;
      } else {
        this.affutage = newAffutage;
      }

      this.updateUI();
    }
  }

  private parsePrecision(line: string): void {
    // Format: "Précision (+X Niv.)"
    const precisionMatch = line.match(/Précision\s*\(\+(\d+)\s*Niv\.\)/i);
    if (precisionMatch) {
      const newPrecision = parseInt(precisionMatch[1], 10);
      this.precision = newPrecision;

      // Check for "Esprit affûté" talent (limits precision to 200)
      if (
        line.includes("Valeur maximale de Précision atteinte !") &&
        this.precision > 200
      ) {
        // Check if this was after a +300 gain (normal case - don't cap)
        if (!this.wasRecent300Gain()) {
          this.precision = 200;
          this.precisionMax = 200;
          this.hasEspritAffute = true;
        }
      } else {
        // If precision exceeds max, cap it
        if (this.precision > this.precisionMax) {
          this.precision = this.precisionMax;
        }
      }

      this.updateUI();
    }

    // Track precision gains for talent detection
    const gainMatch = line.match(/Précision.*?(\+?\d+)/i);
    if (gainMatch && line.includes("+")) {
      try {
        const precisionGain = parseInt(gainMatch[1], 10);
        this.storePrecisionGain(precisionGain);

        // If gained > 200 without cap message, talent might be removed
        if (
          precisionGain > 200 &&
          !line.includes("Valeur maximale de Précision atteinte !")
        ) {
          if (this.hasEspritAffute) {
            this.hasEspritAffute = false;
            this.precisionMax = 300;
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  private parsePointeAffutee(line: string): void {
    if (line.includes("Consomme Pointe affûtée")) {
      if (this.pointeAffuteeStacks > 0) {
        this.pointeAffuteeStacks--;
        this.updateUI();
      }
    }
  }

  private parseBaliseAffutee(line: string): void {
    // Balise affûtée is consumed when specific spells are cast
    if (line.includes("lance le sort")) {
      if (
        line.includes("Balise de destruction") ||
        line.includes("Balise d'alignement") ||
        line.includes("Balise de contact")
      ) {
        if (this.baliseAffuteeStacks > 0) {
          this.baliseAffuteeStacks--;
          this.updateUI();
        }
      }
    }
  }

  private parseTirPrecis(line: string): void {
    // Parse Tir précis buff activation
    if (line.includes("Tir précis (Niv.")) {
      this.tirPrecisActive = true;
      this.updateUI();
    }
    // Parse Tir précis buff removal
    else if (line.includes("n'est plus sous l'emprise de 'Tir précis'")) {
      this.tirPrecisActive = false;
      this.updateUI();
    }
  }

  private parsePrecisionBuffRemoval(line: string): void {
    // Parse Précision buff removal - reset precision to 0
    if (line.includes("n'est plus sous l'emprise de 'Précision'")) {
      this.precision = 0;
      // Reset bar maximum back to 300 for normal operation
      this.precisionMax = 300;
      this.hasEspritAffute = false;
      this.updateUI();
    }
  }

  private parseSpellConsumption(line: string, parsed: any): void {
    // Parse spell consumption with Tir précis active
    if (this.tirPrecisActive && parsed.isSpellCast && parsed.spellCast) {
      const spellName = parsed.spellCast.spellName;
      let spellConsumption = 0;

      // Spell consumption values
      const consumptionMap: { [key: string]: number } = {
        "Flèche criblante": 60,
        "Flèche fulminante": 45,
        "Flèche d'immolation": 30,
        "Flèche enflammée": 60,
        "Flèche ardente": 30,
        "Flèche Ardente": 30,
        "Pluie de flèches": 60,
        "Pluie de fleches": 60,
        "Flèche explosive": 90,
        "Flèche cinglante": 45,
        "Flèche perçante": 75,
        "Flèche destructrice": 105,
        "Flèche chercheuse": 30,
        "Flèche de recul": 60,
        "Flèche tempête": 45,
        "Flèche harcelante": 45,
        "Flèche statique": 90,
      };

      for (const [spell, cost] of Object.entries(consumptionMap)) {
        if (spellName.includes(spell)) {
          spellConsumption = cost;
          break;
        }
      }

      if (spellConsumption > 0) {
        this.precision = Math.max(this.precision - spellConsumption, 0);
        this.updateUI();
      }
    }
  }

  private storePrecisionGain(gainValue: number): void {
    this.recentPrecisionGains.push(gainValue);
    // Keep only the last N gains
    if (this.recentPrecisionGains.length > this.maxRecentGains) {
      this.recentPrecisionGains.shift();
    }
  }

  private wasRecent300Gain(): boolean {
    if (this.recentPrecisionGains.length === 0) {
      return false;
    }
    return (
      this.recentPrecisionGains[this.recentPrecisionGains.length - 1] === 300
    );
  }

  private setupDebugMode(): void {
    window.addEventListener("message", (event) => {
      if (event.data.type === "debug-init") {
        // Initialiser avec toutes les valeurs
        const values = event.data.values;
        if (values.affutage !== undefined)
          this.affutage = Number(values.affutage);
        if (values.precision !== undefined)
          this.precision = Number(values.precision);
        if (values.precisionMax !== undefined)
          this.precisionMax = Number(values.precisionMax);
        if (values.tirPrecisActive !== undefined) {
          this.tirPrecisActive = Boolean(values.tirPrecisActive);
        }
        this.updateUI();
      } else if (event.data.type === "debug-update") {
        // Mettre à jour une valeur spécifique
        const { key, value } = event.data;
        switch (key) {
          case "affutage":
            this.affutage = Number(value);
            break;
          case "precision":
            this.precision = Number(value);
            break;
          case "precisionMax":
            this.precisionMax = Number(value);
            break;
          case "tirPrecisActive":
            this.tirPrecisActive = Boolean(value);
            break;
        }
        this.updateUI();
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
      "has-affutage",
      "has-precision",
      "has-tir-precis",
    ];

    this.svgElement.classList.remove(...allClasses);

    // Masquer toutes les couches d'état
    this.hideLayer(this.affutageLayer);
    this.hideLayer(this.precisionLayer);

    // Retirer toutes les classes actives des couches
    this.removeLayerClasses(this.affutageLayer, ["active"]);
    this.removeLayerClasses(this.precisionLayer, ["active"]);

    // Affûtage (Arc)
    if (this.affutage > 0 && this.affutageLayer) {
      this.svgElement.classList.add("has-affutage");
      this.showLayer(this.affutageLayer);
      this.affutageLayer.classList.add("active");
      const normalizedAffutage = Math.min(this.affutage / 100, 1);
      this.animateAffutageFillTo(normalizedAffutage);
    } else if (this.affutageLayer) {
      this.hideLayer(this.affutageLayer);
      this.affutageLayer.classList.remove("active");
      // Stopper l'animation et réinitialiser
      this.targetAffutageFillNormalized = 0;
      this.currentAffutageFillNormalized = 0;
      if (this.affutageFillRect) {
        this.affutageFillRect.setAttribute("y", "0");
        this.affutageFillRect.setAttribute("height", "0");
      }
    }

    // Précision (Cible)
    if (this.precision > 0 && this.precisionLayer) {
      this.svgElement.classList.add("has-precision");
      this.showLayer(this.precisionLayer);
      this.precisionLayer.classList.add("active");
      const normalizedPrecision = Math.min(this.precision / this.precisionMax, 1);
      this.animatePrecisionFillTo(normalizedPrecision);
    } else if (this.precisionLayer) {
      this.hideLayer(this.precisionLayer);
      this.precisionLayer.classList.remove("active");
      // Stopper l'animation et réinitialiser
      this.targetPrecisionFillNormalized = 0;
      this.currentPrecisionFillNormalized = 0;
      if (this.precisionFillRect) {
        this.precisionFillRect.setAttribute("y", "0");
        this.precisionFillRect.setAttribute("height", "0");
      }
    }

    // Tir précis
    if (this.tirPrecisActive) {
      this.svgElement.classList.add("has-tir-precis");
      // Charger l'animation Lottie
      this.loadTirPrecisLottie();
    } else {
      // Arrêter et cacher l'animation Lottie
      this.stopTirPrecisLottie();
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

  private async loadTirPrecisLottie(): Promise<void> {
    if (!this.tirPrecisLottieContainer) {
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
    if (this.tirPrecisLottieAnimation) {
      this.tirPrecisLottieContainer.style.display = "block";
      
      // Vérifier si l'animation est déjà à l'état actif (50%)
      const totalFrames = this.tirPrecisLottieAnimation.totalFrames;
      const halfFrame = Math.floor(totalFrames * 0.5);
      const currentFrame = this.tirPrecisLottieAnimation.currentFrame;
      
      // Si l'animation est déjà à 50% ou proche, ne pas la relancer
      if (Math.abs(currentFrame - halfFrame) <= 2) {
        // L'animation est déjà à l'état actif, ne rien faire
        return;
      }
      
      // Retirer tous les handlers existants
      if (this.tirPrecisRollbackHandler) {
        this.tirPrecisLottieAnimation.removeEventListener('enterFrame', this.tirPrecisRollbackHandler);
        this.tirPrecisRollbackHandler = null;
      }
      
      // Réinitialiser à 0% et jouer jusqu'à 50%
      this.tirPrecisLottieAnimation.goToAndStop(0, true);
      this.tirPrecisLottieAnimation.setSpeed(1.5);
      
      // Créer le handler pour arrêter à 50%
      const forwardCompleteHandler = () => {
        if (!this.tirPrecisLottieAnimation) return;
        
        const currentFrame = this.tirPrecisLottieAnimation.currentFrame;
        if (currentFrame >= halfFrame) {
          // Retirer le listener AVANT de modifier l'animation pour éviter la boucle infinie
          this.tirPrecisLottieAnimation.removeEventListener('enterFrame', forwardCompleteHandler);
          this.tirPrecisRollbackHandler = null;
          
          // Arrêter l'animation en mettant la vitesse à 0, puis aller à 50%
          this.tirPrecisLottieAnimation.setSpeed(0);
          // Utiliser setTimeout pour éviter que goToAndStop déclenche enterFrame
          setTimeout(() => {
            if (this.tirPrecisLottieAnimation) {
              this.tirPrecisLottieAnimation.stop();
              this.tirPrecisLottieAnimation.goToAndStop(halfFrame, true);
            }
          }, 0);
        }
      };
      
      this.tirPrecisRollbackHandler = forwardCompleteHandler;
      this.tirPrecisLottieAnimation.addEventListener('enterFrame', forwardCompleteHandler);
      this.tirPrecisLottieAnimation.play();
      
      // Ajouter la classe CSS au cercle interne
      this.addCrosshairInnerCircleClass();
      return;
    }

    // Afficher le conteneur
    this.tirPrecisLottieContainer.style.display = "block";

    try {
      // Utiliser lottie chargé depuis le CDN
      const lottie = (window as any).lottie;
      
      console.log("[CRA JAUGE] Chargement du fichier crosshair.json");
      const response = await fetch("../../../assets/classes/cra/crosshair.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const animationData = await response.json();
      console.log("[CRA JAUGE] Données JSON chargées:", animationData);
      
      this.tirPrecisLottieAnimation = lottie.loadAnimation({
        container: this.tirPrecisLottieContainer,
        renderer: "svg",
        loop: false, // Désactiver le loop automatique pour contrôler manuellement
        autoplay: true,
        animationData: animationData
      });
      
      // Accélérer l'animation
      this.tirPrecisLottieAnimation.setSpeed(1.5);
      
      // Calculer le frame à 50% (moitié de l'animation)
      const totalFrames = this.tirPrecisLottieAnimation.totalFrames;
      const halfFrame = Math.floor(totalFrames * 0.5);
      
      // Jouer de 0% à 50% une seule fois, puis s'arrêter à 50%
      const forwardCompleteHandler = () => {
        if (!this.tirPrecisLottieAnimation) return;
        
        const currentFrame = this.tirPrecisLottieAnimation.currentFrame;
        if (currentFrame >= halfFrame) {
          // Retirer le listener AVANT de modifier l'animation pour éviter la boucle infinie
          this.tirPrecisLottieAnimation.removeEventListener('enterFrame', forwardCompleteHandler);
          this.tirPrecisRollbackHandler = null;
          
          // Arrêter l'animation en mettant la vitesse à 0, puis aller à 50%
          this.tirPrecisLottieAnimation.setSpeed(0);
          // Utiliser setTimeout pour éviter que goToAndStop déclenche enterFrame
          setTimeout(() => {
            if (this.tirPrecisLottieAnimation) {
              this.tirPrecisLottieAnimation.stop();
              this.tirPrecisLottieAnimation.goToAndStop(halfFrame, true);
            }
          }, 0);
        }
      };
      
      this.tirPrecisRollbackHandler = forwardCompleteHandler;
      this.tirPrecisLottieAnimation.addEventListener('enterFrame', forwardCompleteHandler);
      
      // Ajouter la classe CSS au cercle interne
      this.addCrosshairInnerCircleClass();
      
      console.log("[CRA JAUGE] Animation Lottie créée (0% → 50%):", this.tirPrecisLottieAnimation);
    } catch (error) {
      console.error("Erreur lors du chargement de l'animation Lottie de Tir précis:", error);
    }
  }

  private stopTirPrecisLottie(): void {
    if (this.tirPrecisLottieAnimation) {
      // Retirer le handler de progression 0-50%
      if (this.tirPrecisRollbackHandler) {
        this.tirPrecisLottieAnimation.removeEventListener('enterFrame', this.tirPrecisRollbackHandler);
        this.tirPrecisRollbackHandler = null;
      }
      
      // Aller à 50% si on n'y est pas déjà, puis jouer en arrière jusqu'à 0%
      const currentFrame = this.tirPrecisLottieAnimation.currentFrame;
      const totalFrames = this.tirPrecisLottieAnimation.totalFrames;
      const halfFrame = Math.floor(totalFrames * 0.5);
      
      // Aller à 50% si nécessaire
      if (currentFrame < halfFrame) {
        this.tirPrecisLottieAnimation.goToAndStop(halfFrame, true);
      }
      
      // Jouer en arrière jusqu'à 0%, puis s'arrêter à 0%
      this.tirPrecisLottieAnimation.setSpeed(-1.5);
      
      // Créer un handler pour détecter quand on arrive à 0%
      const rollbackCompleteHandler = () => {
        if (!this.tirPrecisLottieAnimation) return;
        
        const frame = this.tirPrecisLottieAnimation.currentFrame;
        if (frame <= 0) {
          // Retirer le listener AVANT de modifier l'animation pour éviter la boucle infinie
          this.tirPrecisLottieAnimation.removeEventListener('enterFrame', rollbackCompleteHandler);
          
          // Arrêter l'animation en mettant la vitesse à 0, puis aller à 0%
          this.tirPrecisLottieAnimation.setSpeed(0);
          // Utiliser setTimeout pour éviter que goToAndStop déclenche enterFrame
          setTimeout(() => {
            if (this.tirPrecisLottieAnimation) {
              this.tirPrecisLottieAnimation.stop();
              this.tirPrecisLottieAnimation.goToAndStop(0, true);
              this.tirPrecisLottieAnimation = null;
              this.hideTirPrecisContainer();
            }
          }, 0);
        }
      };
      
      this.tirPrecisLottieAnimation.addEventListener('enterFrame', rollbackCompleteHandler);
      this.tirPrecisLottieAnimation.play();
      return;
    }
    
    // Si l'animation n'existe pas, cacher le conteneur
    this.hideTirPrecisContainer();
  }
  
  private hideTirPrecisContainer(): void {
    if (this.tirPrecisLottieContainer) {
      this.tirPrecisLottieContainer.style.display = "none";
      // Vider le conteneur
      this.tirPrecisLottieContainer.innerHTML = "";
    }
    // Réinitialiser la direction
    this.tirPrecisAnimationDirection = 1;
  }

  private addCrosshairInnerCircleClass(): void {
    if (!this.tirPrecisLottieContainer) {
      return;
    }

    // Fonction pour ajouter la classe au cercle interne et réduire sa taille
    const addClassToCircle = () => {
      const svg = this.tirPrecisLottieContainer?.querySelector('svg');
      if (!svg) return;

      // Ne traiter qu'une seule fois
      if (svg.querySelector('path.crosshair-inner-circle')) {
        return; // Déjà traité
      }

      // Cibler le path avec la couleur cyan spécifique (rgb(33,189,195))
      const paths = svg.querySelectorAll('path');
      let foundCircle = false;
      
      paths.forEach(path => {
        // Ignorer si déjà traité
        if (path.classList.contains('crosshair-inner-circle')) {
          return;
        }
        
        const fill = path.getAttribute('fill');
        // Vérifier la couleur cyan précise (rgb(33,189,195))
        if (fill && fill.includes('rgb(33,189,195)')) {
          // Vérifier aussi que c'est bien un cercle (path qui commence par M et contient C pour des courbes)
          const d = path.getAttribute('d');
          if (d && d.includes('M') && d.includes('C')) {
            console.log('[CRA JAUGE] Cercle interne trouvé et stylisé:', { fill, d: d.substring(0, 50) });
            path.classList.add('crosshair-inner-circle');
            foundCircle = true;
            
            // Réduire la taille en appliquant un transform scale sur le groupe parent
            const parentGroup = path.closest('g');
            if (parentGroup && !parentGroup.hasAttribute('data-scaled')) {
              const existingTransform = parentGroup.getAttribute('transform') || '';
              // Scale depuis le centre
              parentGroup.setAttribute('transform', `scale(0.6) ${existingTransform}`);
              parentGroup.setAttribute('data-scaled', 'true');
            }
          }
        }
      });
      
      // Si on n'a pas trouvé avec la couleur exacte, essayer avec #21BDC3
      if (!foundCircle) {
        paths.forEach(path => {
          if (path.classList.contains('crosshair-inner-circle')) {
            return;
          }
          
          const fill = path.getAttribute('fill');
          if (fill === '#21BDC3' || fill === 'rgb(33, 189, 195)') {
            const d = path.getAttribute('d');
            if (d && d.includes('M') && d.includes('C')) {
              path.classList.add('crosshair-inner-circle');
              
              const parentGroup = path.closest('g');
              if (parentGroup && !parentGroup.hasAttribute('data-scaled')) {
                const existingTransform = parentGroup.getAttribute('transform') || '';
                parentGroup.setAttribute('transform', `scale(0.6) ${existingTransform}`);
                parentGroup.setAttribute('data-scaled', 'true');
              }
            }
          }
        });
      }
    };

    // Attendre que le SVG soit généré par Lottie
    setTimeout(addClassToCircle, 100);
    // Essayer aussi après un délai plus long au cas où l'animation prend plus de temps
    setTimeout(addClassToCircle, 300);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new CraJaugeTracker();
});
