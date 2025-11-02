/**
 * Wakfu Domain - Domaine métier Wakfu
 * Détection de classes et données des sorts
 */

export type ClassType = 'Iop' | 'Cra' | 'Ouginak';

/**
 * Mapping des numéros de breed vers les classes
 * Les breeds sont les identifiants numériques des classes dans Wakfu
 */
export const BREED_TO_CLASS_MAP: Map<number, ClassType> = new Map([
  [8, 'Iop'],
  [9, 'Cra'],
  // Note: Les autres numéros de breed peuvent être ajoutés au fur et à mesure
  // breed 11 = Ouginak (approximatif)
  // breed 12 = ? (à identifier selon les logs)
  // Ces valeurs sont à confirmer avec les logs réels
]);

/**
 * Convertit un numéro de breed en classe
 */
export function breedToClass(breed: number): ClassType | null {
  return BREED_TO_CLASS_MAP.get(breed) || null;
}

/**
 * Détecteur de classes basé sur les sorts lancés
 */
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
   */
  static detectClass(spellName: string): ClassType | null {
    const normalizedSpell = this.normalizeString(spellName);
    
    for (const spell of this.IOP_SPELLS) {
      const normalized = this.normalizeString(spell);
      if (normalizedSpell.includes(normalized)) {
        return 'Iop';
      }
    }
    
    for (const spell of this.CRA_SPELLS) {
      const normalized = this.normalizeString(spell);
      if (normalizedSpell.includes(normalized)) {
        return 'Cra';
      }
    }
    
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

/**
 * Données partagées pour les sorts Iop
 */
export const IOP_SPELL_COST_MAP = new Map<string, string>([
  ["Épée céleste", "2PA"],
  ["Fulgur", "3PA"],
  ["Super Iop Punch", "4PA"],
  ["Jugement", "1PA"],
  ["Colère de Iop", "6PA"],
  ["Ébranler", "2PA"],
  ["Roknocerok", "4PA"],
  ["Fendoir", "3PA"],
  ["Ravage", "5PA"],
  ["Jabs", "3PA"],
  ["Rafale", "1PA"],
  ["Torgnole", "2PA"],
  ["Tannée", "4PA"],
  ["Épée de Iop", "3PA"],
  ["Bond", "4PA"],
  ["Focus", "2PA"],
  ["Éventrail", "1PM"],
  ["Uppercut", "1PW"],
  ["Amplification", "2PM"],
  ["Duel", "1PA"],
  ["Étendard de bravoure", "3PA"],
  ["Vertu", "2PA"],
  ["Charge", "1PA"]
]);

export const IOP_SPELL_ICON_MAP = new Map<string, string>([
  ["Épée céleste", "epeeceleste.png"],
  ["Fulgur", "fulgur.png"],
  ["Super Iop Punch", "superioppunch.png"],
  ["Jugement", "jugement.png"],
  ["Colère de Iop", "colere.png"],
  ["Ébranler", "ebranler.png"],
  ["Roknocerok", "roknocerok.png"],
  ["Fendoir", "fendoir.png"],
  ["Ravage", "ravage.png"],
  ["Jabs", "jabs.png"],
  ["Rafale", "rafale.png"],
  ["Torgnole", "torgnole.png"],
  ["Tannée", "tannee.png"],
  ["Épée de Iop", "Epeeduiop.png"],
  ["Bond", "Bond.png"],
  ["Focus", "Focus.png"],
  ["Éventrail", "eventrail.png"],
  ["Uppercut", "uppercut.png"],
  ["Amplification", "Amplification.png"],
  ["Duel", "Duel.png"],
  ["Étendard de bravoure", "Etandard.png"],
  ["Vertu", "Vertu.png"],
  ["Charge", "charge.png"]
]);

