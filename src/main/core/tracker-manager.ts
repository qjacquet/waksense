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
    // Le tracker principal n'a pas de suffixe
    if (trackerType === "main" || trackerType === "") {
      return `tracker-${className}-${playerName}`;
    }
    return `tracker-${className}-${playerName}-${trackerType}`;
  }

  /**
   * Crée un tracker pour un personnage
   */
  static createTracker(
    character: Character,
    trackerType: string
  ): BrowserWindow | null {
    const config = getTrackerConfig(character.className, trackerType);
    if (!config) {
      return null;
    }

    const trackerId = this.getTrackerId(
      character.className,
      character.playerName,
      trackerType
    );

    // Vérifier si le tracker existe déjà
    if (WindowManager.hasWindow(trackerId)) {
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
    const window = WindowManager.getWindow(trackerId);

    if (window && !window.isDestroyed()) {
      window.show();
      window.focus();
      return window;
    }

    // Créer le tracker s'il n'existe pas
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

    // Cacher toutes les fenêtres qui correspondent aux suffixes
    for (const [id, window] of allWindows) {
      if (window.isDestroyed()) {
        continue;
      }

      // Vérifier les suffixes normaux (ex: "-jauge", "-combos")
      for (const suffix of hideTogetherSuffixes) {
        if (id.endsWith(suffix)) {
          window.hide();
          break;
        }
      }

      // Vérifier les trackers "main" (sans suffixe) pour les classes configurées
      // Pattern: tracker-{className}-{playerName} (sans suffixe supplémentaire)
      for (const [classNameLower, classConfig] of CLASS_TRACKER_CONFIGS.entries()) {
        if (classConfig.hideTogether) {
          for (const group of classConfig.hideTogether) {
            if (group.includes("main")) {
              // Vérifier si l'ID correspond au pattern tracker-{className}-{playerName}
              // et ne se termine pas par un suffixe connu
              const pattern = `tracker-${classNameLower}-`;
              if (id.startsWith(pattern)) {
                // Extraire la partie après le pattern
                const afterPattern = id.substring(pattern.length);
                // Si après le pattern il n'y a pas de tiret, c'est le tracker principal
                // (car les autres trackers ont un suffixe comme "-jauge" ou "-combos")
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

    // Créer et afficher si n'existe pas
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

    // Vérifier si tous les trackers sont visibles
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

    // Toggle tous les trackers
    if (allVisible && windows.length > 0) {
      // Tout cacher
      for (const window of windows) {
        if (!window.isDestroyed()) {
          window.hide();
        }
      }
      return { windows, isVisible: false };
    } else {
      // Tout afficher ou créer
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
   * C'est LE SEUL endroit où l'affichage automatique est géré
   */
  static showTrackersOnTurnStart(character: Character): void {
    // Ne pas afficher les trackers si on n'est pas en combat
    if (!CombatHandler.isInCombat()) {
      return;
    }

    const autoShow = getAutoShowTrackers(character.className);
    const autoCreateButHide = getAutoCreateButHideTrackers(character.className);

    // Afficher les trackers configurés pour l'affichage automatique
    for (const trackerType of autoShow) {
      const window = this.showTracker(character, trackerType);
      if (window && !window.isDestroyed()) {
        // S'assurer que la fenêtre est complètement chargée avant d'envoyer les événements
        if (window.webContents.isLoading()) {
          window.webContents.once("did-finish-load", () => {
            WindowManager.safeSendToWindow(window, "combat-started");
            // Forcer une mise à jour de l'UI après un court délai pour s'assurer que tout est prêt
            setTimeout(() => {
              WindowManager.safeSendToWindow(window, "refresh-ui");
            }, 100);
          });
        } else {
          WindowManager.safeSendToWindow(window, "combat-started");
          // Forcer une mise à jour de l'UI après un court délai
          setTimeout(() => {
            WindowManager.safeSendToWindow(window, "refresh-ui");
          }, 100);
        }
      }
    }

    // Créer mais cacher les trackers configurés pour être créés mais cachés
    for (const trackerType of autoCreateButHide) {
      const window = this.createTracker(character, trackerType);
      if (window && !window.isDestroyed()) {
        window.hide();
      }
    }
  }
}

