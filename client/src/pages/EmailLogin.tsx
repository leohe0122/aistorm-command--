import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Mail, Lock, User, Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EmailLoginProps {
  onSuccess: (user: { id: number; email: string; name: string; role: string; podRole: string }) => void;
}

export default function EmailLogin({ onSuccess }: EmailLoginProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const loginMut = trpc.emailAuth.login.useMutation({
    onSuccess: (data) => {
      setLoading(false);
      if (data.success && data.user) {
        toast.success(`欢迎回来，${data.user.name}！`);
        onSuccess(data.user);
      }
    },
    onError: (e) => {
      setLoading(false);
      toast.error(e.message);
    },
  });

  const registerMut = trpc.emailAuth.register.useMutation({
    onSuccess: () => {
      setLoading(false);
      toast.success("注册成功！请使用邮箱和密码登录");
      setTab("login");
    },
    onError: (e) => {
      setLoading(false);
      toast.error(e.message);
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("请填写邮箱和密码"); return; }
    setLoading(true);
    loginMut.mutate({ email, password });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) { toast.error("请填写所有字段"); return; }
    if (!email.toLowerCase().endsWith("@aistorm.com")) {
      toast.error("仅允许使用 @aistorm.com 邮箱注册");
      return;
    }
    if (password.length < 8) { toast.error("密码至少 8 个字符"); return; }
    setLoading(true);
    registerMut.mutate({ email, password, name });
  };

  return (
    <div className="min-h-screen flex" style={{ background: "oklch(0.09 0.025 240)" }}>
      {/* Left panel - branding */}
      <div className="hidden md:flex md:w-5/12 flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, oklch(0.08 0.03 240) 0%, oklch(0.12 0.04 230) 100%)" }}>

        {/* Animated background circles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #00A8D6 0%, transparent 70%)" }} />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-8"
            style={{ background: "radial-gradient(circle, #4DB87A 0%, transparent 70%)" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
            style={{ background: "radial-gradient(circle, #1B6FBF 0%, transparent 60%)" }} />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <img
            src="/manus-storage/aistorm_logo_transparent_62266e48.png"
            alt="AIStorm"
            className="h-10 w-auto object-contain"
            style={{ filter: "brightness(1.25) saturate(1.1)" }}
          />
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            AIStorm<br />
            <span style={{ background: "linear-gradient(90deg, #00A8D6, #4DB87A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Command
            </span>
          </h2>
          <p className="text-base text-white/60 leading-relaxed max-w-sm">
            AI 驱动的大客户作战指挥系统。整合情报、MEDDPICC、POD 协同，让每一次拜访都精准高效。
          </p>

          {/* Feature tags */}
          <div className="flex flex-wrap gap-2 mt-6">
            {["战场地图", "情报雷达", "AI洞察", "POD协同", "Champion培养"].map(tag => (
              <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium text-white/70 border border-white/10"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-xs text-white/30">仅限 AIStorm 内部团队使用</p>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Mobile logo */}
        <div className="md:hidden mb-8">
          <img
            src="/manus-storage/aistorm_logo_transparent_62266e48.png"
            alt="AIStorm"
            className="h-8 w-auto object-contain"
            style={{ filter: "brightness(1.25) saturate(1.1)" }}
          />
        </div>

        <div className="w-full max-w-md">
          {/* Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">
              {tab === "login" ? "欢迎回来" : "创建账号"}
            </h1>
            <p className="text-sm text-white/40">
              {tab === "login" ? "使用公司邮箱登录 AIStorm Command" : "使用 @aistorm.com 邮箱注册"}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 rounded-xl mb-6"
            style={{ background: "oklch(0.14 0.022 240)" }}>
            <button
              onClick={() => setTab("login")}
              className={cn(
                "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
                tab === "login"
                  ? "text-white shadow-sm"
                  : "text-white/40 hover:text-white/70"
              )}
              style={tab === "login" ? { background: "linear-gradient(135deg, #1B6FBF, #00A8D6)" } : undefined}
            >
              登录
            </button>
            <button
              onClick={() => setTab("register")}
              className={cn(
                "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
                tab === "register"
                  ? "text-white shadow-sm"
                  : "text-white/40 hover:text-white/70"
              )}
              style={tab === "register" ? { background: "linear-gradient(135deg, #1B6FBF, #00A8D6)" } : undefined}
            >
              注册账号
            </button>
          </div>

          {/* Form */}
          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block font-medium">公司邮箱</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="yourname@aistorm.com"
                    className="pl-9 h-11 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block font-medium">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-9 h-11 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 mt-2 transition-opacity disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #1B6FBF 0%, #00A8D6 100%)" }}
              >
                <LogIn className="w-4 h-4" />
                {loading ? "登录中..." : "登录"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block font-medium">姓名</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="请输入真实姓名"
                    className="pl-9 h-11 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block font-medium">公司邮箱</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="yourname@aistorm.com"
                    className="pl-9 h-11 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50"
                    autoComplete="email"
                  />
                </div>
                <p className="text-[10px] text-white/25 mt-1">仅接受 @aistorm.com 邮箱注册</p>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block font-medium">设置密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="至少 8 个字符"
                    className="pl-9 pr-9 h-11 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-cyan-500/50"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 mt-2 transition-opacity disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #1B6FBF 0%, #00A8D6 100%)" }}
              >
                <User className="w-4 h-4" />
                {loading ? "注册中..." : "创建账号"}
              </button>
            </form>
          )}

          <p className="text-center text-[11px] text-white/25 mt-6">
            仅限 AIStorm 内部团队使用 · 如有问题请联系系统管理员
          </p>
        </div>
      </div>
    </div>
  );
}
