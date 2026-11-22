import { useMemo } from "react";
import { APP_NAME } from "../shared/app";
import type { Me } from "../shared/types";
import { Link, Loaded } from "./components/ui";
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
  const ctx = useMemo(() => ({ me, refreshMe, navigate }), [me, refreshMe, navigate]);
  const count = (n: number) => (n > 0 ? ` (${n})` : "");
  return (
    <AppCtx.Provider value={ctx}>
      <div className="min-h-screen bg-stone-50 text-stone-900">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-200 bg-white px-4 py-3 text-sm">
          <span className="font-semibold">{APP_NAME}</span>
          <Link to={{ page: "week" }}>Week</Link>
          <Link to={{ page: "history" }}>History</Link>
          <Link to={{ page: "dishes" }}>Dishes</Link>
          <Link to={{ page: "dishes", filter: "to-validate" }}>To validate{count(me.pendingDishes)}</Link>
          <Link to={{ page: "ingredients", filter: "to-decide" }}>To decide{count(me.undecided)}</Link>
          <Link to={{ page: "ingredients" }}>Ingredients</Link>
          <Link to={{ page: "settings" }}>Settings</Link>
          <span className="ml-auto text-stone-500">{me.person.name}</span>
        </nav>
        <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>
      </div>
    </AppCtx.Provider>
  );
}
