/**
 * Iop Jauge Tracker - Suivi visuel des boosts Iop avec SVG
 * Version modulaire - orchestration des différents modules
 */

import { setupTrackerEventListeners } from "../../core/ui-helpers.js";
import { ResourceState } from "./core/resource-state.js";
import { ResourceParsers } from "./parsers/resource-parsers.js";
import { PostureParser } from "./parsers/posture-parser.js";
import { SPELL_COST_MAP, DAMAGE_SPELLS } from "./config/spell-maps.js";

// Note: Les modules UI et animations sont conservés dans ce fichier pour l'instant
// car ils sont très spécifiques à l'implémentation SVG/Lottie d'Iop
// Ils pourront être extraits plus tard si nécessaire

class IopJaugeTracker {
  private debugMode: boolean = false;

  // Modules
  private state: ResourceState;
  private resourceParsers: ResourceParsers;
  private postureParser: PostureParser;

  // SVG elements (conservés ici pour l'instant)
  private svgElement: SVGElement | null = null;
  private baseLayer: SVGGElement | null = null;
  private courrouxLayer: SVGGElement | null = null;
  private concentrationLayer: SVGGElement | null = null;
  private preparationLayer: SVGGElement | null = null;
  private egareLayer: SVGGElement | null = null;
  private postureContreLayer: SVGGElement | null = null;
  private postureDefenseLayer: SVGGElement | null = null;
  private postureVivaciteLayer: SVGGElement | null = null;

  private courrouxLottieContainer: HTMLElement | null = null;
  private courrouxLottieAnimation: any = null;
  private preparationLottieContainer: HTMLElement | null = null;
  private preparationLottieAnimation: any = null;

  // Animation state for concentration fill
  private currentFillNormalized: number = 0;
  private targetFillNormalized: number = 0;
  private fillAnimationFrame: number | null = null;
  private concentrationFillRect: SVGRectElement | null = null;

  constructor() {
    // Détecter le mode debug
    const urlParams = new URLSearchParams(window.location.search);
    this.debugMode = urlParams.get("debug") === "true";

    // Initialiser les modules
    this.state = new ResourceState();
    this.resourceParsers = new ResourceParsers(this.state);
    this.postureParser = new PostureParser(this.state);

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
    this.courrouxLayer = document.querySelector<SVGGElement>("#courroux-layer");
    this.concentrationLayer = document.querySelector<SVGGElement>("#concentration-layer");
    this.courrouxLottieContainer = document.getElementById("courroux-lottie-container");
    this.preparationLottieContainer = document.getElementById("preparation-lottie-container");
    this.preparationLayer = document.querySelector<SVGGElement>("#preparation-layer");
    this.egareLayer = document.querySelector<SVGGElement>("#egare-layer");
    this.postureContreLayer = document.querySelector<SVGGElement>("#posture-contre-layer");
    this.postureDefenseLayer = document.querySelector<SVGGElement>("#posture-défense-layer");
    this.postureVivaciteLayer = document.querySelector<SVGGElement>("#posture-vivacité-layer");

    if (!this.svgElement) {
      console.error("[IOP JAUGE] SVG element not found");
    }
  }

  private setupEventListeners(): void {
    setupTrackerEventListeners(
      (line: string, parsed: any) => this.processLogLine(line, parsed),
      () => {
        this.state.setInCombat(false);
        this.resetResources();
      },
      () => {
        this.state.setInCombat(true);
        this.updateUI();
      }
    );
  }

  private resetResources(): void {
    this.state.reset();
    this.updateUI();
  }

  private processLogLine(line: string, parsed: any): void {
    let uiNeedsUpdate = false;

    // Parse resource gains FIRST (before spell casts that might consume them)
    if (this.resourceParsers.parseConcentration(line)) {
      uiNeedsUpdate = true;
    }

    if (this.resourceParsers.parseCourroux(line)) {
      uiNeedsUpdate = true;
    }

    if (this.resourceParsers.parsePuissance(line)) {
      uiNeedsUpdate = true;
    }

    if (this.resourceParsers.parsePreparation(line)) {
      uiNeedsUpdate = true;
    }

    if (this.resourceParsers.parseEgare(line)) {
      uiNeedsUpdate = true;
    }

    // Parse Postures (must be before spell casts)
    if (this.postureParser.parse(line)) {
      uiNeedsUpdate = true;
    }

    // Parse spell consumption (after resource parsing to avoid resetting before gain)
    if (parsed.isSpellCast && parsed.spellCast) {
      if (
        this.resourceParsers.handleSpellCast(
          parsed.spellCast,
          SPELL_COST_MAP,
          DAMAGE_SPELLS
        )
      ) {
        uiNeedsUpdate = true;
      }
    }

    // Parse damage dealt (for courroux deactivation) - must be after spell cast
    if (this.resourceParsers.parseDamageDealt(line)) {
      uiNeedsUpdate = true;
    }

    // Parse damage received (for posture deactivation)
    if (this.postureParser.parseDamage(line)) {
      uiNeedsUpdate = true;
    }

    if (uiNeedsUpdate) {
      this.updateUI();
    }
  }

  private animateFillTo(target: number): void {
    this.targetFillNormalized = Math.max(0, Math.min(1, target));
    if (this.fillAnimationFrame !== null) {
      return;
    }
    const step = () => {
      const diff = this.targetFillNormalized - this.currentFillNormalized;
      if (Math.abs(diff) < 0.002) {
        this.currentFillNormalized = this.targetFillNormalized;
      } else {
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
        this.concentrationFillRect.setAttribute("width", "1");
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

  private setupDebugMode(): void {
    this.state.setInCombat(true);

    window.addEventListener("message", (event) => {
      if (event.data.type === "debug-init") {
        const values = event.data.values;
        if (values.concentration !== undefined)
          this.state.setConcentration(Number(values.concentration));
        if (values.courroux !== undefined)
          this.state.setCourroux(Boolean(values.courroux));
        if (values.puissance !== undefined)
          this.state.setPuissance(Number(values.puissance));
        if (values.preparation !== undefined)
          this.state.setPreparation(Boolean(values.preparation));
        if (values.egare !== undefined)
          this.state.setEgare(Boolean(values.egare));
        if (values.activePosture !== undefined) {
          this.state.setActivePosture(
            values.activePosture === "" || values.activePosture === null
              ? null
              : values.activePosture
          );
        }
        this.updateUI();
      } else if (event.data.type === "debug-update") {
        const { key, value } = event.data;
        switch (key) {
          case "concentration":
            this.state.setConcentration(Number(value));
            this.updateUI();
            break;
          case "courroux":
            this.state.setCourroux(Boolean(value));
            this.updateUI();
            break;
          case "puissance":
            this.state.setPuissance(Number(value));
            this.updateUI();
            break;
          case "preparation":
            this.state.setPreparation(Boolean(value));
            this.updateUI();
            break;
          case "egare":
            this.state.setEgare(Boolean(value));
            this.updateUI();
            break;
          case "activePosture":
            this.state.setActivePosture(
              value === "" || value === null ? null : value
            );
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
    this.hideLayer(this.courrouxLayer);
    this.hideLayer(this.concentrationLayer);
    this.hideLayer(this.preparationLayer);
    this.hideLayer(this.egareLayer);
    this.hideLayer(this.postureContreLayer);
    this.hideLayer(this.postureDefenseLayer);
    this.hideLayer(this.postureVivaciteLayer);

    // Retirer toutes les classes de niveau des couches
    this.removeLayerClasses(this.concentrationLayer, ["active"]);

    // Si pas en combat, appliquer l'état inactif
    if (!this.state.getInCombat()) {
      this.svgElement.classList.add("inactive");
      return;
    }

    const concentration = this.state.getConcentration();
    const courroux = this.state.getCourroux();
    const puissance = this.state.getPuissance();
    const preparation = this.state.getPreparation();
    const egare = this.state.getEgare();
    const activePosture = this.state.getActivePosture();

    // Concentration pleine (bleue)
    if (concentration > 0 && this.concentrationLayer) {
      const postureSigil1 = this.svgElement.querySelector(
        ".posture-sigil1"
      ) as SVGRectElement | null;
      const postureSigil2 = this.svgElement.querySelector(
        ".posture-sigil2"
      ) as SVGRectElement | null;

      this.hideLayer(postureSigil1);
      this.hideLayer(postureSigil2);
      if (concentration >= 80) {
        this.showLayer(postureSigil1);
        this.showLayer(postureSigil2);
      }

      this.svgElement.classList.add("has-puissance");
      this.showLayer(this.concentrationLayer);
      this.concentrationLayer.classList.add("active");
      const normalizedConcentration = Math.min(concentration / 100, 1);
      this.animateFillTo(normalizedConcentration);
    } else if (this.concentrationLayer) {
      this.hideLayer(this.concentrationLayer);
      this.concentrationLayer.classList.remove("active");
      this.targetFillNormalized = 0;
      this.currentFillNormalized = 0;
      if (this.concentrationFillRect) {
        this.concentrationFillRect.setAttribute("y", "1");
        this.concentrationFillRect.setAttribute("height", "0");
      }
    }

    // Courroux
    if (courroux && this.courrouxLayer) {
      this.svgElement.classList.add("has-courroux");
      this.showLayer(this.courrouxLayer);
      this.courrouxLayer.classList.add("active");
      this.loadCourrouxLottie();
    } else {
      this.stopCourrouxLottie();
    }

    // Préparation
    if (preparation && this.preparationLayer) {
      this.svgElement.classList.add("has-preparation");
      this.showLayer(this.preparationLayer);
      this.preparationLayer.classList.add("active");
      this.loadPreparationLottie();
    } else {
      this.stopPreparationLottie();
    }

    // Égaré
    if (egare && this.egareLayer) {
      this.svgElement.classList.add("has-egare");
      this.showLayer(this.egareLayer);
      this.egareLayer.classList.add("active");
    }

    // Mettre à jour la vitesse des animations Lottie selon l'état Égaré
    this.updateLottieSpeed();

    // Posture
    if (activePosture) {
      if (activePosture === "contre" && this.postureContreLayer) {
        this.showLayer(this.postureContreLayer);
        this.postureContreLayer.classList.add("active");
      } else if (activePosture === "défense" && this.postureDefenseLayer) {
        this.showLayer(this.postureDefenseLayer);
        this.postureDefenseLayer.classList.add("active");
      } else if (activePosture === "vivacité" && this.postureVivaciteLayer) {
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

  private removeLayerClasses(layer: SVGGElement | null, classes: string[]): void {
    if (layer) {
      layer.classList.remove(...classes);
    }
  }

  private async loadCourrouxLottie(): Promise<void> {
    if (!this.courrouxLottieContainer) {
      return;
    }

    let retries = 0;
    while (typeof (window as any).lottie === "undefined" && retries < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    if (typeof (window as any).lottie === "undefined") {
      console.error("Lottie n'est pas disponible après le chargement.");
      return;
    }

    if (this.courrouxLottieAnimation) {
      this.courrouxLottieContainer.style.display = "block";
      this.courrouxLottieAnimation.play();
      this.updateLottieSpeed();
      return;
    }

    this.courrouxLottieContainer.style.display = "block";

    try {
      const lottie = (window as any).lottie;
      const response = await fetch("../../../assets/classes/iop/blue-fire.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const animationData = await response.json();

      this.courrouxLottieAnimation = lottie.loadAnimation({
        container: this.courrouxLottieContainer,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: animationData,
      });

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
      this.courrouxLottieContainer.innerHTML = "";
    }
  }

  private async loadPreparationLottie(): Promise<void> {
    if (!this.preparationLottieContainer) {
      return;
    }

    let retries = 0;
    while (typeof (window as any).lottie === "undefined" && retries < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    if (typeof (window as any).lottie === "undefined") {
      console.error("Lottie n'est pas disponible après le chargement.");
      return;
    }

    if (this.preparationLottieAnimation) {
      this.preparationLottieContainer.style.display = "block";
      this.preparationLottieAnimation.play();
      this.updateLottieSpeed();
      return;
    }

    this.preparationLottieContainer.style.display = "block";

    try {
      const lottie = (window as any).lottie;
      const response = await fetch("../../../assets/classes/iop/lightning-neon.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const animationData = await response.json();

      this.preparationLottieAnimation = lottie.loadAnimation({
        container: this.preparationLottieContainer,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: animationData,
      });

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
      this.preparationLottieContainer.innerHTML = "";
    }
  }

  private updateLottieSpeed(): void {
    const speed = this.state.getEgare() ? 2.0 : 1.0;

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
