"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { MacDock, type DockIconSource, type DockItem } from "./dock.tsx";

export type MacWindowState = "open" | "minimized" | "closed";

export interface MacManagedApp {
  readonly id: string;
  readonly name: string;
  readonly icon: DockIconSource;
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
  readonly registrationOrder: number;
  readonly running: boolean;
};

type WindowRecord = {
  readonly id: string;
  readonly appId: string;
  readonly label: string;
  readonly registrationOrder: number;
  readonly stackOrder: number;
  readonly state: MacWindowState;
  readonly zoomed: boolean;
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
  readonly defaultRunning: boolean;
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

function appIsRunning(state: ManagerState, appId: string) {
  return state.apps.find((app) => app.id === appId)?.running === true;
}

function visibleWindows(state: ManagerState) {
  return state.windows
    .filter((window) => window.state === "open" && appIsRunning(state, window.appId))
    .slice()
    .sort((left, right) => left.stackOrder - right.stackOrder);
}

export function MacWindowManager({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<ManagerState>(initialState);
  const interactionModalityRef = useRef<"keyboard" | "pointer" | null>(null);

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
        if (existing.name === registration.name) return current;
        return {
          ...current,
          apps: current.apps.map((app) => app.id === registration.id ? { ...app, name: registration.name } : app),
        };
      }
      return {
        ...current,
        apps: [...current.apps, {
          id: registration.id,
          name: registration.name,
          icon: registration.icon,
          registrationOrder: current.nextRegistrationOrder,
          running: registration.defaultRunning,
        }],
        nextRegistrationOrder: current.nextRegistrationOrder + 1,
      };
    });
  }, []);

  const unregisterApp = useCallback((appId: string) => {
    setState((current) => ({
      ...current,
      apps: current.apps.filter((app) => app.id !== appId),
      windows: current.windows.filter((window) => window.appId !== appId),
    }));
  }, []);

  const registerWindow = useCallback((registration: WindowRegistration) => {
    setState((current) => {
      if (current.windows.some((window) => window.id === registration.id)) return current;
      return {
        ...current,
        windows: [...current.windows, {
          id: registration.id,
          appId: registration.appId,
          label: registration.label,
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
    setState((current) => ({
      ...current,
      windows: current.windows.filter((window) => window.id !== windowId),
    }));
  }, []);

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
    setState((current) => {
      const target = current.windows.find((window) => window.id === windowId);
      if (target === undefined) return current;
      return {
        ...current,
        apps: current.apps.map((app) => app.id === target.appId ? { ...app, running: true } : app),
        windows: current.windows.map((window) => window.id === windowId
          ? { ...window, state: "open", stackOrder: current.nextStackOrder }
          : window),
        nextStackOrder: current.nextStackOrder + 1,
      };
    });
  }, []);

  const activateApp = useCallback((appId: string) => {
    setState((current) => {
      const appWindows = current.windows
        .filter((window) => window.appId === appId)
        .slice()
        .sort((left, right) => right.stackOrder - left.stackOrder || left.registrationOrder - right.registrationOrder);
      const primaryWindow = appWindows.slice().sort((left, right) => left.registrationOrder - right.registrationOrder)[0];
      const target = appWindows.find((window) => window.state !== "closed") ?? primaryWindow;
      return {
        ...current,
        apps: current.apps.map((app) => app.id === appId ? { ...app, running: true } : app),
        windows: target === undefined ? current.windows : current.windows.map((window) => window.id === target.id
          ? { ...window, state: "open", stackOrder: current.nextStackOrder }
          : window),
        nextStackOrder: target === undefined ? current.nextStackOrder : current.nextStackOrder + 1,
      };
    });
  }, []);

  const closeWindow = useCallback((windowId: string) => {
    setState((current) => ({
      ...current,
      windows: current.windows.map((window) => window.id === windowId ? { ...window, state: "closed" } : window),
    }));
  }, []);

  const minimizeWindow = useCallback((windowId: string) => {
    setState((current) => ({
      ...current,
      windows: current.windows.map((window) => window.id === windowId ? { ...window, state: "minimized" } : window),
    }));
  }, []);

  const restoreWindow = activateWindow;
  const openWindow = activateWindow;

  const toggleZoom = useCallback((windowId: string) => {
    setState((current) => ({
      ...current,
      windows: current.windows.map((window) => window.id === windowId ? { ...window, zoomed: !window.zoomed } : window),
    }));
  }, []);

  const bringAllToFront = useCallback((appId?: string) => {
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
  }, []);

  const quitApp = useCallback((appId: string) => {
    setState((current) => ({
      ...current,
      apps: current.apps.map((app) => app.id === appId ? { ...app, running: false } : app),
      windows: current.windows.map((window) => window.appId === appId ? { ...window, state: "closed" } : window),
    }));
  }, []);

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
    }));
  const publicApps: readonly MacManagedApp[] = state.apps
    .slice()
    .sort((left, right) => left.registrationOrder - right.registrationOrder)
    .map((app) => ({
      id: app.id,
      name: app.name,
      icon: app.icon,
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

export function MacApp({ children, defaultRunning = true, icon, id, name }: {
  readonly children: ReactNode;
  readonly defaultRunning?: boolean;
  readonly icon: DockIconSource;
  readonly id: string;
  readonly name: string;
}) {
  const manager = useMacWindowManager();
  const initialRegistration = useRef<AppRegistration>({ id, name, icon, defaultRunning });
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
  const items: readonly DockItem[] = [
    ...manager.apps.map((app): DockItem => ({
      id: app.id,
      label: app.name,
      icon: app.icon,
      group: "apps",
      running: app.running,
      onActivate: () => {
        manager.activateApp(app.id);
        onAppActivate?.(app.id);
      },
    })),
    ...extraItems.filter((item) => !appIds.has(item.id)),
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
  const resolvedWindowId = manager !== null && app !== null ? windowId ?? `${app.id}:main` : null;
  const registerWindow = manager?.registerWindow;
  const unregisterWindow = manager?.unregisterWindow;
  const updateWindowLabel = manager?.updateWindowLabel;

  useEffect(() => {
    if (registerWindow === undefined || unregisterWindow === undefined || app === null || resolvedWindowId === null) return;
    registerWindow({ id: resolvedWindowId, appId: app.id, label, defaultOpen });
    return () => unregisterWindow(resolvedWindowId);
  }, [app, defaultOpen, registerWindow, resolvedWindowId, unregisterWindow]);

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
