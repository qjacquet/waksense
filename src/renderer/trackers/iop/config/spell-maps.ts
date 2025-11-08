/**
 * Configuration des sorts et coûts pour le tracker Iop
 */

export const SPELL_COST_MAP: Map<string, string> = new Map([
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
  ["Charge", "1PA"],
]);

export const DAMAGE_SPELLS: Set<string> = new Set([
  "Épée céleste",
  "Fulgur",
  "Super Iop Punch",
  "Jugement",
  "Colère de Iop",
  "Ébranler",
  "Roknocerok",
  "Fendoir",
  "Ravage",
  "Jabs",
  "Rafale",
  "Torgnole",
  "Tannée",
  "Épée de Iop",
  "Uppercut",
  "Charge",
  "Éventrail",
]);

export const EGARE_SPELLS: string[] = ["Fulgur", "Colère de Iop"];

export const INITIAL_PUISSANCE = 30;
export const MAX_PUISSANCE = 50;
export const PUISSANCE_LOSS_ON_ISOLATION = 10;

