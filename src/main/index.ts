/**
 * Main Process - Point d'entrée principal de l'application Electron
 */

import { app, BrowserWindow, protocol } from "electron";
import * as fs from "fs";
import * as path from "path";
import { CombatStartInfo } from "../shared/log/log-processor";
import { Config } from "./core/config";
import { ClassDetection, LogMonitor } from "./core/log-monitor";
import { TrackerManager } from "./core/tracker-manager";
import { WindowWatcher } from "./core/window-watcher";
import { setupIpcHandlers } from "./handlers/ipc.handlers";
import { WindowManager } from "./windows/window-manager";
import { CombatHandler } from "./core/combat-handler";
import { FighterMappings } from "./core/fighter-mappings";
import { setupAssetsProtocol } from "./core/assets-protocol";
import { IPC_EVENTS } from "../shared/constants/ipc-events";
import { PATTERNS } from "../shared/constants/patterns";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "assets",
    privileges: {
      standard: true,
      secure: true,
      corsEnabled: true,
      supportFetchAPI: true,
    },
  },
]);

let launcherWindow: BrowserWindow | null = null;
let logMonitor: LogMonitor | null = null;
let combatLogMonitor: LogMonitor | null = null;
let windowWatcher: WindowWatcher | null = null;

const detectedClasses: Map<string, ClassDetection> = new Map();
const playerNameToFighterId: Map<string, number> = new Map();
const fighterIdToFighter: Map<number, CombatStartInfo["fighters"][0]> =
  new Map();

function hideAllJauges(): void {
  TrackerManager.hideAllTrackersGlobally();
}

function ensureLogMonitoring(): void {
  const logPath = Config.getLogPath() || Config.getDefaultLogPath();

  if (!logMonitor) {
    startLogMonitoring(Config.getLogFilePath(logPath));
  }

  if (!combatLogMonitor) {
    startCombatLogMonitoring(Config.getCombatLogFilePath(logPath));
  }
}

function createLauncherWindow(): void {
  launcherWindow = WindowManager.createLauncherWindow();

  launcherWindow.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      console.log(
        `[LAUNCHER RENDERER ${level}]: ${message} (${sourceId}:${line})`
      );
    }
  );

  launcherWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[LAUNCHER] Failed to load: ${errorCode} - ${errorDescription} - ${validatedURL}`
      );
    }
  );

  launcherWindow.loadFile(
    path.join(__dirname, "..", "renderer", "core", "launcher", "index.html")
  );

  launcherWindow.on("closed", () => {
    launcherWindow = null;
  });
}

app.whenReady().then(() => {
  setupAssetsProtocol();

  createLauncherWindow();

  windowWatcher = new WindowWatcher();
  
  windowWatcher.setOnCharacterChanged((character) => {
    hideAllJauges();
    
    if (character && CombatHandler.isInCombat()) {
      TrackerManager.showTrackersOnTurnStart(character);
    }
  });
  
  windowWatcher.start();

  setupIpcHandlers(
    launcherWindow,
    () => logMonitor, // Passer une fonction qui retourne le logMonitor actuel
    detectedClasses,
    ensureLogMonitoring,
    startLogMonitoring,
    stopLogMonitoring
  );

  if (launcherWindow) {
    launcherWindow.webContents.once("did-finish-load", () => {
      const alreadyDetected = Array.from(detectedClasses.values());
      for (const detection of alreadyDetected) {
        WindowManager.safeSendToWindow(
          launcherWindow,
          IPC_EVENTS.CLASS_DETECTED,
          detection
        );
      }

      const savedLogsDir = Config.getLogPath();
      let logFilePath: string;

      if (savedLogsDir) {
        logFilePath = Config.getLogFilePath(savedLogsDir);
      } else {
        logFilePath = Config.getDefaultLogPath();
      }

      if (fs.existsSync(logFilePath)) {
        startLogMonitoring(logFilePath);
        launcherWindow?.webContents.send("monitoring-started");
      } else {
        launcherWindow?.webContents.send("log-file-not-found");
      }
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLauncherWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (windowWatcher) {
    windowWatcher.stop();
    windowWatcher = null;
  }
  
  if (process.platform !== "darwin") {
    stopLogMonitoring();
    app.quit();
  }
});

app.on("before-quit", () => {
  if (windowWatcher) {
    windowWatcher.stop();
    windowWatcher = null;
  }
  
  stopLogMonitoring();
  WindowManager.closeAll();
});

function startCombatLogMonitoring(logFilePath: string): void {
  if (combatLogMonitor) {
    combatLogMonitor.stop();
  }

  combatLogMonitor = new LogMonitor(logFilePath, true);

  combatLogMonitor.on("combatStarted", (combatInfo?: CombatStartInfo) => {
    if (combatInfo) {
      CombatHandler.handleCombatStarted(
        combatInfo,
        launcherWindow,
        detectedClasses,
        playerNameToFighterId,
        fighterIdToFighter,
        logMonitor,
        windowWatcher
      );
    }
  });

  combatLogMonitor.on(
    "fighterJoined",
    (data: {
      fightId: number;
      fighter: {
        playerName: string;
        breed: number;
        className: string | null;
        fighterId?: number;
      };
    }) => {
      CombatHandler.handleFighterJoined(
        data,
        launcherWindow,
        detectedClasses,
        playerNameToFighterId,
        fighterIdToFighter,
        logMonitor,
        windowWatcher
      );
    }
  );

  combatLogMonitor.on("combatEnded", (fightId?: number) => {
    CombatHandler.handleCombatEnded(
      fightId,
      launcherWindow,
      windowWatcher,
      playerNameToFighterId,
      fighterIdToFighter
    );
  });

  combatLogMonitor.start();
}

function startLogMonitoring(logFilePath: string): void {
  if (logMonitor) {
    logMonitor.stop();
  }

  logMonitor = new LogMonitor(logFilePath, true);

  logMonitor.on("classDetected", (detection: ClassDetection) => {
    const key = `${detection.className}_${detection.playerName}`;
    detectedClasses.set(key, detection);

    WindowManager.safeSendToWindow(launcherWindow, IPC_EVENTS.CLASS_DETECTED, detection);
  });

  logMonitor.on(
    "turnStarted",
    (data: {
      fighterId: number;
      fighter: { playerName: string; className: string | null };
    }) => {
      if (!data.fighter || !data.fighter.className) {
        return;
      }

      const activeCharacter = {
        playerName: data.fighter.playerName,
        className: data.fighter.className,
      };

      TrackerManager.showTrackersOnTurnStart(activeCharacter);

      ensureLogMonitoring();
    }
  );

  logMonitor.on("turnEnded", () => {
    // Le WindowWatcher gère la fin/début de tour
  });

  logMonitor.on("logLine", (line: string, parsed: any) => {
    const trackerWindows = WindowManager.getAllWindows();

    trackerWindows.forEach((window, id) => {
      if (id.startsWith(PATTERNS.TRACKER_ID_PREFIX)) {
        const sent = WindowManager.safeSendToWindow(
          window,
          IPC_EVENTS.LOG_LINE,
          line,
          parsed
        );
        if (!sent) {
          console.error(`[MAIN] Failed to send log to tracker: ${id}`);
        }
      }
    });
  });

  logMonitor.start();
}

function stopLogMonitoring(): void {
  if (logMonitor) {
    logMonitor.stop();
    logMonitor = null;
  }
  if (combatLogMonitor) {
    combatLogMonitor.stop();
    combatLogMonitor = null;
  }
}

function openDebugWindow(): void {
  WindowManager.createDebugWindow();
}

export {
  createLauncherWindow,
  openDebugWindow,
  startCombatLogMonitoring,
  startLogMonitoring,
  stopLogMonitoring,
};
