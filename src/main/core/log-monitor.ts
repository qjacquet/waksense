/**
 * Log Monitor - Surveillance du fichier de logs Wakfu en temps réel
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { LogDeduplicator, LogParser, CombatStartInfo } from '../../shared/log/log-processor';
import { ClassDetector } from '../../shared/domain/wakfu-domain';

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
  private currentFightId: number | null = null;
  private currentFightFighters: Map<string, CombatStartInfo['fighters'][0]> = new Map(); // key = playerName
  private fighterIdToFighter: Map<number, CombatStartInfo['fighters'][0]> = new Map(); // key = fighterId
  private lastSpellCasterFighterId: number | null = null; // Dernier fighterId qui a lancé un sort
  private playerNameToFighterId: Map<string, number> = new Map(); // Mapping playerName -> fighterId

  constructor(logFilePath: string, enableDeduplication: boolean = true) {
    super();
    this.logFilePath = logFilePath;
    this.enableDeduplication = enableDeduplication;

    if (enableDeduplication) {
      this.deduplicator = new LogDeduplicator(100);
    }

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

    this.checkInterval = setInterval(() => {
      this.checkForChanges();
    }, 100);
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

      if (currentSize < this.lastPosition) {
        this.lastPosition = 0;
      }

      if (currentSize > this.lastPosition) {
        const fd = fs.openSync(this.logFilePath, 'r');
        const buffer = Buffer.alloc(currentSize - this.lastPosition);
        fs.readSync(fd, buffer, 0, buffer.length, this.lastPosition);
        fs.closeSync(fd);

        const newContent = buffer.toString('utf-8', 0, buffer.length);
        
        const newLines = newContent.split('\n');

        for (const line of newLines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          if (this.enableDeduplication && this.deduplicator) {
            if (!this.deduplicator.shouldProcessLine(trimmed)) {
              continue;
            }
          }

          const parsed = LogParser.parseLine(trimmed);

          if (parsed.isSpellCast && parsed.spellCast) {
            const detectedClass = ClassDetector.detectClass(parsed.spellCast.spellName);
            if (detectedClass) {
              this.emit('classDetected', {
                className: detectedClass,
                playerName: parsed.spellCast.playerName
              });
            }
          }

          this.emit('logLine', trimmed, parsed);

          // Détection du début de combat avec le nouveau pattern
          if (LogParser.isCombatStart(trimmed)) {
            const combatInfo = LogParser.parseCombatStart(trimmed);
            if (combatInfo) {
              // Nouveau combat détecté (nouveau fightId) ou combat en cours
              if (this.currentFightId === null || this.currentFightId !== combatInfo.fightId) {
                // Nouveau combat ou changement de combat
                this.currentFightId = combatInfo.fightId;
                this.currentFightFighters.clear();
                this.fighterIdToFighter.clear();
                this.playerNameToFighterId.clear();
                this.lastSpellCasterFighterId = null;
                
                // Ajouter tous les combattants de cette ligne
                for (const fighter of combatInfo.fighters) {
                  this.currentFightFighters.set(fighter.playerName, fighter);
                  // Ajouter le mapping fighterId -> Fighter
                  if (fighter.fighterId !== undefined) {
                    this.fighterIdToFighter.set(fighter.fighterId, fighter);
                    this.playerNameToFighterId.set(fighter.playerName, fighter.fighterId);
                  }
                }
                
                // Émettre l'événement avec les informations du combattant
                this.emit('combatStarted', combatInfo);
              } else {
                // Même combat, ajouter les nouveaux combattants
                for (const fighter of combatInfo.fighters) {
                  if (!this.currentFightFighters.has(fighter.playerName)) {
                    this.currentFightFighters.set(fighter.playerName, fighter);
                    // Ajouter le mapping fighterId -> Fighter
                    if (fighter.fighterId !== undefined) {
                      this.fighterIdToFighter.set(fighter.fighterId, fighter);
                      this.playerNameToFighterId.set(fighter.playerName, fighter.fighterId);
                    }
                    // Émettre un événement pour chaque nouveau combattant
                    this.emit('fighterJoined', {
                      fightId: combatInfo.fightId,
                      fighter
                    });
                  }
                }
              }
            } else {
              // parseCombatStart a retourné null (monstre ou pattern non matché)
              // Mais isCombatStart retourne true, donc c'est peut-être un ancien pattern
              // Vérifier si c'est l'ancien pattern
              if (!trimmed.includes('[_FL_]')) {
                // Ancien pattern (pour compatibilité)
                this.emit('combatStarted');
              }
            }
          }

          // Détection du début de tour : quand un nouveau fighter lance son premier sort
          if (parsed.isSpellCast && parsed.spellCast) {
            const playerName = parsed.spellCast.playerName;
            const fighterId = this.playerNameToFighterId.get(playerName);
            
            // Si on a un fighterId pour ce joueur et que c'est différent du dernier qui a lancé un sort
            // Alors c'est le début du tour de ce fighter
            if (fighterId !== undefined && fighterId !== this.lastSpellCasterFighterId) {
              const fighter = this.fighterIdToFighter.get(fighterId);
              if (fighter) {
                // Nouveau fighter qui lance son premier sort = début de tour
                this.lastSpellCasterFighterId = fighterId;
                this.emit('turnStarted', {
                  fighterId,
                  fighter
                });
              }
            } else if (fighterId !== undefined && fighterId === this.lastSpellCasterFighterId) {
              // Même fighter qui lance un autre sort, pas de début de tour
              // On garde juste la trace
            }
          }

          // Détection de la fin de tour
          if (trimmed.includes('secondes reportées pour le tour suivant') || 
              trimmed.includes('reportées pour le tour suivant')) {
            // Émettre un événement pour masquer tous les trackers
            this.emit('turnEnded');
          }

          // Détection de la fin de combat
          if (LogParser.isCombatEnd(trimmed)) {
            const fightId = LogParser.parseCombatEnd(trimmed);
            if (fightId !== null) {
              // Nouveau pattern avec fightId
              this.emit('combatEnded', fightId);
            } else {
              // Ancien pattern (pour compatibilité)
              this.emit('combatEnded');
            }
            
            // Réinitialiser l'état du combat
            this.currentFightId = null;
            this.currentFightFighters.clear();
            this.fighterIdToFighter.clear();
            this.playerNameToFighterId.clear();
            this.lastSpellCasterFighterId = null;
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

  /**
   * Synchronise les mappings fighterId depuis l'extérieur
   * Utilisé pour partager les mappings entre logMonitor (wakfu_chat.log) et combatLogMonitor (wakfu.log)
   */
  syncFighterMappings(playerNameToFighterId: Map<string, number>, fighterIdToFighter: Map<number, CombatStartInfo['fighters'][0]>): void {
    this.playerNameToFighterId.clear();
    this.fighterIdToFighter.clear();
    
    for (const [playerName, fighterId] of playerNameToFighterId.entries()) {
      this.playerNameToFighterId.set(playerName, fighterId);
    }
    
    for (const [fighterId, fighter] of fighterIdToFighter.entries()) {
      this.fighterIdToFighter.set(fighterId, fighter);
    }
  }
}

