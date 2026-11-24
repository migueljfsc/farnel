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
  active: (route: Route) => boolean;
}

const PLACES: NavItem[] = [
  { to: { page: "week" }, label: "nav.week", icon: "week", active: (r) => r.page === "week" },
  { to: { page: "dishes" }, label: "nav.dishes", icon: "dishes", active: (r) => r.page === "dishes" || r.page === "dish" },
  { to: { page: "ingredients" }, label: "nav.ingredients", icon: "ingredients", active: (r) => r.page === "ingredients" },
  { to: { page: "history" }, label: "nav.history", icon: "history", active: (r) => r.page === "history" },
];

/** How many things wait for a person: dishes to validate and ingredients to decide. */
const Count = ({ n }: { n: number }) => <span className="rounded-[2px] bg-mostarda px-1.5 text-[11px] font-bold leading-[18px] text-[#17201e]">{n}</span>;

/**
 * A teal rail down the left on wider screens (the places, then what waits for review, then the
 * settings); on phones a top strip and a bottom bar of the four places.
 */
function Shell({ me, route, refreshMe, navigate, children }: { me: Me; route: Route; refreshMe: () => void; navigate: (r: Route) => void; children: React.ReactNode }) {
  const { t } = useI18n();
  const ctx = useMemo(() => ({ me, refreshMe, navigate }), [me, refreshMe, navigate]);
  const waiting = me.pendingDishes + me.undecided;
  const railLink = (to: Route, active: boolean, content: React.ReactNode, key?: string) => (
    <Link
      key={key}
      to={to}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex items-center gap-3 px-5 py-2.5 text-sm font-semibold no-underline transition hover:no-underline",
        active ? "-mr-px bg-papel text-mar!" : "text-on-rail/80! hover:bg-on-rail/10 hover:text-on-rail!",
      )}
    >
      {content}
    </Link>
  );

  return (
    <AppCtx.Provider value={ctx}>
      <ToastProvider>
        <div className="min-h-dvh sm:grid sm:grid-cols-[13rem_minmax(0,1fr)]">
          <aside className="sticky top-0 hidden h-dvh flex-col bg-rail py-6 text-on-rail sm:flex">
            <span className="wordmark px-5 pb-6 text-3xl">{APP_NAME}</span>
            <nav aria-label={t("nav.label")} className="flex flex-col">
              {PLACES.map((item) =>
                railLink(
                  item.to,
                  item.active(route),
                  <>
                    <Icon name={item.icon} />
                    {t(item.label)}
                  </>,
                  item.label,
                ),
              )}
              {(waiting > 0 || route.page === "review") &&
                railLink(
                  { page: "review" },
                  route.page === "review",
                  <>
                    <Icon name="review" />
                    {t("nav.review")}
                    {waiting > 0 && (
                      <span className="ml-auto">
                        <Count n={waiting} />
                      </span>
                    )}
                  </>,
                )}
            </nav>
            <div className="mt-auto space-y-3 border-t border-on-rail/20 pt-4">
              {railLink(
                { page: "settings" },
                route.page === "settings",
                <>
                  <Icon name="settings" />
                  {t("nav.settings")}
                </>,
              )}
              <div className="space-y-2 px-5">
                <ThemeSwitch onMar />
                <LocaleSwitch onMar />
                <p className="text-xs text-on-rail/75">{me.person.name}</p>
              </div>
            </div>
          </aside>

          <div className="min-w-0 pb-24 sm:pb-0">
            <header className="sticky top-0 z-20 flex items-center gap-3 border-b-2 border-tinta bg-papel px-4 py-2.5 sm:hidden">
              <span className="wordmark mr-auto text-2xl text-mar">{APP_NAME}</span>
              {waiting > 0 && (
                <Link to={{ page: "review" }} aria-label={`${t("nav.review")}: ${waiting}`} className="flex items-center gap-1 no-underline hover:no-underline">
                  <Count n={waiting} />
                </Link>
              )}
              <Link
                to={{ page: "settings" }}
                aria-label={t("nav.settings")}
                aria-current={route.page === "settings" ? "page" : undefined}
                className={cx("grid size-9 place-items-center rounded-[3px] no-underline", route.page === "settings" ? "bg-mar text-on-mar!" : "text-tinta!")}
              >
                <Icon name="settings" />
              </Link>
            </header>
            <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
          </div>

          <nav aria-label={t("nav.label")} className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-tinta bg-papel pb-[env(safe-area-inset-bottom)] sm:hidden">
            <div className="grid grid-cols-4">
              {PLACES.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  aria-current={item.active(route) ? "page" : undefined}
                  className={cx(
                    "relative flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-semibold no-underline hover:no-underline",
                    item.active(route) ? "text-mar! before:absolute before:inset-x-[22%] before:-top-0.5 before:h-1 before:bg-mar" : "text-tinta-soft!",
                  )}
                >
                  <Icon name={item.icon} />
                  {t(item.label)}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </ToastProvider>
    </AppCtx.Provider>
  );
}
