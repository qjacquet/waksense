/**
 * Configuration des sorts et coûts pour le tracker Cra
 */

export const SPELL_CONSUMPTION_MAP: { [key: string]: number } = {
  "Flèche criblante": 60,
  "Flèche fulminante": 45,
  "Flèche d'immolation": 30,
  "Flèche enflammée": 60,
  "Flèche ardente": 30,
  "Flèche Ardente": 30,
  "Pluie de flèches": 60,
  "Pluie de fleches": 60,
  "Flèche explosive": 90,
  "Flèche cinglante": 45,
  "Flèche perçante": 75,
  "Flèche destructrice": 105,
  "Flèche chercheuse": 30,
  "Flèche de recul": 60,
  "Flèche tempête": 45,
  "Flèche harcelante": 45,
  "Flèche statique": 90,
};

export const CRA_SPELLS: string[] = [
  "Flèche",
  "Balise",
  "Tir",
  "Arc",
  "Cible"
];

export const BALISE_SPELLS: string[] = [
  "Balise de destruction",
  "Balise d'alignement",
  "Balise de contact"
];

export const MAX_POINTE_STACKS = 3;
export const MAX_BALISE_STACKS = 3;
export const MAX_FLECHE_LUMINEUSE_STACKS = 5;
export const PRECISION_MAX_DEFAULT = 300;
export const PRECISION_MAX_ESPRIT_AFFUTE = 200;
export const MAX_RECENT_PRECISION_GAINS = 5;

