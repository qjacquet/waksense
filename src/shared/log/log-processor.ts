/**
 * Log Processor - Traitement complet des logs Wakfu
 * Parse et déduplique les lignes de logs
 */

import { breedToClass } from '../domain/wakfu-domain';

interface LogEntry {
  timestampMs: number;
  content: string;
  fullLine: string;
}

export interface SpellCast {
  playerName: string;
  spellName: string;
  timestamp: string;
}

export interface Fighter {
  playerName: string;
  breed: number;
  className: string | null; // null si la classe n'est pas connue
}

export interface CombatStartInfo {
  fightId: number;
  fighters: Fighter[];
}

export interface LogLineInfo {
  type: 'combat' | 'information' | 'other';
  isSpellCast: boolean;
  spellCast?: SpellCast;
  content: string;
  timestamp: string;
}

export interface DeduplicationStats {
  totalMessages: number;
  duplicatesDetected: number;
  messagesProcessed: number;
  duplicateWindowMs: number;
  duplicateRate: number;
}

/**
 * Parser pour les logs Wakfu
 */
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

    const timestampMatch = trimmed.match(/^(\d{2}:\d{2}:\d{2},\d{3})/);
    const timestamp = timestampMatch ? timestampMatch[1] : '';

    const contentMatch = trimmed.match(/^\d{2}:\d{2}:\d{2},\d{3}\s*-\s*(.+)$/);
    const content = contentMatch ? contentMatch[1] : trimmed;

    let type: 'combat' | 'information' | 'other' = 'other';
    if (content.includes('[Information (combat)]')) {
      type = 'combat';
    } else if (content.includes('[Information]')) {
      type = 'information';
    }

    let spellMatch = content.match(/\[Information \(combat\)\]\s*([^:]+?)[:\s]+\s*lance le sort\s+(.+?)(?:\s*\(|$)/);
    
    if (!spellMatch) {
      spellMatch = content.match(/\[Information \(combat\)\]\s*([^:]+?)[:\s]+lance le sort\s+(.+)/);
    }
    
    let playerPart: string | undefined;
    let spellPart: string | undefined;
    
    if (!spellMatch && content.includes('lance le sort')) {
      const parts = content.split('lance le sort');
      if (parts.length >= 2) {
        playerPart = parts[0].replace(/\[Information \(combat\)\]\s*/, '').trim();
        spellPart = parts[1].split('(')[0].trim();
      }
    }
    
    let spellCast: SpellCast | undefined;

    if (spellMatch && spellMatch[1] && spellMatch[2]) {
      spellCast = {
        playerName: spellMatch[1].trim().replace(/^:/, '').trim(),
        spellName: spellMatch[2].trim(),
        timestamp
      };
    } else if (playerPart && spellPart) {
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
   * Vérifie si la ligne indique le début d'un combat avec le nouveau pattern
   * Pattern: INFO ... - [_FL_] fightId=... <nom> breed : <numéro> ... isControlledByAI=...
   */
  static isCombatStart(line: string): boolean {
    // Nouveau pattern: [_FL_] fightId=... breed : ...
    if (line.includes('[_FL_]') && line.includes('fightId=') && line.includes('breed :')) {
      return true;
    }
    // Ancien pattern (conservé pour compatibilité)
    return line.includes('[Information (combat)]') && 
           line.includes('lance le sort');
  }

  /**
   * Parse les informations de début de combat depuis une ligne de log
   * Pattern: INFO ... - [_FL_] fightId=1552072008 Astra Gladia breed : 8 [7595487] isControlledByAI=false ...
   * 
   * Retourne null si :
   * - La ligne ne matche pas le pattern
   * - isControlledByAI=true (c'est un monstre, pas un joueur)
   */
  static parseCombatStart(line: string): CombatStartInfo | null {
    // Pattern: [_FL_] fightId=<id> <nom> breed : <numéro> ... isControlledByAI=<bool>
    // Exemple: INFO ... - [_FL_] fightId=1552072008 Astra Gladia breed : 8 [7595487] isControlledByAI=false ...
    // Le nom peut contenir des espaces, donc on prend tout jusqu'à "breed :"
    const pattern = /\[_FL_\]\s+fightId=(\d+)\s+(.+?)\s+breed\s*:\s*(\d+)\s+.*?isControlledByAI=(true|false)/;
    const match = line.match(pattern);
    
    if (match) {
      const fightId = parseInt(match[1], 10);
      const playerName = match[2].trim();
      const breed = parseInt(match[3], 10);
      const isControlledByAI = match[4] === 'true';
      
      // Ne garder que les joueurs (isControlledByAI=false), pas les monstres
      if (isControlledByAI) {
        return null;
      }
      
      const className = breedToClass(breed);
      
      return {
        fightId,
        fighters: [{
          playerName,
          breed,
          className
        }]
      };
    }
    
    return null;
  }

  /**
   * Vérifie si la ligne indique la fin d'un combat
   * Pattern: INFO ... - [FIGHT] End fight with id ...
   */
  static isCombatEnd(line: string): boolean {
    // Nouveau pattern: [FIGHT] End fight with id
    if (line.includes('[FIGHT]') && line.includes('End fight with id')) {
      return true;
    }
    // Ancien pattern (conservé pour compatibilité)
    return line.includes("Combat terminé, cliquez ici pour rouvrir l'écran de fin de combat.");
  }

  /**
   * Parse le fightId depuis une ligne de fin de combat
   * Pattern: INFO ... - [FIGHT] End fight with id 1552084023
   */
  static parseCombatEnd(line: string): number | null {
    const pattern = /\[FIGHT\]\s+End fight with id\s+(\d+)/;
    const match = line.match(pattern);
    
    if (match) {
      return parseInt(match[1], 10);
    }
    
    return null;
  }
}

/**
 * Déduplicateur de logs - Gère les doublons causés par plusieurs instances Wakfu
 */
export class LogDeduplicator {
  private duplicateWindowMs: number;
  private maxHistory: number;
  private messageHistory: LogEntry[] = [];
  private debugMode: boolean = false;
  private duplicatesDetected: number = 0;
  private totalMessages: number = 0;

  constructor(duplicateWindowMs: number = 100, maxHistory: number = 1000) {
    this.duplicateWindowMs = duplicateWindowMs;
    this.maxHistory = maxHistory;
  }

  /**
   * Détermine si une ligne doit être traitée ou si c'est un doublon
   */
  shouldProcessLine(line: string): boolean {
    this.totalMessages++;

    const parsed = this.parseLogLine(line);

    if (!parsed.timestamp || !parsed.content) {
      return true;
    }

    const currentTimeMs = this.timestampToMs(parsed.timestamp);

    for (const entry of this.messageHistory) {
      if (
        Math.abs(currentTimeMs - entry.timestampMs) <= this.duplicateWindowMs &&
        entry.content === parsed.content
      ) {
        this.duplicatesDetected++;
        return false;
      }
    }

    const newEntry: LogEntry = {
      timestampMs: currentTimeMs,
      content: parsed.content,
      fullLine: line
    };

    this.messageHistory.push(newEntry);

    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.shift();
    }

    return true;
  }

  /**
   * Parse une ligne de log pour extraire timestamp et contenu
   */
  private parseLogLine(line: string): { timestamp: string | null; content: string | null } {
    try {
      const match = line.trim().match(/^(\d{2}:\d{2}:\d{2},\d{3})\s*-\s*(.+)$/);
      if (match) {
        return {
          timestamp: match[1],
          content: match[2]
        };
      }
    } catch (e) {
      // Erreur silencieuse
    }

    return { timestamp: null, content: null };
  }

  /**
   * Convertit un timestamp "HH:MM:SS,mmm" en millisecondes depuis minuit
   */
  private timestampToMs(timestampStr: string): number {
    try {
      const [timePart, msPart] = timestampStr.split(',');
      const [h, m, s] = timePart.split(':').map(Number);
      const ms = parseInt(msPart, 10);

      return (h * 3600 + m * 60 + s) * 1000 + ms;
    } catch (e) {
      return 0;
    }
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  getStats(): DeduplicationStats {
    return {
      totalMessages: this.totalMessages,
      duplicatesDetected: this.duplicatesDetected,
      messagesProcessed: this.messageHistory.length,
      duplicateWindowMs: this.duplicateWindowMs,
      duplicateRate: this.totalMessages > 0 
        ? (this.duplicatesDetected / this.totalMessages) * 100 
        : 0
    };
  }

  resetStats(): void {
    this.duplicatesDetected = 0;
    this.totalMessages = 0;
    this.messageHistory = [];
  }
}

