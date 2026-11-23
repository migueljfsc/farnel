import { useMemo } from "react";
import { APP_NAME } from "../shared/app";
import type { Me } from "../shared/types";
import { LocaleSwitch } from "./components/LocaleSwitch";
import { Link, Loaded } from "./components/ui";
import { useI18n } from "./i18n/context";
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
        <Shell me={data} refreshMe={me.reload} navigate={navigate}>
          <Body route={route} />
        </Shell>
      )}
    </Loaded>
  );
}

function Shell({ me, refreshMe, navigate, children }: { me: Me; refreshMe: () => void; navigate: (r: Route) => void; children: React.ReactNode }) {
  const { t } = useI18n();
  const ctx = useMemo(() => ({ me, refreshMe, navigate }), [me, refreshMe, navigate]);
  const count = (n: number) => (n > 0 ? ` (${n})` : "");
  return (
    <AppCtx.Provider value={ctx}>
      <div className="min-h-screen bg-stone-50 text-stone-900">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-200 bg-white px-4 py-3 text-sm">
          <span className="font-semibold">{APP_NAME}</span>
          <Link to={{ page: "week" }}>{t("nav.week")}</Link>
          <Link to={{ page: "history" }}>{t("nav.history")}</Link>
          <Link to={{ page: "dishes" }}>{t("nav.dishes")}</Link>
          <Link to={{ page: "dishes", filter: "to-validate" }}>
            {t("nav.toValidate")}
            {count(me.pendingDishes)}
          </Link>
          <Link to={{ page: "ingredients", filter: "to-decide" }}>
            {t("nav.toDecide")}
            {count(me.undecided)}
          </Link>
          <Link to={{ page: "ingredients" }}>{t("nav.ingredients")}</Link>
          <Link to={{ page: "settings" }}>{t("nav.settings")}</Link>
          <span className="ml-auto flex items-center gap-2 text-stone-500">
            {me.person.name}
            <LocaleSwitch />
          </span>
        </nav>
        <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>
      </div>
    </AppCtx.Provider>
  );
}
