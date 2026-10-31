import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import IntegratedWorkbench from "./pages/IntegratedWorkbench";
import OrrenHub from "./pages/OrrenHub";
import ProjectAudit from "./pages/ProjectAudit";
import ProjectBuilds from "./pages/ProjectBuilds";
import ProjectMembers from "./pages/ProjectMembers";
import { lazy, Suspense } from "react";
import { AppProviders } from "@/app/providers";

const DevRuntime = import.meta.env.DEV ? lazy(() => import("@/runtime/DevRuntime")) : null;

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={IntegratedWorkbench} />
      <Route path={"/semantic"} component={OrrenHub} />
      <Route path={"/projects/:projectId/semantic"} component={OrrenHub} />
      <Route path={"/projects/:projectId/audit"} component={ProjectAudit} />
      <Route path={"/projects/:projectId/builds"} component={ProjectBuilds} />
      <Route path={"/projects/:projectId/members"} component={ProjectMembers} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  const application = (
    <AppProviders>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </AppProviders>
  );
  return DevRuntime ? <Suspense fallback={application}><DevRuntime>{application}</DevRuntime></Suspense> : application;
}

export default App;
