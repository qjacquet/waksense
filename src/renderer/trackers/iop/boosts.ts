/**
 * Iop Boosts Tracker - Suivi des boosts Iop en temps réel
 * Concentration, Courroux, Puissance, Préparation, Égaré
 */

import { IOP_SPELL_COST_MAP, IOP_SPELL_ICON_MAP } from '../../../shared/iop-spell-data';

class IopBoostsTracker {
  private concentration: number = 0;
  private courroux: number = 0;
  private puissance: number = 0;
  private preparation: number = 0;
  private egare: boolean = false;
  
  private inCombat: boolean = false;
  private trackedPlayerName: string | null = null;
  
  private pendingPreparationLoss: boolean = false;
  private preparationLossCaster: string | null = null;
  private preparationLossSpell: string | null = null;

  // UI Elements
  private concentrationBar: HTMLElement | null = null;
  private concentrationFill: HTMLElement | null = null;
  private concentrationText: HTMLElement | null = null;
  private courrouxSection: HTMLElement | null = null;
  private courrouxCounter: HTMLElement | null = null;
  private puissanceSection: HTMLElement | null = null;
  private egareSection: HTMLElement | null = null;
  private egareIcon: HTMLElement | null = null;
  private preparationSection: HTMLElement | null = null;
  private preparationCounter: HTMLElement | null = null;
  private timelineContainer: HTMLElement | null = null;

  constructor() {
    this.initializeUIElements();
    this.setupEventListeners();
    this.updateUI();
  }

  private initializeUIElements(): void {
    this.concentrationBar = document.getElementById('concentration-bar');
    this.concentrationFill = document.getElementById('concentration-fill');
    this.concentrationText = document.getElementById('concentration-text');
    this.courrouxSection = document.getElementById('courroux-section');
    this.courrouxCounter = document.getElementById('courroux-counter');
    this.puissanceSection = document.getElementById('puissance-section');
    this.egareSection = document.getElementById('egare-section');
    this.egareIcon = document.getElementById('egare-icon');
    this.preparationSection = document.getElementById('preparation-section');
    this.preparationCounter = document.getElementById('preparation-counter');
    this.timelineContainer = document.getElementById('timeline-container');
  }

  private setupEventListeners(): void {
    window.electronAPI.onLogLine((line: string, parsed: any) => {
      // Handle turn end (clear timeline)
      if (line.includes('reportée pour le tour suivant') || line.includes('reportées pour le tour suivant')) {
        this.timelineEntries = [];
        this.updateTimeline();
      }
      
      this.processLogLine(line, parsed);
    });
    
    window.electronAPI.onCombatStarted(() => {
      this.inCombat = true;
    });
    
    window.electronAPI.onCombatEnded(() => {
      this.inCombat = false;
      this.resetResources();
      this.updateUI();
    });
  }

  private processLogLine(line: string, parsed: any): void {
    // Parse Concentration
    this.parseConcentration(line);
    
    // Parse Courroux
    this.parseCourroux(line);
    
    // Parse Puissance
    this.parsePuissance(line);
    
    // Parse Préparation
    this.parsePreparation(line);
    
    // Parse Égaré
    this.parseEgare(line);
    
    // Parse spell consumption
    if (parsed.isSpellCast && parsed.spellCast) {
      this.handleSpellCast(parsed.spellCast, line);
    }
    
    // Parse damage for Préparation consumption
    this.parseDamage(line);
    
    this.updateUI();
  }

  private parseConcentration(line: string): void {
    const concentrationMatch = line.match(/Concentration \(\+(\d+) Niv\.\)/);
    if (concentrationMatch) {
      const concentrationValue = parseInt(concentrationMatch[1], 10);
      
      // Extract player name
      const playerMatch = line.match(/\[Information \(combat\)\] ([^:]+): Concentration/);
      if (playerMatch) {
        this.trackedPlayerName = playerMatch[1].trim();
      }
      
      // Check if concentration reaches 100+ (triggers overflow and égaré loss)
      if (concentrationValue >= 100) {
        this.concentration = concentrationValue % 100;
        if (this.egare) {
          this.egare = false;
        }
      } else {
        this.concentration = concentrationValue;
      }
    }
  }

  private parseCourroux(line: string): void {
    const courrouxGainMatch = line.match(/Courroux \(\+(\d+) Niv\.\) \((Compulsion|Concentration)\)/);
    if (courrouxGainMatch) {
      const courrouxTotal = parseInt(courrouxGainMatch[1], 10);
      this.courroux = Math.min(courrouxTotal, 4);
    }
    
    if (line.includes("n'est plus sous l'emprise de 'Courroux' (Compulsion)")) {
      const playerMatch = line.match(/\[Information \(combat\)\] ([^:]+):/);
      if (playerMatch && playerMatch[1] === this.trackedPlayerName) {
        this.courroux = 0;
      }
    }
    
    // Check for Courroux loss from damage
    if (line.includes('(Courroux)') && line.includes('PV')) {
      this.courroux = 0;
    }
  }

  private parsePuissance(line: string): void {
    const puissanceMatch = line.match(/Puissance \(\+(\d+) Niv\.\)/);
    if (puissanceMatch) {
      const puissanceValue = parseInt(puissanceMatch[1], 10);
      this.puissance = Math.min(puissanceValue, 50);
    }
    
    if (line.includes("n'est plus sous l'emprise de 'Puissance' (Iop isolé)")) {
      const playerMatch = line.match(/\[Information \(combat\)\] ([^:]+):/);
      if (playerMatch && playerMatch[1] === this.trackedPlayerName) {
        this.puissance = Math.max(0, this.puissance - 10);
      }
    }
  }

  private parsePreparation(line: string): void {
    const preparationGainMatch = line.match(/Préparation \(\+(\d+) Niv\.\)/);
    if (preparationGainMatch) {
      const preparationTotal = parseInt(preparationGainMatch[1], 10);
      this.preparation = preparationTotal;
    }
  }

  private parseEgare(line: string): void {
    // Égaré is gained via spells (Fulgur, Colère de Iop) - handled in handleSpellCast
    
    // Égaré loss - turn passing
    if (line.includes('reportée pour le tour suivant') || line.includes('reportées pour le tour suivant')) {
      if (this.egare) {
        this.egare = false;
      }
    }
  }

  private handleSpellCast(spellCast: { playerName: string; spellName: string }, line: string): void {
    if (spellCast.playerName !== this.trackedPlayerName) {
      return;
    }
    
    // Initialize puissance on first spell cast in combat
    if (!this.inCombat) {
      this.inCombat = true;
      this.puissance = 30;
    }
    
    // Handle Courroux loss spells
    if (['Super Iop Punch', 'Roknocerok', 'Tannée'].includes(spellCast.spellName)) {
      this.courroux = 0;
    }
    
    // Handle Préparation loss
    if (this.preparation > 0) {
      this.pendingPreparationLoss = true;
      this.preparationLossCaster = spellCast.playerName;
      this.preparationLossSpell = spellCast.spellName;
    }
    
    // Handle Égaré gain spells
    if (['Fulgur', 'Colère de Iop'].includes(spellCast.spellName)) {
      this.egare = true;
    }
    
    // Add to timeline (only if spell is known)
    if (IOP_SPELL_ICON_MAP.has(spellCast.spellName)) {
      this.addToTimeline(spellCast.spellName);
    }
  }

  private parseDamage(line: string): void {
    if (!this.pendingPreparationLoss) {
      return;
    }
    
    const damageMatch = line.match(/\[Information \(combat\)\] ([^:]+):\s+-(\d+)\s*PV/);
    if (damageMatch && damageMatch[1] === this.preparationLossCaster) {
      this.preparation = 0;
      this.pendingPreparationLoss = false;
      this.preparationLossCaster = null;
      this.preparationLossSpell = null;
    }
  }


  private timelineEntries: Array<{spell: string; cost: string; icon: string; alpha: number; slide: number}> = [];
  private timelineMaxSlots: number = 5;

  private addToTimeline(spellName: string): void {
    const cost = IOP_SPELL_COST_MAP.get(spellName) || '?';
    const iconFileName = IOP_SPELL_ICON_MAP.get(spellName) || '';
    
    const entry = {
      spell: spellName,
      cost: cost,
      icon: iconFileName,
      alpha: 0.0,
      slide: -16
    };
    
    this.timelineEntries.push(entry);
    
    // Keep only last N entries
    if (this.timelineEntries.length > this.timelineMaxSlots) {
      this.timelineEntries = this.timelineEntries.slice(-this.timelineMaxSlots);
    }
    
    this.updateTimeline();
  }

  private updateTimeline(): void {
    if (!this.timelineContainer) return;
    
    // Clear existing timeline entries
    this.timelineContainer.innerHTML = '';
    
    // Display newest to oldest (left to right)
    const entriesToShow = this.timelineEntries.slice(-this.timelineMaxSlots);
    entriesToShow.reverse(); // Reverse to show newest first
    
    for (let i = 0; i < this.timelineMaxSlots; i++) {
      const timelineIcon = document.createElement('div');
      timelineIcon.className = 'timeline-icon';
      timelineIcon.id = `timeline-icon-${i}`;
      
      if (i < entriesToShow.length) {
        const entry = entriesToShow[i];
        const img = document.createElement('img');
        img.src = `img/${entry.icon}`;
        img.alt = entry.spell;
        img.onerror = () => {
          timelineIcon.textContent = '?';
        };
        
        const cost = document.createElement('div');
        cost.className = 'timeline-cost';
        cost.textContent = entry.cost;
        
        timelineIcon.appendChild(img);
        timelineIcon.appendChild(cost);
        timelineIcon.style.opacity = entry.alpha.toString();
      }
      
      this.timelineContainer.appendChild(timelineIcon);
    }
  }

  private resetResources(): void {
    this.concentration = 0;
    this.courroux = 0;
    this.puissance = 0;
    this.preparation = 0;
    this.egare = false;
    this.pendingPreparationLoss = false;
    this.preparationLossCaster = null;
    this.preparationLossSpell = null;
    this.timelineEntries = [];
    this.updateTimeline();
  }

  private updateUI(): void {
    // Update Concentration
    if (this.concentrationFill) {
      const percentage = Math.min((this.concentration / 100) * 100, 100);
      this.concentrationFill.style.width = `${percentage}%`;
    }
    if (this.concentrationText) {
      this.concentrationText.textContent = `${this.concentration}/100`;
    }
    
    // Update Courroux
    if (this.courrouxSection && this.courrouxCounter) {
      if (this.courroux > 0) {
        this.courrouxSection.style.display = 'flex';
        this.courrouxCounter.textContent = this.courroux.toString();
      } else {
        this.courrouxSection.style.display = 'none';
      }
    }
    
    // Update Puissance
    if (this.puissanceSection) {
      const barsToShow = Math.min(5, Math.floor(this.puissance / 10));
      if (barsToShow > 0) {
        this.puissanceSection.style.display = 'flex';
        for (let i = 0; i < 5; i++) {
          const bar = document.getElementById(`puissance-bar-${i}`);
          if (bar) {
            if (i < barsToShow) {
              bar.classList.add('active');
            } else {
              bar.classList.remove('active');
            }
          }
        }
      } else {
        this.puissanceSection.style.display = 'none';
      }
    }
    
    // Update Égaré
    if (this.egareSection && this.egareIcon) {
      if (this.egare && this.inCombat) {
        this.egareSection.style.display = 'flex';
        this.egareIcon.classList.add('visible');
      } else {
        this.egareIcon.classList.remove('visible');
        if (!this.egare) {
          this.egareSection.style.display = 'none';
        }
      }
    }
    
    // Update Préparation
    if (this.preparationSection && this.preparationCounter) {
      if (this.preparation > 0 && this.inCombat) {
        this.preparationSection.style.display = 'flex';
        this.preparationCounter.textContent = this.preparation.toString();
      } else {
        this.preparationSection.style.display = 'none';
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new IopBoostsTracker();
});

