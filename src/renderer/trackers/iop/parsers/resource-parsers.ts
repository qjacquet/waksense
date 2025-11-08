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

  parseDamageDealt(line: string): boolean {
    // Only process combat lines
    if (!line.includes("[Information (combat)]")) {
      return false;
    }

    // Log toutes les lignes qui contiennent PV et - pour déboguer
    if (line.includes("PV") && line.includes("-")) {
      console.log(`[IOP JAUGE] Ligne de dégâts détectée: ${line}`);
    }

    if (!line.includes("PV") || !line.includes("-")) {
      return false;
    }

    // Pattern pour les dégâts : peut avoir un timestamp au début, et les nombres peuvent avoir des espaces (format français)
    // Exemple: "15:49:37,467 - [Information (combat)] Sac à patates: -8 342 PV (Feu) (Courroux)"
    const damageMatch = line.match(
      /\[Information \(combat\)\] ([^:]+):\s+-([\d\s]+)\s*PV/
    );

    if (!damageMatch) {
      console.log(`[IOP JAUGE] Pattern de dégâts ne correspond pas pour: ${line}`);
      return false;
    }

    const targetName = damageMatch[1].trim();
    const trackedPlayerName = this.state.getTrackedPlayerName();
    const courroux = this.state.getCourroux();
    const lastSpellCaster = this.state.getLastSpellCaster();
    const lastSpellCost = this.state.getLastSpellCost();

    // Log tous les dégâts détectés si le courroux est actif
    if (courroux) {
      console.log(
        `[IOP JAUGE] Dégâts détectés - cible: ${targetName}, courroux: ${courroux}, ` +
        `lastSpellCaster: ${lastSpellCaster}, trackedPlayer: ${trackedPlayerName}, ` +
        `lastSpellCost: ${lastSpellCost}, même joueur: ${targetName === trackedPlayerName?.trim()}`
      );
    }

    // Si le courroux est actif et que le dernier sort était un sort de 4 PA par le joueur tracké
    // ET que la ligne contient "(Courroux)" entre parenthèses
    if (
      courroux &&
      lastSpellCaster === trackedPlayerName &&
      lastSpellCost === "4PA" &&
      line.includes("(Courroux)")
    ) {
      // Si des dégâts sont infligés à quelqu'un d'autre que le joueur tracké,
      // c'est que le joueur tracké a infligé ces dégâts (avec son sort de 4 PA)
      if (trackedPlayerName && targetName !== trackedPlayerName.trim()) {
        console.log(
          `[IOP JAUGE] Dégâts infligés détectés avec Courroux (${targetName} reçoit ${damageMatch[2]} PV), désactivation du courroux`
        );
        this.state.setCourroux(false);
        return true;
      } else if (targetName === trackedPlayerName?.trim()) {
        console.log(
          `[IOP JAUGE] Dégâts reçus par le joueur tracké, pas de désactivation du courroux`
        );
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
      // Si un autre joueur lance un sort, réinitialiser lastSpellCost pour éviter les faux positifs
      this.state.setLastSpellCost(null);
      return false;
    }

    // Mémoriser le coût du dernier sort lancé par le joueur tracké
    const spellCost = spellCostMap.get(spellCast.spellName);
    this.state.setLastSpellCost(spellCost || null);
    
    if (this.state.getCourroux()) {
      console.log(
        `[IOP JAUGE] Sort lancé sous courroux: ${spellCast.spellName}, coût: ${spellCost || "non trouvé"}`
      );
      if (spellCost === "4PA") {
        console.log(`[IOP JAUGE] Sort de 4 PA détecté, en attente de dégâts pour désactiver le courroux`);
      }
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

    // Note: Le courroux n'est plus géré ici, il sera désactivé dans parseDamageDealt
    // quand des dégâts seront réellement infligés

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

