/**
 * Fighter Mappings - Gestion des mappings entre playerName et fighterId
 */

import { Fighter, CombatStartInfo } from "../../shared/log/log-processor";
import { LogMonitor } from "./log-monitor";

export class FighterMappings {
  /**
   * Synchronise les mappings avec un LogMonitor
   */
  static syncWithLogMonitor(
    playerNameToFighterId: Map<string, number>,
    fighterIdToFighter: Map<number, Fighter>,
    logMonitor: LogMonitor | null
  ): void {
    if (logMonitor) {
      logMonitor.syncFighterMappings(playerNameToFighterId, fighterIdToFighter);
    }
  }

  /**
   * Réinitialise tous les mappings
   */
  static clear(
    playerNameToFighterId: Map<string, number>,
    fighterIdToFighter: Map<number, Fighter>
  ): void {
    playerNameToFighterId.clear();
    fighterIdToFighter.clear();
  }

  /**
   * Ajoute un combattant aux mappings
   */
  static addFighter(
    fighter: Fighter,
    playerNameToFighterId: Map<string, number>,
    fighterIdToFighter: Map<number, Fighter>
  ): void {
    if (fighter.fighterId !== undefined) {
      playerNameToFighterId.set(fighter.playerName, fighter.fighterId);
      fighterIdToFighter.set(fighter.fighterId, fighter);
    }
  }

  /**
   * Ajoute tous les combattants d'un CombatStartInfo aux mappings
   */
  static addFighters(
    combatInfo: CombatStartInfo,
    playerNameToFighterId: Map<string, number>,
    fighterIdToFighter: Map<number, Fighter>
  ): void {
    for (const fighter of combatInfo.fighters) {
      this.addFighter(fighter, playerNameToFighterId, fighterIdToFighter);
    }
  }
}

