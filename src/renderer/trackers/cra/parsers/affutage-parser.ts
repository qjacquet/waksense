/**
 * Parser pour l'affûtage Cra
 */

import { ResourceState } from "../core/resource-state.js";

export interface AffutageParseResult {
  affutage: number;
  pointeStacksGained: number;
  baliseStacksGained: number;
}

export class AffutageParser {
  constructor(private state: ResourceState) {}

  parse(line: string): AffutageParseResult | null {
    // Format: "Affûtage (+X Niv.)"
    const match = line.match(/Affûtage\s*\(\+(\d+)\s*Niv\.\)/i);
    if (!match) {
      return null;
    }

    const newAffutage = parseInt(match[1], 10);
    let pointeStacksGained = 0;
    let baliseStacksGained = 0;

    // Handle Affûtage reaching 100+ - gain stacks and carry over excess
    if (newAffutage >= 100) {
      const stacksGained = Math.floor(newAffutage / 100);

      // Gain Pointe affûtée stacks (max 3)
      const currentPointeStacks = this.state.getPointeAffuteeStacks();
      if (currentPointeStacks < 3) {
        pointeStacksGained = Math.min(stacksGained, 3 - currentPointeStacks);
        this.state.addPointeAffuteeStacks(pointeStacksGained);
      }

      // Gain Balise affûtée stacks (max 3)
      const currentBaliseStacks = this.state.getBaliseAffuteeStacks();
      if (currentBaliseStacks < 3) {
        baliseStacksGained = Math.min(stacksGained, 3 - currentBaliseStacks);
        this.state.addBaliseAffuteeStacks(baliseStacksGained);
      }

      // Keep remainder (ex: 150 → 1 stack, 50 remaining)
      this.state.setAffutage(newAffutage % 100);
    } else {
      this.state.setAffutage(newAffutage);
    }

    return {
      affutage: this.state.getAffutage(),
      pointeStacksGained,
      baliseStacksGained,
    };
  }
}

