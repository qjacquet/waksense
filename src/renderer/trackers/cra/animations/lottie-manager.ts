/**
 * Gestionnaire d'animations Lottie pour Tir précis
 */

export class LottieManager {
  private tirPrecisLottieContainer: HTMLElement | null = null;
  private tirPrecisLottieAnimation: any = null;
  private tirPrecisRollbackHandler: (() => void) | null = null;

  constructor() {
    this.tirPrecisLottieContainer = document.getElementById("tir-precis-lottie-container");
  }

  async loadTirPrecis(): Promise<void> {
    if (!this.tirPrecisLottieContainer) {
      return;
    }

    // Attendre que lottie soit disponible (chargé depuis le CDN)
    let retries = 0;
    while (typeof (window as any).lottie === "undefined" && retries < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    // Vérifier que lottie est disponible
    if (typeof (window as any).lottie === "undefined") {
      console.error("Lottie n'est pas disponible après le chargement. Vérifiez que le script est chargé.");
      return;
    }

    // Si l'animation est déjà chargée, ne pas la recharger
    if (this.tirPrecisLottieAnimation) {
      this.tirPrecisLottieContainer.style.display = "block";

      // Vérifier si l'animation est déjà à l'état actif (50%)
      const totalFrames = this.tirPrecisLottieAnimation.totalFrames;
      const halfFrame = Math.floor(totalFrames * 0.5);
      const currentFrame = this.tirPrecisLottieAnimation.currentFrame;

      // Si l'animation est déjà à 50% ou proche, ne pas la relancer
      if (Math.abs(currentFrame - halfFrame) <= 2) {
        return;
      }

      // Retirer tous les handlers existants
      if (this.tirPrecisRollbackHandler) {
        this.tirPrecisLottieAnimation.removeEventListener('enterFrame', this.tirPrecisRollbackHandler);
        this.tirPrecisRollbackHandler = null;
      }

      // Réinitialiser à 0% et jouer jusqu'à 50%
      this.tirPrecisLottieAnimation.goToAndStop(0, true);
      this.tirPrecisLottieAnimation.setSpeed(1.5);

      // Créer le handler pour arrêter à 50%
      const forwardCompleteHandler = () => {
        if (!this.tirPrecisLottieAnimation) return;

        const currentFrame = this.tirPrecisLottieAnimation.currentFrame;
        if (currentFrame >= halfFrame) {
          this.tirPrecisLottieAnimation.removeEventListener('enterFrame', forwardCompleteHandler);
          this.tirPrecisRollbackHandler = null;

          this.tirPrecisLottieAnimation.setSpeed(0);
          setTimeout(() => {
            if (this.tirPrecisLottieAnimation) {
              this.tirPrecisLottieAnimation.stop();
              this.tirPrecisLottieAnimation.goToAndStop(halfFrame, true);
            }
          }, 0);
        }
      };

      this.tirPrecisRollbackHandler = forwardCompleteHandler;
      this.tirPrecisLottieAnimation.addEventListener('enterFrame', forwardCompleteHandler);
      this.tirPrecisLottieAnimation.play();

      this.addCrosshairInnerCircleClass();
      return;
    }

    // Afficher le conteneur
    this.tirPrecisLottieContainer.style.display = "block";

    try {
      const lottie = (window as any).lottie;

      console.log("[CRA JAUGE] Chargement du fichier crosshair.json");
      const response = await fetch("../../../assets/classes/cra/crosshair.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const animationData = await response.json();
      console.log("[CRA JAUGE] Données JSON chargées:", animationData);

      this.tirPrecisLottieAnimation = lottie.loadAnimation({
        container: this.tirPrecisLottieContainer,
        renderer: "svg",
        loop: false,
        autoplay: true,
        animationData: animationData
      });

      this.tirPrecisLottieAnimation.setSpeed(1.5);

      const totalFrames = this.tirPrecisLottieAnimation.totalFrames;
      const halfFrame = Math.floor(totalFrames * 0.5);

      const forwardCompleteHandler = () => {
        if (!this.tirPrecisLottieAnimation) return;

        const currentFrame = this.tirPrecisLottieAnimation.currentFrame;
        if (currentFrame >= halfFrame) {
          this.tirPrecisLottieAnimation.removeEventListener('enterFrame', forwardCompleteHandler);
          this.tirPrecisRollbackHandler = null;

          this.tirPrecisLottieAnimation.setSpeed(0);
          setTimeout(() => {
            if (this.tirPrecisLottieAnimation) {
              this.tirPrecisLottieAnimation.stop();
              this.tirPrecisLottieAnimation.goToAndStop(halfFrame, true);
            }
          }, 0);
        }
      };

      this.tirPrecisRollbackHandler = forwardCompleteHandler;
      this.tirPrecisLottieAnimation.addEventListener('enterFrame', forwardCompleteHandler);

      this.addCrosshairInnerCircleClass();

      console.log("[CRA JAUGE] Animation Lottie créée (0% → 50%):", this.tirPrecisLottieAnimation);
    } catch (error) {
      console.error("Erreur lors du chargement de l'animation Lottie de Tir précis:", error);
    }
  }

  stopTirPrecis(): void {
    if (this.tirPrecisLottieAnimation) {
      // Retirer le handler de progression 0-50%
      if (this.tirPrecisRollbackHandler) {
        this.tirPrecisLottieAnimation.removeEventListener('enterFrame', this.tirPrecisRollbackHandler);
        this.tirPrecisRollbackHandler = null;
      }

      // Aller à 50% si on n'y est pas déjà, puis jouer en arrière jusqu'à 0%
      const currentFrame = this.tirPrecisLottieAnimation.currentFrame;
      const totalFrames = this.tirPrecisLottieAnimation.totalFrames;
      const halfFrame = Math.floor(totalFrames * 0.5);

      if (currentFrame < halfFrame) {
        this.tirPrecisLottieAnimation.goToAndStop(halfFrame, true);
      }

      this.tirPrecisLottieAnimation.setSpeed(-1.5);

      const rollbackCompleteHandler = () => {
        if (!this.tirPrecisLottieAnimation) return;

        const frame = this.tirPrecisLottieAnimation.currentFrame;
        if (frame <= 0) {
          this.tirPrecisLottieAnimation.removeEventListener('enterFrame', rollbackCompleteHandler);

          this.tirPrecisLottieAnimation.setSpeed(0);
          setTimeout(() => {
            if (this.tirPrecisLottieAnimation) {
              this.tirPrecisLottieAnimation.stop();
              this.tirPrecisLottieAnimation.goToAndStop(0, true);
              this.tirPrecisLottieAnimation = null;
              this.hideTirPrecisContainer();
            }
          }, 0);
        }
      };

      this.tirPrecisLottieAnimation.addEventListener('enterFrame', rollbackCompleteHandler);
      this.tirPrecisLottieAnimation.play();
      return;
    }

    this.hideTirPrecisContainer();
  }

  private hideTirPrecisContainer(): void {
    if (this.tirPrecisLottieContainer) {
      this.tirPrecisLottieContainer.style.display = "none";
      this.tirPrecisLottieContainer.innerHTML = "";
    }
  }

  private addCrosshairInnerCircleClass(): void {
    if (!this.tirPrecisLottieContainer) {
      return;
    }

    const addClassToCircle = () => {
      const svg = this.tirPrecisLottieContainer?.querySelector('svg');
      if (!svg) return;

      if (svg.querySelector('path.crosshair-inner-circle')) {
        return;
      }

      const paths = svg.querySelectorAll('path');
      let foundCircle = false;

      paths.forEach(path => {
        if (path.classList.contains('crosshair-inner-circle')) {
          return;
        }

        const fill = path.getAttribute('fill');
        if (fill && fill.includes('rgb(33,189,195)')) {
          const d = path.getAttribute('d');
          if (d && d.includes('M') && d.includes('C')) {
            console.log('[CRA JAUGE] Cercle interne trouvé et stylisé:', { fill, d: d.substring(0, 50) });
            path.classList.add('crosshair-inner-circle');
            foundCircle = true;

            const parentGroup = path.closest('g');
            if (parentGroup && !parentGroup.hasAttribute('data-scaled')) {
              const existingTransform = parentGroup.getAttribute('transform') || '';
              parentGroup.setAttribute('transform', `scale(0.6) ${existingTransform}`);
              parentGroup.setAttribute('data-scaled', 'true');
            }
          }
        }
      });

      if (!foundCircle) {
        paths.forEach(path => {
          if (path.classList.contains('crosshair-inner-circle')) {
            return;
          }

          const fill = path.getAttribute('fill');
          if (fill === '#21BDC3' || fill === 'rgb(33, 189, 195)') {
            const d = path.getAttribute('d');
            if (d && d.includes('M') && d.includes('C')) {
              path.classList.add('crosshair-inner-circle');

              const parentGroup = path.closest('g');
              if (parentGroup && !parentGroup.hasAttribute('data-scaled')) {
                const existingTransform = parentGroup.getAttribute('transform') || '';
                parentGroup.setAttribute('transform', `scale(0.6) ${existingTransform}`);
                parentGroup.setAttribute('data-scaled', 'true');
              }
            }
          }
        });
      }
    };

    setTimeout(addClassToCircle, 100);
    setTimeout(addClassToCircle, 300);
  }
}

