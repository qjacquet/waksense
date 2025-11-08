/**
 * Mise à jour de l'UI avec progress bars pour le tracker Cra
 */

import {
  updateProgressBar,
  updateStackIndicator,
} from "../../../core/ui-helpers.js";
import { ResourceState } from "../core/resource-state.js";

export class ProgressBarUpdater {
  constructor(private state: ResourceState) {}

  update(): void {
    const affutage = this.state.getAffutage();
    const precision = this.state.getPrecision();
    const precisionMax = this.state.getPrecisionMax();

    updateProgressBar("affutage-fill", "affutage-value", affutage, 100);
    updateProgressBar(
      "precision-fill",
      "precision-value",
      precision,
      precisionMax
    );

    const precisionMaxElement = document.getElementById("precision-max");
    if (precisionMaxElement) {
      precisionMaxElement.textContent = `/ ${precisionMax}`;
    }

    updateStackIndicator(
      "pointe-stacks",
      this.state.getPointeAffuteeStacks(),
      3,
      "Pointe"
    );
    updateStackIndicator(
      "balise-stacks",
      this.state.getBaliseAffuteeStacks(),
      3,
      "Balise"
    );
    updateStackIndicator(
      "fleche-lumineuse-stacks",
      Math.min(this.state.getFlecheLumineuseStacks(), 5),
      5,
      "Flèche"
    );

    const tirPrecisIndicator = document.getElementById("tir-precis-indicator");
    if (tirPrecisIndicator) {
      if (this.state.getTirPrecisActive()) {
        tirPrecisIndicator.style.display = "flex";
      } else {
        tirPrecisIndicator.style.display = "none";
      }
    }
  }
}

