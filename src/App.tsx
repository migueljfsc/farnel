import { useMemo } from "react";
import { APP_NAME } from "../shared/app";
import type { Me } from "../shared/types";
import { LocaleSwitch } from "./components/LocaleSwitch";
import { ThemeSwitch } from "./components/ThemeSwitch";
import { Icon, type IconName } from "./components/icons";
import { ToastProvider } from "./components/toast";
import { Review } from "./pages/Review";
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
    case "review":
      return <Review />;
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
  icon: IconName;
  count?: number;
  active: (route: Route) => boolean;
}

function Shell({ me, route, refreshMe, navigate, children }: { me: Me; route: Route; refreshMe: () => void; navigate: (r: Route) => void; children: React.ReactNode }) {
  const { t } = useI18n();
  const ctx = useMemo(() => ({ me, refreshMe, navigate }), [me, refreshMe, navigate]);
  const items: NavItem[] = [
    { to: { page: "week" }, label: "nav.week", icon: "week", active: (r) => r.page === "week" },
    { to: { page: "history" }, label: "nav.history", icon: "history", active: (r) => r.page === "history" },
    { to: { page: "dishes" }, label: "nav.dishes", icon: "dishes", active: (r) => r.page === "dishes" || r.page === "dish" || r.page === "ingredients" },
    { to: { page: "review" }, label: "nav.review", icon: "review", count: me.pendingDishes + me.undecided, active: (r) => r.page === "review" },
    { to: { page: "settings" }, label: "nav.settings", icon: "settings", active: (r) => r.page === "settings" },
  ];
  const count = (n?: number) =>
    !!n && <span className="rounded-full bg-acafrao px-1.5 text-[11px] font-bold leading-4 text-terra">{n}</span>;

  return (
    <AppCtx.Provider value={ctx}>
      <ToastProvider>
        <div className="min-h-dvh pb-24 sm:pb-0">
          <header className="sticky top-0 z-20 border-b border-linha bg-folha/85 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
              <span className="display text-2xl text-manjericao">{APP_NAME}</span>
              <nav className="hidden flex-1 gap-1 text-sm sm:flex">
                {items.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    aria-current={item.active(route) ? "page" : undefined}
                    className={cx(
                      "flex items-center gap-1.5 rounded-full px-3 py-1 font-medium no-underline transition hover:no-underline",
                      item.active(route) ? "bg-manjericao text-louca!" : "text-terra-soft! hover:bg-manjericao-soft hover:text-manjericao!",
                    )}
                  >
                    {t(item.label)}
                    {count(item.count)}
                  </Link>
                ))}
              </nav>
              <span className="ml-auto hidden text-sm text-terra-soft md:inline">{me.person.name}</span>
              <span className="ml-auto flex items-center gap-2 md:ml-0">
                <ThemeSwitch />
                <LocaleSwitch />
              </span>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
          <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-linha bg-louca/90 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
            <div className="grid grid-cols-5">
              {items.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  aria-current={item.active(route) ? "page" : undefined}
                  className={cx(
                    "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold no-underline hover:no-underline",
                    item.active(route) ? "text-manjericao!" : "text-terra-soft!",
                  )}
                >
                  <span className={cx("grid h-7 w-12 place-items-center rounded-full transition", item.active(route) && "bg-manjericao-soft")}>
                    <Icon name={item.icon} />
                  </span>
                  {t(item.label)}
                  {!!item.count && <span className="absolute right-[18%] top-1">{count(item.count)}</span>}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </ToastProvider>
    </AppCtx.Provider>
  );
}
