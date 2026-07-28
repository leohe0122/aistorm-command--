import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RoleProvider } from "./contexts/RoleContext";
import CommandLayout from "./components/CommandLayout";
import BattleMap from "./pages/BattleMap";
import IntelRadar from "./pages/IntelRadar";
import ActionCommand from "./pages/ActionCommand";
import AIInsights from "./pages/AIInsights";
import ChampionAmmo from "./pages/ChampionAmmo";
import PodCenter from "./pages/PodCenter";
import MeetingMinutes from "./pages/MeetingMinutes";
import OpportunityPrediction from "./pages/OpportunityPrediction";
import CrmIntegration from "./pages/CrmIntegration";
import DailyBriefing from "./pages/DailyBriefing";
import Arsenal from "./pages/Arsenal";
import ADDashboard from "./pages/ADDashboard";
import NotFound from "./pages/NotFound";
import EmailLogin from "./pages/EmailLogin";
import UserManagement from "./pages/UserManagement";
import SystemSettings from "./pages/SystemSettings";
import TeamManagement from "./pages/TeamManagement";
import { trpc } from "@/lib/trpc";
import { useState, createContext, useContext, useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";

// ── Email Auth Context ─────────────────────────────────────────────────────
interface EmailUser {
  id: number;
  email: string;
  name: string;
  role: string;
  podRole: string;
}

interface EmailAuthContextType {
  emailUser: EmailUser | null;
  setEmailUser: (u: EmailUser | null) => void;
}

export const EmailAuthContext = createContext<EmailAuthContextType>({
  emailUser: null,
  setEmailUser: () => {},
});

export function useEmailAuth() {
  return useContext(EmailAuthContext);
}

// ── Auth Gate ──────────────────────────────────────────────────────────────
function AuthGate({ children }: { children: React.ReactNode }) {
  const [emailUser, setEmailUser] = useState<EmailUser | null>(null);
  const { data: sessionUser, isLoading } = trpc.emailAuth.me.useQuery(undefined, {
    retry: false,
  });

  useEffect(() => {
    if (sessionUser) setEmailUser(sessionUser as EmailUser);
  }, [sessionUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  const currentUser = emailUser || (sessionUser as EmailUser | null);

  if (!currentUser) {
    return (
      <EmailAuthContext.Provider value={{ emailUser: null, setEmailUser }}>
        <EmailLogin onSuccess={(u) => setEmailUser(u)} />
      </EmailAuthContext.Provider>
    );
  }

  return (
    <EmailAuthContext.Provider value={{ emailUser: currentUser, setEmailUser }}>
      {children}
    </EmailAuthContext.Provider>
  );
}

// ── Router ─────────────────────────────────────────────────────────────────
function Router() {
  return (
    <CommandLayout>
      <Switch>
        <Route path="/" component={ADDashboard} />
        <Route path="/dashboard" component={ADDashboard} />
        <Route path="/battle-map" component={BattleMap} />
        <Route path="/intel-radar" component={IntelRadar} />
        <Route path="/action-command" component={ActionCommand} />
        <Route path="/ai-insights" component={AIInsights} />
        <Route path="/champion-ammo" component={ChampionAmmo} />
        <Route path="/pod-center" component={PodCenter} />
        <Route path="/meeting-minutes" component={MeetingMinutes} />
        <Route path="/prediction" component={OpportunityPrediction} />
        <Route path="/crm" component={CrmIntegration} />
        <Route path="/daily-briefing" component={DailyBriefing} />
        <Route path="/settings" component={SystemSettings} />
        <Route path="/arsenal" component={Arsenal} />
        <Route path="/admin/users" component={UserManagement} />
        <Route component={NotFound} />
      </Switch>
    </CommandLayout>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <RoleProvider>
          <TooltipProvider>
            <Toaster />
            <AuthGate>
              <Router />
            </AuthGate>
          </TooltipProvider>
        </RoleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
        <Route path="/team" component={TeamManagement} />
