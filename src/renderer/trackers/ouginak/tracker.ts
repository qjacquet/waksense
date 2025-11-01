/**
 * Ouginak Tracker - Suivi des ressources Ouginak en temps réel
 * Basé sur wakfu_ouginak_resource_tracker.py
 */

import { setupTrackerEventListeners, updateProgressBar } from '../../core/ui-helpers.js';

interface TimelineEntry {
  spell: string;
  cost: string;
  icon?: string;
}

class OuginakTracker {
  private rage: number = 0;
  private ougigarouActive: boolean = false;
  private trackedPlayerName: string | null = null;
  private isOuginakTurn: boolean = false;
  private overlayVisible: boolean = false;
  private inCombat: boolean = false;
  private lastSpellCaster: string | null = null;
  
  private timelineEntries: TimelineEntry[] = [];
  private readonly timelineMaxSlots: number = 5;

  // Liste des sorts Ouginak
  private readonly ouginakSpells: string[] = [
    "Emeute", "Émeute", "Fleau", "Fléau", "Rupture", "Plombage",
    "Balafre", "Croc-en-jambe", "Bastonnade", "Molosse", "Hachure",
    "Saccade", "Balayage", "Contusion", "Cador", "Brise'Os", "Brise'O",
    "Baroud", "Chasseur", "Elan", "Élan", "Canine", "Apaisement",
    "Poursuite", "Meute", "Proie", "Ougigarou", "Chienchien"
  ];

  // Mapping des coûts de sorts (pour affichage)
  private readonly spellCostMap: Map<string, string> = new Map([
    ["Emeute", "3PA"], ["Émeute", "3PA"],
    ["Fléau", "4PA"], ["Fleau", "4PA"],
    ["Rupture", "2PA"],
    ["Plombage", "3PA"],
    ["Balafre", "5PA"],
    ["Croc-en-jambe", "2PA"],
    ["Bastonnade", "3PA"],
    ["Molosse", "4PA"],
    ["Hachure", "3PA"],
    ["Saccade", "4PA"],
    ["Balayage", "4PA"],
    ["Contusion", "3PA"],
    ["Cador", "3PA"],
    ["Brise'Os", "2PA"], ["Brise'O", "2PA"],
    ["Baroud", "6PA"],
    ["Chasseur", "2PA"],
    ["Elan", "1PA"], ["Élan", "1PA"],
    ["Canine", "3PA"],
    ["Apaisement", "2PA"],
    ["Poursuite", "3PA"],
    ["Meute", "1PW"],
    ["Proie", "1PW"],
    ["Chienchien", "3PA"],
    ["Ougigarou", "2PA2PW"]
  ]);

  // Mapping des coûts de rage en mode Ougigarou (PA + PM + PW)
  private readonly spellRageCostMap: Map<string, number> = new Map([
    ["Emeute", 3], ["Émeute", 3],
    ["Fléau", 5], ["Fleau", 5], // 4 PA + 1 PW
    ["Rupture", 2],
    ["Plombage", 3],
    ["Balafre", 5],
    ["Croc-en-jambe", 2],
    ["Bastonnade", 4], // 3 PA + 1 PW
    ["Molosse", 4],
    ["Hachure", 3],
    ["Saccade", 4],
    ["Balayage", 4],
    ["Contusion", 3],
    ["Cador", 4], // 3 PA + 1 PW
    ["Brise'Os", 2], ["Brise'O", 2],
    ["Baroud", 7] // 6 PA + 1 PW
    // Note: Chasseur, Elan, Élan, Canine, Apaisement, Poursuite, Meute, Proie, Chienchien ne consomment PAS de rage
  ]);

  constructor() {
    this.setupEventListeners();
    this.updateUI();
    this.updateTimeline();
  }

  private setupEventListeners(): void {
    setupTrackerEventListeners(
      (line: string, parsed: any) => this.processLogLine(line, parsed),
      () => this.resetResources()
    );
  }

  private resetResources(): void {
    this.rage = 0;
    this.ougigarouActive = false;
    this.isOuginakTurn = false;
    this.overlayVisible = false;
    this.inCombat = false;
    this.trackedPlayerName = null;
    this.lastSpellCaster = null;
    this.timelineEntries = [];
    this.updateUI();
    this.updateTimeline();
  }

  private processLogLine(line: string, parsed: any): void {
    // Vérifier que c'est une ligne de combat
    if (!line.includes("[Information (combat)]")) {
      return;
    }

    // Parse Rage gain - Format: "X Rage (Traqueur)"
    const rageMatch = line.match(/(\d+)\s+Rage\s*\(Traqueur\)/);
    if (rageMatch) {
      const rageGained = parseInt(rageMatch[1], 10);
      this.rage = Math.min(30, this.rage + rageGained);
      this.updateUI();
      return;
    }

    // Détection du début de combat
    if (line.includes("lance le sort")) {
      this.inCombat = true;

      // Extraire le nom du joueur et du sort
      if (parsed.isSpellCast && parsed.spellCast) {
        const casterName = parsed.spellCast.playerName;
        const spellName = parsed.spellCast.spellName;

        this.lastSpellCaster = casterName;

        // Vérifier si c'est un sort Ouginak (recherche partielle comme en Python)
        const isOuginakSpell = this.ouginakSpells.some(spell => {
          const normalizedSpell = spell.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const normalizedSpellName = spellName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          return normalizedSpellName.includes(normalizedSpell) || normalizedSpell.includes(normalizedSpellName);
        });

        if (isOuginakSpell) {
          // Définir le joueur tracké au premier sort Ouginak
          if (this.trackedPlayerName === null) {
            this.trackedPlayerName = casterName;
          }

          // Afficher l'overlay si le joueur Ouginak tracké lance un sort
          if (casterName === this.trackedPlayerName) {
            this.isOuginakTurn = true;
            this.overlayVisible = true;

            // Ajouter à la timeline
            this.addSpellToTimeline(spellName);

            // Vérifier la consommation de rage en mode Ougigarou
            if (this.ougigarouActive && casterName === this.trackedPlayerName) {
              const rageCost = this.spellRageCostMap.get(spellName) || 0;
              if (rageCost > 0) {
                this.rage = Math.max(0, this.rage - rageCost);

                // Vérifier si la rage atteint 0 (sortir du mode Ougigarou)
                if (this.rage <= 0) {
                  this.ougigarouActive = false;
                }
                this.updateUI();
              }
            }
          }
        }
      }
    }

    // Détection de l'activation Ougigarou
    if (line.includes("Ougigarou (Niv.")) {
      const ougiMatch = line.match(/\[Information \(combat\)\] ([^:]+): Ougigarou/);
      if (ougiMatch && ougiMatch[1].trim() === this.trackedPlayerName) {
        this.ougigarouActive = true;
        this.updateUI();
      }
    }

    // Détection de la désactivation Ougigarou
    if (line.includes("n'est plus sous l'emprise de 'Ougigarou' (Rage consommée)")) {
      this.ougigarouActive = false;
      this.updateUI();
    }

    // Détection de fin de tour
    if (line.includes("secondes reportées pour le tour suivant") || 
        line.includes("reportées pour le tour suivant")) {
      const turnOwner = this.lastSpellCaster;

      if (turnOwner && this.trackedPlayerName && turnOwner === this.trackedPlayerName) {
        this.isOuginakTurn = false;
        this.overlayVisible = false;
      }
    }

    // Détection de fin de combat
    if (line.includes("Combat terminé, cliquez ici pour rouvrir l'écran de fin de combat.")) {
      this.inCombat = false;
      this.isOuginakTurn = false;
      this.overlayVisible = false;
      this.trackedPlayerName = null;
      this.rage = 0;
      this.ougigarouActive = false;
      this.timelineEntries = [];
      this.updateUI();
      this.updateTimeline();
    }
  }

  private addSpellToTimeline(spellName: string): void {
    // Déterminer le coût à afficher : coût de rage si Ougigarou actif, sinon coût normal
    let displayCost: string;
    if (this.ougigarouActive && this.spellRageCostMap.has(spellName)) {
      const rageCost = this.spellRageCostMap.get(spellName) || 0;
      displayCost = rageCost > 0 ? `${rageCost}RG` : "";
    } else {
      // Afficher le coût normal - seulement le premier coût
      const cost = this.spellCostMap.get(spellName) || "?PA";
      displayCost = cost;
    }

    const entry: TimelineEntry = {
      spell: spellName,
      cost: displayCost
    };

    // Ajouter et limiter à N dernières entrées
    this.timelineEntries.push(entry);
    if (this.timelineEntries.length > this.timelineMaxSlots) {
      this.timelineEntries = this.timelineEntries.slice(-this.timelineMaxSlots);
    }

    this.updateTimeline();
  }

  private updateTimeline(): void {
    const timelineContainer = document.getElementById('timeline-container');
    if (!timelineContainer) {
      return;
    }

    timelineContainer.innerHTML = '';

    // Afficher les entrées de la plus récente à la plus ancienne (de gauche à droite)
    for (let i = this.timelineEntries.length - 1; i >= 0; i--) {
      const entry = this.timelineEntries[i];
      const index = this.timelineEntries.length - 1 - i;

      if (index < this.timelineMaxSlots) {
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';

        // Icône du sort (pour l'instant texte, peut être amélioré avec des images)
        const iconDiv = document.createElement('div');
        iconDiv.className = 'timeline-icon';
        iconDiv.textContent = '🐺'; // Placeholder, peut être remplacé par une image
        timelineItem.appendChild(iconDiv);

        // Coût du sort
        const costDiv = document.createElement('div');
        costDiv.className = 'timeline-cost';
        costDiv.textContent = entry.cost;
        
        // Ajouter une classe pour la couleur selon le type de ressource
        if (entry.cost.includes('RG')) {
          costDiv.classList.add('cost-rage');
        } else if (entry.cost.includes('PA')) {
          costDiv.classList.add('cost-pa');
        } else if (entry.cost.includes('PM')) {
          costDiv.classList.add('cost-pm');
        } else if (entry.cost.includes('PW')) {
          costDiv.classList.add('cost-pw');
        }
        
        timelineItem.appendChild(costDiv);

        timelineContainer.appendChild(timelineItem);
      }
    }
  }

  private updateUI(): void {
    // Mettre à jour la barre de rage (0-30)
    updateProgressBar('rage-fill', 'rage-value', this.rage, 30, (current, max) => `${current}/${max}`);

    // Mettre à jour le style en mode Ougigarou
    const rageFill = document.getElementById('rage-fill');
    const trackerContainer = document.getElementById('tracker-container');
    
    if (rageFill && trackerContainer) {
      if (this.ougigarouActive) {
        rageFill.classList.add('ougarou-active');
        trackerContainer.classList.add('ougarou-mode');
      } else {
        rageFill.classList.remove('ougarou-active');
        trackerContainer.classList.remove('ougarou-mode');
      }
    }

    // Afficher/masquer l'overlay selon la visibilité
    if (trackerContainer) {
      if (this.overlayVisible && this.inCombat) {
        trackerContainer.style.display = 'block';
      } else {
        trackerContainer.style.display = 'none';
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OuginakTracker();
});
