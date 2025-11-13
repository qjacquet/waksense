/**
 * Configuration des trackers par classe
 * Centralise toute la logique spécifique aux classes
 */

export interface TrackerWindowConfig {
  htmlFile: string;
  width: number;
  height: number;
  resizable: boolean;
  rendererName?: string;
}

export interface ClassTrackerConfig {
  className: string;
  trackers: {
    [trackerType: string]: TrackerWindowConfig;
  };
  // Types de trackers disponibles pour cette classe (ex: "jauge", "combos", "main")
  availableTrackerTypes: string[];
  // Types de trackers qui doivent être cachés ensemble (ex: ["jauge", "combos"])
  hideTogether?: string[][];
  // Types de trackers à afficher automatiquement au début du tour (ex: ["jauge", "combos"])
  autoShowOnTurnStart?: string[];
  // Types de trackers à créer mais cacher au début du tour (ex: ["main"])
  autoCreateButHide?: string[];
}

export const CLASS_TRACKER_CONFIGS: Map<string, ClassTrackerConfig> = new Map([
  [
    "cra",
    {
      className: "Cra",
      trackers: {
        jauge: {
          htmlFile: "jauge.html",
          width: 200,
          height: 200,
          resizable: true,
          rendererName: "CRA JAUGE",
        },
      },
      availableTrackerTypes: ["jauge"],
      hideTogether: [["jauge"]],
      autoShowOnTurnStart: ["jauge"], // Afficher la jauge au début du tour
    } as ClassTrackerConfig,
  ],
  [
    "iop",
    {
      className: "Iop",
      trackers: {
        jauge: {
          htmlFile: "jauge.html",
          width: 140,
          height: 200,
          resizable: true,
          rendererName: "IOP JAUGE",
        },
        combos: {
          htmlFile: "combos.html",
          width: 240,
          height: 180,
          resizable: true,
          rendererName: "IOP COMBOS",
        },
      },
      availableTrackerTypes: ["jauge", "combos"],
      hideTogether: [["jauge", "combos"]],
      autoShowOnTurnStart: ["jauge", "combos"], // Afficher jauge et combos au début du tour
    } as ClassTrackerConfig,
  ],
  // Ajouter d'autres classes ici au fur et à mesure
]);

/**
 * Obtient la configuration d'un tracker pour une classe
 */
export function getTrackerConfig(
  className: string,
  trackerType: string
): TrackerWindowConfig | null {
  const classConfig = CLASS_TRACKER_CONFIGS.get(className.toLowerCase());
  if (!classConfig) {
    return null;
  }
  return classConfig.trackers[trackerType] || null;
}

/**
 * Obtient la configuration complète d'une classe
 */
export function getClassConfig(className: string): ClassTrackerConfig | null {
  return CLASS_TRACKER_CONFIGS.get(className.toLowerCase()) || null;
}

/**
 * Vérifie si une classe a un type de tracker spécifique
 */
export function hasTrackerType(className: string, trackerType: string): boolean {
  const classConfig = getClassConfig(className);
  if (!classConfig) {
    return false;
  }
  return classConfig.availableTrackerTypes.includes(trackerType);
}

/**
 * Obtient tous les types de trackers pour une classe
 */
export function getTrackerTypes(className: string): string[] {
  const classConfig = getClassConfig(className);
  return classConfig?.availableTrackerTypes || [];
}

/**
 * Obtient les groupes de trackers à cacher ensemble
 */
export function getHideTogetherGroups(className: string): string[][] {
  const classConfig = getClassConfig(className);
  return classConfig?.hideTogether || [];
}

/**
 * Obtient tous les suffixes de trackers à cacher ensemble (pour hideAllJauges)
 * Note: Exclut "main" car le tracker principal n'a pas de suffixe
 */
export function getAllHideTogetherSuffixes(): Set<string> {
  const suffixes = new Set<string>();
  for (const classConfig of CLASS_TRACKER_CONFIGS.values()) {
    if (classConfig.hideTogether) {
      for (const group of classConfig.hideTogether) {
        for (const trackerType of group) {
          // Le tracker "main" n'a pas de suffixe, on l'exclut
          if (trackerType !== "main" && trackerType !== "") {
            suffixes.add(`-${trackerType}`);
          }
        }
      }
    }
  }
  return suffixes;
}

/**
 * Obtient les trackers à afficher automatiquement au début du tour
 */
export function getAutoShowTrackers(className: string): string[] {
  const classConfig = getClassConfig(className);
  return classConfig?.autoShowOnTurnStart || [];
}

/**
 * Obtient les trackers à créer mais cacher au début du tour
 */
export function getAutoCreateButHideTrackers(className: string): string[] {
  const classConfig = getClassConfig(className);
  return classConfig?.autoCreateButHide || [];
}

