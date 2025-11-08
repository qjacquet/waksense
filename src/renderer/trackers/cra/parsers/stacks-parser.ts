/**
 * Parsers pour les stacks (Pointe, Balise, Flèche lumineuse)
 */

import { ResourceState } from "../core/resource-state.js";
import { CRA_SPELLS, BALISE_SPELLS } from "../config/spell-maps.js";

export class StacksParser {
  constructor(private state: ResourceState) {}

  parsePointeAffutee(line: string): boolean {
    if (line.includes("Consomme Pointe affûtée")) {
      const currentStacks = this.state.getPointeAffuteeStacks();
      if (currentStacks > 0) {
        this.state.setPointeAffuteeStacks(currentStacks - 1);
        return true;
      }
    }
    return false;
  }

  parseBaliseAffutee(line: string): boolean {
    // Balise affûtée is consumed when specific spells are cast
    if (line.includes("lance le sort")) {
      const isBaliseSpell = BALISE_SPELLS.some((spell) =>
        line.includes(spell)
      );
      if (isBaliseSpell) {
        const currentStacks = this.state.getBaliseAffuteeStacks();
        if (currentStacks > 0) {
          this.state.setBaliseAffuteeStacks(currentStacks - 1);
          return true;
        }
      }
    }
    return false;
  }

  parseFlecheLumineuse(line: string, parsed: any): boolean {
    // Chercher directement dans la ligne le pattern ": Flèche lumineuse (+x Niv.) (Archer Futé)"
    // Pattern: ": Flèche lumineuse (+x Niv.) (Archer Futé)" où x est entre 1 et 5
    const flecheLumineuseMatch = line.match(
      /:\s*Flèche lumineuse\s*\(\+(\d+)\s*Niv\.\)\s*\(Archer Futé\)/i
    );

    if (flecheLumineuseMatch) {
      const increment = parseInt(flecheLumineuseMatch[1], 10);

      // Vérifier que le nombre est entre 1 et 5
      if (increment >= 1 && increment <= 5) {
        // Détecter le nom du personnage depuis les messages de combat
        if (parsed.isSpellCast && parsed.spellCast) {
          const playerName = parsed.spellCast.playerName;

          // Stocker le nom du personnage si on détecte un sort de Cra
          if (!this.state.getTrackedPlayerName()) {
            const spellName = parsed.spellCast.spellName;
            if (spellName && CRA_SPELLS.some((spell) => spellName.includes(spell))) {
              this.state.setTrackedPlayerName(playerName);
            }
          }

          // Vérifier si c'est notre personnage
          if (
            this.state.getTrackedPlayerName() &&
            playerName === this.state.getTrackedPlayerName()
          ) {
            this.state.setFlecheLumineuseStacks(increment);
            return true;
          }
        } else {
          // Si on ne peut pas identifier le joueur via spellCast, on peut quand même écraser la valeur
          this.state.setFlecheLumineuseStacks(increment);
          return true;
        }
      }
    } else {
      // Vérifier si c'est une consommation de flèche lumineuse (pas de pattern "+x Niv.")
      if (parsed.isSpellCast && parsed.spellCast) {
        const playerName = parsed.spellCast.playerName;
        const spellName = parsed.spellCast.spellName;

        // Stocker le nom du personnage si on détecte un sort de Cra
        if (spellName && !this.state.getTrackedPlayerName()) {
          if (CRA_SPELLS.some((spell) => spellName.includes(spell))) {
            this.state.setTrackedPlayerName(playerName);
          }
        }

        // Si c'est "Flèche lumineuse" sans le pattern d'incrément, c'est une consommation
        if (
          spellName &&
          spellName.includes("Flèche lumineuse") &&
          !line.match(/:\s*Flèche lumineuse\s*\(\+\d+\s*Niv\.\)/i)
        ) {
          if (
            this.state.getTrackedPlayerName() &&
            playerName === this.state.getTrackedPlayerName()
          ) {
            const currentStacks = this.state.getFlecheLumineuseStacks();
            if (currentStacks > 0) {
              this.state.setFlecheLumineuseStacks(currentStacks - 1);
              return true;
            }
          }
        }
      }
    }

    return false;
  }
}

