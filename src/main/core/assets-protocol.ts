/**
 * Assets Protocol - Configuration du protocole personnalisé pour les assets
 */

import { app, protocol } from "electron";
import * as fs from "fs";
import * as path from "path";

/**
 * Configure le protocole personnalisé "assets://" pour servir les fichiers assets
 */
export function setupAssetsProtocol(): void {
  protocol.registerFileProtocol("assets", (request, callback) => {
    try {
      // Extraire le chemin depuis l'URL (assets://classes/cra/Affûtage.png)
      // request.url sera "assets://classes/cra/Aff%C3%BBtage.png" (URL encodée)
      const urlObj = new URL(request.url);
      // Décoder l'URL pour gérer les caractères spéciaux (accents)
      const decodedPath = decodeURIComponent(urlObj.pathname);
      // Enlever le slash initial si présent
      const cleanPath = decodedPath.startsWith("/")
        ? decodedPath.slice(1)
        : decodedPath;

      // Obtenir le chemin vers les assets
      // Les assets sont maintenant dans dist/assets/ (copiés par copy-assets)
      // En développement : app.getAppPath() pointe vers dist/
      // En production : app.getAppPath() pointe vers le dossier de l'application
      const appPath = app.getAppPath();
      // Les assets sont toujours dans dist/assets/ ou dans le dossier app/assets/
      const assetsBasePath = appPath.endsWith("dist")
        ? path.join(appPath, "assets")
        : path.join(appPath, "assets");

      const filePath = path.join(assetsBasePath, cleanPath);

      // Vérifier que le fichier existe
      if (fs.existsSync(filePath)) {
        callback({ path: filePath });
      } else {
        console.error(`[ASSETS] File not found: ${filePath}`);
        console.error(`[ASSETS] Request URL: ${request.url}`);
        console.error(`[ASSETS] App path: ${appPath}`);
        console.error(`[ASSETS] Assets base: ${assetsBasePath}`);
        callback({ error: -6 }); // FILE_NOT_FOUND error code
      }
    } catch (error) {
      console.error(`[ASSETS] Error handling request: ${request.url}`, error);
      callback({ error: -2 }); // FAILED error code
    }
  });
}

