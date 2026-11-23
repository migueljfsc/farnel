import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

export type Route =
  | { page: "week"; weekStart?: string }
  | { page: "history" }
  | { page: "dishes"; filter?: "to-validate" | "archived" }
  | { page: "dish"; id: number | "new" }
  | { page: "ingredients"; filter?: "to-decide" }
  | { page: "settings" }
  | { page: "review" };

const DISH_FILTERS = ["to-validate", "archived"] as const;

export function parseRoute(pathname: string, search: string): Route {
  const filter = new URLSearchParams(search).get("filter");
  const parts = pathname.split("/").filter(Boolean);
  switch (parts[0]) {
    case "week":
      return /^\d{4}-\d{2}-\d{2}$/.test(parts[1] ?? "") ? { page: "week", weekStart: parts[1] } : { page: "week" };
    case "history":
      return { page: "history" };
    case "dishes":
      if (parts[1] === "new") return { page: "dish", id: "new" };
      if (/^\d+$/.test(parts[1] ?? "")) return { page: "dish", id: Number(parts[1]) };
      return DISH_FILTERS.find((f) => f === filter) ? { page: "dishes", filter: filter as (typeof DISH_FILTERS)[number] } : { page: "dishes" };
    case "ingredients":
      return filter === "to-decide" ? { page: "ingredients", filter } : { page: "ingredients" };
    case "settings":
      return { page: "settings" };
    case "review":
      return { page: "review" };
    default:
      return { page: "week" };
  }
}

export function href(route: Route): string {
  switch (route.page) {
    case "week":
      return route.weekStart ? `/week/${route.weekStart}` : "/";
    case "history":
      return "/history";
    case "dishes":
      return route.filter ? `/dishes?filter=${route.filter}` : "/dishes";
    case "dish":
      return `/dishes/${route.id}`;
    case "ingredients":
      return route.filter ? `/ingredients?filter=${route.filter}` : "/ingredients";
    case "settings":
      return "/settings";
    case "review":
      return "/review";
  }
}

const current = (): Route => parseRoute(location.pathname, location.search);

/** The current route, and a navigate function that pushes history. */
export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const onPop = () => setRoute(current());
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  const navigate = useCallback((next: Route) => {
    const change = () => {
      history.pushState(null, "", href(next));
      flushSync(() => setRoute(next));
      scrollTo(0, 0);
    };
    if (document.startViewTransition) document.startViewTransition(change);
    else change();
  }, []);
  return [route, navigate];
}
