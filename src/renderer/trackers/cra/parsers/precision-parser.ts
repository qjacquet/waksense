/**
 * Parser pour la précision Cra
 */

import { ResourceState } from "../core/resource-state.js";
import { PRECISION_MAX_ESPRIT_AFFUTE, PRECISION_MAX_DEFAULT } from "../config/spell-maps.js";

export class PrecisionParser {
  constructor(private state: ResourceState) {}

  parse(line: string): boolean {
    // Format: "Précision (+X Niv.)"
    const precisionMatch = line.match(/Précision\s*\(\+(\d+)\s*Niv\.\)/i);
    if (!precisionMatch) {
      // Track precision gains for talent detection
      const gainMatch = line.match(/Précision.*?(\+?\d+)/i);
      if (gainMatch && line.includes("+")) {
        try {
          const precisionGain = parseInt(gainMatch[1], 10);
          this.state.storePrecisionGain(precisionGain);

          // If gained > 200 without cap message, talent might be removed
          if (
            precisionGain > 200 &&
            !line.includes("Valeur maximale de Précision atteinte !")
          ) {
            if (this.state.getHasEspritAffute()) {
              this.state.setHasEspritAffute(false);
              this.state.setPrecisionMax(PRECISION_MAX_DEFAULT);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      return false;
    }

    const newPrecision = parseInt(precisionMatch[1], 10);
    this.state.setPrecision(newPrecision);

    // Check for "Esprit affûté" talent (limits precision to 200)
    if (
      line.includes("Valeur maximale de Précision atteinte !") &&
      newPrecision > 200
    ) {
      // Check if this was after a +300 gain (normal case - don't cap)
      if (!this.state.wasRecent300Gain()) {
        this.state.setPrecision(PRECISION_MAX_ESPRIT_AFFUTE);
        this.state.setPrecisionMax(PRECISION_MAX_ESPRIT_AFFUTE);
        this.state.setHasEspritAffute(true);
      }
    } else {
      // If precision exceeds max, cap it
      const precisionMax = this.state.getPrecisionMax();
      if (newPrecision > precisionMax) {
        this.state.setPrecision(precisionMax);
      }
    }

    return true;
  }

  parseBuffRemoval(line: string): boolean {
    // Parse Précision buff removal - reset precision to 0
    if (line.includes("n'est plus sous l'emprise de 'Précision'")) {
      this.state.setPrecision(0);
      this.state.setPrecisionMax(PRECISION_MAX_DEFAULT);
      this.state.setHasEspritAffute(false);
      return true;
    }
    return false;
  }
}

