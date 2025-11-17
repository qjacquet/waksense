/**
 * Combat Handler - Gestion des événements de combat
 */

import { BrowserWindow } from "electron";
import { CombatStartInfo, Fighter } from "../../shared/log/log-processor";
import { ClassDetection } from "./log-monitor";
import { TrackerManager } from "./tracker-manager";
import { WindowManager } from "../windows/window-manager";
import { WindowWatcher } from "./window-watcher";
import { getTrackerTypes, getClassConfig } from "../../shared/domain/class-tracker-config";
import { IPC_EVENTS } from "../../shared/constants/ipc-events";
import { PATTERNS } from "../../shared/constants/patterns";

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
    console.log("[COMBAT HANDLER] handleCombatStarted called", combatInfo);
    if (!combatInfo || !combatInfo.fighters) {
      console.log("[COMBAT HANDLER] No combat info or fighters, returning");
      return;
    }

    playerNameToFighterId.clear();
    fighterIdToFighter.clear();

    for (const fighter of combatInfo.fighters) {
      // Vérifier que c'est un joueur (isControlledByAI doit être false ou undefined pour compatibilité)
      if (fighter.isControlledByAI === true) {
        console.log(`[COMBAT HANDLER] Skipping NPC: ${fighter.playerName}`);
        continue;
      }
      
      if (fighter.className) {
        console.log(`[COMBAT HANDLER] Processing fighter: ${fighter.playerName} (${fighter.className})`);
        const key = `${fighter.className}_${fighter.playerName}`;
        detectedClasses.set(key, {
          className: fighter.className,
          playerName: fighter.playerName,
        });

        if (fighter.fighterId !== undefined) {
          playerNameToFighterId.set(fighter.playerName, fighter.fighterId);
          fighterIdToFighter.set(fighter.fighterId, fighter);
        }

        WindowManager.safeSendToWindow(launcherWindow, IPC_EVENTS.CLASS_DETECTED, {
          className: fighter.className,
          playerName: fighter.playerName,
        });

        // Créer un tracker seulement si la classe a des trackers configurés
        const classConfig = getClassConfig(fighter.className);
        const hasTrackers = classConfig && classConfig.availableTrackerTypes && classConfig.availableTrackerTypes.length > 0;
        if (hasTrackers) {
          console.log(`[COMBAT HANDLER] Creating tracker for ${fighter.playerName} (${fighter.className})`);
          this.createTrackerForFighter(fighter, launcherWindow);
        } else {
          console.log(`[COMBAT HANDLER] No trackers configured for ${fighter.playerName} (${fighter.className}), skipping tracker creation (but character is still detected)`);
        }
      }
    }

    if (logMonitor) {
      logMonitor.syncFighterMappings(playerNameToFighterId, fighterIdToFighter);
    }

    if (windowWatcher) {
      const detectedCharsMap = new Map<string, { className: string; playerName: string }>();
      for (const [key, detection] of detectedClasses.entries()) {
        detectedCharsMap.set(key, detection);
      }
      windowWatcher.setDetectedCharacters(detectedCharsMap);
    }

    console.log("[COMBAT HANDLER] Sending combat-started event");
    WindowManager.safeSendToWindow(launcherWindow, IPC_EVENTS.COMBAT_STARTED);

    this.broadcastToTrackers(IPC_EVENTS.COMBAT_STARTED);

    this.isCombatActive = true;
    console.log("[COMBAT HANDLER] Combat marked as active");

    if (combatInfo.fighters && combatInfo.fighters.length > 0) {
      const firstFighter = combatInfo.fighters.find(f => f.className);
      if (firstFighter && firstFighter.className) {
        const character = {
          className: firstFighter.className,
          playerName: firstFighter.playerName,
        };
        console.log(`[COMBAT HANDLER] Scheduling showTrackersOnTurnStart for ${character.playerName}`);
        setTimeout(() => {
          if (this.isCombatActive) {
            console.log(`[COMBAT HANDLER] Calling showTrackersOnTurnStart for ${character.playerName}`);
            TrackerManager.showTrackersOnTurnStart(character);
          } else {
            console.log("[COMBAT HANDLER] Combat no longer active, skipping showTrackersOnTurnStart");
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
        isControlledByAI?: boolean;
      };
    },
    launcherWindow: BrowserWindow | null,
    detectedClasses: Map<string, ClassDetection>,
    playerNameToFighterId: Map<string, number>,
    fighterIdToFighter: Map<number, Fighter>,
    logMonitor: any,
    windowWatcher: WindowWatcher | null
  ): void {
    // Vérifier que c'est un joueur (isControlledByAI doit être false ou undefined pour compatibilité)
    if (data.fighter.isControlledByAI === true) {
      console.log(`[COMBAT HANDLER] Skipping NPC joining: ${data.fighter.playerName}`);
      return;
    }
    
    if (!data.fighter.className) {
      return;
    }

    const key = `${data.fighter.className}_${data.fighter.playerName}`;
    detectedClasses.set(key, {
      className: data.fighter.className,
      playerName: data.fighter.playerName,
    });

    if (data.fighter.fighterId !== undefined) {
      playerNameToFighterId.set(data.fighter.playerName, data.fighter.fighterId);
      fighterIdToFighter.set(data.fighter.fighterId, data.fighter);
    }

    if (logMonitor) {
      logMonitor.syncFighterMappings(playerNameToFighterId, fighterIdToFighter);
    }

    WindowManager.safeSendToWindow(launcherWindow, IPC_EVENTS.CLASS_DETECTED, {
      className: data.fighter.className,
      playerName: data.fighter.playerName,
    });

    if (windowWatcher) {
      const detectedCharsMap = new Map<string, { className: string; playerName: string }>();
      for (const [key, detection] of detectedClasses.entries()) {
        detectedCharsMap.set(key, detection);
      }
      windowWatcher.setDetectedCharacters(detectedCharsMap);
    }

    // Créer un tracker seulement si la classe a des trackers configurés
    const classConfig = getClassConfig(data.fighter.className);
    const hasTrackers = classConfig && classConfig.availableTrackerTypes && classConfig.availableTrackerTypes.length > 0;
    if (hasTrackers) {
      console.log(`[COMBAT HANDLER] Creating tracker for ${data.fighter.playerName} (${data.fighter.className})`);
      this.createTrackerForFighter(data.fighter, launcherWindow);
    } else {
      console.log(`[COMBAT HANDLER] No trackers configured for ${data.fighter.playerName} (${data.fighter.className}), skipping tracker creation (but character is still detected)`);
    }
  }

  static handleCombatEnded(
    fightId: number | undefined,
    launcherWindow: BrowserWindow | null,
    windowWatcher: WindowWatcher | null,
    playerNameToFighterId: Map<string, number>,
    fighterIdToFighter: Map<number, Fighter>
  ): void {
    if (windowWatcher) {
      windowWatcher.setTurnActive(false);
    }

    this.closeAllTrackers();

    playerNameToFighterId.clear();
    fighterIdToFighter.clear();

    WindowManager.safeSendToWindow(launcherWindow, IPC_EVENTS.COMBAT_ENDED);

    this.broadcastToTrackers(IPC_EVENTS.COMBAT_ENDED);

    this.isCombatActive = false;
  }

  private static createTrackerForFighter(
    fighter: Fighter,
    launcherWindow: BrowserWindow | null
  ): void {
    if (!fighter.className) {
      console.log("[COMBAT HANDLER] No className for fighter, skipping tracker creation");
      return;
    }

    const character = {
      className: fighter.className,
      playerName: fighter.playerName,
    };

    const trackerTypes = getTrackerTypes(fighter.className);
    console.log(`[COMBAT HANDLER] Tracker types for ${fighter.className}:`, trackerTypes);
    
    for (const trackerType of trackerTypes) {
      console.log(`[COMBAT HANDLER] Creating tracker ${trackerType} for ${fighter.playerName}`);
      const trackerWindow = TrackerManager.createTracker(character, trackerType);

      if (trackerWindow && !trackerWindow.isDestroyed()) {
        console.log(`[COMBAT HANDLER] Tracker ${trackerType} created, hiding it`);
        trackerWindow.hide();
        const trackerId = TrackerManager.getTrackerId(
          fighter.className,
          fighter.playerName,
          trackerType
        );
        trackerWindow.webContents.once("did-finish-load", () => {
          // Vérifier que la fenêtre existe toujours dans la Map et n'est pas détruite
          const stillExists = WindowManager.getWindow(trackerId);
          if (stillExists && !stillExists.isDestroyed()) {
            console.log(`[COMBAT HANDLER] Tracker ${trackerType} finished loading, sending combat-started`);
            stillExists.hide();
            WindowManager.safeSendToWindow(stillExists, IPC_EVENTS.COMBAT_STARTED);
          }
        });
        WindowManager.safeSendToWindow(trackerWindow, IPC_EVENTS.COMBAT_STARTED);
      } else {
        console.log(`[COMBAT HANDLER] Tracker ${trackerType} already exists or failed to create`);
        const trackerId = TrackerManager.getTrackerId(
          fighter.className,
          fighter.playerName,
          trackerType
        );
        const existingWindow = WindowManager.getWindow(trackerId);
        if (existingWindow && !existingWindow.isDestroyed()) {
          console.log(`[COMBAT HANDLER] Sending combat-started to existing tracker ${trackerId}`);
          WindowManager.safeSendToWindow(existingWindow, IPC_EVENTS.COMBAT_STARTED);
        }
      }
    }
  }

  private static closeAllTrackers(): void {
    const allWindows = WindowManager.getAllWindows();
    for (const [id, window] of allWindows) {
      if (id.startsWith(PATTERNS.TRACKER_ID_PREFIX)) {
        WindowManager.closeWindow(id);
      }
    }
    // Nettoyer les personnages actifs
    TrackerManager.clearActiveCharacters();
  }

  private static broadcastToTrackers(channel: string): void {
    const trackerWindows = WindowManager.getAllWindows();
    trackerWindows.forEach((window, id) => {
      if (id.startsWith(PATTERNS.TRACKER_ID_PREFIX)) {
        WindowManager.safeSendToWindow(window, channel);
      }
    });
  }
}

