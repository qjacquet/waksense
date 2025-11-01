/**
 * Log Deduplicator - Gestionnaire de déduplication des logs basé sur le timing
 * Gère les doublons causés par plusieurs instances Wakfu qui écrivent dans le même fichier de log
 */

interface LogEntry {
  timestampMs: number;
  content: string;
  fullLine: string;
}

export interface DeduplicationStats {
  totalMessages: number;
  duplicatesDetected: number;
  messagesProcessed: number;
  duplicateWindowMs: number;
  duplicateRate: number;
}

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
   * @param line Ligne de log complète avec timestamp
   * @returns true si la ligne doit être traitée, false si c'est un doublon
   */
  shouldProcessLine(line: string): boolean {
    this.totalMessages++;

    // Extraire le timestamp et le contenu du message
    const parsed = this.parseLogLine(line);

    if (!parsed.timestamp || !parsed.content) {
      // Si on ne peut pas parser, traiter quand même pour éviter de perdre des données
      if (this.debugMode) {
        console.log(`DEBUG: Impossible de parser la ligne, traitement forcé: ${line.substring(0, 50)}...`);
      }
      return true;
    }

    const currentTimeMs = this.timestampToMs(parsed.timestamp);

    // Vérifier les doublons dans la fenêtre temporelle
    for (const entry of this.messageHistory) {
      if (
        Math.abs(currentTimeMs - entry.timestampMs) <= this.duplicateWindowMs &&
        entry.content === parsed.content
      ) {
        this.duplicatesDetected++;
        if (this.debugMode) {
          const timeDiff = Math.abs(currentTimeMs - entry.timestampMs);
          console.log(`DEBUG: 🚫 DOUBLON IGNORÉ (diff: ${timeDiff}ms) - ${parsed.content.substring(0, 60)}...`);
        }
        return false;
      }
    }

    // Ajouter à l'historique
    const newEntry: LogEntry = {
      timestampMs: currentTimeMs,
      content: parsed.content,
      fullLine: line
    };

    this.messageHistory.push(newEntry);

    // Limiter la taille de l'historique
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.shift();
    }

    if (this.debugMode) {
      console.log(`DEBUG: ✅ MESSAGE TRAITÉ - ${parsed.content.substring(0, 60)}...`);
    }

    return true;
  }

  /**
   * Parse une ligne de log pour extraire timestamp et contenu
   * Format attendu: "20:34:53,813 - [Information (combat)] Belluzu lance le sort Jugement"
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
      if (this.debugMode) {
        console.log(`DEBUG: Erreur parsing ligne: ${e}`);
      }
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

      // Convertir en millisecondes depuis minuit
      return (h * 3600 + m * 60 + s) * 1000 + ms;
    } catch (e) {
      if (this.debugMode) {
        console.log(`DEBUG: Erreur conversion timestamp: ${e}`);
      }
      return 0;
    }
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    console.log(`DEBUG: Mode debug déduplication ${enabled ? 'activé' : 'désactivé'}`);
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
    console.log('DEBUG: Statistiques de déduplication remises à zéro');
  }
}

