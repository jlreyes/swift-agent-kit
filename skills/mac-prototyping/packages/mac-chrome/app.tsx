"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { MacDock, type DockIconSource, type DockItem } from "./dock.tsx";
import {
  captureMacWindowThumbnail,
  commitMacWindowViewTransition,
  macWindowViewTransitionName,
  type MacWindowThumbnail,
} from "./window-transition.ts";

export type MacWindowState = "open" | "minimized" | "closed";
export type MacAppPresentation = "windowed" | "menuBar";

/** Static app metadata used to render the app registry on the first frame. */
export interface MacAppDefinition {
  readonly id: string;
  readonly name: string;
  readonly icon: DockIconSource;
  readonly dockGroup?: "apps" | "places";
  readonly defaultRunning?: boolean;
  readonly presentation?: MacAppPresentation;
}

export interface MacManagedApp {
  readonly id: string;
  readonly name: string;
  readonly icon: DockIconSource;
  readonly dockGroup: "apps" | "places";
  readonly presentation: MacAppPresentation;
  readonly running: boolean;
  readonly windowIds: readonly string[];
}

export interface MacManagedWindow {
  readonly id: string;
  readonly appId: string;
  readonly label: string;
  readonly state: MacWindowState;
  readonly zoomed: boolean;
  readonly isKeyWindow: boolean;
  readonly zIndex: number;
  readonly thumbnail?: MacWindowThumbnail;
}

export interface MacWindowManagerValue {
  readonly apps: readonly MacManagedApp[];
  readonly windows: readonly MacManagedWindow[];
  readonly keyWindowId: string | null;
  readonly keyAppId: string | null;
  readonly activateApp: (appId: string) => void;
  readonly activateWindow: (windowId: string) => void;
  readonly openWindow: (windowId: string) => void;
  readonly closeWindow: (windowId: string) => void;
  readonly minimizeWindow: (windowId: string) => void;
  readonly restoreWindow: (windowId: string) => void;
  readonly toggleZoom: (windowId: string) => void;
  readonly bringAllToFront: (appId?: string) => void;
  readonly quitApp: (appId: string) => void;
}

type AppRecord = {
  readonly id: string;
  readonly name: string;
  readonly icon: DockIconSource;
  readonly dockGroup: "apps" | "places";
  readonly presentation: MacAppPresentation;
  /** Boot-manifest records outlive mounted component registrations. */
  readonly fromManifest: boolean;
  readonly registrationCount: number;
  readonly registrationOrder: number;
  readonly running: boolean;
};

type WindowRecord = {
  readonly id: string;
  readonly appId: string;
  readonly label: string;
  readonly registrationCount: number;
  readonly registrationOrder: number;
  readonly stackOrder: number;
  readonly state: MacWindowState;
  readonly zoomed: boolean;
  readonly thumbnail?: MacWindowThumbnail;
};

type ManagerState = {
  readonly apps: readonly AppRecord[];
  readonly windows: readonly WindowRecord[];
  readonly nextRegistrationOrder: number;
  readonly nextStackOrder: number;
};

type AppRegistration = {
  readonly id: string;
  readonly name: string;
  readonly icon: DockIconSource;
  readonly dockGroup: "apps" | "places";
  readonly defaultRunning: boolean;
  readonly presentation: MacAppPresentation;
};

type WindowRegistration = {
  readonly id: string;
  readonly appId: string;
  readonly label: string;
  readonly defaultOpen: boolean;
};

interface MacWindowManagerContextValue extends MacWindowManagerValue {
  readonly registerApp: (registration: AppRegistration) => void;
  readonly unregisterApp: (appId: string) => void;
  readonly registerWindow: (registration: WindowRegistration) => void;
  readonly unregisterWindow: (windowId: string) => void;
  readonly updateWindowLabel: (windowId: string, label: string) => void;
  readonly consumeKeyboardWindowFocusIntent: () => boolean;
}

type MacAppContextValue = {
  readonly id: string;
  readonly defaultRunning: boolean;
};

const MacWindowManagerContext = createContext<MacWindowManagerContextValue | null>(null);
const MacAppContext = createContext<MacAppContextValue | null>(null);

const initialState: ManagerState = {
  apps: [],
  windows: [],
  nextRegistrationOrder: 1,
  nextStackOrder: 1,
};

function initialStateFor(apps: readonly MacAppDefinition[]): ManagerState {
  return {
    apps: apps.map((app, index) => ({
      id: app.id,
      name: app.name,
      icon: app.icon,
      dockGroup: app.dockGroup ?? "apps",
      presentation: app.presentation ?? "windowed",
      fromManifest: true,
      registrationCount: 0,
      registrationOrder: index + 1,
      running: app.defaultRunning ?? true,
    })),
    windows: [],
    nextRegistrationOrder: apps.length + 1,
    nextStackOrder: 1,
  };
}

function appIsRunning(state: ManagerState, appId: string) {
  return state.apps.find((app) => app.id === appId)?.running === true;
}

function visibleWindows(state: ManagerState) {
  return state.windows
    .filter((window) => window.state === "open" && appIsRunning(state, window.appId))
    .slice()
    .sort((left, right) => left.stackOrder - right.stackOrder);
}

function appActivationTarget(state: ManagerState, appId: string) {
  const appWindows = state.windows
    .filter((window) => window.appId === appId)
    .slice()
    .sort((left, right) => right.stackOrder - left.stackOrder || left.registrationOrder - right.registrationOrder);
  const primaryWindow = appWindows.slice().sort((left, right) => left.registrationOrder - right.registrationOrder)[0];
  return appWindows.find((window) => window.state !== "closed") ?? primaryWindow;
}

export function MacWindowManager({ children, initialApps = [] }: {
  readonly children: ReactNode;
  /** Immutable boot manifest: keeps app identity and Dock geometry SSR-stable. */
  readonly initialApps?: readonly MacAppDefinition[];
}) {
  const initialAppsRef = useRef(initialApps);
  const [state, setState] = useState<ManagerState>(() => initialAppsRef.current.length === 0
    ? initialState
    : initialStateFor(initialAppsRef.current));
  const stateRef = useRef(state);
  stateRef.current = state;
  const interactionModalityRef = useRef<"keyboard" | "pointer" | null>(null);
  // Captures finish asynchronously; a later window command supersedes the
  // capture even when the window has returned to the same visible state.
  const thumbnailCaptureVersionsRef = useRef(new Map<string, number>());
  const pendingThumbnailCapturesRef = useRef(new Map<string, number>());

  const invalidateWindowThumbnailCapture = useCallback((windowId: string) => {
    thumbnailCaptureVersionsRef.current.set(
      windowId,
      (thumbnailCaptureVersionsRef.current.get(windowId) ?? 0) + 1,
    );
    pendingThumbnailCapturesRef.current.delete(windowId);
  }, []);

  const invalidateWindowThumbnailCaptures = useCallback((windowIds: readonly string[]) => {
    for (const windowId of windowIds) {
      invalidateWindowThumbnailCapture(windowId);
    }
  }, [invalidateWindowThumbnailCapture]);

  useEffect(() => {
    function recordKeyboardInteraction() {
      interactionModalityRef.current = "keyboard";
    }
    function recordPointerInteraction() {
      interactionModalityRef.current = "pointer";
    }
    document.addEventListener("keydown", recordKeyboardInteraction, true);
    document.addEventListener("pointerdown", recordPointerInteraction, true);
    return () => {
      document.removeEventListener("keydown", recordKeyboardInteraction, true);
      document.removeEventListener("pointerdown", recordPointerInteraction, true);
    };
  }, []);

  const consumeKeyboardWindowFocusIntent = useCallback(() => {
    if (interactionModalityRef.current !== "keyboard") return false;
    interactionModalityRef.current = null;
    return true;
  }, []);

  const registerApp = useCallback((registration: AppRegistration) => {
    setState((current) => {
      const existing = current.apps.find((app) => app.id === registration.id);
      if (existing !== undefined) {
        return {
          ...current,
          apps: current.apps.map((app) => app.id === registration.id
            ? {
                ...app,
                name: registration.name,
                icon: registration.icon,
                dockGroup: registration.dockGroup,
                presentation: registration.presentation,
                registrationCount: app.registrationCount + 1,
              }
            : app),
        };
      }
      return {
        ...current,
        apps: [...current.apps, {
          id: registration.id,
          name: registration.name,
          icon: registration.icon,
          dockGroup: registration.dockGroup,
          presentation: registration.presentation,
          fromManifest: false,
          registrationCount: 1,
          registrationOrder: current.nextRegistrationOrder,
          running: registration.defaultRunning,
        }],
        nextRegistrationOrder: current.nextRegistrationOrder + 1,
      };
    });
  }, []);

  const unregisterApp = useCallback((appId: string) => {
    const existing = stateRef.current.apps.find((app) => app.id === appId);
    if (existing !== undefined && !existing.fromManifest && existing.registrationCount === 1) {
      invalidateWindowThumbnailCaptures(
        stateRef.current.windows.filter((window) => window.appId === appId).map((window) => window.id),
      );
    }
    setState((current) => {
      const existing = current.apps.find((app) => app.id === appId);
      if (existing === undefined || existing.registrationCount === 0) return current;
      const registrationCount = existing.registrationCount - 1;
      if (existing.fromManifest || registrationCount > 0) {
        return {
          ...current,
          apps: current.apps.map((app) => app.id === appId ? { ...app, registrationCount } : app),
        };
      }
      return {
        ...current,
        apps: current.apps.filter((app) => app.id !== appId),
        windows: current.windows.filter((window) => window.appId !== appId),
      };
    });
  }, [invalidateWindowThumbnailCaptures]);

  const registerWindow = useCallback((registration: WindowRegistration) => {
    setState((current) => {
      if (current.windows.some((window) => window.id === registration.id)) {
        return {
          ...current,
          windows: current.windows.map((window) => window.id === registration.id
            ? { ...window, label: registration.label, registrationCount: window.registrationCount + 1 }
            : window),
        };
      }
      return {
        ...current,
        windows: [...current.windows, {
          id: registration.id,
          appId: registration.appId,
          label: registration.label,
          registrationCount: 1,
          registrationOrder: current.nextRegistrationOrder,
          stackOrder: registration.defaultOpen ? current.nextStackOrder : 0,
          state: registration.defaultOpen ? "open" : "closed",
          zoomed: false,
        }],
        nextRegistrationOrder: current.nextRegistrationOrder + 1,
        nextStackOrder: registration.defaultOpen ? current.nextStackOrder + 1 : current.nextStackOrder,
      };
    });
  }, []);

  const unregisterWindow = useCallback((windowId: string) => {
    const existing = stateRef.current.windows.find((window) => window.id === windowId);
    if (existing?.registrationCount === 1) invalidateWindowThumbnailCapture(windowId);
    setState((current) => {
      const existing = current.windows.find((window) => window.id === windowId);
      if (existing === undefined) return current;
      if (existing.registrationCount > 1) {
        return {
          ...current,
          windows: current.windows.map((window) => window.id === windowId
            ? { ...window, registrationCount: window.registrationCount - 1 }
            : window),
        };
      }
      return {
        ...current,
        windows: current.windows.filter((window) => window.id !== windowId),
      };
    });
  }, [invalidateWindowThumbnailCapture]);

  const updateWindowLabel = useCallback((windowId: string, label: string) => {
    setState((current) => {
      const existing = current.windows.find((window) => window.id === windowId);
      if (existing === undefined || existing.label === label) return current;
      return {
        ...current,
        windows: current.windows.map((window) => window.id === windowId ? { ...window, label } : window),
      };
    });
  }, []);

  const activateWindow = useCallback((windowId: string) => {
    invalidateWindowThumbnailCapture(windowId);
    setState((current) => {
      const target = current.windows.find((window) => window.id === windowId);
      if (target === undefined) return current;
      return {
        ...current,
        apps: current.apps.map((app) => app.id === target.appId ? { ...app, running: true } : app),
        windows: current.windows.map((window) => window.id === windowId
          ? { ...window, state: "open", stackOrder: current.nextStackOrder, thumbnail: undefined }
          : window),
        nextStackOrder: current.nextStackOrder + 1,
      };
    });
  }, [invalidateWindowThumbnailCapture]);

  const activateApp = useCallback((appId: string) => {
    const currentTarget = appActivationTarget(stateRef.current, appId);
    if (currentTarget !== undefined) invalidateWindowThumbnailCapture(currentTarget.id);
    setState((current) => {
      const target = appActivationTarget(current, appId);
      return {
        ...current,
        apps: current.apps.map((app) => app.id === appId ? { ...app, running: true } : app),
        windows: target === undefined ? current.windows : current.windows.map((window) => window.id === target.id
          ? { ...window, state: "open", stackOrder: current.nextStackOrder, thumbnail: undefined }
          : window),
        nextStackOrder: target === undefined ? current.nextStackOrder : current.nextStackOrder + 1,
      };
    });
  }, [invalidateWindowThumbnailCapture]);

  const closeWindow = useCallback((windowId: string) => {
    invalidateWindowThumbnailCapture(windowId);
    setState((current) => ({
      ...current,
      windows: current.windows.map((window) => window.id === windowId ? { ...window, state: "closed", thumbnail: undefined } : window),
    }));
  }, [invalidateWindowThumbnailCapture]);

  const minimizeWindow = useCallback((windowId: string) => {
    if (pendingThumbnailCapturesRef.current.has(windowId)) return;
    const captureVersion = (thumbnailCaptureVersionsRef.current.get(windowId) ?? 0) + 1;
    thumbnailCaptureVersionsRef.current.set(windowId, captureVersion);
    pendingThumbnailCapturesRef.current.set(windowId, captureVersion);
    const element = [...document.querySelectorAll<HTMLElement>("[data-window-id]")]
      .find((candidate) => candidate.dataset.windowId === windowId) ?? null;
    void captureMacWindowThumbnail(element).then((thumbnail) => {
      if (thumbnailCaptureVersionsRef.current.get(windowId) !== captureVersion) return;
      commitMacWindowViewTransition(() => {
        if (thumbnailCaptureVersionsRef.current.get(windowId) !== captureVersion) return;
        setState((current) => {
          const target = current.windows.find((window) => window.id === windowId);
          if (target === undefined || target.state !== "open") return current;
          return {
            ...current,
            windows: current.windows.map((window) => window.id === windowId
              ? { ...window, state: "minimized", thumbnail }
              : window),
          };
        });
      });
    }).finally(() => {
      if (pendingThumbnailCapturesRef.current.get(windowId) === captureVersion) {
        pendingThumbnailCapturesRef.current.delete(windowId);
      }
    });
  }, []);

  const restoreWindow = useCallback((windowId: string) => {
    invalidateWindowThumbnailCapture(windowId);
    commitMacWindowViewTransition(() => {
      activateWindow(windowId);
    });
  }, [activateWindow, invalidateWindowThumbnailCapture]);
  const openWindow = activateWindow;

  const toggleZoom = useCallback((windowId: string) => {
    invalidateWindowThumbnailCapture(windowId);
    setState((current) => ({
      ...current,
      windows: current.windows.map((window) => window.id === windowId ? { ...window, zoomed: !window.zoomed } : window),
    }));
  }, [invalidateWindowThumbnailCapture]);

  const bringAllToFront = useCallback((appId?: string) => {
    invalidateWindowThumbnailCaptures(
      visibleWindows(stateRef.current)
        .filter((window) => appId === undefined || window.appId === appId)
        .map((window) => window.id),
    );
    setState((current) => {
      const targets = visibleWindows(current).filter((window) => appId === undefined || window.appId === appId);
      if (targets.length === 0) return current;
      const orders = new Map(targets.map((window, index) => [window.id, current.nextStackOrder + index]));
      return {
        ...current,
        windows: current.windows.map((window) => {
          const stackOrder = orders.get(window.id);
          return stackOrder === undefined ? window : { ...window, stackOrder };
        }),
        nextStackOrder: current.nextStackOrder + targets.length,
      };
    });
  }, [invalidateWindowThumbnailCaptures]);

  const quitApp = useCallback((appId: string) => {
    invalidateWindowThumbnailCaptures(
      stateRef.current.windows.filter((window) => window.appId === appId).map((window) => window.id),
    );
    setState((current) => ({
      ...current,
      apps: current.apps.map((app) => app.id === appId ? { ...app, running: false } : app),
      windows: current.windows.map((window) => window.appId === appId
        ? { ...window, state: "closed", thumbnail: undefined }
        : window),
    }));
  }, [invalidateWindowThumbnailCaptures]);

  const orderedVisibleWindows = visibleWindows(state);
  const keyWindow = orderedVisibleWindows.at(-1) ?? null;
  const publicWindows: readonly MacManagedWindow[] = state.windows
    .slice()
    .sort((left, right) => left.registrationOrder - right.registrationOrder)
    .map((window) => ({
      id: window.id,
      appId: window.appId,
      label: window.label,
      state: window.state,
      zoomed: window.zoomed,
      isKeyWindow: window.id === keyWindow?.id,
      zIndex: 10 + orderedVisibleWindows.findIndex((candidate) => candidate.id === window.id),
      thumbnail: window.thumbnail,
    }));
  const publicApps: readonly MacManagedApp[] = state.apps
    .slice()
    .sort((left, right) => left.registrationOrder - right.registrationOrder)
    .map((app) => ({
      id: app.id,
      name: app.name,
      icon: app.icon,
      dockGroup: app.dockGroup,
      presentation: app.presentation,
      running: app.running,
      windowIds: state.windows
        .filter((window) => window.appId === app.id)
        .slice()
        .sort((left, right) => left.registrationOrder - right.registrationOrder)
        .map((window) => window.id),
    }));

  const value = useMemo<MacWindowManagerContextValue>(() => ({
    apps: publicApps,
    windows: publicWindows,
    keyWindowId: keyWindow?.id ?? null,
    keyAppId: keyWindow?.appId ?? null,
    activateApp,
    activateWindow,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    toggleZoom,
    bringAllToFront,
    quitApp,
    registerApp,
    unregisterApp,
    registerWindow,
    unregisterWindow,
    updateWindowLabel,
    consumeKeyboardWindowFocusIntent,
  }), [
    activateApp,
    activateWindow,
    bringAllToFront,
    closeWindow,
    keyWindow?.appId,
    keyWindow?.id,
    minimizeWindow,
    openWindow,
    publicApps,
    publicWindows,
    quitApp,
    registerApp,
    registerWindow,
    restoreWindow,
    toggleZoom,
    unregisterApp,
    unregisterWindow,
    updateWindowLabel,
    consumeKeyboardWindowFocusIntent,
  ]);

  return <MacWindowManagerContext.Provider value={value}>{children}</MacWindowManagerContext.Provider>;
}

export function useMacWindowManager() {
  const manager = useContext(MacWindowManagerContext);
  if (manager === null) throw new Error("useMacWindowManager must be used inside MacWindowManager");
  return manager;
}

/** Internal-friendly optional lookup used by shared chrome. */
export function useOptionalMacWindowManager() {
  return useContext(MacWindowManagerContext);
}

export function MacApp({ children, defaultRunning = true, dockGroup = "apps", icon, id, name, presentation = "windowed" }: MacAppDefinition & {
  readonly children: ReactNode;
}) {
  const manager = useMacWindowManager();
  const initialRegistration = useRef<AppRegistration>({ id, name, icon, dockGroup, defaultRunning, presentation });
  useEffect(() => {
    manager.registerApp(initialRegistration.current);
    return () => manager.unregisterApp(initialRegistration.current.id);
  }, [manager.registerApp, manager.unregisterApp]);
  const value = useMemo<MacAppContextValue>(() => ({ id, defaultRunning }), [defaultRunning, id]);
  return <MacAppContext.Provider value={value}>{children}</MacAppContext.Provider>;
}

export function useOptionalMacApp() {
  return useContext(MacAppContext);
}

export function MacAppDock({ extraItems = [], label = "Dock", onAppActivate }: {
  readonly extraItems?: readonly DockItem[];
  readonly label?: string;
  readonly onAppActivate?: (appId: string) => void;
}) {
  const manager = useMacWindowManager();
  const appIds = new Set(manager.apps.map((app) => app.id));
  const unmanagedItems = extraItems.filter((item) => !appIds.has(item.id));
  function appDockItem(app: MacManagedApp): DockItem {
    return {
      id: app.id,
      label: app.name,
      icon: app.icon,
      group: app.dockGroup,
      running: app.running,
      onActivate: () => {
        manager.activateApp(app.id);
        onAppActivate?.(app.id);
      },
    };
  }
  const items: readonly DockItem[] = [
    ...manager.apps.filter((app) => app.presentation === "windowed" && app.dockGroup === "apps").map(appDockItem),
    ...unmanagedItems.filter((item) => item.group === "apps"),
    ...manager.windows.filter((window) => window.state === "minimized").map((window): DockItem => {
      const app = manager.apps.find((candidate) => candidate.id === window.appId);
      return {
        id: `minimized:${window.id}`,
        label: window.label,
        icon: app?.icon ?? "",
        group: "windows",
        windowThumbnail: window.thumbnail ?? { width: 720, height: 480 },
        viewTransitionName: macWindowViewTransitionName(window.id),
        onActivate: () => manager.restoreWindow(window.id),
      };
    }),
    ...manager.apps.filter((app) => app.presentation === "windowed" && app.dockGroup === "places").map(appDockItem),
    ...unmanagedItems.filter((item) => item.group !== "apps"),
  ];
  return <MacDock label={label} items={items} />;
}

export function useManagedWindowRegistration({ defaultOpen, label, windowId }: {
  readonly defaultOpen: boolean;
  readonly label: string;
  readonly windowId?: string;
}) {
  const manager = useOptionalMacWindowManager();
  const app = useOptionalMacApp();
  const appId = app?.id;
  const resolvedWindowId = manager !== null && app !== null ? windowId ?? `${app.id}:main` : null;
  const registerWindow = manager?.registerWindow;
  const unregisterWindow = manager?.unregisterWindow;
  const updateWindowLabel = manager?.updateWindowLabel;
  const initialRegistration = useRef({ defaultOpen, label });

  useEffect(() => {
    if (registerWindow === undefined || unregisterWindow === undefined || appId === undefined || resolvedWindowId === null) return;
    // Dynamic labels flow through updateWindowLabel. Defaults belong only to
    // the initial registration and must not reset live window state.
    registerWindow({ id: resolvedWindowId, appId, ...initialRegistration.current });
    return () => unregisterWindow(resolvedWindowId);
  }, [appId, registerWindow, resolvedWindowId, unregisterWindow]);

  useEffect(() => {
    if (updateWindowLabel === undefined || resolvedWindowId === null) return;
    updateWindowLabel(resolvedWindowId, label);
  }, [label, resolvedWindowId, updateWindowLabel]);

  const managedWindow = resolvedWindowId === null
    ? null
    : manager?.windows.find((window) => window.id === resolvedWindowId) ?? null;
  const appRunning = app === null
    ? true
    : manager?.apps.find((candidate) => candidate.id === app.id)?.running ?? app.defaultRunning;

  return { app, appRunning, manager, managedWindow, resolvedWindowId };
}
