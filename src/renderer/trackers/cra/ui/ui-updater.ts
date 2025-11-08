/**
 * Mise à jour de l'UI pour le tracker Cra
 */

import { ResourceState } from "../core/resource-state.js";
import { SVGManager } from "./svg-manager.js";
import { FillAnimation } from "../animations/fill-animations.js";

export class UIUpdater {
  private affutageAnimation: FillAnimation;
  private precisionAnimation: FillAnimation;

  constructor(
    private state: ResourceState,
    private svgManager: SVGManager
  ) {
    // Animation pour affûtage
    this.affutageAnimation = new FillAnimation({
      onUpdate: (normalizedValue) => {
        const currentValue = Math.round(normalizedValue * 100);
        this.svgManager.updateAffutageFill(normalizedValue, currentValue);
      },
    });

    // Animation pour précision
    this.precisionAnimation = new FillAnimation({
      onUpdate: (normalizedValue) => {
        const precisionMax = this.state.getPrecisionMax();
        const currentValue = Math.round(normalizedValue * precisionMax);
        this.svgManager.updatePrecisionFill(normalizedValue, currentValue);
      },
    });
  }

  update(): void {
    const elements = this.svgManager.getElements();
    if (!elements.svgElement) {
      return;
    }

    // Retirer toutes les classes d'état du SVG
    const allClasses = [
      "inactive",
      "has-affutage",
      "has-precision",
      "has-tir-precis",
      "has-fleche-lumineuse",
    ];

    elements.svgElement.classList.remove(...allClasses);

    // Masquer toutes les couches d'état
    this.svgManager.hideLayer(elements.affutageLayer);
    this.svgManager.hideLayer(elements.precisionLayer);

    // Retirer toutes les classes actives des couches
    this.svgManager.removeLayerClasses(elements.affutageLayer, ["active"]);
    this.svgManager.removeLayerClasses(elements.precisionLayer, ["active"]);

    const affutage = this.state.getAffutage();
    const precision = this.state.getPrecision();

    // Affûtage (Arc)
    if (affutage > 0 && elements.affutageLayer) {
      elements.svgElement.classList.add("has-affutage");
      this.svgManager.showLayer(elements.affutageLayer);
      elements.affutageLayer.classList.add("active");
      const normalizedAffutage = Math.min(affutage / 100, 1);
      this.affutageAnimation.animateTo(normalizedAffutage);
    } else if (elements.affutageLayer) {
      this.svgManager.hideLayer(elements.affutageLayer);
      elements.affutageLayer.classList.remove("active");
      this.affutageAnimation.reset();
      this.svgManager.resetAffutageFill();
    }

    // Précision (Cible)
    if (precision > 0 && elements.precisionLayer) {
      elements.svgElement.classList.add("has-precision");
      this.svgManager.showLayer(elements.precisionLayer);
      elements.precisionLayer.classList.add("active");
      const precisionMax = this.state.getPrecisionMax();
      const normalizedPrecision = Math.min(precision / precisionMax, 1);
      this.precisionAnimation.animateTo(normalizedPrecision);
    } else if (elements.precisionLayer) {
      this.svgManager.hideLayer(elements.precisionLayer);
      elements.precisionLayer.classList.remove("active");
      this.precisionAnimation.reset();
      this.svgManager.resetPrecisionFill();
    }

    // Mettre à jour les compteurs de stacks
    this.svgManager.updateStackCounters(
      this.state.getBaliseAffuteeStacks(),
      this.state.getPointeAffuteeStacks(),
      this.state.getFlecheLumineuseStacks()
    );

    // Colorer la pointe de la flèche en doré si des flèches lumineuses sont disponibles
    if (this.state.getFlecheLumineuseStacks() > 0) {
      elements.svgElement.classList.add("has-fleche-lumineuse");
    }
  }

  updateTirPrecis(active: boolean, lottieManager: any): void {
    const elements = this.svgManager.getElements();
    if (!elements.svgElement) {
      return;
    }

    if (active) {
      elements.svgElement.classList.add("has-tir-precis");
      lottieManager.loadTirPrecis();
    } else {
      elements.svgElement.classList.remove("has-tir-precis");
      lottieManager.stopTirPrecis();
    }
  }
}

