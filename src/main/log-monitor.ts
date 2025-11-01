/**
 * Log Monitor - Surveillance du fichier de logs Wakfu en temps réel
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { LogDeduplicator } from '../shared/log-deduplicator';
import { LogParser } from '../shared/log-parser';
import { ClassDetector } from '../shared/class-detector';

export interface ClassDetection {
  className: string;
  playerName: string;
}

export class LogMonitor extends EventEmitter {
  private logFilePath: string;
  private monitoring: boolean = false;
  private lastPosition: number = 0;
  private deduplicator?: LogDeduplicator;
  private enableDeduplication: boolean;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(logFilePath: string, enableDeduplication: boolean = true) {
    super();
    this.logFilePath = logFilePath;
    this.enableDeduplication = enableDeduplication;

    if (enableDeduplication) {
      this.deduplicator = new LogDeduplicator(100); // 100ms de fenêtre
    }

    // Initialiser la position à la fin du fichier
    this.initializePositionToEnd();
  }

  /**
   * Initialise la position à la fin du fichier pour ignorer le contenu existant
   */
  private initializePositionToEnd(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        this.lastPosition = stats.size;
      } else {
        this.lastPosition = 0;
      }
    } catch (error) {
      this.lastPosition = 0;
    }
  }

  /**
   * Démarre la surveillance du fichier de logs
   */
  start(): void {
    if (this.monitoring) {
      return;
    }

    this.monitoring = true;

    // Surveiller le fichier avec un intervalle
    this.checkInterval = setInterval(() => {
      this.checkForChanges();
    }, 100); // Check every 100ms
  }

  /**
   * Arrête la surveillance du fichier de logs
   */
  stop(): void {
    this.monitoring = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Vérifie les changements dans le fichier de logs
   */
  private checkForChanges(): void {
    if (!this.monitoring) {
      return;
    }

    try {
      if (!fs.existsSync(this.logFilePath)) {
        return;
      }

      const stats = fs.statSync(this.logFilePath);
      const currentSize = stats.size;

      // Si le fichier a été tronqué ou réinitialisé
      if (currentSize < this.lastPosition) {
        this.lastPosition = 0;
      }

      // Si de nouvelles lignes sont disponibles
      if (currentSize > this.lastPosition) {
        const fd = fs.openSync(this.logFilePath, 'r');
        const buffer = Buffer.alloc(currentSize - this.lastPosition);
        fs.readSync(fd, buffer, 0, buffer.length, this.lastPosition);
        fs.closeSync(fd);

        // Les logs Wakfu sont en UTF-8, lire directement en UTF-8
        const newContent = buffer.toString('utf-8', 0, buffer.length);
        
        
        const newLines = newContent.split('\n');

        // Traiter chaque ligne
        for (const line of newLines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          // Vérifier la déduplication si activée
          if (this.enableDeduplication && this.deduplicator) {
            if (!this.deduplicator.shouldProcessLine(trimmed)) {
              continue; // Ignorer les doublons
            }
          }

          // Parser la ligne
          const parsed = LogParser.parseLine(trimmed);

          // Détecter la classe si c'est un sort
          if (parsed.isSpellCast && parsed.spellCast) {
            const detectedClass = ClassDetector.detectClass(parsed.spellCast.spellName);
            if (detectedClass) {
              this.emit('classDetected', {
                className: detectedClass,
                playerName: parsed.spellCast.playerName
              });
            }
          }

          // Émettre l'événement pour chaque ligne
          this.emit('logLine', trimmed, parsed);

          // Détecter le début de combat
          if (LogParser.isCombatStart(trimmed)) {
            this.emit('combatStarted');
          }

          // Détecter la fin de combat
          if (LogParser.isCombatEnd(trimmed)) {
            this.emit('combatEnded');
          }
        }

        this.lastPosition = currentSize;
      }
    } catch (error) {
      console.error(`Error monitoring log file: ${error}`);
    }
  }

  /**
   * Obtient les statistiques de déduplication
   */
  getDeduplicationStats() {
    if (this.deduplicator) {
      return this.deduplicator.getStats();
    }
    return null;
  }

  /**
   * Réinitialise les statistiques de déduplication
   */
  resetDeduplicationStats(): void {
    if (this.deduplicator) {
      this.deduplicator.resetStats();
    }
  }

  /**
   * Active/désactive le mode debug de déduplication
   */
  setDeduplicationDebug(enabled: boolean): void {
    if (this.deduplicator) {
      this.deduplicator.setDebugMode(enabled);
    }
  }
}

