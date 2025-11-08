/**
 * Parser pour les postures Iop
 */

import { ResourceState, PostureType } from "../core/resource-state.js";

export class PostureParser {
  constructor(private state: ResourceState) {}

  parse(line: string): boolean {
    // Only process combat lines
    if (!line.includes("[Information (combat)]")) {
      return false;
    }

    // Détection de la perte de posture
    if (
      line.includes("n'est plus sous l'emprise de 'Posture de contre'") ||
      line.includes("n'est plus sous l'emprise de 'Posture de défense'") ||
      line.includes("n'est plus sous l'emprise de 'Posture de vivacité'")
    ) {
      const playerMatch = line.match(/\[Information \(combat\)\] ([^:]+):/);
      if (
        playerMatch &&
        this.state.getTrackedPlayerName() &&
        playerMatch[1].trim() === this.state.getTrackedPlayerName()?.trim()
      ) {
        this.state.setActivePosture(null);
        return true;
      }
      return false;
    }

    // Pattern: [Information (combat)] PlayerName: Posture de contre/défense/vivacité
    const postureMatch = line.match(
      /\[Information \(combat\)\] ([^:]+):\s+(Posture de contre|Posture de défense|Posture de vivacité)/
    );
    if (!postureMatch) {
      return false;
    }

    const playerName = postureMatch[1].trim();
    const postureName = postureMatch[2].trim();

    // Si le joueur n'est pas encore tracké, le définir maintenant
    if (!this.state.getTrackedPlayerName()) {
      this.state.setTrackedPlayerName(playerName);
    }

    // Vérifier que c'est le joueur tracké
    if (playerName === this.state.getTrackedPlayerName()?.trim()) {
      let posture: PostureType = null;
      if (postureName === "Posture de contre") {
        posture = "contre";
      } else if (postureName === "Posture de défense") {
        posture = "défense";
      } else if (postureName === "Posture de vivacité") {
        posture = "vivacité";
      }
      this.state.setActivePosture(posture);
      return true;
    }

    return false;
  }

  parseDamage(line: string): boolean {
    // Only process combat lines
    if (!line.includes("[Information (combat)]")) {
      return false;
    }

    // Pattern pour les dégâts : [Information (combat)] TargetName: -XX PV (element)
    if (line.includes("PV") && line.includes("-")) {
      const damageMatch = line.match(
        /\[Information \(combat\)\] ([^:]+):\s+-(\d+)\s*PV/
      );

      if (damageMatch) {
        const targetName = damageMatch[1].trim();

        // For posture: check if the tracked player receives damage
        if (
          this.state.getTrackedPlayerName() &&
          targetName === this.state.getTrackedPlayerName()?.trim() &&
          this.state.getActivePosture() !== null
        ) {
          console.log(
            `[IOP JAUGE] Dégâts reçus par ${targetName}, désactivation de la posture`
          );
          this.state.setActivePosture(null);
          return true;
        }
      }
    }

    return false;
  }
}

