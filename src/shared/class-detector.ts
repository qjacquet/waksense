/**
 * Détecteur de classes basé sur les sorts lancés
 */

export type ClassType = 'Iop' | 'Cra' | 'Ouginak';

export class ClassDetector {
  private static readonly IOP_SPELLS = [
    'Épée céleste',
    'Fulgur',
    'Super Iop Punch',
    'Jugement',
    'Colère de Iop',
    'Ébranler',
    'Roknocerok',
    'Fendoir',
    'Ravage',
    'Jabs',
    'Rafale',
    'Torgnole',
    'Tannée',
    'Épée de Iop',
    'Bond',
    'Focus',
    'Éventrail',
    'Uppercut'
  ];

  private static readonly CRA_SPELLS = [
    'Flèche criblante',
    'Flèche fulminante',
    'Flèche d\'immolation',
    'Flèche enflammée',
    'Flèche Ardente',
    'Flèche explosive',
    'Flèche cinglante',
    'Flèche perçante',
    'Flèche destructrice',
    'Flèche chercheuse',
    'Flèche de recul',
    'Flèche tempête',
    'Flèche harcelante',
    'Flèche statique',
    'Balise de destruction',
    'Balise d\'alignement',
    'Balise de contact',
    'Tir précis',
    'Débalisage',
    'Eclaireur',
    'Flèche lumineuse',
    'Pluie de flèches',
    'Roulade'
  ];

  private static readonly OUGINAK_SPELLS = [
    'Emeute',
    'Émeute',
    'Fleau',
    'Fléau',
    'Rupture',
    'Plombage',
    'Balafre',
    'Croc-en-jambe',
    'Bastonnade',
    'Molosse',
    'Hachure',
    'Saccade',
    'Balayage',
    'Contusion',
    'Cador',
    'Brise\'Os',
    'Brise\'O',
    'Baroud',
    'Chasseur',
    'Elan',
    'Élan',
    'Canine',
    'Apaisement',
    'Poursuite',
    'Meute',
    'Proie',
    'Ougigarou',
    'Chienchien'
  ];

  /**
   * Détecte la classe d'un personnage basée sur le nom du sort
   * @param spellName Nom du sort lancé
   * @returns Le type de classe ou null si non détecté
   */
  static detectClass(spellName: string): ClassType | null {
    // Normaliser le nom du sort (supprimer les accents pour comparaison plus robuste)
    const normalizedSpell = this.normalizeString(spellName);
    
    // Vérifier les sorts Iop
    for (const spell of this.IOP_SPELLS) {
      const normalized = this.normalizeString(spell);
      if (normalizedSpell.includes(normalized)) {
        return 'Iop';
      }
    }
    
    // Vérifier les sorts Cra
    for (const spell of this.CRA_SPELLS) {
      const normalized = this.normalizeString(spell);
      if (normalizedSpell.includes(normalized)) {
        return 'Cra';
      }
    }
    
    // Vérifier les sorts Ouginak
    for (const spell of this.OUGINAK_SPELLS) {
      const normalized = this.normalizeString(spell);
      if (normalizedSpell.includes(normalized)) {
        return 'Ouginak';
      }
    }
    
    return null;
  }

  /**
   * Normalise une chaîne pour la comparaison (supprime les accents)
   */
  private static normalizeString(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /**
   * Obtient tous les sorts pour une classe donnée
   */
  static getSpellsForClass(classType: ClassType): string[] {
    switch (classType) {
      case 'Iop':
        return [...this.IOP_SPELLS];
      case 'Cra':
        return [...this.CRA_SPELLS];
      case 'Ouginak':
        return [...this.OUGINAK_SPELLS];
      default:
        return [];
    }
  }
}

