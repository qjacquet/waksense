/**
 * Combat Handler - Gestion des événements de combat
 */

import { BrowserWindow } from "electron";
import { CombatStartInfo, Fighter } from "../../shared/log/log-processor";
import { ClassDetection } from "./log-monitor";
import { TrackerManager } from "./tracker-manager";
import { WindowManager } from "../windows/window-manager";
import { WindowWatcher } from "./window-watcher";

export class CombatHandler {
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

        // Créer la jauge si elle est configurée pour cette classe
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

    // Créer la jauge si elle est configurée pour cette classe
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
  }

  /**
   * Crée un tracker pour un combattant
   */
  private static createTrackerForFighter(
    fighter: Fighter,
    launcherWindow: BrowserWindow | null
  ): void {
    if (!fighter.className) {
      return;
    }

    if (TrackerManager.hasTrackerType(fighter.className, "jauge")) {
      const character = {
        className: fighter.className,
        playerName: fighter.playerName,
      };
      const jaugeWindow = TrackerManager.createTracker(character, "jauge");

      if (jaugeWindow && !jaugeWindow.isDestroyed()) {
        // Cacher la jauge par défaut
        jaugeWindow.hide();
        jaugeWindow.webContents.once("did-finish-load", () => {
          if (jaugeWindow && !jaugeWindow.isDestroyed()) {
            jaugeWindow.hide();
            WindowManager.safeSendToWindow(jaugeWindow, "combat-started");
          }
        });
        WindowManager.safeSendToWindow(jaugeWindow, "combat-started");
      } else {
        // Si la jauge existe déjà, envoyer l'événement
        const jaugeTrackerId = TrackerManager.getTrackerId(
          fighter.className,
          fighter.playerName,
          "jauge"
        );
        const existingJaugeWindow = WindowManager.getWindow(jaugeTrackerId);
        if (existingJaugeWindow && !existingJaugeWindow.isDestroyed()) {
          WindowManager.safeSendToWindow(existingJaugeWindow, "combat-started");
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

