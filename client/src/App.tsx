import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import MessengerPage from "./pages/MessengerPage";
import InviteAcceptPage from "./pages/InviteAcceptPage";

function LoadingDots() {
  return (
    <div
      className="flex items-center justify-center"
      style={{ height: "100dvh", background: "var(--bg)" }}
    >
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="typing-dot"
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background:
                i === 0 ? "var(--mint)" : i === 1 ? "var(--lilac)" : "var(--yellow)",
              border: "1.5px solid var(--border)",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Router() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingDots />;

  return (
    <Switch>
      <Route path="/invite/:code" component={InviteAcceptPage} />
      <Route path="/" component={user ? MessengerPage : LoginPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      theme={theme}
      toastOptions={{
        style: {
          background: "var(--bg-elevated)",
          color: "var(--fg)",
          border: "1.5px solid var(--border)",
          borderRadius: "0.875rem",
          boxShadow: "3px 3px 0 var(--border)",
        },
      }}
    />
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <ThemedToaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
