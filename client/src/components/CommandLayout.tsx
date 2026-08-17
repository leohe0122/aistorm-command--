import { ReactNode, useState, Fragment } from "react";
import { Link, useLocation } from "wouter";
import AIStormLogo from "@/components/AIStormLogo";
import { cn } from "@/lib/utils";
import {
  Map, Radio, Zap, FileText, Users, MessageSquare, TrendingUp,
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
  { path: "/dashboard", label: "AD 指挥台", icon: LayoutDashboard, desc: "Portfolio Review 看板" },
  { path: "/battle-map", label: "战场地图", icon: Map, desc: "MEDDPICC看板" },
  { path: "/intel-radar", label: "客户情报雷达", icon: Radio, desc: "信号监控与解读" },
  { path: "/quick-review", label: "⚡ 快速 Review", icon: TrendingUp, desc: "选客户，一键生成 AI Review" },
  { path: "/ai-insights", label: "AI洞察简报", icon: FileText, desc: "拜访前客户洞察 1-Pager" },
  { path: "/meeting-minutes", label: "拜访作战日志", icon: MessageSquare, desc: "拜访录入·AI解析·更新战场" },
  { path: "/action-command", label: "AI行动指令台", icon: Zap, desc: "优先行动推荐" },
  { path: "/pod-center", label: "POD协同中枢", icon: Users, desc: "角色任务视图" },
  { path: "/arsenal", label: "武器库 Arsenal", icon: Crosshair, desc: "产品文档·AI方案·竞品阻击包" },
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
  const [showReviewTip, setShowReviewTip] = useState(() => {
    try { return localStorage.getItem('aistorm_review_tip_dismissed') !== '1'; } catch { return true; }
  });
  const dismissReviewTip = () => {
    setShowReviewTip(false);
    try { localStorage.setItem('aistorm_review_tip_dismissed', '1'); } catch {}
  };
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
        {/* Global top bar — desktop only */}
        <div className="hidden md:flex items-center justify-end px-6 py-2 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="relative">
            <Link href="/quick-review" onClick={dismissReviewTip}>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 hover:border-primary/40 transition-all">
                <Zap className="w-3.5 h-3.5" />
                ⚡ 快速 Review
              </button>
            </Link>
            {showReviewTip && (
              <div className="absolute top-full right-0 mt-2 w-64 z-50 bg-card border border-primary/30 rounded-xl shadow-lg shadow-primary/10 p-3">
                <div className="absolute -top-1.5 right-6 w-3 h-3 bg-card border-l border-t border-primary/30 rotate-45" />
                <p className="text-xs text-foreground leading-relaxed">
                  不知道从哪开始？点击这里让 AI 帮你梳理客户现状 🎯
                </p>
                <button
                  type="button"
                  onClick={dismissReviewTip}
                  className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  知道了，不再显示 ✕
                </button>
              </div>
            )}
          </div>
        </div>
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
          { path: "/quick-review", icon: TrendingUp, label: "Review" },
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
          { path: "/intel-radar", icon: Radio, label: "情报" },
          { path: "/action-command", icon: Zap, label: "指令台" },
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
