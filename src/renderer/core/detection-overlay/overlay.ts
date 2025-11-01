/**
 * Detection Overlay - Overlay transparent pour afficher les classes détectées
 */

import { ClassType } from '../types/index.js';

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
    this.classesContainer = document.getElementById('classes-container');

    if (!this.classesContainer) {
      console.error('[OVERLAY] Classes container not found!');
    }
  }

  private setupEventListeners(): void {
    if (window.electronAPI && window.electronAPI.onClassDetected) {
      window.electronAPI.onClassDetected((detection) => {
        this.addDetectedClass(detection.className as ClassType, detection.playerName);
      });
    } else {
      console.error('[OVERLAY] window.electronAPI or onClassDetected not available!');
    }
  }

  private async loadAlreadyDetectedClasses(): Promise<void> {
    try {
      if (window.electronAPI && window.electronAPI.getDetectedClasses) {
        const alreadyDetected = await window.electronAPI.getDetectedClasses();
        
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
    
    if (this.detectedClasses.has(buttonKey)) {
      return;
    }

    this.detectedClasses.set(buttonKey, {
      className,
      playerName,
      buttonKey
    });

    this.createClassButton(className, playerName, buttonKey);

    document.body.style.display = 'block';
  }

  private createClassButton(className: ClassType, playerName: string, buttonKey: string): void {
    if (!this.classesContainer) {
      console.error('[OVERLAY] Classes container not found');
      return;
    }

    const container = document.createElement('div');
    container.className = 'class-item';
    container.dataset.buttonKey = buttonKey;

    const icon = document.createElement('span');
    icon.className = 'class-icon';
    icon.textContent = className === 'Iop' ? '⚔' : className === 'Cra' ? '🏹' : '🐕';

    const name = document.createElement('span');
    name.className = 'class-name';
    name.textContent = playerName;
    name.classList.add(`class-${className.toLowerCase()}`);

    const button = document.createElement('button');
    button.className = 'class-button';
    button.appendChild(icon);
    button.appendChild(name);

    button.addEventListener('click', () => {
      this.launchTracker(className, playerName);
    });

    container.appendChild(button);
    this.classesContainer.appendChild(container);
  }

  private async launchTracker(className: ClassType, playerName: string): Promise<void> {
    try {
      if (window.electronAPI && window.electronAPI.createTracker) {
        await window.electronAPI.createTracker(className, playerName);
      }
    } catch (error) {
      console.error('[OVERLAY] Error launching tracker:', error);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new DetectionOverlay();
});

