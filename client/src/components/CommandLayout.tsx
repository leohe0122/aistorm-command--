import { ReactNode, useState, Fragment } from "react";
import { Link, useLocation } from "wouter";
import AIStormLogo from "@/components/AIStormLogo";
import { cn } from "@/lib/utils";
import {
  Map, Users, MessageSquare,
  ChevronRight, Database, Bell, Crosshair, LogOut, LayoutDashboard, Settings, Plus
} from "lucide-react";
import { UserCog, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmailAuth } from "@/App";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const navItems = [
  { path: "/dashboard", label: "AD 指挥台", icon: LayoutDashboard, desc: "AI 今日指令 · 异常预警 · 挂起确认" },
  { path: "/battle-map", label: "战场地图", icon: Map, desc: "Account Map · Deal Map · 全局态势" },
  { path: "/meeting-minutes", label: "拜访作战日志", icon: MessageSquare, desc: "拜访录入·AI解析·更新战场" },
  { path: "/pod-center", label: "POD 协同", icon: Users, desc: "角色任务视图 · 跨部门协同（次级汇总）" },
  { path: "/arsenal", label: "武器库 Arsenal", icon: Crosshair, desc: "产品文档·AI方案·竞品阻击包" },
  { path: "/daily-briefing", label: "每日情报简报", icon: Bell, desc: "战场动态 · 合规信号 · 行业情报" },
];

const settingsNavItems = [
  { path: "/settings", label: "系统设置", icon: Settings, desc: "RSS · 飞书 · CRM" },
  { path: "/team", label: "团队成员管理", icon: UserCog, desc: "增删改 SAM/RSM/SA/AD" },
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
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const changePwdMut = trpc.emailAuth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("密码已修改，请重新登录");
      setShowChangePwd(false);
      setCurPwd(""); setNewPwd(""); setNewPwd2("");
      setTimeout(() => { logoutMut.mutate(); }, 1500);
    },
    onError: (e) => toast.error(e.message),
  });
  if (!emailUser) return null;
  return (
    <Fragment>
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
        onClick={() => setShowChangePwd(true)}
        className="p-1 rounded hover:bg-purple-500/20 hover:text-purple-400 text-muted-foreground transition-colors flex-shrink-0"
        title="修改密码"
      >
        <KeyRound className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => logoutMut.mutate()}
        className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-muted-foreground transition-colors flex-shrink-0"
        title="退出登录"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
    <Dialog open={showChangePwd} onOpenChange={setShowChangePwd}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-purple-400" /> 修改密码
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">当前密码</label>
            <Input type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)} placeholder="输入当前密码" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">新密码（至少8位）</label>
            <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="新密码" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">确认新密码</label>
            <Input type="password" value={newPwd2} onChange={e => setNewPwd2(e.target.value)} placeholder="再次输入新密码" className="h-9 text-sm" />
            {newPwd && newPwd2 && newPwd !== newPwd2 && <div className="text-[10px] text-red-400 mt-1">两次密码不一致</div>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowChangePwd(false)}>取消</Button>
          <Button
            onClick={() => {
              if (!curPwd || !newPwd) { toast.error("请填写完整"); return; }
              if (newPwd !== newPwd2) { toast.error("两次密码不一致"); return; }
              if (newPwd.length < 8) { toast.error("新密码至少8位"); return; }
              changePwdMut.mutate({ currentPassword: curPwd, newPassword: newPwd });
            }}
            disabled={changePwdMut.isPending}
          >
            {changePwdMut.isPending ? "修改中..." : "确认修改"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </Fragment>
  );
}

export default function CommandLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { emailUser } = useEmailAuth();
  const [showQuickEntry, setShowQuickEntry] = useState(false);

  // Role-based visibility: AD sees everything, others see restricted items
  const isAD = !emailUser || emailUser.podRole === 'AD';

  // All items are shown; AD-only items are locked for non-AD users
  const visibleNavItems = navItems;
  const visibleSettingsNavItems = settingsNavItems;

  const AD_ONLY_PATHS = ['/dashboard'];
  const ADMIN_ONLY_PATHS = ['/settings', '/team'];

  const getItemLock = (path: string): { locked: boolean; message: string } | null => {
    if (!isAD && AD_ONLY_PATHS.includes(path)) {
      return { locked: true, message: '你的真实输入，是 AD 读懂你的战场、给你精准支持的唯一依据。' };
    }
    if (!isAD && ADMIN_ONLY_PATHS.includes(path)) {
      return { locked: true, message: '此功能仅限管理员使用' };
    }
    return null;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col border-r border-border bg-sidebar overflow-y-auto">

        {/* Brand Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border relative">
          {/* Top brand accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, #00A8D6 0%, #1B6FBF 60%, transparent 100%)" }} />
          {/* AIStorm Logo */}
          <AIStormLogo height={20} showText={true} className="mb-2" />
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
        {emailUser && (
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <span className={cn("text-xs px-2 py-0.5 rounded border font-semibold", roleColors[emailUser.podRole ?? 'SAM'] || "bg-muted text-muted-foreground border-border")}>
                {emailUser.podRole ?? 'SAM'}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">{roleDescriptions[emailUser.podRole ?? 'SAM']}</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || (location === "/" && item.path === "/dashboard");
            const lock = getItemLock(item.path);
            if (lock) {
              return (
                <div key={item.path}
                  onClick={() => toast(lock.message, { icon: '🔒', duration: 4000 })}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 cursor-pointer transition-all opacity-40 hover:opacity-60 border border-transparent"
                >
                  <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight text-muted-foreground">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">{item.desc}</div>
                  </div>
                  <span className="text-[9px] text-muted-foreground/50 flex-shrink-0">🔒</span>
                </div>
              );
            }
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
          {visibleSettingsNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            const lock = getItemLock(item.path);
            if (lock) {
              return (
                <div key={item.path}
                  onClick={() => toast(lock.message, { icon: '🔒', duration: 4000 })}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 cursor-pointer transition-all opacity-40 hover:opacity-60 border border-transparent"
                >
                  <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight text-muted-foreground">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">{item.desc}</div>
                  </div>
                  <span className="text-[9px] text-muted-foreground/50 flex-shrink-0">🔒</span>
                </div>
              );
            }
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

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-2">
          <EmailUserFooter />
          <div className="text-[10px] text-muted-foreground text-center">
            Powered by <span className="font-semibold" style={{ color: "#00A8D6" }}>AIStorm</span> · AI-Driven Sales Intelligence
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Page content */}
        <div className="flex-1 pb-16 md:pb-0 animate-in fade-in duration-200">
          {children}
        </div>
      </main>
      {/* Mobile bottom navigation */}
      {/* Quick entry menu */}
      <div className={cn(
        "md:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 items-center transition-all duration-300 ease-out",
        showQuickEntry ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-8 pointer-events-none"
      )}>
        <button
          type="button"
          onClick={() => {
            setShowQuickEntry(false);
            window.location.href = '/meeting-minutes?voice=1';
          }}
          className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-border shadow-xl text-sm font-medium text-foreground w-44 justify-center"
        >
          <span className="text-xl">🎙️</span>
          语音录入
        </button>
        <a
          href="/meeting-minutes"
          onClick={() => setShowQuickEntry(false)}
          className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-border shadow-xl text-sm font-medium text-foreground w-44 justify-center"
        >
          <span className="text-xl">✏️</span>
          文本录入
        </a>
      </div>
      {showQuickEntry && (
        <>
          <div className="md:hidden fixed inset-0 z-40" onClick={() => setShowQuickEntry(false)} />
        </>
      )}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-border flex items-center justify-around px-1 py-1.5">
        {[
          { path: "/battle-map", icon: Map, label: "战场" },
        ].map(({ path, icon: Icon, label }) => {
          const isActive = location === path;
          return (
            <Link key={path} href={path}>
              <div className={cn("flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all duration-200", isActive ? "text-[#00A8D6]" : "text-muted-foreground")}>
                <Icon className={cn("w-5 h-5 transition-transform duration-200", isActive ? "scale-110" : "scale-100")} />
                <span className="text-[9px] font-medium">{label}</span>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#00A8D6] mt-0.5" />}
              </div>
            </Link>
          );
        })}
        {/* 中心录入按钮 */}
          <div
            className="flex flex-col items-center gap-0.5 px-1 py-0.5 -mt-3 cursor-pointer"
            onClick={() => setShowQuickEntry(o => !o)}
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200",
              showQuickEntry ? "scale-90" : "scale-100"
            )} style={{ background: "linear-gradient(135deg, #00A8D6 0%, #1B6FBF 100%)" }}>
              <Plus className={cn("w-6 h-6 text-white transition-transform duration-200", showQuickEntry ? "rotate-45" : "rotate-0")} />
            </div>
            <span className="text-[9px] font-medium text-[#00A8D6]">{showQuickEntry ? "关闭" : "录入"}</span>
          </div>
        {[
          { path: "/pod-center", icon: Users, label: "POD" },
        ].map(({ path, icon: Icon, label }) => {
          const isActive = location === path || (location === "/" && path === "/dashboard");
          return (
            <Link key={path} href={path}>
              <div className={cn("flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all duration-200", isActive ? "text-[#00A8D6]" : "text-muted-foreground")}>
                <Icon className={cn("w-5 h-5 transition-transform duration-200", isActive ? "scale-110" : "scale-100")} />
                <span className="text-[9px] font-medium">{label}</span>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#00A8D6] mt-0.5" />}
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
