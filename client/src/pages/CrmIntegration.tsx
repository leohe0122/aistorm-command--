import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Database, CheckCircle2, XCircle, Upload, User, Briefcase,
  Eye, EyeOff, RefreshCw, Info, ExternalLink, Download, ArrowDownToLine
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CrmConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  username: string;
  password: string; // 账号密码 + 8位安全令牌直接拼接
}

interface CrmSession {
  accessToken: string;
  userId?: number;
}

export default function CrmIntegration() {
  const [config, setConfig] = useState<CrmConfig>({
    clientId: "",
    clientSecret: "",
    redirectUri: "https://api.xiaoshouyi.com",
    username: "",
    password: "", // 账号密码 + 8位安全令牌直接拼接
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState<CrmSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [pushingOpportunity, setPushingOpportunity] = useState<number | null>(null);
  const [pushingContact, setPushingContact] = useState<number | null>(null);
  const [pushedOpportunities, setPushedOpportunities] = useState<Set<number>>(new Set());
  const [pushedContacts, setPushedContacts] = useState<Set<number>>(new Set());
  const [opportunityStage, setOpportunityStage] = useState("Prospecting");
  const [opportunityAmount, setOpportunityAmount] = useState("");
  const [closeDate, setCloseDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split("T")[0];
  });
  const [pulledOpportunities, setPulledOpportunities] = useState<Array<{
    id: string; name: string; stage: string; amount?: number;
    closeDate?: string; ownerName?: string; lastModifiedDate?: string;
  }> | null>(null);
  const [pullingOpportunities, setPullingOpportunities] = useState(false);

  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.listByClient.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );
  // Fetch MEDDPICC data for all clients for comparison view
  const { data: allMeddpicc = [] } = trpc.meddpicc.getAll.useQuery();

  const testConnection = trpc.crm.testConnection.useMutation({
    onSuccess: (data) => {
      setConnecting(false);
      if (data.success && data.accessToken) {
        setSession({ accessToken: data.accessToken, userId: data.userId });
        toast.success("销售易连接成功！Token 已获取");
      } else {
        toast.error(data.error || "连接失败");
      }
    },
    onError: () => {
      setConnecting(false);
      toast.error("连接请求失败，请检查网络");
    },
  });

  const pushOpportunity = trpc.crm.pushOpportunity.useMutation({
    onSuccess: (data, vars) => {
      const clientId = clients.find((c: { id: number; name: string }) => c.name === vars.clientName)?.id;
      if (clientId) {
        setPushedOpportunities(prev => { const s = new Set(Array.from(prev)); s.add(clientId); return s; });
      }
      setPushingOpportunity(null);
      if (data.success) {
        toast.success(`商机已同步到销售易 (ID: ${data.crmId})`);
      } else {
        toast.error(data.error || "推送失败");
      }
    },
    onError: () => {
      setPushingOpportunity(null);
      toast.error("推送失败");
    },
  });

  const pushContact = trpc.crm.pushContact.useMutation({
    onSuccess: (data, vars) => {
      setPushingContact(null);
      if (data.success) {
        const contactId = contacts.find((c: { id: number; name: string }) => c.name === vars.fullName)?.id;
        if (contactId) {
          setPushedContacts(prev => { const s = new Set(Array.from(prev)); s.add(contactId); return s; });
        }
        toast.success(`联系人「${vars.fullName}」已同步到销售易`);
      } else {
        toast.error(data.error || "推送失败");
      }
    },
    onError: () => {
      setPushingContact(null);
      toast.error("推送失败");
    },
  });

  const pullOpportunitiesMutation = trpc.crm.pullOpportunities.useMutation({
    onSuccess: (data) => {
      setPullingOpportunities(false);
      if (data.success) {
        setPulledOpportunities(data.opportunities);
        toast.success(`从销售易拉取到 ${data.opportunities.length} 条商机（共 ${data.total} 条）`);
      } else {
        toast.error(data.error || "拉取失败");
      }
    },
    onError: () => {
      setPullingOpportunities(false);
      toast.error("拉取失败，请检查网络或Token");
    },
  });

  const handlePullOpportunities = () => {
    if (!session) { toast.error("请先连接销售易"); return; }
    setPullingOpportunities(true);
    pullOpportunitiesMutation.mutate({ accessToken: session.accessToken, pageSize: 20, pageNo: 1 });
  };

  const handleConnect = () => {
    if (!config.clientId || !config.clientSecret || !config.username || !config.password) {
      toast.error("请填写所有必填字段");
      return;
    }
    setConnecting(true);
    testConnection.mutate(config);
  };

  const handlePushOpportunity = (client: { id: number; name: string }) => {
    if (!session) { toast.error("请先连接销售易"); return; }
    setPushingOpportunity(client.id);
    pushOpportunity.mutate({
      accessToken: session.accessToken,
      clientName: client.name,
      stage: opportunityStage,
      amount: opportunityAmount ? parseFloat(opportunityAmount) : undefined,
      closeDate,
    });
  };

  const handlePushContact = (contact: { id: number; name: string; title?: string | null; email?: string | null; department?: string | null; notes?: string | null; [key: string]: unknown }) => {
    if (!session) { toast.error("请先连接销售易"); return; }
    const client = clients.find(c => c.id === selectedClientId);
    setPushingContact(contact.id);
    pushContact.mutate({
      accessToken: session.accessToken,
      fullName: contact.name,
      title: contact.title || undefined,
      email: contact.email || undefined,
      phone: contact.phone as string | undefined,
      department: contact.department || undefined,
      notes: contact.notes || undefined,
    });
  };

  const STAGES = ["Prospecting", "Qualification", "Needs Analysis", "Value Proposition", "Id. Decision Makers", "Perception Analysis", "Proposal/Price Quote", "Negotiation/Review", "Closed Won", "Closed Lost"];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">销售易 CRM 集成</h1>
          {session && (
            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded-full ml-2">
              <CheckCircle2 className="w-3 h-3" />已连接
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">配置销售易凭证，将T100专项商机和关键人数据同步到CRM，保持作战系统与CRM数据一致</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Config Panel */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-primary" />
              <div className="text-sm font-semibold text-foreground">连接配置</div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">实例地址 *</label>
                <Input
                  value={config.redirectUri}
                  onChange={e => setConfig(c => ({ ...c, redirectUri: e.target.value }))}
                  placeholder="https://api.xiaoshouyi.com"
                  className="text-xs h-8"
                />
                <div className="text-[10px] text-muted-foreground mt-1">销售易默认回调地址，一般无需修改</div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Client ID (Consumer Key) *</label>
                <Input
                  value={config.clientId}
                  onChange={e => setConfig(c => ({ ...c, clientId: e.target.value }))}
                  placeholder="3MVG9..."
                  className="text-xs h-8 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Client Secret (Consumer Secret) *</label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={config.clientSecret}
                    onChange={e => setConfig(c => ({ ...c, clientSecret: e.target.value }))}
                    placeholder="••••••••"
                    className="text-xs h-8 font-mono pr-8"
                  />
                  <button
                    onClick={() => setShowSecret(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">用户名 *</label>
                <Input
                  value={config.username}
                  onChange={e => setConfig(c => ({ ...c, username: e.target.value }))}
                  placeholder="user@company.com"
                  className="text-xs h-8"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">密码 *</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={config.password}
                    onChange={e => setConfig(c => ({ ...c, password: e.target.value }))}
                    placeholder="••••••••"
                    className="text-xs h-8 pr-8"
                  />
                  <button
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">安全令牌 (Security Token)</label>
                <Input
                  value={""}
                  onChange={() => {}}
                  placeholder="密码 = 账号密码 + 8位安全令牌直接拼接"
                  className="text-xs h-8 font-mono"
                />
              </div>

              <Button
                className="w-full gap-2 mt-2"
                onClick={handleConnect}
                disabled={connecting}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", connecting && "animate-spin")} />
                {connecting ? "连接中..." : session ? "重新连接" : "测试连接并获取 Token"}
              </Button>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">如何获取 API 凭证</div>
                <div>1. 登录销售易管理后台</div>
                <div>2. 进入「设置 → 应用管理 → 已连接的应用」</div>
                <div>3. 新建应用，获取 Consumer Key 和 Secret</div>
                <div>4. 在「个人设置 → 我的安全令牌」重置获取 Token</div>
                <a
                  href="https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_oauth_and_connected_apps.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  查看 API 文档
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Panel */}
        <div className="xl:col-span-2 space-y-4">
          {/* Opportunity Sync */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-4 h-4 text-primary" />
              <div className="text-sm font-semibold text-foreground">商机同步</div>
              <div className="text-xs text-muted-foreground ml-auto">将5户客户作为商机推送到销售易</div>
            </div>

            {/* Opportunity settings */}
            <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-muted/20 rounded-lg">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">商机阶段</label>
                <select
                  value={opportunityStage}
                  onChange={e => setOpportunityStage(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50"
                >
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">预计金额 (万元)</label>
                <Input
                  value={opportunityAmount}
                  onChange={e => setOpportunityAmount(e.target.value)}
                  placeholder="如 200"
                  className="text-xs h-7"
                  type="number"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">预计关单日期</label>
                <Input
                  type="date"
                  value={closeDate}
                  onChange={e => setCloseDate(e.target.value)}
                  className="text-xs h-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              {clients.map(client => (
                <div key={client.id} className="flex items-center justify-between p-3 bg-muted/10 rounded-lg border border-border">
                  <div>
                    <div className="text-sm font-medium text-foreground">{client.name}</div>
                    <div className="text-xs text-muted-foreground">{client.industry || "科技"} · {client.stage || "Prospecting"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pushedOpportunities.has(client.id) && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />已同步
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 text-xs"
                      onClick={() => handlePushOpportunity(client)}
                      disabled={!session || pushingOpportunity === client.id}
                    >
                      {pushingOpportunity === client.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                      {pushedOpportunities.has(client.id) ? "重新同步" : "推送到CRM"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {!session && (
              <div className="mt-3 text-xs text-muted-foreground text-center py-2 bg-muted/10 rounded-lg">
                请先在左侧配置并连接销售易账号
              </div>
            )}
          </div>

          {/* Pull from CRM */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <ArrowDownToLine className="w-4 h-4 text-cyan-400" />
              <div className="text-sm font-semibold text-foreground">从销售易拉取商机</div>
              <div className="text-xs text-muted-foreground ml-auto">反向同步：从 CRM 拉取商机列表并对比本地数据</div>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <Button
                className="gap-2"
                variant="outline"
                onClick={handlePullOpportunities}
                disabled={!session || pullingOpportunities}
              >
                {pullingOpportunities ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {pullingOpportunities ? "拉取中...请稍候" : "从销售易拉取商机"}
              </Button>
              {pulledOpportunities && (
                <span className="text-xs text-muted-foreground">已拉取 {pulledOpportunities.length} 条商机</span>
              )}
            </div>

            {!session && (
              <div className="text-xs text-muted-foreground text-center py-3 bg-muted/10 rounded-lg">
                请先在左侧配置并连接销售易账号
              </div>
            )}

            {pulledOpportunities !== null && (
              <div className="space-y-2">
                {pulledOpportunities.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">销售易中暂无商机数据</div>
                ) : (
                  pulledOpportunities.map(opp => {
                    // Match with local clients
                    const matchedClient = clients.find(c =>
                      opp.name.includes(c.name) || c.name.includes(opp.name.split(' ')[0])
                    );
                    const localMeddpicc = matchedClient
                      ? allMeddpicc.find((m: { clientId: number }) => m.clientId === matchedClient.id)
                      : null;
                    const localAvgScore = localMeddpicc?.meddpicc
                      ? Math.round((
                          localMeddpicc.meddpicc.metricsScore +
                          localMeddpicc.meddpicc.economicBuyerScore +
                          localMeddpicc.meddpicc.decisionCriteriaScore +
                          localMeddpicc.meddpicc.decisionProcessScore +
                          localMeddpicc.meddpicc.paperProcessScore +
                          localMeddpicc.meddpicc.implicatePainScore +
                          localMeddpicc.meddpicc.championScore +
                          localMeddpicc.meddpicc.competitionScore
                        ) / 8)
                      : null;
                    // Detect stage mismatch
                    const stageMismatch = matchedClient && matchedClient.stage !== opp.stage;
                    return (
                      <div key={opp.id} className="p-3 bg-muted/10 rounded-lg border border-border">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="text-sm font-medium text-foreground truncate">{opp.name}</div>
                              {matchedClient && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30 flex-shrink-0">
                                  匹配: {matchedClient.name}
                                </span>
                              )}
                              {!matchedClient && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border flex-shrink-0">未匹配本地</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="text-primary/70">销售易阶段: {opp.stage}</span>
                              {opp.amount && <span>金额: {opp.amount.toLocaleString()}</span>}
                              {opp.closeDate && <span>关单: {opp.closeDate}</span>}
                              {opp.ownerName && <span>负责人: {opp.ownerName}</span>}
                            </div>
                          </div>
                        </div>
                        {/* MEDDPICC Comparison Row */}
                        {matchedClient && (
                          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/50">
                            <div className="bg-muted/20 rounded-lg p-2">
                              <div className="text-[10px] text-muted-foreground mb-1">本地作战系统</div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-foreground">{matchedClient.stage}</span>
                                {localAvgScore !== null && (
                                  <span className="text-xs font-mono text-primary">MEDDPICC: {localAvgScore}</span>
                                )}
                              </div>
                              {localMeddpicc?.meddpicc && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {[
                                    { label: 'M', val: localMeddpicc.meddpicc.metricsScore },
                                    { label: 'E', val: localMeddpicc.meddpicc.economicBuyerScore },
                                    { label: 'C', val: localMeddpicc.meddpicc.championScore },
                                  ].map(({ label, val }) => (
                                    <span key={label} className={cn(
                                      "text-[10px] px-1 py-0.5 rounded font-mono",
                                      val >= 70 ? "bg-green-500/15 text-green-400" :
                                      val >= 40 ? "bg-yellow-500/15 text-yellow-400" :
                                      "bg-red-500/15 text-red-400"
                                    )}>{label}:{val}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="bg-muted/20 rounded-lg p-2">
                              <div className="text-[10px] text-muted-foreground mb-1">CRM 销售易</div>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-xs font-medium",
                                  stageMismatch ? "text-yellow-400" : "text-foreground"
                                )}>{opp.stage}</span>
                                {stageMismatch && (
                                  <span className="text-[10px] text-yellow-400">⚠ 阶段不一致</span>
                                )}
                              </div>
                              {opp.lastModifiedDate && (
                                <div className="text-[10px] text-muted-foreground mt-1">更新: {new Date(opp.lastModifiedDate).toLocaleDateString('zh-CN')}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Contact Sync */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-primary" />
              <div className="text-sm font-semibold text-foreground">关键人同步</div>
              <div className="text-xs text-muted-foreground ml-auto">将关键人图谱中的高管同步为联系人</div>
            </div>

            {/* Client selector for contacts */}
            <div className="mb-3">
              <div className="flex gap-2 flex-wrap">
                {clients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClientId(c.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      selectedClientId === c.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/20 text-muted-foreground border-border hover:border-muted-foreground/50"
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {!selectedClientId ? (
              <div className="text-center py-6 text-muted-foreground text-sm">选择客户查看关键人列表</div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">该客户暂无关键人数据</div>
            ) : (
              <div className="space-y-2">
                {contacts.map(contact => (
                  <div key={contact.id} className="flex items-center justify-between p-3 bg-muted/10 rounded-lg border border-border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-foreground">{contact.name}</div>
                        {contact.influence && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-primary/30 text-primary/70">{contact.influence}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {contact.title || "—"}
                        {contact.email && <span className="ml-2 text-primary/60">{contact.email}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {pushedContacts.has(contact.id) && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />已同步
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7 text-xs"
                        onClick={() => handlePushContact(contact)}
                        disabled={!session || pushingContact === contact.id}
                      >
                        {pushingContact === contact.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                        {pushedContacts.has(contact.id) ? "重新同步" : "推送联系人"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!session && (
              <div className="mt-3 text-xs text-muted-foreground text-center py-2 bg-muted/10 rounded-lg">
                请先在左侧配置并连接销售易账号
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
