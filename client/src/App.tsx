import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RoleProvider } from "./contexts/RoleContext";
import CommandLayout from "./components/CommandLayout";
import BattleMap from "./pages/BattleMap";
import IntelRadar from "./pages/IntelRadar";
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
import ClientWorkstation from "./pages/ClientWorkstation";
import OpportunityRoom from "./pages/OpportunityRoom";
import { trpc } from "@/lib/trpc";
import { useState, createContext, useContext, useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw } from "lucide-react";

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

// ── PWA Update Banner ──────────────────────────────────────────────────────
function PWAUpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        setShowUpdate(true);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium"
      style={{ background: "linear-gradient(90deg, #00A8D6 0%, #1B6FBF 100%)", color: "#fff" }}>
      <RefreshCw className="w-4 h-4 animate-spin" />
      <span>发现新版本</span>
      <button
        onClick={() => window.location.reload()}
        className="ml-2 px-3 py-0.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors font-semibold text-xs border border-white/30"
      >
        立即更新
      </button>
      <button onClick={() => setShowUpdate(false)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity text-xs">✕</button>
    </div>
  );
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
        <Route path="/clients/:clientId/opportunities/:opportunityId" component={OpportunityRoom} />
        <Route path="/clients/:clientId" component={ClientWorkstation} />
        <Route path="/intel-radar" component={IntelRadar} />
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
        <Route path="/team" component={TeamManagement} />
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
            <PWAUpdateBanner />
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
