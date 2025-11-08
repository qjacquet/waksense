/**
 * Parser pour la consommation de précision avec Tir précis actif
 */

import { ResourceState } from "../core/resource-state.js";
import { SPELL_CONSUMPTION_MAP } from "../config/spell-maps.js";

export class SpellConsumptionParser {
  constructor(private state: ResourceState) {}

  parse(line: string, parsed: any): boolean {
    // Parse spell consumption with Tir précis active
    if (!this.state.getTirPrecisActive() || !parsed.isSpellCast || !parsed.spellCast) {
      return false;
    }

    const spellName = parsed.spellCast.spellName;
    let spellConsumption = 0;

    for (const [spell, cost] of Object.entries(SPELL_CONSUMPTION_MAP)) {
      if (spellName.includes(spell)) {
        spellConsumption = cost;
        break;
      }
    }

    if (spellConsumption > 0) {
      const currentPrecision = this.state.getPrecision();
      this.state.setPrecision(Math.max(currentPrecision - spellConsumption, 0));
      return true;
    }

    return false;
  }
}

