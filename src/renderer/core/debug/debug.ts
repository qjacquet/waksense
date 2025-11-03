/**
 * Debug UI - Interface de debug pour prévisualiser les trackers
 */

class DebugUI {
  private trackerSelect: HTMLSelectElement | null = null;
  private previewIframe: HTMLIFrameElement | null = null;
  private previewPlaceholder: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    this.trackerSelect = document.getElementById(
      "tracker-select"
    ) as HTMLSelectElement;
    this.previewIframe = document.getElementById(
      "tracker-preview"
    ) as HTMLIFrameElement;
    this.previewPlaceholder = document.getElementById("preview-placeholder");

    if (!this.trackerSelect || !this.previewIframe) {
      console.error("Debug UI: Required elements not found");
      return;
    }

    this.trackerSelect.addEventListener("change", () =>
      this.handleTrackerChange()
    );
  }

  private handleTrackerChange(): void {
    const selectedValue = this.trackerSelect?.value;

    if (!selectedValue || !this.previewIframe || !this.previewPlaceholder) {
      return;
    }

    // Construire le chemin vers le tracker
    const trackerPath = `../../trackers/${selectedValue}`;

    // Charger le tracker dans l'iframe
    this.previewIframe.src = trackerPath;
    this.previewIframe.style.display = "block";
    this.previewPlaceholder.style.display = "none";

    // Attendre que l'iframe soit chargée pour ajuster la taille si nécessaire
    this.previewIframe.onload = () => {
      try {
        const iframeDocument =
          this.previewIframe?.contentDocument ||
          this.previewIframe?.contentWindow?.document;
        if (iframeDocument) {
          // Ajuster la taille de l'iframe au contenu si nécessaire
          // Note: Cela peut échouer à cause des politiques CORS si les fichiers sont chargés via file://
          // Mais ça devrait fonctionner dans Electron
          const body = iframeDocument.body;
          if (body) {
            const height = Math.max(body.scrollHeight, body.offsetHeight);
            const width = Math.max(body.scrollWidth, body.offsetWidth);
            // Optionnel: ajuster la taille, mais généralement mieux de laisser à 100%
          }
        }
      } catch (error) {
        // Erreur CORS possible, ignorer
        console.log("Could not access iframe content (expected in some cases)");
      }
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new DebugUI();
});
