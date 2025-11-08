/**
 * Tracker Manager - Gestion générique des trackers
 * Utilise la configuration des classes pour créer et gérer les trackers
 */

import { BrowserWindow } from "electron";
import {
  getClassConfig,
  getTrackerConfig,
  hasTrackerType,
  getTrackerTypes,
  getAllHideTogetherSuffixes,
  CLASS_TRACKER_CONFIGS,
  getAutoShowTrackers,
  getAutoCreateButHideTrackers,
} from "../../shared/domain/class-tracker-config";
import { WindowManager } from "../windows/window-manager";
import { Config } from "./config";
import { CombatHandler } from "./combat-handler";
import { IPC_EVENTS } from "../../shared/constants/ipc-events";
import { PATTERNS } from "../../shared/constants/patterns";

export interface Character {
  className: string;
  playerName: string;
}

export class TrackerManager {
  /**
   * Génère l'ID d'un tracker
   * Note: Si trackerType est "main" ou vide, aucun suffixe n'est ajouté
   */
  static getTrackerId(
    className: string,
    playerName: string,
    trackerType: string
  ): string {
    if (trackerType === PATTERNS.TRACKER_MAIN || trackerType === "") {
      return `${PATTERNS.TRACKER_ID_PREFIX}${className}-${playerName}`;
    }
    return `${PATTERNS.TRACKER_ID_PREFIX}${className}-${playerName}-${trackerType}`;
  }

  /**
   * Crée un tracker pour un personnage
   */
  static createTracker(
    character: Character,
    trackerType: string
  ): BrowserWindow | null {
    console.log(`[TRACKER MANAGER] createTracker: ${character.className}.${trackerType} for ${character.playerName}`);
    const config = getTrackerConfig(character.className, trackerType);
    if (!config) {
      console.log(`[TRACKER MANAGER] No config found for ${character.className}.${trackerType}`);
      return null;
    }

    const trackerId = this.getTrackerId(
      character.className,
      character.playerName,
      trackerType
    );
    console.log(`[TRACKER MANAGER] Tracker ID: ${trackerId}`);

    if (WindowManager.hasWindow(trackerId)) {
      console.log(`[TRACKER MANAGER] Tracker ${trackerId} already exists`);
      return WindowManager.getWindow(trackerId) || null;
    }

    const window = WindowManager.createTrackerWindow(
      trackerId,
      config.htmlFile,
      character.className.toLowerCase(),
      {
        width: config.width,
        height: config.height,
        resizable: config.resizable,
        rendererName: config.rendererName,
      }
    );

    return window;
  }

  /**
   * Crée tous les trackers disponibles pour un personnage
   */
  static createAllTrackers(character: Character): BrowserWindow[] {
    const trackerTypes = getTrackerTypes(character.className);
    const windows: BrowserWindow[] = [];

    for (const trackerType of trackerTypes) {
      const window = this.createTracker(character, trackerType);
      if (window) {
        windows.push(window);
      }
    }

    return windows;
  }

  /**
   * Affiche un tracker
   */
  static showTracker(
    character: Character,
    trackerType: string
  ): BrowserWindow | null {
    const trackerId = this.getTrackerId(
      character.className,
      character.playerName,
      trackerType
    );
    console.log(`[TRACKER MANAGER] showTracker: trackerId=${trackerId}`);
    const window = WindowManager.getWindow(trackerId);

    if (window && !window.isDestroyed()) {
      console.log(`[TRACKER MANAGER] Tracker ${trackerId} exists, showing it`);
      window.show();
      window.focus();
      return window;
    }

    console.log(`[TRACKER MANAGER] Tracker ${trackerId} doesn't exist, creating it`);
    return this.createTracker(character, trackerType);
  }

  /**
   * Cache un tracker
   */
  static hideTracker(character: Character, trackerType: string): void {
    const trackerId = this.getTrackerId(
      character.className,
      character.playerName,
      trackerType
    );
    const window = WindowManager.getWindow(trackerId);

    if (window && !window.isDestroyed()) {
      window.hide();
    }
  }

  /**
   * Cache tous les trackers d'un personnage
   */
  static hideAllTrackers(character: Character): void {
    const trackerTypes = getTrackerTypes(character.className);
    for (const trackerType of trackerTypes) {
      this.hideTracker(character, trackerType);
    }
  }

  /**
   * Cache tous les trackers de tous les personnages
   * Utilise les groupes "hideTogether" de la configuration
   */
  static hideAllTrackersGlobally(): void {
    const allWindows = WindowManager.getAllWindows();
    const hideTogetherSuffixes = getAllHideTogetherSuffixes();

    for (const [id, window] of allWindows) {
      if (window.isDestroyed()) {
        continue;
      }

      for (const suffix of hideTogetherSuffixes) {
        if (id.endsWith(suffix)) {
          window.hide();
          break;
        }
      }

      for (const [classNameLower, classConfig] of CLASS_TRACKER_CONFIGS.entries()) {
        if (classConfig.hideTogether) {
          for (const group of classConfig.hideTogether) {
            if (group.includes(PATTERNS.TRACKER_MAIN)) {
              const pattern = `${PATTERNS.TRACKER_ID_PREFIX}${classNameLower}-`;
              if (id.startsWith(pattern)) {
                const afterPattern = id.substring(pattern.length);
                if (!afterPattern.includes("-")) {
                  window.hide();
                  break;
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Toggle la visibilité d'un tracker
   */
  static toggleTracker(
    character: Character,
    trackerType: string
  ): { window: BrowserWindow | null; isVisible: boolean } {
    const trackerId = this.getTrackerId(
      character.className,
      character.playerName,
      trackerType
    );
    const window = WindowManager.getWindow(trackerId);

    if (window) {
      const result = WindowManager.toggleWindow(window);
      return { window, isVisible: result.isVisible };
    }

    const newWindow = this.createTracker(character, trackerType);
    if (newWindow && !newWindow.isDestroyed()) {
      newWindow.show();
      newWindow.focus();
      return { window: newWindow, isVisible: true };
    }

    return { window: null, isVisible: false };
  }

  /**
   * Toggle tous les trackers d'un personnage (selon les groupes hideTogether)
   */
  static toggleAllTrackers(
    character: Character
  ): { windows: BrowserWindow[]; isVisible: boolean } {
    const classConfig = getClassConfig(character.className);
    if (!classConfig) {
      return { windows: [], isVisible: false };
    }

    const windows: BrowserWindow[] = [];
    let allVisible = true;

    for (const trackerType of classConfig.availableTrackerTypes) {
      const trackerId = this.getTrackerId(
        character.className,
        character.playerName,
        trackerType
      );
      const window = WindowManager.getWindow(trackerId);
      if (window) {
        windows.push(window);
        if (!window.isVisible()) {
          allVisible = false;
        }
      } else {
        allVisible = false;
      }
    }

    if (allVisible && windows.length > 0) {
      for (const window of windows) {
        if (!window.isDestroyed()) {
          window.hide();
        }
      }
      return { windows, isVisible: false };
    } else {
      const newWindows: BrowserWindow[] = [];
      for (const trackerType of classConfig.availableTrackerTypes) {
        const window = this.showTracker(character, trackerType);
        if (window) {
          newWindows.push(window);
        }
      }
      return { windows: newWindows, isVisible: true };
    }
  }

  /**
   * Vérifie si un personnage a un type de tracker spécifique
   */
  static hasTrackerType(className: string, trackerType: string): boolean {
    return hasTrackerType(className, trackerType);
  }

  /**
   * Envoie un événement à tous les trackers d'un personnage
   */
  static sendToAllTrackers(
    character: Character,
    channel: string,
    ...args: any[]
  ): void {
    const trackerTypes = getTrackerTypes(character.className);
    for (const trackerType of trackerTypes) {
      const trackerId = this.getTrackerId(
        character.className,
        character.playerName,
        trackerType
      );
      const window = WindowManager.getWindow(trackerId);
      WindowManager.safeSendToWindow(window || null, channel, ...args);
    }
  }

  /**
   * Positionne un tracker par rapport à un autre
   */
  static positionTrackerRelative(
    character: Character,
    trackerType: string,
    relativeToTrackerType: string,
    offsetX: number = 10,
    offsetY: number = 0
  ): void {
    const trackerId = this.getTrackerId(
      character.className,
      character.playerName,
      trackerType
    );
    const relativeTrackerId = this.getTrackerId(
      character.className,
      character.playerName,
      relativeToTrackerType
    );

    const trackerWindow = WindowManager.getWindow(trackerId);
    const relativeWindow = WindowManager.getWindow(relativeTrackerId);

    if (
      trackerWindow &&
      relativeWindow &&
      !trackerWindow.isDestroyed() &&
      !relativeWindow.isDestroyed()
    ) {
      const savedPos = Config.getOverlayPosition(trackerId);
      if (!savedPos) {
        const relativeBounds = relativeWindow.getBounds();
        trackerWindow.setPosition(
          relativeBounds.x + relativeBounds.width + offsetX,
          relativeBounds.y + offsetY
        );
      }
    }
  }

  /**
   * Affiche automatiquement les trackers configurés pour un personnage au début du tour
   */
  static showTrackersOnTurnStart(character: Character): void {
    console.log(`[TRACKER MANAGER] showTrackersOnTurnStart called for ${character.playerName} (${character.className})`);
    if (!CombatHandler.isInCombat()) {
      console.log("[TRACKER MANAGER] Not in combat, returning");
      return;
    }

    const autoShow = getAutoShowTrackers(character.className);
    const autoCreateButHide = getAutoCreateButHideTrackers(character.className);
    console.log(`[TRACKER MANAGER] Auto show trackers:`, autoShow);
    console.log(`[TRACKER MANAGER] Auto create but hide:`, autoCreateButHide);

    for (const trackerType of autoShow) {
      console.log(`[TRACKER MANAGER] Showing tracker ${trackerType} for ${character.playerName}`);
      const window = this.showTracker(character, trackerType);
      if (window && !window.isDestroyed()) {
        console.log(`[TRACKER MANAGER] Tracker ${trackerType} window obtained, isVisible: ${window.isVisible()}`);
        const trackerId = this.getTrackerId(
          character.className,
          character.playerName,
          trackerType
        );
        if (window.webContents.isLoading()) {
          console.log(`[TRACKER MANAGER] Tracker ${trackerType} is loading, waiting for did-finish-load`);
          window.webContents.once("did-finish-load", () => {
            // Vérifier que la fenêtre existe toujours dans la Map et n'est pas détruite
            const stillExists = WindowManager.getWindow(trackerId);
            if (stillExists && !stillExists.isDestroyed()) {
              console.log(`[TRACKER MANAGER] Tracker ${trackerType} finished loading, sending events`);
              WindowManager.safeSendToWindow(stillExists, IPC_EVENTS.COMBAT_STARTED);
              setTimeout(() => {
                WindowManager.safeSendToWindow(stillExists, IPC_EVENTS.REFRESH_UI);
              }, 100);
            }
          });
        } else {
          console.log(`[TRACKER MANAGER] Tracker ${trackerType} already loaded, sending events immediately`);
          WindowManager.safeSendToWindow(window, IPC_EVENTS.COMBAT_STARTED);
          setTimeout(() => {
            WindowManager.safeSendToWindow(window, IPC_EVENTS.REFRESH_UI);
          }, 100);
        }
      } else {
        console.log(`[TRACKER MANAGER] Failed to get window for tracker ${trackerType}`);
      }
    }

    for (const trackerType of autoCreateButHide) {
      const window = this.createTracker(character, trackerType);
      if (window && !window.isDestroyed()) {
        window.hide();
      }
    }
  }
}

