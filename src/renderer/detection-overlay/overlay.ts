/**
 * Detection Overlay - Overlay transparent pour afficher les classes détectées
 */

// ClassType est défini dans src/renderer/types.d.ts

interface DetectedClass {
  className: ClassType;
  playerName: string;
  buttonKey: string;
}

class DetectionOverlay {
  private detectedClasses: Map<string, DetectedClass> = new Map();
  private classesContainer: HTMLElement | null = null;

  constructor() {
    this.initializeUI();
    this.setupEventListeners();
    this.loadAlreadyDetectedClasses();
  }

  private initializeUI(): void {
    console.log('[OVERLAY] Initializing UI...');
    
    this.classesContainer = document.getElementById('classes-container');

    if (!this.classesContainer) {
      console.error('[OVERLAY] ❌ Classes container not found!');
    } else {
      console.log('[OVERLAY] ✅ Classes container found');
    }

    console.log('[OVERLAY] Detection overlay initialized');
  }

  private setupEventListeners(): void {
    console.log('[OVERLAY] Setting up event listeners...');
    console.log('[OVERLAY] window.electronAPI exists?', !!window.electronAPI);
    console.log('[OVERLAY] window.electronAPI.onClassDetected exists?', !!(window.electronAPI && window.electronAPI.onClassDetected));
    
    // Écouter les détections de classes
    if (window.electronAPI && window.electronAPI.onClassDetected) {
      console.log('[OVERLAY] Registering onClassDetected listener...');
      window.electronAPI.onClassDetected((detection) => {
        console.log('[OVERLAY] ✅✅✅ Class detected event received:', detection);
        this.addDetectedClass(detection.className as ClassType, detection.playerName);
      });
      console.log('[OVERLAY] ✅ onClassDetected listener registered');
    } else {
      console.error('[OVERLAY] ❌ window.electronAPI or onClassDetected not available!');
    }

    console.log('[OVERLAY] Event listeners attached');
  }

  private async loadAlreadyDetectedClasses(): Promise<void> {
    try {
      if (window.electronAPI && window.electronAPI.getDetectedClasses) {
        const alreadyDetected = await window.electronAPI.getDetectedClasses();
        console.log('[OVERLAY] Loaded already detected classes:', alreadyDetected);
        
        if (alreadyDetected && alreadyDetected.length > 0) {
          for (const detection of alreadyDetected) {
            this.addDetectedClass(detection.className as ClassType, detection.playerName);
          }
        }
      }
    } catch (error) {
      console.error('[OVERLAY] Error loading already detected classes:', error);
    }
  }

  private addDetectedClass(className: ClassType, playerName: string): void {
    const buttonKey = `${className}_${playerName}`;
    
    // Vérifier si la classe existe déjà
    if (this.detectedClasses.has(buttonKey)) {
      console.log(`[OVERLAY] Class ${buttonKey} already exists`);
      return;
    }

    console.log(`[OVERLAY] Adding class: ${className} / ${playerName}`);

    // Stocker la classe
    this.detectedClasses.set(buttonKey, {
      className,
      playerName,
      buttonKey
    });

    // Créer le bouton
    this.createClassButton(className, playerName, buttonKey);

    // Afficher l'overlay si elle est cachée
    document.body.style.display = 'block';
  }

  private createClassButton(className: ClassType, playerName: string, buttonKey: string): void {
    if (!this.classesContainer) {
      console.error('[OVERLAY] Classes container not found');
      return;
    }

    // Créer le conteneur du bouton
    const container = document.createElement('div');
    container.className = 'class-item';
    container.dataset.buttonKey = buttonKey;

    // Créer l'icône (emoji pour l'instant)
    const icon = document.createElement('span');
    icon.className = 'class-icon';
    icon.textContent = className === 'Iop' ? '⚔' : className === 'Cra' ? '🏹' : '🐕';

    // Créer le nom
    const name = document.createElement('span');
    name.className = 'class-name';
    name.textContent = playerName;
    name.classList.add(`class-${className.toLowerCase()}`);

    // Créer le bouton cliquable
    const button = document.createElement('button');
    button.className = 'class-button';
    button.appendChild(icon);
    button.appendChild(name);

    button.addEventListener('click', () => {
      this.launchTracker(className, playerName);
    });

    container.appendChild(button);
    this.classesContainer.appendChild(container);

    console.log(`[OVERLAY] Button created for ${buttonKey}`);
  }

  private async launchTracker(className: ClassType, playerName: string): Promise<void> {
    try {
      console.log(`[OVERLAY] Launching tracker: ${className} / ${playerName}`);
      if (window.electronAPI && window.electronAPI.createTracker) {
        await window.electronAPI.createTracker(className, playerName);
      }
    } catch (error) {
      console.error('[OVERLAY] Error launching tracker:', error);
    }
  }
}

// Initialiser l'overlay quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
  new DetectionOverlay();
});

