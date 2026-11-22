import { createContext, useContext } from "react";
import type { Me } from "../../shared/types";
import type { Route } from "./router";

export interface AppContext {
  me: Me;
  /** Fetches the signed-in person and the To validate / To decide counts again. */
  refreshMe: () => void;
  navigate: (route: Route) => void;
}

export const AppCtx = createContext<AppContext | null>(null);

export function useApp(): AppContext {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp outside AppCtx");
  return ctx;
}
