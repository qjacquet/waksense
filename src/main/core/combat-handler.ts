/**
 * Combat Handler - Gestion des événements de combat
 */

import { BrowserWindow } from "electron";
import { CombatStartInfo, Fighter } from "../../shared/log/log-processor";
import { ClassDetection } from "./log-monitor";
import { TrackerManager } from "./tracker-manager";
import { WindowManager } from "../windows/window-manager";
import { WindowWatcher } from "./window-watcher";
import { getTrackerTypes } from "../../shared/domain/class-tracker-config";

export class CombatHandler {
  private static isCombatActive: boolean = false;

  /**
   * Vérifie si un combat est actif
   */
  static isInCombat(): boolean {
    return this.isCombatActive;
  }

  /**
   * Gère le début d'un combat
   */
  static handleCombatStarted(
    combatInfo: CombatStartInfo,
    launcherWindow: BrowserWindow | null,
    detectedClasses: Map<string, ClassDetection>,
    playerNameToFighterId: Map<string, number>,
    fighterIdToFighter: Map<number, Fighter>,
    logMonitor: any,
    windowWatcher: WindowWatcher | null
  ): void {
    if (!combatInfo || !combatInfo.fighters) {
      return;
    }

    // Synchroniser les mappings avec logMonitor pour la détection de début de tour
    playerNameToFighterId.clear();
    fighterIdToFighter.clear();

    // Détecter les combattants et mettre à jour la liste des personnages
    for (const fighter of combatInfo.fighters) {
      if (fighter.className) {
        // Enregistrer la détection de classe
        const key = `${fighter.className}_${fighter.playerName}`;
        detectedClasses.set(key, {
          className: fighter.className,
          playerName: fighter.playerName,
        });

        // Synchroniser les mappings pour la détection de début de tour
        if (fighter.fighterId !== undefined) {
          playerNameToFighterId.set(fighter.playerName, fighter.fighterId);
          fighterIdToFighter.set(fighter.fighterId, fighter);
        }

        // Notifier la détection de classe pour le launcher
        WindowManager.safeSendToWindow(launcherWindow, "class-detected", {
          className: fighter.className,
          playerName: fighter.playerName,
        });

        this.createTrackerForFighter(fighter, launcherWindow);
      }
    }

    // Synchroniser les mappings avec logMonitor pour qu'il puisse détecter le début de tour
    if (logMonitor) {
      logMonitor.syncFighterMappings(playerNameToFighterId, fighterIdToFighter);
    }

    // Mettre à jour le WindowWatcher avec les personnages détectés en combat
    if (windowWatcher) {
      const detectedCharsMap = new Map<string, { className: string; playerName: string }>();
      for (const [key, detection] of detectedClasses.entries()) {
        detectedCharsMap.set(key, detection);
      }
      windowWatcher.setDetectedCharacters(detectedCharsMap);
    }

    WindowManager.safeSendToWindow(launcherWindow, "combat-started");

    // Envoyer l'événement à toutes les fenêtres de trackers
    this.broadcastToTrackers("combat-started");

    // Marquer le combat comme actif
    this.isCombatActive = true;

    // Afficher les trackers du premier personnage détecté
    // (celui qui a probablement lancé le combat)
    if (combatInfo.fighters && combatInfo.fighters.length > 0) {
      const firstFighter = combatInfo.fighters.find(f => f.className);
      if (firstFighter && firstFighter.className) {
        const character = {
          className: firstFighter.className,
          playerName: firstFighter.playerName,
        };
        // Attendre un peu pour que les trackers soient créés
        setTimeout(() => {
          if (this.isCombatActive) {
            TrackerManager.showTrackersOnTurnStart(character);
          }
        }, 200);
      }
    }
  }

  /**
   * Gère l'arrivée d'un nouveau combattant
   */
  static handleFighterJoined(
    data: {
      fightId: number;
      fighter: {
        playerName: string;
        breed: number;
        className: string | null;
        fighterId?: number;
      };
    },
    launcherWindow: BrowserWindow | null,
    detectedClasses: Map<string, ClassDetection>,
    playerNameToFighterId: Map<string, number>,
    fighterIdToFighter: Map<number, Fighter>,
    logMonitor: any,
    windowWatcher: WindowWatcher | null
  ): void {
    if (!data.fighter.className) {
      return;
    }

    // Enregistrer la détection de classe
    const key = `${data.fighter.className}_${data.fighter.playerName}`;
    detectedClasses.set(key, {
      className: data.fighter.className,
      playerName: data.fighter.playerName,
    });

    // Synchroniser les mappings pour la détection de début de tour
    if (data.fighter.fighterId !== undefined) {
      playerNameToFighterId.set(data.fighter.playerName, data.fighter.fighterId);
      fighterIdToFighter.set(data.fighter.fighterId, data.fighter);
    }

    // Synchroniser les mappings avec logMonitor pour qu'il puisse détecter le début de tour
    if (logMonitor) {
      logMonitor.syncFighterMappings(playerNameToFighterId, fighterIdToFighter);
    }

    // Notifier la détection de classe pour mettre à jour la liste
    WindowManager.safeSendToWindow(launcherWindow, "class-detected", {
      className: data.fighter.className,
      playerName: data.fighter.playerName,
    });

    // Mettre à jour le WindowWatcher avec TOUS les personnages détectés (y compris le nouveau)
    if (windowWatcher) {
      const detectedCharsMap = new Map<string, { className: string; playerName: string }>();
      for (const [key, detection] of detectedClasses.entries()) {
        detectedCharsMap.set(key, detection);
      }
      windowWatcher.setDetectedCharacters(detectedCharsMap);
    }

    this.createTrackerForFighter(data.fighter, launcherWindow);
  }

  /**
   * Gère la fin d'un combat
   */
  static handleCombatEnded(
    fightId: number | undefined,
    launcherWindow: BrowserWindow | null,
    windowWatcher: WindowWatcher | null,
    playerNameToFighterId: Map<string, number>,
    fighterIdToFighter: Map<number, Fighter>
  ): void {
    // Réactiver le WindowWatcher à la fin du combat (au cas où un tour serait encore actif)
    if (windowWatcher) {
      windowWatcher.setTurnActive(false);
    }

    // Fermer automatiquement tous les trackers à la fin du combat
    this.closeAllTrackers();

    // Réinitialiser les mappings
    playerNameToFighterId.clear();
    fighterIdToFighter.clear();

    WindowManager.safeSendToWindow(launcherWindow, "combat-ended");

    // Envoyer l'événement à toutes les fenêtres de trackers
    this.broadcastToTrackers("combat-ended");

    // Marquer le combat comme terminé
    this.isCombatActive = false;
  }

  /**
   * Crée un tracker pour un combattant
   * Crée tous les trackers configurés pour cette classe et les cache par défaut
   */
  private static createTrackerForFighter(
    fighter: Fighter,
    launcherWindow: BrowserWindow | null
  ): void {
    if (!fighter.className) {
      return;
    }

    const character = {
      className: fighter.className,
      playerName: fighter.playerName,
    };

    // Créer tous les trackers disponibles pour cette classe
    const trackerTypes = getTrackerTypes(fighter.className);
    
    for (const trackerType of trackerTypes) {
      const trackerWindow = TrackerManager.createTracker(character, trackerType);

      if (trackerWindow && !trackerWindow.isDestroyed()) {
        // Cacher le tracker par défaut
        trackerWindow.hide();
        trackerWindow.webContents.once("did-finish-load", () => {
          if (trackerWindow && !trackerWindow.isDestroyed()) {
            trackerWindow.hide();
            WindowManager.safeSendToWindow(trackerWindow, "combat-started");
          }
        });
        WindowManager.safeSendToWindow(trackerWindow, "combat-started");
      } else {
        // Si le tracker existe déjà, envoyer l'événement
        const trackerId = TrackerManager.getTrackerId(
          fighter.className,
          fighter.playerName,
          trackerType
        );
        const existingWindow = WindowManager.getWindow(trackerId);
        if (existingWindow && !existingWindow.isDestroyed()) {
          WindowManager.safeSendToWindow(existingWindow, "combat-started");
        }
      }
    }
  }

  /**
   * Ferme tous les trackers de combat
   */
  private static closeAllTrackers(): void {
    const allWindows = WindowManager.getAllWindows();
    for (const [id, window] of allWindows) {
      if (id.startsWith("tracker-")) {
        WindowManager.closeWindow(id);
      }
    }
  }

  /**
   * Envoie un événement à toutes les fenêtres de trackers
   */
  private static broadcastToTrackers(channel: string): void {
    const trackerWindows = WindowManager.getAllWindows();
    trackerWindows.forEach((window, id) => {
      if (id.startsWith("tracker-")) {
        WindowManager.safeSendToWindow(window, channel);
      }
    });
  }
}

