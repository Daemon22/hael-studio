import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { StudioProvider } from "@/state/studioStore";
import { lazy, Suspense } from "react";

const DevRuntime = import.meta.env.DEV ? lazy(() => import("@/runtime/DevRuntime")) : null;

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
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
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <StudioProvider>
            <Router />
          </StudioProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
  return DevRuntime ? <Suspense fallback={application}><DevRuntime>{application}</DevRuntime></Suspense> : application;
}

export default App;
