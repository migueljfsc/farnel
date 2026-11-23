import { useMemo } from "react";
import { APP_NAME } from "../shared/app";
import type { Me } from "../shared/types";
import { LocaleSwitch } from "./components/LocaleSwitch";
import { Link, Loaded } from "./components/ui";
import { useI18n } from "./i18n/context";
import type { MessageKey } from "./i18n/core";
import { cx } from "./components/styles";
import { useApi } from "./lib/api";
import { AppCtx } from "./lib/app-context";
import { useRoute, type Route } from "./lib/router";
import { DishEditor } from "./pages/DishEditor";
import { Dishes } from "./pages/Dishes";
import { History } from "./pages/History";
import { Ingredients } from "./pages/Ingredients";
import { Settings } from "./pages/Settings";
import { Week } from "./pages/Week";

function Body({ route }: { route: Route }) {
  switch (route.page) {
    case "week":
      return <Week key={route.weekStart} weekStart={route.weekStart} />;
    case "history":
      return <History />;
    case "dishes":
      return <Dishes filter={route.filter} />;
    case "dish":
      return <DishEditor key={route.id} id={route.id} />;
    case "ingredients":
      return <Ingredients filter={route.filter} />;
    case "settings":
      return <Settings />;
  }
}

export function App() {
  const [route, navigate] = useRoute();
  const me = useApi<Me>("/api/me");

  return (
    <Loaded data={me.data} error={me.error}>
      {(data) => (
        <Shell me={data} route={route} refreshMe={me.reload} navigate={navigate}>
          <Body route={route} />
        </Shell>
      )}
    </Loaded>
  );
}

interface NavItem {
  to: Route;
  label: MessageKey;
  count?: number;
  active: (route: Route) => boolean;
}

function Shell({ me, route, refreshMe, navigate, children }: { me: Me; route: Route; refreshMe: () => void; navigate: (r: Route) => void; children: React.ReactNode }) {
  const { t } = useI18n();
  const ctx = useMemo(() => ({ me, refreshMe, navigate }), [me, refreshMe, navigate]);
  const items: NavItem[] = [
    { to: { page: "week" }, label: "nav.week", active: (r) => r.page === "week" },
    { to: { page: "history" }, label: "nav.history", active: (r) => r.page === "history" },
    { to: { page: "dishes" }, label: "nav.dishes", active: (r) => (r.page === "dishes" && r.filter !== "to-validate") || r.page === "dish" },
    { to: { page: "dishes", filter: "to-validate" }, label: "nav.toValidate", count: me.pendingDishes, active: (r) => r.page === "dishes" && r.filter === "to-validate" },
    { to: { page: "ingredients", filter: "to-decide" }, label: "nav.toDecide", count: me.undecided, active: (r) => r.page === "ingredients" && r.filter === "to-decide" },
    { to: { page: "ingredients" }, label: "nav.ingredients", active: (r) => r.page === "ingredients" && r.filter !== "to-decide" },
    { to: { page: "settings" }, label: "nav.settings", active: (r) => r.page === "settings" },
  ];
  return (
    <AppCtx.Provider value={ctx}>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-10 border-b border-linha bg-esmalte/85 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <span className="display text-2xl text-cobalto">{APP_NAME}</span>
            <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1 text-sm">
              {items.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className={cx(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 font-medium no-underline transition hover:no-underline",
                    item.active(route) ? "bg-cobalto text-louca" : "text-tinta-soft hover:bg-cobalto-soft hover:text-cobalto",
                  )}
                >
                  {t(item.label)}
                  {!!item.count && <span className="rounded-full bg-colorau px-1.5 text-[11px] font-bold leading-4 text-louca">{item.count}</span>}
                </Link>
              ))}
            </nav>
            <span className="hidden items-center gap-2 text-sm text-tinta-soft sm:flex">{me.person.name}</span>
            <LocaleSwitch />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </div>
    </AppCtx.Provider>
  );
}
