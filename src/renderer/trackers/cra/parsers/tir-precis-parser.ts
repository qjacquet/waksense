/**
 * Parser pour le buff Tir précis
 */

import { ResourceState } from "../core/resource-state.js";

export class TirPrecisParser {
  constructor(private state: ResourceState) {}

  parse(line: string): boolean {
    // Parse Tir précis buff activation
    if (line.includes("Tir précis (Niv.")) {
      this.state.setTirPrecisActive(true);
      return true;
    }
    // Parse Tir précis buff removal
    else if (line.includes("n'est plus sous l'emprise de 'Tir précis'")) {
      this.state.setTirPrecisActive(false);
      return true;
    }
    return false;
  }
}

