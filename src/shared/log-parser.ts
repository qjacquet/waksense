/**
 * Parser pour les logs Wakfu
 * Extrait les informations pertinentes des lignes de logs
 */

export interface SpellCast {
  playerName: string;
  spellName: string;
  timestamp: string;
}

export interface LogLineInfo {
  type: 'combat' | 'information' | 'other';
  isSpellCast: boolean;
  spellCast?: SpellCast;
  content: string;
  timestamp: string;
}

export class LogParser {
  /**
   * Parse une ligne de log et extrait les informations pertinentes
   */
  static parseLine(line: string): LogLineInfo {
    const trimmed = line.trim();
    if (!trimmed) {
      return {
        type: 'other',
        isSpellCast: false,
        content: '',
        timestamp: ''
      };
    }

    // Extraire le timestamp
    const timestampMatch = trimmed.match(/^(\d{2}:\d{2}:\d{2},\d{3})/);
    const timestamp = timestampMatch ? timestampMatch[1] : '';

    // Extraire le contenu après le timestamp
    const contentMatch = trimmed.match(/^\d{2}:\d{2}:\d{2},\d{3}\s*-\s*(.+)$/);
    const content = contentMatch ? contentMatch[1] : trimmed;

    // Déterminer le type
    let type: 'combat' | 'information' | 'other' = 'other';
    if (content.includes('[Information (combat)]')) {
      type = 'combat';
    } else if (content.includes('[Information]')) {
      type = 'information';
    }

    // Détecter un lancement de sort
    // Pattern plus flexible pour gérer les différents formats
    // Exemples possibles:
    // - "Astra Stria: lance le sort Flèche explosive"
    // - "Astra Stria lance le sort Flèche explosive"
    // - "Astra Stria : lance le sort Flèche explosive"
    // Le regex doit capturer jusqu'à la parenthèse ouvrante (s'il y en a) ou jusqu'à la fin
    let spellMatch = content.match(/\[Information \(combat\)\]\s*([^:]+?)[:\s]+\s*lance le sort\s+(.+?)(?:\s*\(|$)/);
    
    // Si aucun match, essayer sans les espaces optionnels autour de ":"
    if (!spellMatch) {
      spellMatch = content.match(/\[Information \(combat\)\]\s*([^:]+?)[:\s]+lance le sort\s+(.+)/);
    }
    
    // Si toujours pas de match, essayer un pattern encore plus simple
    let playerPart: string | undefined;
    let spellPart: string | undefined;
    
    if (!spellMatch && content.includes('lance le sort')) {
      const parts = content.split('lance le sort');
      if (parts.length >= 2) {
        playerPart = parts[0].replace(/\[Information \(combat\)\]\s*/, '').trim();
        spellPart = parts[1].split('(')[0].trim(); // Prendre jusqu'à la première parenthèse
      }
    }
    
    let spellCast: SpellCast | undefined;

    if (spellMatch && spellMatch[1] && spellMatch[2]) {
      spellCast = {
        playerName: spellMatch[1].trim().replace(/^:/, '').trim(), // Retirer le : au début si présent
        spellName: spellMatch[2].trim(),
        timestamp
      };
    } else if (playerPart && spellPart) {
      // Utiliser les parties extraites manuellement
      spellCast = {
        playerName: playerPart.replace(/^:/, '').trim(),
        spellName: spellPart.trim(),
        timestamp
      };
    }

    return {
      type,
      isSpellCast: !!spellCast,
      spellCast,
      content,
      timestamp
    };
  }

  /**
   * Vérifie si la ligne indique le début d'un combat
   */
  static isCombatStart(line: string): boolean {
    return line.includes('[Information (combat)]') && 
           line.includes('lance le sort');
  }

  /**
   * Vérifie si la ligne indique la fin d'un combat
   */
  static isCombatEnd(line: string): boolean {
    return line.includes("Combat terminé, cliquez ici pour rouvrir l'écran de fin de combat.");
  }
}

