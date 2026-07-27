import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useRole } from "@/contexts/RoleContext";
import { cn } from "@/lib/utils";
import {
  Map, Radio, Zap, FileText, Shield, Users, MessageSquare, TrendingUp,
  ChevronRight, Database, Bell, Crosshair, LogOut, LayoutDashboard, Settings
} from "lucide-react";
import { useEmailAuth } from "@/App";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const navItems = [
  { path: "/dashboard", label: "AD 指挥台", icon: LayoutDashboard, desc: "Portfolio Review 看板" },
  { path: "/battle-map", label: "战场地图", icon: Map, desc: "MEDDPICC看板" },
  { path: "/intel-radar", label: "客户情报雷达", icon: Radio, desc: "信号监控与解读" },
  { path: "/ai-insights", label: "AI洞察简报", icon: FileText, desc: "拜访前客户洞察 1-Pager" },
  { path: "/meeting-minutes", label: "拜访作战日志", icon: MessageSquare, desc: "拜访录入·AI解析·更新战场" },
  { path: "/action-command", label: "AI行动指令台", icon: Zap, desc: "优先行动推荐" },
  { path: "/pod-center", label: "POD协同中枢", icon: Users, desc: "角色任务视图" },
  { path: "/arsenal", label: "武器库 Arsenal", icon: Crosshair, desc: "产品文档·AI方案·竞品阻击包" },
];

const settingsNavItems = [
  { path: "/settings", label: "系统设置", icon: Settings, desc: "RSS · 飞书 · CRM" },
];

const adminNavItems = [
  { path: "/admin/users", label: "用户管理", icon: Users, desc: "账号与角色管理" },
];

const roleColors: Record<string, string> = {
  AD: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  SAM: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
  SA: "bg-violet-500/20 text-violet-400 border-violet-500/40",
  RSM: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
};

const roleDescriptions: Record<string, string> = {
  AD: "Account Director · 顶层破冰",
  SAM: "Strategic Account Mgr · 中枢操盘",
  SA: "Solution Architect · 技术定标",
  RSM: "Regional Sales Mgr · 属地辅攻",
};

function EmailUserFooter() {
  const { emailUser, setEmailUser } = useEmailAuth();
  const logoutMut = trpc.emailAuth.logout.useMutation({
    onSuccess: () => {
      setEmailUser(null);
      toast.success("已退出登录");
      window.location.reload();
    },
  });
  if (!emailUser) return null;
  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/5 border border-white/8">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
        style={{ background: "linear-gradient(135deg, #1B6FBF 0%, #00A8D6 100%)" }}>
        {emailUser.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground truncate">{emailUser.name}</div>
        <div className="text-[10px] text-muted-foreground truncate">{emailUser.email}</div>
      </div>
      <button
        onClick={() => logoutMut.mutate()}
        className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-muted-foreground transition-colors flex-shrink-0"
        title="退出登录"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function CommandLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { role, setRole } = useRole();
  const { emailUser } = useEmailAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-border bg-sidebar overflow-y-auto">

        {/* Brand Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border relative">
          {/* Top brand accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, #00A8D6 0%, #1B6FBF 60%, transparent 100%)" }} />
          {/* AIStorm Logo */}
          <img
            src="/manus-storage/aistorm-logo_534d597d.webp"
            alt="AIStorm"
            className="h-8 w-auto object-contain mb-2.5"
            style={{ filter: "brightness(2) contrast(1.1) saturate(1.2)" }}
          />
          {/* System name */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-sm font-bold tracking-wide" style={{ color: "#e8f4fb" }}>Command</div>
              <div className="text-[10px] tracking-wider uppercase" style={{ color: "rgba(0,168,214,0.75)" }}>Strategic Account AI System</div>
            </div>
            {/* Accent dot */}
            <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: "linear-gradient(180deg, #00A8D6, #1B6FBF)" }} />
          </div>
        </div>

        {/* Role Switcher */}
        <div className="px-3 py-2.5 border-b border-border">
          <div className="text-[10px] text-muted-foreground mb-2 font-semibold uppercase tracking-widest">当前角色</div>
          <div className="flex gap-1">
            {(["AD", "SAM", "SA", "RSM"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "flex-1 py-1.5 text-xs font-semibold rounded border transition-all",
                  role === r
                    ? roleColors[r]
                    : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5 text-center leading-tight">{roleDescriptions[role]}</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || (location === "/" && item.path === "/dashboard");
            return (
              <Link key={item.path} href={item.path}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 cursor-pointer transition-all group",
                  isActive
                    ? "text-white border border-[#00A8D6]/35"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground border border-transparent"
                )}
                  style={isActive ? { background: "linear-gradient(90deg, rgba(0,168,214,0.16) 0%, rgba(0,168,214,0.03) 100%)",
                    boxShadow: "inset 2px 0 0 #00A8D6" } : undefined}
                >
                  <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-[#00A8D6]" : "text-muted-foreground group-hover:text-foreground")} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{item.desc}</div>
                  </div>
                  {isActive && <ChevronRight className="w-3 h-3 text-[#00A8D6] flex-shrink-0" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Settings section */}
        <div className="px-2 pb-1 border-t border-border/50 pt-2">
          <div className="text-[10px] text-muted-foreground px-3 mb-1 font-semibold uppercase tracking-widest">辅助工具</div>
          {settingsNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 cursor-pointer transition-all group",
                  isActive
                    ? "text-white border border-[#00A8D6]/35"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground border border-transparent"
                )}
                  style={isActive ? { background: "linear-gradient(90deg, rgba(0,168,214,0.16) 0%, rgba(0,168,214,0.03) 100%)",
                    boxShadow: "inset 2px 0 0 #00A8D6" } : undefined}
                >
                  <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-[#00A8D6]" : "text-muted-foreground group-hover:text-foreground")} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{item.desc}</div>
                  </div>
                  {isActive && <ChevronRight className="w-3 h-3 text-[#00A8D6] flex-shrink-0" />}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Admin section */}
        {emailUser?.role === 'admin' && (
          <div className="px-2 pb-2 border-t border-border/50 pt-2">
            <div className="text-[10px] text-muted-foreground px-3 mb-1 font-semibold uppercase tracking-widest">管理员</div>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 cursor-pointer transition-all group",
                    isActive
                      ? "text-white border border-[#00A8D6]/35"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground border border-transparent"
                  )}
                    style={isActive ? { background: "linear-gradient(90deg, rgba(0,168,214,0.16) 0%, rgba(0,168,214,0.03) 100%)",
                    boxShadow: "inset 2px 0 0 #00A8D6" } : undefined}
                  >
                    <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-[#00A8D6]" : "text-muted-foreground group-hover:text-foreground")} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-tight">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{item.desc}</div>
                    </div>
                    {isActive && <ChevronRight className="w-3 h-3 text-[#00A8D6] flex-shrink-0" />}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-2">
          <EmailUserFooter />
          <div className="text-[10px] text-muted-foreground text-center">
            Powered by <span className="font-semibold" style={{ color: "#00A8D6" }}>AIStorm</span> · AI-Driven Sales Intelligence
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
