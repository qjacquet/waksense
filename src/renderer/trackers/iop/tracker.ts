/**
 * Iop Tracker - Suivi des ressources Iop en temps réel
 */

interface ResourceState {
  pa: number;
  pm: number;
  pw: number;
  concentration: number;
}

interface TimelineEntry {
  spell: string;
  cost: string;
  icon?: string;
}

class IopTracker {
  private resources: ResourceState = {
    pa: 0,
    pm: 0,
    pw: 0,
    concentration: 0
  };

  private timeline: TimelineEntry[] = [];
  private maxTimelineEntries = 5;

  constructor() {
    this.setupEventListeners();
    this.updateUI();
  }

  private setupEventListeners(): void {
    if (!window.electronAPI) {
      console.error('window.electronAPI is not available!');
      return;
    }
    
    // Écouter les nouvelles lignes de logs
    window.electronAPI.onLogLine((line: string, parsed: any) => {
      this.processLogLine(line, parsed);
    });
  }

  private processLogLine(line: string, parsed: any): void {
    // Parser les lignes pour détecter les changements de ressources
    // PA/PM/PW
    if (line.includes('PA') || line.includes('PM') || line.includes('PW')) {
      this.parseResources(line);
    }

    // Concentration
    if (line.includes('Concentration') || line.includes('concentration')) {
      this.parseConcentration(line);
    }

    // Sorts lancés
    if (parsed.isSpellCast && parsed.spellCast) {
      this.addTimelineEntry(parsed.spellCast);
    }
  }

  private parseResources(line: string): void {
    // Exemple: "Belluzu a maintenant 6 PA, 4 PM, 2 PW"
    const paMatch = line.match(/(\d+)\s+PA/i);
    const pmMatch = line.match(/(\d+)\s+PM/i);
    const pwMatch = line.match(/(\d+)\s+PW/i);

    if (paMatch) {
      this.resources.pa = parseInt(paMatch[1], 10);
    }
    if (pmMatch) {
      this.resources.pm = parseInt(pmMatch[1], 10);
    }
    if (pwMatch) {
      this.resources.pw = parseInt(pwMatch[1], 10);
    }

    this.updateUI();
  }

  private parseConcentration(line: string): void {
    // Exemple: "Concentration: 45/100"
    const match = line.match(/Concentration[:\s]+(\d+)\/(\d+)/i);
    if (match) {
      this.resources.concentration = parseInt(match[1], 10);
      this.updateUI();
    }
  }

  private addTimelineEntry(spellCast: { playerName: string; spellName: string }): void {
    // Extraire le coût du sort (simplifié pour l'instant)
    const cost = this.getSpellCost(spellCast.spellName);

    const entry: TimelineEntry = {
      spell: spellCast.spellName,
      cost: cost
    };

    this.timeline.unshift(entry);

    // Limiter le nombre d'entrées
    if (this.timeline.length > this.maxTimelineEntries) {
      this.timeline = this.timeline.slice(0, this.maxTimelineEntries);
    }

    this.updateTimeline();
  }

  private getSpellCost(spellName: string): string {
    // Mapping simplifié des coûts (à compléter avec la logique complète)
    const costMap: { [key: string]: string } = {
      'Jugement': '1PA',
      'Épée céleste': '2PA',
      'Fulgur': '3PA',
      'Super Iop Punch': '4PA'
    };

    return costMap[spellName] || '?';
  }

  private updateUI(): void {
    // Mettre à jour les barres PA/PM/PW (max supposé: 6 PA, 6 PM, 6 PW)
    this.updateBar('pa', this.resources.pa, 6);
    this.updateBar('pm', this.resources.pm, 6);
    this.updateBar('pw', this.resources.pw, 6);

    // Mettre à jour Concentration (max: 100)
    this.updateBar('concentration', this.resources.concentration, 100);
  }

  private updateBar(type: string, current: number, max: number): void {
    const fill = document.getElementById(`${type}-fill`);
    const value = document.getElementById(`${type}-value`);

    if (fill) {
      const percentage = max > 0 ? (current / max) * 100 : 0;
      fill.style.width = `${percentage}%`;
    }

    if (value) {
      if (type === 'concentration') {
        value.textContent = `${current}/100`;
      } else {
        value.textContent = current.toString();
      }
    }
  }

  private updateTimeline(): void {
    const timelineContainer = document.getElementById('timeline');
    if (!timelineContainer) {
      return;
    }

    timelineContainer.innerHTML = '';

    this.timeline.forEach(entry => {
      const entryElement = document.createElement('div');
      entryElement.className = 'timeline-entry';
      entryElement.innerHTML = `
        <span>${entry.spell}</span>
        <span class="timeline-cost">${entry.cost}</span>
      `;
      timelineContainer.appendChild(entryElement);
    });
  }
}

// Initialiser le tracker quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
  new IopTracker();
});

