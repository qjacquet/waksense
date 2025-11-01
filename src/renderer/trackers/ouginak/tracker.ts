/**
 * Ouginak Tracker - Suivi des ressources Ouginak en temps réel
 */

import { setupTrackerEventListeners, updateProgressBar } from '../../core/ui-helpers';

class OuginakTracker {
  private rage: number = 0;

  constructor() {
    this.setupEventListeners();
    this.updateUI();
  }

  private setupEventListeners(): void {
    setupTrackerEventListeners((line: string, parsed: any) => {
      this.processLogLine(line, parsed);
    });
  }

  private processLogLine(line: string, parsed: any): void {
    if (line.includes('Rage') || line.includes('rage')) {
      this.parseRage(line);
    }
  }

  private parseRage(line: string): void {
    const match = line.match(/Rage[:\s]*(\d+)\/(\d+)/i);
    if (match) {
      this.rage = parseInt(match[1], 10);
      this.updateUI();
    }
  }

  private updateUI(): void {
    updateProgressBar('rage-fill', 'rage-value', this.rage, 30, (current, max) => `${current}/${max}`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OuginakTracker();
});

