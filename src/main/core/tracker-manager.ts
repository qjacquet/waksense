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
import { GameWindowManager } from "./game-window-manager";

export interface Character {
  className: string;
  playerName: string;
}

export class TrackerManager {
  private static lastActiveCharacter: { playerName: string; className: string } | null = null;
  private static visibilityUpdateTimeout: NodeJS.Timeout | null = null;
  private static lastShowTime: number = 0;
  private static hideProtectionDelay: number = 2000; // Ne pas cacher pendant 2s après un affichage
  private static lastKnownActiveWindow: { id: string; character: { playerName: string; className: string } } | null = null;
  private static lastWindowBounds: { x: number; y: number; width: number; height: number } | null = null;
  private static windowMovingTimeout: NodeJS.Timeout | null = null;
  private static activeCharactersByWindow: Map<string, { playerName: string; className: string }> = new Map(); // Fenêtre -> personnage actif
  private static lastTrackerPositions: Map<string, { x: number; y: number }> = new Map(); // Tracker ID -> dernière position

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
      
      // Positionner le tracker par rapport à la fenêtre du jeu
      this.positionTrackerOnGameWindow(window, character, trackerType);
      
      window.show();
      this.lastShowTime = Date.now(); // Enregistrer le moment de l'affichage
      // Ne pas faire focus() pour éviter de voler le focus au jeu
      return window;
    }

    console.log(`[TRACKER MANAGER] Tracker ${trackerId} doesn't exist, creating it`);
    const newWindow = this.createTracker(character, trackerType);
    if (newWindow && !newWindow.isDestroyed()) {
      // Positionner le tracker par rapport à la fenêtre du jeu
      this.positionTrackerOnGameWindow(newWindow, character, trackerType);
      newWindow.show();
      this.lastShowTime = Date.now(); // Enregistrer le moment de l'affichage
    }
    return newWindow;
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
    // Nettoyer les personnages actifs
    this.activeCharactersByWindow.clear();
    this.lastTrackerPositions.clear();
  }

  /**
   * Nettoie les personnages actifs (appelé à la fin du combat)
   */
  static clearActiveCharacters(): void {
    this.activeCharactersByWindow.clear();
    this.lastTrackerPositions.clear();
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
   * Positionne un tracker par rapport à la fenêtre du jeu
   */
  private static positionTrackerOnGameWindow(
    trackerWindow: BrowserWindow,
    character: Character,
    trackerType: string
  ): void {
    const trackerId = this.getTrackerId(
      character.className,
      character.playerName,
      trackerType
    );

    // Vérifier s'il y a une position sauvegardée
    const savedPos = Config.getOverlayPosition(trackerId);
    if (savedPos) {
      // Utiliser la position sauvegardée
      trackerWindow.setPosition(savedPos.x, savedPos.y);
      if (savedPos.width && savedPos.height) {
        trackerWindow.setSize(savedPos.width, savedPos.height);
      }
      return;
    }

    // Sinon, positionner par rapport à la fenêtre du jeu
    // Chercher la fenêtre de jeu correspondante à ce personnage
    const gameWindow = GameWindowManager.getWindowForCharacter(character);
    if (!gameWindow) {
      // Si aucune fenêtre trouvée directement, chercher dans toutes les fenêtres
      const allGameWindows = GameWindowManager.getAllWindows();
      for (const [id, gw] of allGameWindows) {
        if (gw.character && 
            gw.character.playerName === character.playerName && 
            gw.character.className === character.className) {
          this.positionTrackerRelativeToGameWindow(trackerWindow, gw);
          return;
        }
      }
      // Si vraiment aucune fenêtre trouvée, utiliser la fenêtre active comme fallback
      const activeGameWindow = GameWindowManager.getActiveWindow();
      if (activeGameWindow) {
        this.positionTrackerRelativeToGameWindow(trackerWindow, activeGameWindow);
      }
      return;
    }

    this.positionTrackerRelativeToGameWindow(trackerWindow, gameWindow);
  }

  /**
   * Positionne un tracker par rapport à une fenêtre de jeu
   */
  private static positionTrackerRelativeToGameWindow(
    trackerWindow: BrowserWindow,
    gameWindow: { bounds: { x: number; y: number; width: number; height: number } }
  ): void {
    const trackerBounds = trackerWindow.getBounds();
    const gameBounds = gameWindow.bounds;

    // Positionner le tracker en haut à droite de la fenêtre du jeu
    // Avec un petit offset pour ne pas coller au bord
    const offsetX = 10;
    const offsetY = 10;

    const newX = gameBounds.x + gameBounds.width - trackerBounds.width - offsetX;
    const newY = gameBounds.y + offsetY;

    trackerWindow.setPosition(newX, newY);
  }

  /**
   * Définit le personnage actif pour une fenêtre (appelé au début du tour)
   */
  static setActiveCharacterForWindow(windowId: string, character: { playerName: string; className: string }): void {
    this.activeCharactersByWindow.set(windowId, character);
  }

  /**
   * Met à jour la position des trackers selon les fenêtres du jeu
   * Ne gère QUE le positionnement, pas la visibilité (qui est gérée par showTrackersOnTurnStart/turnEnded)
   */
  static updateTrackersVisibility(immediate: boolean = false): void {
    // Debounce pour éviter les appels trop fréquents
    if (!immediate) {
      if (this.visibilityUpdateTimeout) {
        clearTimeout(this.visibilityUpdateTimeout);
      }
      this.visibilityUpdateTimeout = setTimeout(() => {
        this.updateTrackersVisibility(true);
      }, 200); // Attendre 200ms avant de mettre à jour (réduction pour réactivité)
      return;
    }

    const allWindows = WindowManager.getAllWindows();

    // Pour chaque tracker visible, trouver la fenêtre de jeu correspondante et le positionner
    for (const [id, trackerWindow] of allWindows) {
      if (!id.startsWith(PATTERNS.TRACKER_ID_PREFIX) || trackerWindow.isDestroyed()) {
        continue;
      }

      // Ne repositionner que les trackers déjà visibles
      if (!trackerWindow.isVisible()) {
        continue;
      }

      // Extraire le personnage depuis l'ID du tracker
      const trackerIdParts = id.substring(PATTERNS.TRACKER_ID_PREFIX.length).split("-");
      if (trackerIdParts.length < 2) {
        continue;
      }

      const className = trackerIdParts[0];
      const playerName = trackerIdParts[1];
      const character = { className, playerName };

      // Chercher la fenêtre de jeu correspondante à ce personnage
      const gameWindow = GameWindowManager.getWindowForCharacter(character);
      
      if (gameWindow && gameWindow.character) {
        // Repositionner seulement si la position a vraiment changé (évite les clignotements)
        const currentBounds = trackerWindow.getBounds();
        const lastPos = this.lastTrackerPositions.get(id);
        const gameBounds = gameWindow.bounds;
        const expectedX = gameBounds.x + gameBounds.width - currentBounds.width - 10;
        const expectedY = gameBounds.y + 10;
        
        // Vérifier si la position doit être mise à jour (seuil de 10px pour éviter les micro-mouvements)
        const needsReposition = !lastPos || 
          Math.abs(lastPos.x - expectedX) > 10 || 
          Math.abs(lastPos.y - expectedY) > 10;
        
        if (needsReposition) {
          this.positionTrackerOnGameWindow(trackerWindow, character, this.getTrackerTypeFromId(id));
          this.lastTrackerPositions.set(id, { x: expectedX, y: expectedY });
        }
      }
    }
  }

  /**
   * Extrait le type de tracker depuis son ID
   * Format: tracker-{className}-{playerName}[-{trackerType}]
   */
  private static getTrackerTypeFromId(trackerId: string): string {
    const parts = trackerId.substring(PATTERNS.TRACKER_ID_PREFIX.length).split("-");
    if (parts.length > 2) {
      // Il y a un type de tracker (ex: "jauge", "combos")
      return parts.slice(2).join("-");
    }
    // Pas de type spécifique, c'est le tracker principal
    return PATTERNS.TRACKER_MAIN;
  }

  /**
   * Affiche automatiquement les trackers configurés pour un personnage au début du tour
   * Détecte tous les personnages, même ceux sans trackers, pour savoir quand ne rien afficher
   */
  static showTrackersOnTurnStart(character: Character): void {
    console.log(`[TRACKER MANAGER] showTrackersOnTurnStart called for ${character.playerName} (${character.className})`);
    if (!CombatHandler.isInCombat()) {
      console.log("[TRACKER MANAGER] Not in combat, returning");
      return;
    }

    // Trouver la fenêtre de jeu correspondante
    let gameWindow = GameWindowManager.getWindowForCharacter(character);
    if (!gameWindow) {
      // Si pas de fenêtre trouvée pour ce personnage, utiliser la fenêtre active
      // (peut arriver si le personnage n'est pas encore détecté depuis le titre)
      const activeGameWindow = GameWindowManager.getActiveWindow();
      if (activeGameWindow) {
        gameWindow = activeGameWindow;
        console.log(`[TRACKER MANAGER] No specific window found for ${character.playerName}, using active window: ${gameWindow.id}`);
        
        // Si la fenêtre active n'a pas de personnage associé, l'associer maintenant
        if (!gameWindow.character) {
          // Mettre à jour la fenêtre avec ce personnage
          gameWindow.character = character;
          const allWindows = GameWindowManager.getAllWindows();
          allWindows.set(gameWindow.id, gameWindow);
          console.log(`[TRACKER MANAGER] Associated character ${character.playerName} (${character.className}) to active window ${gameWindow.id}`);
        }
      } else {
        console.log(`[TRACKER MANAGER] No game window found for ${character.playerName} and no active window`);
        return;
      }
    }

    // Marquer ce personnage comme actif pour cette fenêtre (même s'il n'a pas de trackers)
    this.setActiveCharacterForWindow(gameWindow.id, character);

    // Vérifier si cette classe a des trackers configurés
    const classConfig = getClassConfig(character.className);
    if (!classConfig || !classConfig.availableTrackerTypes || classConfig.availableTrackerTypes.length === 0) {
      console.log(`[TRACKER MANAGER] No trackers configured for class ${character.className}, nothing to show`);
      return;
    }

    const autoShow = getAutoShowTrackers(character.className);
    const autoCreateButHide = getAutoCreateButHideTrackers(character.className);
    console.log(`[TRACKER MANAGER] Auto show trackers:`, autoShow);
    console.log(`[TRACKER MANAGER] Auto create but hide:`, autoCreateButHide);

    // Si aucun tracker à afficher automatiquement, ne rien faire
    if (autoShow.length === 0 && autoCreateButHide.length === 0) {
      console.log(`[TRACKER MANAGER] No trackers to show or create for ${character.className}, skipping`);
      return;
    }

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
        
        // Positionner immédiatement
        this.positionTrackerOnGameWindow(window, character, trackerType);
        const currentBounds = window.getBounds();
        const gameBounds = gameWindow.bounds;
        const expectedX = gameBounds.x + gameBounds.width - currentBounds.width - 10;
        const expectedY = gameBounds.y + 10;
        this.lastTrackerPositions.set(trackerId, { x: expectedX, y: expectedY });
        
        if (window.webContents.isLoading()) {
          console.log(`[TRACKER MANAGER] Tracker ${trackerType} is loading, waiting for did-finish-load`);
          window.webContents.once("did-finish-load", () => {
            // Vérifier que la fenêtre existe toujours dans la Map et n'est pas détruite
            const stillExists = WindowManager.getWindow(trackerId);
            if (stillExists && !stillExists.isDestroyed()) {
              console.log(`[TRACKER MANAGER] Tracker ${trackerType} finished loading, sending events`);
              // Repositionner après le chargement
              this.positionTrackerOnGameWindow(stillExists, character, trackerType);
              WindowManager.safeSendToWindow(stillExists, IPC_EVENTS.COMBAT_STARTED);
              // Mettre à jour la visibilité immédiatement après l'affichage
              setTimeout(() => {
                WindowManager.safeSendToWindow(stillExists, IPC_EVENTS.REFRESH_UI);
                // Forcer la mise à jour de position immédiatement
                this.updateTrackersVisibility(true);
              }, 50);
            }
          });
        } else {
          console.log(`[TRACKER MANAGER] Tracker ${trackerType} already loaded, sending events immediately`);
          WindowManager.safeSendToWindow(window, IPC_EVENTS.COMBAT_STARTED);
          // Mettre à jour la visibilité immédiatement après l'affichage
          setTimeout(() => {
            WindowManager.safeSendToWindow(window, IPC_EVENTS.REFRESH_UI);
            // Forcer la mise à jour de position immédiatement
            this.updateTrackersVisibility(true);
          }, 50);
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

  /**
   * Cache les trackers d'un personnage à la fin de son tour
   * Ne cache que les trackers configurés pour s'afficher automatiquement
   * Nettoie aussi le personnage actif même s'il n'a pas de trackers
   */
  static hideTrackersOnTurnEnd(character: Character): void {
    console.log(`[TRACKER MANAGER] hideTrackersOnTurnEnd called for ${character.playerName} (${character.className})`);
    
    // Vérifier si cette classe a des trackers configurés
    const classConfig = getClassConfig(character.className);
    if (classConfig && classConfig.availableTrackerTypes && classConfig.availableTrackerTypes.length > 0) {
      // Ne cacher que les trackers qui sont configurés pour s'afficher automatiquement
      const autoShow = getAutoShowTrackers(character.className);
      for (const trackerType of autoShow) {
        const trackerId = this.getTrackerId(
          character.className,
          character.playerName,
          trackerType
        );
        const window = WindowManager.getWindow(trackerId);
        if (window && !window.isDestroyed() && window.isVisible()) {
          window.hide();
          console.log(`[TRACKER MANAGER] Hiding tracker ${trackerType} for ${character.playerName}`);
        }
      }
    } else {
      console.log(`[TRACKER MANAGER] No trackers configured for class ${character.className}, nothing to hide`);
    }
    
    // Nettoyer le personnage actif pour cette fenêtre (même s'il n'a pas de trackers)
    const gameWindow = GameWindowManager.getWindowForCharacter(character);
    if (gameWindow) {
      this.activeCharactersByWindow.delete(gameWindow.id);
      console.log(`[TRACKER MANAGER] Cleared active character for window ${gameWindow.id}`);
    }
  }
}

