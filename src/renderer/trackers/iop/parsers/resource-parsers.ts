/**
 * Parsers pour les ressources Iop (concentration, courroux, puissance, préparation, égaré)
 */

import { ResourceState } from "../core/resource-state.js";
import { EGARE_SPELLS } from "../config/spell-maps.js";

export class ResourceParsers {
  constructor(private state: ResourceState) {}

  parseConcentration(line: string): boolean {
    // Check for concentration in combat lines
    if (
      !line.includes("[Information (combat)]") ||
      !line.includes("Concentration")
    ) {
      return false;
    }

    const concentrationMatch = line.match(/Concentration \(\+(\d+) Niv\.\)/);
    if (!concentrationMatch) {
      return false;
    }

    const concentrationValue = parseInt(concentrationMatch[1], 10);

    // Extract player name
    const playerMatch = line.match(
      /\[Information \(combat\)\] ([^:]+): Concentration/
    );
    if (playerMatch) {
      this.state.setTrackedPlayerName(playerMatch[1].trim());
    }

    // Check if concentration reaches 100+ (triggers overflow and égaré loss)
    if (concentrationValue >= 100) {
      this.state.setConcentration(concentrationValue % 100);
      if (this.state.getEgare()) {
        this.state.setEgare(false);
      }
    } else {
      this.state.setConcentration(concentrationValue);
    }

    return true;
  }

  parseCourroux(line: string): boolean {
    // Only process combat lines
    if (!line.includes("[Information (combat)]")) {
      return false;
    }

    // Parse Courroux gains - "Courroux (+X Niv.) (Compulsion)" OR "Courroux (+X Niv.) (Concentration)"
    const courrouxGainMatch = line.match(
      /Courroux \(\+(\d+) Niv\.\) \((Compulsion|Concentration)\)/
    );
    if (courrouxGainMatch) {
      this.state.setCourroux(true);
      return true;
    }
    return false;
  }

  parsePuissance(line: string): boolean {
    let updated = false;

    const puissanceMatch = line.match(/Puissance \(\+(\d+) Niv\.\)/);
    if (puissanceMatch) {
      const puissanceValue = parseInt(puissanceMatch[1], 10);
      const oldPuissance = this.state.getPuissance();
      this.state.setPuissance(puissanceValue);
      updated = this.state.getPuissance() !== oldPuissance;
    }

    if (
      line.includes("n'est plus sous l'emprise de 'Puissance' (Iop isolé)")
    ) {
      const playerMatch = line.match(/\[Information \(combat\)\] ([^:]+):/);
      if (
        playerMatch &&
        playerMatch[1] === this.state.getTrackedPlayerName()
      ) {
        const oldPuissance = this.state.getPuissance();
        this.state.losePuissanceOnIsolation();
        updated = this.state.getPuissance() !== oldPuissance;
      }
    }

    return updated;
  }

  parsePreparation(line: string): boolean {
    const preparationGainMatch = line.match(/Préparation \(\+(\d+) Niv\.\)/);
    if (preparationGainMatch) {
      this.state.setPreparation(true);
      return true;
    }
    return false;
  }

  parseEgare(line: string): boolean {
    // Égaré loss - turn passing
    if (
      line.includes("reportée pour le tour suivant") ||
      line.includes("reportées pour le tour suivant")
    ) {
      if (this.state.getEgare()) {
        this.state.setEgare(false);
        return true;
      }

      // Désactiver la posture à la fin du tour
      if (this.state.getActivePosture() !== null) {
        console.log(`[IOP JAUGE] Fin de tour détectée, désactivation de la posture`);
        this.state.setActivePosture(null);
        return true;
      }
    }
    return false;
  }

  handleSpellCast(
    spellCast: { playerName: string; spellName: string },
    spellCostMap: Map<string, string>,
    damageSpells: Set<string>
  ): boolean {
    let updated = false;

    // Mémoriser le dernier joueur qui a lancé un sort
    this.state.setLastSpellCaster(spellCast.playerName);

    if (spellCast.playerName !== this.state.getTrackedPlayerName()) {
      return false;
    }

    // Initialize puissance on first spell cast if not already in combat
    if (!this.state.getInCombat()) {
      this.state.setInCombat(true);
    }

    // Initialize puissance on first spell cast by tracked player
    if (this.state.getPuissance() === 0) {
      this.state.initializePuissance();
      updated = true;
    }

    // Handle Courroux loss - disparaît dès le premier sort coûtant 4 PA
    if (this.state.getCourroux()) {
      const spellCost = spellCostMap.get(spellCast.spellName);
      if (spellCost === "4PA") {
        this.state.setCourroux(false);
        updated = true;
      }
    }

    // Handle Préparation loss - disparaît dès le lancement d'un sort infligeant des dégâts
    if (this.state.getPreparation() && damageSpells.has(spellCast.spellName)) {
      console.log(
        `[IOP JAUGE] Sort infligeant des dégâts détecté: ${spellCast.spellName}, désactivation de la préparation`
      );
      this.state.setPreparation(false);
      updated = true;
    }

    // Handle Égaré gain spells
    if (EGARE_SPELLS.includes(spellCast.spellName)) {
      this.state.setEgare(true);
      updated = true;
    }

    return updated;
  }
}

