/**
 * Game Window Manager - Gère la détection et le suivi de toutes les fenêtres Wakfu
 */

import activeWin from "active-win";
import { PATTERNS } from "../../shared/constants/patterns";
import { Config } from "./config";

export interface GameWindow {
  id: string; // Identifiant unique basé sur le titre ou le handle
  title: string;
  owner: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isFullscreen: boolean;
  isActive: boolean;
  character?: {
    playerName: string;
    className: string;
  };
}

export class GameWindowManager {
  private static windows: Map<string, GameWindow> = new Map();
  private static activeWindowId: string | null = null;
  private static checkInterval: NodeJS.Timeout | null = null;
  private static checkIntervalMs: number = 300; // Vérifier toutes les 300ms pour une détection plus rapide
  private static detectedCharacters: Map<string, { className: string; playerName: string }> = new Map();
  private static lastActiveCharacterFromLogs: { playerName: string; className: string } | null = null;
  private static lastCharacterFromLogsTimestamp: number = 0; // Timestamp de la dernière mise à jour depuis les logs
  private static lastSuccessfulDetection: { windowId: string; timestamp: number } | null = null;
  private static detectionFailureCount: number = 0;

  /**
   * Démarre la surveillance de toutes les fenêtres Wakfu
   */
  static start(): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(() => {
      this.updateWindows();
    }, this.checkIntervalMs);

    this.updateWindows();
  }

  /**
   * Arrête la surveillance
   */
  static stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.windows.clear();
    this.activeWindowId = null;
  }

  /**
   * Met à jour la liste des fenêtres détectées
   */
  private static async updateWindows(): Promise<void> {
    try {
      // Détecter la fenêtre active
      const activeWindow = await activeWin();
      
      if (activeWindow) {
        const title = activeWindow.title || "";
        const owner = activeWindow.owner?.name || "";
        
        const isWakfuWindow = 
          title.toLowerCase().includes(PATTERNS.WAKFU_WINDOW_KEYWORD) || 
          owner.toLowerCase().includes(PATTERNS.WAKFU_WINDOW_KEYWORD);

        if (isWakfuWindow) {
          const windowId = this.getWindowId(title, owner, activeWindow.bounds);
          
          // Détecter le fullscreen de manière plus précise
          // En fullscreen, la fenêtre couvre généralement tout l'écran
          const screen = require("electron").screen;
          const primaryDisplay = screen.getPrimaryDisplay();
          const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
          
          // Considérer comme fullscreen si la fenêtre couvre au moins 95% de l'écran
          const isFullscreen = 
            activeWindow.bounds.width >= screenWidth * 0.95 &&
            activeWindow.bounds.height >= screenHeight * 0.95 &&
            Math.abs(activeWindow.bounds.x) < 10 &&
            Math.abs(activeWindow.bounds.y) < 10;
          
          // Vérifier si cette fenêtre existe déjà
          const existingWindow = this.windows.get(windowId);
          
          // Vérifier si on change de fenêtre (windowId différent de la dernière détection)
          const windowChanged = this.activeWindowId && this.activeWindowId !== windowId;
          
          // Vérifier si le titre a changé (indique un changement de personnage sur la même fenêtre)
          const titleChanged = existingWindow && existingWindow.title !== title;
          
          // Détecter le personnage : priorité au titre de la fenêtre (source fiable)
          // Les logs sont partagés entre tous les clients, donc on ne peut pas s'y fier quand on change de fenêtre
          let character = this.extractCharacterFromTitle(title);
          
          if (character) {
            console.log(`[GAME WINDOW MANAGER] Character detected from title: ${character.playerName} (${character.className})`);
          } else {
            // Si le titre ne contient pas le personnage détectable
            if (titleChanged) {
              // Le titre a changé, donc le personnage a probablement changé aussi
              // Ne PAS utiliser les logs car ils sont partagés entre tous les clients
              // Effacer l'ancien personnage pour forcer une nouvelle détection depuis le titre
              // (sauf en fullscreen où on ne peut pas lire le titre)
              if (isFullscreen && this.lastActiveCharacterFromLogs) {
                // En fullscreen, on ne peut pas lire le titre, utiliser les logs comme fallback
                character = this.lastActiveCharacterFromLogs;
                console.log(`[GAME WINDOW MANAGER] Title changed from "${existingWindow?.title}" to "${title}" (fullscreen), using character from logs: ${character.playerName} (${character.className})`);
              } else {
                // Titre changé mais on ne peut pas détecter le nouveau personnage, effacer l'ancien
                console.log(`[GAME WINDOW MANAGER] Title changed from "${existingWindow?.title}" to "${title}", clearing old character to force new detection`);
                character = null;
              }
            } else if (existingWindow?.character) {
              // Le titre n'a pas changé, garder le personnage existant
              character = existingWindow.character;
              console.log(`[GAME WINDOW MANAGER] Keeping existing character for window: ${character.playerName} (${character.className})`);
            } else {
              // La fenêtre n'a pas encore de personnage associé
              // Utiliser les logs seulement si :
              // 1. On est en fullscreen (titre non lisible)
              // 2. On ne change pas de fenêtre (sinon on garde le personnage de l'autre fenêtre)
              if (this.lastActiveCharacterFromLogs && isFullscreen && !windowChanged) {
                character = this.lastActiveCharacterFromLogs;
                console.log(`[GAME WINDOW MANAGER] Using character from logs (fullscreen, no existing character, same window): ${character.playerName} (${character.className})`);
              } else if (windowChanged && existingWindow?.character) {
                // On change de fenêtre, garder le personnage de cette fenêtre si elle en a un
                character = existingWindow.character;
                console.log(`[GAME WINDOW MANAGER] Window changed, keeping character for this window: ${character.playerName} (${character.className})`);
              } else {
                console.log(`[GAME WINDOW MANAGER] No character detected from title "${title}", no existing character, no logs available`);
              }
            }
          }
          
          // Mettre à jour ou créer la fenêtre active
          const gameWindow: GameWindow = {
            id: windowId,
            title,
            owner,
            bounds: activeWindow.bounds,
            isFullscreen,
            isActive: true,
            character: character || existingWindow?.character || undefined,
          };

          // Marquer toutes les autres fenêtres comme non actives
          for (const [id, window] of this.windows.entries()) {
            if (id !== windowId) {
              window.isActive = false;
            }
          }

          this.windows.set(windowId, gameWindow);
          this.activeWindowId = windowId;
          this.lastSuccessfulDetection = { windowId, timestamp: Date.now() };
          this.detectionFailureCount = 0; // Réinitialiser le compteur d'échecs
          
          console.log(`[GAME WINDOW MANAGER] Active window: ${windowId}, character: ${gameWindow.character ? `${gameWindow.character.playerName} (${gameWindow.character.className})` : 'none'}`);

          // Essayer de détecter d'autres fenêtres Wakfu en arrière-plan
          // Note: active-win ne peut détecter que la fenêtre active
          // Pour détecter toutes les fenêtres, il faudrait utiliser une bibliothèque native
          // Pour l'instant, on se contente de la fenêtre active
        } else {
          // Si la fenêtre active n'est pas Wakfu, marquer toutes les fenêtres comme non actives
          // MAIS garder les fenêtres en mémoire avec leur personnage associé
          this.detectionFailureCount++;
          
          // Si on a détecté une fenêtre récemment, ne pas la supprimer immédiatement
          // (peut arriver si on clique sur l'overlay ou une autre fenêtre)
          if (this.lastSuccessfulDetection && 
              Date.now() - this.lastSuccessfulDetection.timestamp < 3000 && // Dernière détection il y a moins de 3s
              this.detectionFailureCount < 10) { // Moins de 10 échecs consécutifs
            // Garder la dernière fenêtre active connue
            const lastWindow = this.windows.get(this.lastSuccessfulDetection.windowId);
            if (lastWindow) {
              lastWindow.isActive = false; // Marquer comme non active mais garder en mémoire
            }
            // Ne pas changer activeWindowId pour garder la référence
            console.log(`[GAME WINDOW MANAGER] Non-Wakfu window active, keeping last known window (failures: ${this.detectionFailureCount})`);
          } else {
            // Trop d'échecs ou trop de temps écoulé, vraiment désactiver
            for (const [id, window] of this.windows.entries()) {
              window.isActive = false;
            }
            this.activeWindowId = null;
          }
        }
      } else {
        // Aucune fenêtre active détectée (peut arriver si on clique ailleurs ou si activeWin() échoue)
        this.detectionFailureCount++;
        
        // Si on a détecté une fenêtre récemment, ne pas la supprimer immédiatement
        if (this.lastSuccessfulDetection && 
            Date.now() - this.lastSuccessfulDetection.timestamp < 3000 && // Dernière détection il y a moins de 3s
            this.detectionFailureCount < 10) { // Moins de 10 échecs consécutifs
          // Garder la dernière fenêtre active connue
          const lastWindow = this.windows.get(this.lastSuccessfulDetection.windowId);
          if (lastWindow) {
            lastWindow.isActive = false; // Marquer comme non active mais garder en mémoire
          }
          // Ne pas changer activeWindowId pour garder la référence
          console.log(`[GAME WINDOW MANAGER] No window detected, keeping last known window (failures: ${this.detectionFailureCount})`);
        } else {
          // Trop d'échecs ou trop de temps écoulé, vraiment désactiver
          for (const [id, window] of this.windows.entries()) {
            window.isActive = false;
          }
          this.activeWindowId = null;
        }
      }
    } catch (error) {
      console.error("[GAME WINDOW MANAGER] Error updating windows:", error);
    }
  }

  /**
   * Génère un ID unique pour une fenêtre basé sur son titre et sa position
   */
  private static getWindowId(title: string, owner: string, bounds: { x: number; y: number; width: number; height: number }): string {
    // Utiliser la position comme identifiant principal pour différencier les fenêtres
    // Deux fenêtres Wakfu auront des positions différentes même si le titre est similaire
    // Format: wakfu-{x}-{y}-{width}-{height}
    // Cela permet de distinguer deux clients même s'ils ont le même personnage
    return `wakfu-${bounds.x}-${bounds.y}-${bounds.width}-${bounds.height}`;
  }

  /**
   * Extrait le nom du personnage et la classe depuis le titre de la fenêtre
   */
  private static extractCharacterFromTitle(title: string): { playerName: string; className: string } | null {
    const titleLower = title.toLowerCase();
    
    // D'abord, chercher dans les personnages détectés en combat
    for (const [key, detection] of this.detectedCharacters.entries()) {
      const playerNameLower = detection.playerName.toLowerCase();
      
      if (titleLower.includes(playerNameLower)) {
        Config.saveCharacter(detection.className, detection.playerName);
        console.log(`[GAME WINDOW MANAGER] Found character "${detection.playerName}" in title "${title}" from detectedCharacters`);
        return { playerName: detection.playerName, className: detection.className };
      }
    }

    // Ensuite, chercher dans les personnages sauvegardés
    const savedCharacters = Config.getSavedCharacters();
    let activePlayerName: string | null = null;
    let activeClassName: string | null = null;

    for (const [className, playerNames] of Object.entries(savedCharacters)) {
      for (const playerName of playerNames) {
        const playerNameLower = playerName.toLowerCase();
        
        if (titleLower.includes(playerNameLower)) {
          activePlayerName = playerName;
          activeClassName = className;
          break;
        }
      }
      if (activePlayerName) {
        break;
      }
    }

    if (activePlayerName && activeClassName) {
      console.log(`[GAME WINDOW MANAGER] Found character "${activePlayerName}" in title "${title}" from savedCharacters`);
      return { playerName: activePlayerName, className: activeClassName };
    }

    console.log(`[GAME WINDOW MANAGER] No character found in title "${title}" (detectedCharacters: ${this.detectedCharacters.size}, savedCharacters: ${Object.keys(savedCharacters).length})`);
    return null;
  }

  /**
   * Définit les personnages détectés en combat
   * Tous les personnages joueurs détectés sont ajoutés, même ceux sans trackers
   */
  static setDetectedCharacters(characters: Map<string, { className: string; playerName: string }>): void {
    this.detectedCharacters = characters;
    console.log(`[GAME WINDOW MANAGER] setDetectedCharacters: ${characters.size} characters detected`);
    // Sauvegarder automatiquement tous les personnages détectés (même ceux sans trackers)
    for (const [key, character] of characters.entries()) {
      console.log(`[GAME WINDOW MANAGER]   - ${character.playerName} (${character.className})`);
      Config.saveCharacter(character.className, character.playerName);
    }
  }

  /**
   * Définit le personnage actif détecté depuis les logs du jeu
   * Cette méthode est appelée quand un tour commence dans les logs
   * 
   * NOTE: Les logs sont partagés entre tous les clients, donc on ne peut pas
   * associer automatiquement ce personnage à une fenêtre spécifique.
   * On l'utilise comme fallback quand on ne peut pas détecter depuis le titre.
   */
  static setActiveCharacterFromLogs(character: { playerName: string; className: string } | null): void {
    const hasChanged = !this.lastActiveCharacterFromLogs || 
      this.lastActiveCharacterFromLogs.playerName !== character?.playerName ||
      this.lastActiveCharacterFromLogs.className !== character?.className;
    
    this.lastActiveCharacterFromLogs = character;
    if (hasChanged && character) {
      this.lastCharacterFromLogsTimestamp = Date.now();
    }
    console.log(`[GAME WINDOW MANAGER] setActiveCharacterFromLogs: ${character ? `${character.playerName} (${character.className})` : 'null'}`);
    
    // Ne pas associer automatiquement aux fenêtres car les logs sont partagés
    // On l'utilise comme fallback quand on ne peut pas détecter depuis le titre
  }

  /**
   * Obtient la fenêtre active
   * Retourne la dernière fenêtre connue si la détection a échoué récemment
   */
  static getActiveWindow(): GameWindow | null {
    if (this.activeWindowId) {
      const window = this.windows.get(this.activeWindowId);
      if (window) {
        return window;
      }
    }
    
    // Si pas de fenêtre active mais qu'on a une dernière détection récente, la retourner
    if (this.lastSuccessfulDetection) {
      const timeSinceLastDetection = Date.now() - this.lastSuccessfulDetection.timestamp;
      if (timeSinceLastDetection < 3000) { // Dernière détection il y a moins de 3s
        const lastWindow = this.windows.get(this.lastSuccessfulDetection.windowId);
        if (lastWindow) {
          return lastWindow;
        }
      }
    }
    
    return null;
  }

  /**
   * Obtient toutes les fenêtres Wakfu détectées
   */
  static getAllWindows(): Map<string, GameWindow> {
    return this.windows;
  }

  /**
   * Obtient la fenêtre associée à un personnage
   */
  static getWindowForCharacter(character: { playerName: string; className: string }): GameWindow | null {
    for (const [id, window] of this.windows.entries()) {
      if (
        window.character &&
        window.character.playerName === character.playerName &&
        window.character.className === character.className
      ) {
        return window;
      }
    }
    return null;
  }

  /**
   * Obtient toutes les fenêtres pour un personnage donné
   */
  static getWindowsForCharacter(character: { playerName: string; className: string }): GameWindow[] {
    const windows: GameWindow[] = [];
    for (const [id, window] of this.windows.entries()) {
      if (
        window.character &&
        window.character.playerName === character.playerName &&
        window.character.className === character.className
      ) {
        windows.push(window);
      }
    }
    return windows;
  }
}

