/**
 * Chargement des icônes pour le tracker Cra
 */

export class IconLoader {
  static loadIcons(): void {
    // Utiliser les assets globaux depuis dist/assets/
    // Chemin relatif depuis dist/renderer/trackers/cra/ vers dist/assets/classes/cra/
    const affutageIcon = document.getElementById("affutage-icon");
    const precisionIcon = document.getElementById("precision-icon");
    const pointeIcon = document.getElementById("pointe-icon");
    const baliseIcon = document.getElementById("balise-icon");
    const flecheLumineuseIcon = document.getElementById("fleche-lumineuse-icon");
    const tirPrecisIcon = document.getElementById("tir-precis-icon");

    if (affutageIcon) {
      (affutageIcon as HTMLImageElement).src =
        "../../../assets/classes/cra/Affûtage.png";
    }
    if (precisionIcon) {
      (precisionIcon as HTMLImageElement).src =
        "../../../assets/classes/cra/Précision.png";
    }
    if (pointeIcon) {
      (pointeIcon as HTMLImageElement).src =
        "../../../assets/classes/cra/Pointe.png";
    }
    if (baliseIcon) {
      (baliseIcon as HTMLImageElement).src =
        "../../../assets/classes/cra/balise.png";
    }
    if (flecheLumineuseIcon) {
      (flecheLumineuseIcon as HTMLImageElement).src =
        "../../../assets/classes/cra/Flèche lumineuse.png";
    }
    if (tirPrecisIcon) {
      (tirPrecisIcon as HTMLImageElement).src =
        "../../../assets/classes/cra/précis.png";
    }
  }
}

