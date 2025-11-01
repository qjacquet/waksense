# Waksense - Version Electron/TypeScript

Migration de l'application Waksense vers Electron/TypeScript.

## 🚀 Installation

### Prérequis
- Node.js 18+ et npm
- TypeScript (installé via npm)

### Installation des dépendances
```bash
npm install
```

## 📦 Build

### Compilation TypeScript
```bash
npm run build
```

### Build en mode watch (développement)
```bash
npm run build:watch
```

## ▶️ Lancement

### Mode développement
```bash
npm run dev
```

### Mode production
```bash
npm start
```

## 🏗️ Structure du projet

```
src/
├── main/              # Processus principal Electron
│   ├── main.ts        # Point d'entrée
│   ├── log-monitor.ts # Surveillance des logs
│   ├── window-manager.ts # Gestion des fenêtres
│   ├── config.ts      # Configuration
│   └── preload.ts     # Script preload (bridge IPC)
├── renderer/          # Processus de rendu
│   ├── launcher/      # Interface principale
│   └── trackers/      # Trackers par classe
│       ├── iop/
│       ├── cra/
│       └── ouginak/
└── shared/            # Code partagé
    ├── log-deduplicator.ts
    ├── log-parser.ts
    └── class-detector.ts
```

## 🎯 Fonctionnalités

- ✅ Surveillance des logs Wakfu en temps réel
- ✅ Détection automatique des classes (Iop, Cra, Ouginak)
- ✅ Déduplication des logs (gestion multi-instances)
- ✅ Launcher principal avec interface moderne
- ✅ Sauvegarde persistante des personnages
- ✅ Overlays transparents repositionnables

## 📝 TODO

- [ ] Migrer le tracker Iop
- [ ] Migrer le tracker Cra
- [ ] Migrer le tracker Ouginak
- [ ] Créer les composants UI réutilisables (barres de progression)
- [ ] Ajouter la détection de fenêtre active (Wakfu)
- [ ] Package avec electron-builder

## 🔧 Développement

Les fichiers TypeScript sont compilés dans le dossier `dist/`. 
Les fichiers HTML/CSS/JS du renderer sont copiés directement.

Pour lancer en mode développement :
```bash
npm run dev
```

Cela lance :
1. TypeScript en mode watch
2. Electron automatiquement quand la compilation est prête

