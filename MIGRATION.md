# Guide de Migration Waksense - Python/PyQt6 vers Electron/TypeScript

## ✅ État de la Migration

### Composants Migrés

#### ✅ 1. Infrastructure de Base
- [x] Configuration TypeScript (`tsconfig.json`, `package.json`)
- [x] Structure de dossiers Electron
- [x] Scripts de build et copie des assets

#### ✅ 2. Modules Partagés
- [x] `LogDeduplicator` (TypeScript)
- [x] `LogParser` (TypeScript)
- [x] `ClassDetector` (TypeScript)

#### ✅ 3. Main Process Electron
- [x] `main.ts` - Point d'entrée principal
- [x] `log-monitor.ts` - Surveillance des logs en temps réel
- [x] `window-manager.ts` - Gestion des fenêtres overlay
- [x] `config.ts` - Gestion de la configuration persistante
- [x] `preload.ts` - Bridge IPC sécurisé

#### ✅ 4. Interface Launcher
- [x] HTML/CSS/TypeScript pour le launcher principal
- [x] Détection automatique des classes
- [x] Gestion des personnages sauvegardés
- [x] Sélection du chemin des logs

#### ✅ 5. Structure des Trackers
- [x] Structure de base pour Iop/Cra/Ouginak
- [x] HTML/CSS de base pour chaque tracker
- [x] TypeScript simplifié pour le tracker Iop

### 🔄 À Compléter

#### ⏳ 1. Trackers Complets
- [ ] **Tracker Iop** : Logique complète (concentration, courroux, combos, timeline)
- [ ] **Tracker Cra** : Logique complète (affûtage, précision, balises)
- [ ] **Tracker Ouginak** : Logique complète (rage, mode ougigarou)

#### ⏳ 2. Fonctionnalités Avancées
- [ ] Détection de fenêtre active (Wakfu focus detection)
- [ ] Système de combos Iop avec animations
- [ ] Icônes draggables repositionnables
- [ ] Barres de progression animées (comme dans PyQt6)
- [ ] Timeline complète des sorts avec icônes

#### ⏳ 3. Packaging
- [ ] Configuration electron-builder complète
- [ ] Tests de compilation et packaging
- [ ] Génération d'exécutables Windows

## 📋 Prochaines Étapes

### Pour compléter le tracker Iop :
1. Migrer la logique de parsing complète des ressources
2. Implémenter le système de combos avec animations CSS/Canvas
3. Ajouter les icônes et les images
4. Implémenter la timeline complète avec les coûts dynamiques

### Pour tester l'application :
```bash
# Installation des dépendances
npm install

# Compilation TypeScript
npm run build

# Lancement en mode développement
npm run dev

# Lancement en mode production
npm start
```

## 🎯 Architecture

```
src/
├── main/              # Processus principal Electron
│   ├── main.ts
│   ├── log-monitor.ts
│   ├── window-manager.ts
│   ├── config.ts
│   └── preload.ts
├── renderer/          # Processus de rendu
│   ├── launcher/      # Interface principale ✅
│   └── trackers/      # Trackers par classe
│       ├── iop/       # Structure de base ✅
│       ├── cra/       # Structure de base ✅
│       └── ouginak/   # Structure de base ✅
└── shared/            # Code partagé ✅
    ├── log-deduplicator.ts
    ├── log-parser.ts
    └── class-detector.ts
```

## 🔧 Notes Techniques

### Différences avec Python/PyQt6

1. **Lecture de fichiers** : 
   - Python : `seek()` + `readlines()` en boucle
   - Electron : `fs.statSync()` + `fs.readSync()` avec polling

2. **Interface** :
   - Python : PyQt6 avec widgets natifs
   - Electron : HTML/CSS/TypeScript avec BrowserWindow

3. **Communication** :
   - Python : Signaux PyQt (`pyqtSignal`)
   - Electron : IPC (`ipcMain`/`ipcRenderer`)

4. **Overlays** :
   - Python : `FramelessWindowHint`, `WindowStaysOnTopHint`
   - Electron : `frame: false`, `transparent: true`, `alwaysOnTop: true`

### Avantages de la Migration

- ✅ Écosystème npm/Node plus large
- ✅ DevTools natifs pour le debug
- ✅ Plus simple à distribuer (auto-updater possible)
- ✅ TypeScript pour la sécurité de types
- ✅ Plus moderne et maintenable

