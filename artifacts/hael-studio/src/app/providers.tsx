import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { StudioProvider } from "@/state/studioStore";
import { StudioAuthentication } from "@/app/StudioAuthentication";
import { setProjectIdGetter } from "@workspace/api-client-react";
import type { ReactNode } from "react";

setProjectIdGetter(() => {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem("hael.activeProjectId"); } catch { return null; }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1 },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ThemeProvider defaultTheme="light">
          <StudioAuthentication><StudioProvider>{children}</StudioProvider></StudioAuthentication>
        </ThemeProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
