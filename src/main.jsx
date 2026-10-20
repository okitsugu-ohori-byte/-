import React, { useEffect, useState, createContext, useContext } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Sparkles,
  FileText,
  ChartNoAxesCombined,
  Columns3,
  Presentation,
  BookOpen,
  Settings2,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  CalendarDays,
  Clock3,
  Check,
  CheckCheck,
  X,
  ExternalLink,
  Download,
  Upload,
  CircleHelp,
  Search,
  Bell,
  LoaderCircle,
  Link2,
  CircleCheck,
  TriangleAlert,
  MoreHorizontal,
  Trash2,
  Play,
  Menu,
  MessageSquareText,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  Zap,
  Instagram,
  MousePointer2,
  FolderOpen,
  Hash,
  CheckCircle2,
} from "lucide-react";
import Papa from "papaparse";
import "./style.css";

const Ctx = createContext();
const useApp = () => useContext(Ctx);
const nav = [
  ["dashboard", "ホーム", LayoutDashboard],
  ["actions", "AIワークフロー", Sparkles],
  ["minutes", "議事録・アクション", FileText],
  ["insights", "競合・トレンド分析", ChartNoAxesCombined],
  ["posts", "投稿管理", Columns3],
  ["reports", "定例レポート", Presentation],
  ["documents", "Drive・資料ワークフロー", FolderOpen],
  ["skills", "Skills・指示の管理", BookOpen],
  ["settings", "連携・設定", Settings2],
];
const statusLabels = {
  idea: "企画",
  draft: "制作中",
  review: "確認待ち",
  approved: "承認済み",
  published: "公開済み",
};
const priorities = { high: "高", medium: "中", low: "低" };
const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("ja-JP"));
const range = (today, days = 7) => {
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days + 1);
  return { from: d.toISOString().slice(0, 10), to: today };
};
const safeUrl = (u) => {
  try {
    const x = new URL(u);
    return ["https:", "http:"].includes(x.protocol) ? x.href : "#";
  } catch {
    return "#";
  }
};
const safeClaudeProjectUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "claude.ai" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/project\/[\w-]+\/?$/.test(url.pathname)
      ? url.href
      : "";
  } catch {
    return "";
  }
};
const dateLabel = (s) =>
  s ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : "期日未定";
async function request(path, body, method) {
  const r = await fetch("/api" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let v;
  try {
    v = await r.json();
  } catch {
    throw new Error("サーバーに接続できません。起動状態を確認してください。");
  }
  if (!r.ok) throw new Error(v.error || "処理に失敗しました");
  return v;
}
function Button({
  children,
  variant = "",
  icon: Icon,
  onClick,
  type = "button",
  ...props
}) {
  return (
    <button
      className={`btn ${variant}`}
      type={type}
      onClick={onClick}
      {...props}
    >
      {Icon && <Icon size={16} />} {children}
    </button>
  );
}
function Tag({ children, color = "neutral" }) {
  return <span className={`tag ${color}`}>{children}</span>;
}
function Platform({ value }) {
  return (
    <span
      className={`platform ${value === "Instagram" ? "insta" : "x-platform"}`}
    >
      {value === "Instagram" ? (
        <Instagram size={13} />
      ) : (
        <span className="x-symbol">𝕏</span>
      )}
      {value}
    </span>
  );
}
function Empty({ icon: Icon = FolderOpen, title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={25} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Notice({ children, tone = "info" }) {
  return (
    <div className={`notice ${tone}`}>
      {tone === "warning" ? (
        <TriangleAlert size={17} />
      ) : (
        <CircleHelp size={17} />
      )}
      <span>{children}</span>
    </div>
  );
}
function Field({ label, hint, children, wide = false }) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-header-actions">{actions}</div>
    </div>
  );
}
function Modal({ title, children, onClose, wide = false, layer = 100 }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: layer }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Provenance({ item }) {
  return (
    <div className="provenance">
      {item.demo ? (
        <>
          <Tag color="amber">サンプル・架空データ</Tag>
          <span>AI未使用</span>
        </>
      ) : (
        <>
          <ShieldCheck size={13} />
          <span>{item.provenance?.model || "手動登録"}</span>
          {item.provenance?.skills?.map((s) => (
            <span key={s.id} title={s.sha256}>
              {s.name} · {s.sha256.slice(0, 8)}
            </span>
          ))}
        </>
      )}
    </div>
  );
}
function DateFields({ value, onChange }) {
  return (
    <div className="date-fields">
      <input
        aria-label="開始日"
        type="date"
        required
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
      />
      <span>—</span>
      <input
        aria-label="終了日"
        type="date"
        required
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
      />
    </div>
  );
}
function SourceLinks({ ids, data }) {
  return (
    <div className="source-links">
      {ids.map((id, i) => {
        const o = data.observations.find((o) => o.id === id);
        return o ? (
          <a key={id} href={safeUrl(o.url)} target="_blank" rel="noreferrer">
            出典 {i + 1} · {o.account}
            <ArrowUpRight size={11} />
          </a>
        ) : null;
      })}
    </div>
  );
}

function App() {
  const [data, setData] = useState(null),
    [page, setPage] = useState("dashboard"),
    [toast, setToast] = useState(null),
    [busy, setBusy] = useState(""),
    [mobile, setMobile] = useState(false),
    [help, setHelp] = useState(false),
    [query, setQuery] = useState(""),
    [docMode, setDocMode] = useState("library");
  async function reload() {
    try {
      setData(await request("/state"));
    } catch (e) {
      setToast({ error: true, text: e.message });
    }
  }
  useEffect(() => {
    reload();
    const timer = setInterval(reload, 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(
        () => setToast(null),
        toast.error ? 12000 : 4500,
      );
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function act(label, fn, success = "保存しました") {
    if (busy) return null;
    setBusy(label);
    try {
      const v = await fn();
      await reload();
      if (success)
        setToast({
          text: typeof success === "function" ? success(v) : success,
        });
      return v;
    } catch (e) {
      setToast({ error: true, text: e.message });
      return null;
    } finally {
      setBusy("");
    }
  }
  const go = (p, mode) => {
    if (p === "documents" && mode) setDocMode(mode);
    setPage(p);
    setMobile(false);
    setQuery("");
    window.scrollTo(0, 0);
  };
  if (!data)
    return (
      <div className="loading-screen">
        <span className="brand-mark">K</span>
        <LoaderCircle className="spin" />
        <p>{toast?.text || "ワークスペースを準備しています"}</p>
        <Button onClick={reload}>再接続</Button>
      </div>
    );
  const context = {
    data,
    reload,
    act,
    busy,
    go,
    notify: (text, error = false) => setToast({ text, error }),
  };
  const searchResults = query.trim()
    ? [
        ...data.posts
          .filter((p) => p.title.includes(query) || p.product.includes(query))
          .map((p) => ({ title: p.title, category: "投稿", page: "posts" })),
        ...data.tasks
          .filter((p) => p.title.includes(query))
          .map((p) => ({
            title: p.title,
            category: "アクション",
            page: "minutes",
          })),
        ...data.reports
          .filter((p) => p.title.includes(query))
          .map((p) => ({ title: p.title, category: "資料", page: "reports" })),
        ...data.skills
          .filter((p) => p.name.includes(query))
          .map((p) => ({ title: p.name, category: "Skills", page: "skills" })),
      ].slice(0, 6)
    : [];
  const pages = {
    dashboard: <Dashboard />,
    actions: <Actions />,
    minutes: <Minutes />,
    insights: <Insights />,
    posts: <Posts />,
    reports: <Reports />,
    skills: <Skills />,
    documents: <Documents initialMode={docMode} />,
    settings: <Settings />,
  };
  return (
    <Ctx.Provider value={context}>
      <div className="app-shell">
        {mobile && (
          <div className="sidebar-scrim" onClick={() => setMobile(false)} />
        )}
        <aside className={`sidebar ${mobile ? "open" : ""}`}>
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              go("dashboard");
            }}
          >
            <span className="brand-mark">
              k<span>•</span>
            </span>
            <div>
              <strong>
                KADEN<span>Concierge</span>
              </strong>
              <small>SOCIAL WORKSPACE</small>
            </div>
          </a>
          <div className="workspace-switch">
            <span className="workspace-avatar">H</span>
            <div>
              <strong>日立の家電品</strong>
              <small>SNS運用チーム</small>
            </div>
            <span className="workspace-dot" />
          </div>
          <div className="nav-label">WORKSPACE</div>
          <nav>
            {nav.slice(0, 7).map(([id, label, Icon]) => (
              <button
                key={id}
                className={`nav-item ${page === id ? "active" : ""}`}
                onClick={() => go(id)}
              >
                <Icon size={18} strokeWidth={1.7} />
                <span>{label}</span>
                {id === "actions" && <span className="nav-new">AI</span>}
                {id === "posts" &&
                  data.posts.filter((p) => p.status === "review").length >
                    0 && (
                    <span className="nav-count">
                      {data.posts.filter((p) => p.status === "review").length}
                    </span>
                  )}
              </button>
            ))}
          </nav>
          <div className="nav-label second">CONFIGURATION</div>
          <nav>
            {nav.slice(7).map(([id, label, Icon]) => (
              <button
                key={id}
                className={`nav-item ${page === id ? "active" : ""}`}
                onClick={() => go(id)}
              >
                <Icon size={18} strokeWidth={1.7} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="claude-card">
              <div>
                <span className="claude-spark">✳</span>
                <strong>Powered by Claude</strong>
                <span
                  className={`status-dot ${data.connections.claude ? "connected" : ""}`}
                />
              </div>
              <p>
                {data.connections.claude
                  ? "あなたのSkillsで、いつもの仕事を。"
                  : "Skillsを引き継いで、仕事をもっと軽やかに。"}
              </p>
              <button
                onClick={() =>
                  go(data.connections.claude ? "skills" : "settings")
                }
              >
                {data.connections.claude
                  ? "指示を管理する"
                  : "Claudeを接続する"}
                <ArrowUpRight size={13} />
              </button>
            </div>
            <button className="profile" onClick={() => setHelp(true)}>
              <span className="avatar">運</span>
              <div>
                <strong>運用ワークスペース</strong>
                <small>ローカル保存 · JST</small>
              </div>
              <CircleHelp size={17} />
            </button>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-btn mobile-menu"
                onClick={() => setMobile(true)}
                aria-label="メニュー"
              >
                <Menu size={20} />
              </button>
              <span>日立の家電品</span>
              <ChevronRight size={13} />
              <strong>{nav.find((n) => n[0] === page)?.[1]}</strong>
            </div>
            <div className="topbar-right">
              <div className="search-wrap">
                <Search size={15} />
                <input
                  placeholder="投稿・タスクを検索"
                  aria-label="ワークスペース内を検索"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <div className="search-results">
                    {searchResults.length ? (
                      searchResults.map((r, i) => (
                        <button key={i} onClick={() => go(r.page)}>
                          <span>{r.title}</span>
                          <Tag>{r.category}</Tag>
                        </button>
                      ))
                    ) : (
                      <p>該当するデータがありません</p>
                    )}
                  </div>
                )}
              </div>
              <span className="top-date">
                {data.today.replaceAll("-", ".")}
              </span>
              <button
                className="icon-btn notification"
                aria-label="実行履歴を表示"
                onClick={() => go("actions")}
              >
                <Bell size={18} />
                {data.runs.some((r) => r.status === "failed") && <i />}
              </button>
              <span className="avatar small">運</span>
            </div>
          </header>
          <main>{pages[page]}</main>
          <footer>
            <span>
              KADEN Concierge <span className="footer-dot">·</span>{" "}
              SNS運用ワークスペース
            </span>
            <span>
              AI生成物は確認・承認してから活用 <ShieldCheck size={12} />
            </span>
          </footer>
        </div>
        {busy && (
          <div className="busy-indicator" role="status">
            <LoaderCircle size={17} className="spin" />
            {busy}…
          </div>
        )}
        {toast && (
          <div className={`toast ${toast.error ? "error" : ""}`} role="alert">
            {toast.error ? (
              <TriangleAlert size={19} />
            ) : (
              <CircleCheck size={19} />
            )}
            <span>{toast.text}</span>
            <button
              className="icon-btn"
              onClick={() => setToast(null)}
              aria-label="通知を閉じる"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {help && (
          <Modal
            title="このワークスペースについて"
            onClose={() => setHelp(false)}
          >
            <div className="modal-body prose">
              <p>
                日立の家電品のSNS運用を支援する開発版ツールです。日立の公式サービスではありません。
              </p>
              <p>
                データはこのサーバーのSQLiteに保存します。Claudeへの送信はAI実行時のみ。カレンダー登録・シート追記にはGoogle認証が必要です。
              </p>
              <p>
                サンプルは架空データです。外部サービスへの書き込みには使用できません。スケジュール実行はサーバーの稼働中のみ動作します。
              </p>
              <Button
                onClick={() => {
                  setHelp(false);
                  go("settings");
                }}
              >
                連携設定へ
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </Ctx.Provider>
  );
}

function Dashboard() {
  const { data, go, act, busy } = useApp();
  const demo = data.posts.some((p) => p.demo),
    review = data.posts.filter((p) => p.status === "review").length,
    pending = data.tasks.filter((t) => t.status !== "done"),
    week = range(data.today);
  const weekPosts = data.posts.filter(
      (p) => p.date && p.date >= week.from && p.date <= week.to,
    ),
    done = data.posts.filter((p) => p.status === "published");
  const quick = [
    [
      "minutes",
      "議事録から、次の一手へ",
      "議事録を入力してアクションを整理",
      FileText,
      "rose",
    ],
    [
      "insights",
      "競合のヒントを、企画へ",
      "好調投稿を分析して企画案を作成",
      ChartNoAxesCombined,
      "sage",
    ],
    [
      "posts",
      "投稿の進捗を、ひと目で",
      "制作から確認・公開まで一元管理",
      Columns3,
      "sand",
    ],
    [
      "reports",
      "定例資料を、スムーズに",
      "週次・月次レポートを自動生成",
      Presentation,
      "lavender",
    ],
  ];
  return (
    <>
      <div className="dashboard-intro">
        <div>
          <div className="eyebrow">YOUR SOCIAL OPERATIONS, CONNECTED.</div>
          <h1>今日も、暮らしに寄りそう発信を。</h1>
          <p>アイデアから運用まで。チームの「次の一手」を、ここから。</p>
        </div>
        <div className="greeting-date">
          <CalendarDays size={15} />
          {new Intl.DateTimeFormat("ja-JP", {
            month: "long",
            day: "numeric",
            weekday: "short",
            timeZone: "Asia/Tokyo",
          }).format(new Date(data.today + "T00:00:00Z"))}
          <Tag color="green">JST</Tag>
        </div>
      </div>
      {demo && (
        <div className="demo-banner">
          <Sparkles size={16} />
          <span>
            サンプル表示中{" "}
            <small>
              数値・投稿・担当者はすべて架空です。実際の運用データではありません。
            </small>
          </span>
          <button
            disabled={!!busy}
            onClick={() =>
              act(
                "サンプルを削除",
                () => request("/demo", null, "DELETE"),
                "サンプルを削除しました",
              )
            }
          >
            サンプルを消す
            <X size={13} />
          </button>
        </div>
      )}
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span /> KADEN AI CONCIERGE
          </span>
          <h2>
            日々の気づきを、
            <br />
            心に届く企画へ。
          </h2>
          <p>
            議事録も、競合分析も、定例レポートも。
            <br />
            いつもの業務に、あなたのAIコンシェルジュを。
          </p>
          <Button
            variant="primary"
            icon={Sparkles}
            onClick={() => go("actions")}
          >
            AIワークフローをはじめる <ArrowRight size={15} />
          </Button>
          <div className="hero-footnote">
            <ShieldCheck size={12} />
            あなたのSkills・運用ルールを反映
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="petals">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={{ "--i": i }} />
            ))}
          </div>
          <div className="floating-note note-one">
            <span className="note-icon">
              <FileText size={18} />
            </span>
            <div>
              <strong>議事録 → アクション</strong>
              <small>話し合いを、実行につなぐ</small>
            </div>
            <CheckCircle2 size={17} className="green-text" />
          </div>
          <div className="floating-note note-two">
            <span className="note-icon sage">
              <Sparkles size={18} />
            </span>
            <div>
              <small>NEXT CREATIVE IDEA</small>
              <strong>暮らしに、新しいひらめきを。</strong>
            </div>
          </div>
          <div className="visual-dot d1" />
          <div className="visual-dot d2" />
          <span className="hero-visual-label">INSIGHT INTO ACTION.</span>
        </div>
      </section>
      <div className="performance-strip">
        <div>
          <span>重点指標</span>
          <small>日立アカウント実績 · 直近7日</small>
        </div>
        {[
          ["impressions", "IMP"],
          ["engagements", "ENG"],
          ["views", "再生数"],
        ].map(([key, label]) => {
          const rows = data.observations.filter(
            (o) =>
              o.accountType === "own" &&
              o.date >= week.from &&
              o.date <= week.to &&
              o[key] != null,
          );
          return (
            <button key={key} onClick={() => go("insights")}>
              <span>{label}</span>
              <strong>
                {rows.length ? fmt(rows.reduce((n, o) => n + o[key], 0)) : "—"}
              </strong>
              <small>
                {rows.length
                  ? `${rows.length}投稿の入力値合計`
                  : "実績データ未入力"}
              </small>
            </button>
          );
        })}
        <button className="text-link" onClick={() => go("insights")}>
          実績を登録
          <ArrowUpRight size={13} />
        </button>
      </div>
      <div className="metrics-grid">
        {[
          [
            CalendarDays,
            "今週の投稿",
            weekPosts.length,
            "予定・公開を含む",
            "件",
            "rose",
          ],
          [Clock3, "確認待ち", review, "チームのレビュー待ち", "件", "amber"],
          [
            ClipboardList,
            "未完了アクション",
            pending.length,
            "議事録・手動登録から",
            "件",
            "sage",
          ],
          [
            Presentation,
            "作成したレポート",
            data.reports.length,
            "週次・月次の資料",
            "件",
            "lavender",
          ],
        ].map(([Icon, label, note, sub, unit, color]) => (
          <button
            className="metric-card"
            key={label}
            onClick={() =>
              go(
                label === "未完了アクション"
                  ? "minutes"
                  : label === "作成したレポート"
                    ? "reports"
                    : "posts",
              )
            }
          >
            <div className="metric-top">
              <span>{label}</span>
              <span className={`metric-icon ${color}`}>
                <Icon size={17} />
              </span>
            </div>
            <div className="metric-value">
              {note}
              <small>{unit}</small>
            </div>
            <div className="metric-sub">
              {sub}
              <ArrowUpRight size={13} />
            </div>
          </button>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <h2>いつもの業務を、ワンクリックで。</h2>
          <span>QUICK ACTIONS</span>
        </div>
        <button className="text-link" onClick={() => go("actions")}>
          すべてのワークフロー
          <ArrowRight size={14} />
        </button>
      </div>
      <div className="quick-grid">
        {quick.map(([id, title, sub, Icon, color], i) => (
          <button key={id} className="quick-card" onClick={() => go(id)}>
            <span className={`quick-icon ${color}`}>
              <Icon size={22} strokeWidth={1.5} />
            </span>
            <span className="quick-number">0{i + 1}</span>
            <h3>{title}</h3>
            <p>{sub}</p>
            <span className="quick-arrow">
              <ArrowUpRight size={17} />
            </span>
          </button>
        ))}
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-heading">
            <h2>
              <span className="small-red-dot" />
              次のアクション
            </h2>
            <button className="text-link" onClick={() => go("minutes")}>
              すべて見る
              <ChevronRight size={14} />
            </button>
          </div>
          {pending.length ? (
            <div className="task-preview">
              {pending.slice(0, 4).map((t) => (
                <div key={t.id}>
                  <button
                    className="task-check"
                    onClick={() =>
                      act("完了に変更", () =>
                        request("/tasks/" + t.id, { status: "done" }, "PATCH"),
                      )
                    }
                    aria-label={`${t.title}を完了にする`}
                  >
                    <Check size={12} />
                  </button>
                  <span>
                    <strong>{t.title}</strong>
                    <small>
                      {t.assignee || "担当未定"} {t.demo ? "· サンプル" : ""}
                    </small>
                  </span>
                  <Tag
                    color={
                      t.dueDate && t.dueDate < data.today ? "red" : "neutral"
                    }
                  >
                    {dateLabel(t.dueDate)}
                  </Tag>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={ClipboardList} title="次のアクションを、ここに。">
              議事録から抽出したタスクや、
              <br />
              チームのやることを一覧で確認できます。
            </Empty>
          )}
        </section>
        <section className="panel connection-panel">
          <div className="panel-heading">
            <h2>ワークスペースの準備</h2>
            <Tag>
              {
                [
                  data.connections.claude,
                  data.skills.length > 0,
                  data.connections.google,
                ].filter(Boolean).length
              }
              /3 完了
            </Tag>
          </div>
          {[
            [
              "settings",
              "Claude APIを接続",
              data.connections.claude,
              "AI分析・資料生成を有効に",
            ],
            [
              "skills",
              "ClaudeのSkillsを引き継ぐ",
              data.skills.length > 0,
              "プロジェクトの指示を登録",
            ],
            [
              "settings",
              "Googleと連携する",
              data.connections.google,
              "カレンダー・シートにつなぐ",
            ],
          ].map(([id, title, ok, sub], i) => (
            <button key={title} className="setup-row" onClick={() => go(id)}>
              <span className={`step-circle ${ok ? "complete" : ""}`}>
                {ok ? <Check size={13} /> : i + 1}
              </span>
              <span>
                <strong>{title}</strong>
                <small>{sub}</small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
          {!demo && (
            <button
              className="sample-button"
              disabled={!!busy}
              onClick={() =>
                act(
                  "サンプルを準備",
                  () => request("/demo", {}),
                  "サンプルを登録しました。すべて架空データです。",
                )
              }
            >
              <MousePointer2 size={14} />
              まずはサンプルで試す
              <ArrowUpRight size={13} />
            </button>
          )}
        </section>
      </div>
      <div className="official-links">
        <span>運用アカウント</span>
        <a
          href="https://www.instagram.com/hitachi_kaden/"
          target="_blank"
          rel="noreferrer"
        >
          <Instagram size={14} />
          @hitachi_kaden
          <ArrowUpRight size={12} />
        </a>
        <a href="https://x.com/hitachi_kaden" target="_blank" rel="noreferrer">
          <span>𝕏</span>@hitachi_kaden
          <ArrowUpRight size={12} />
        </a>
        <small>アカウントの自動取得・自動投稿は行いません</small>
      </div>
    </>
  );
}

function Actions() {
  const { data, go, act, busy } = useApp();
  const [workflow, setWorkflow] = useState(null),
    [context, setContext] = useState(""),
    [result, setResult] = useState(null),
    [add, setAdd] = useState(false),
    [form, setForm] = useState({ name: "", instruction: "" });
  const builtins = [
    [
      "minutes",
      "会議のあとを、すぐに動かす",
      "議事録 → 要約・決定事項・担当付きアクション。確認後、カレンダーに登録。",
      FileText,
      "議事録と会議日",
    ],
    [
      "insights",
      "競合の好調投稿を、次の企画へ",
      "実測データ → 日別・週次の分析と企画案。指定シートへ追記。",
      ChartNoAxesCombined,
      "投稿のCSVまたは手入力",
    ],
    [
      "reports",
      "定例会の準備を、もっと軽く",
      "期間内の投稿・実績・タスクから週次／月次資料を作成。",
      Presentation,
      "対象期間と運用データ",
    ],
  ];
  return (
    <>
      <PageHeader
        eyebrow="AI WORKFLOWS"
        title="いつもの指示を、ひとつのボタンに。"
        description="登録したSkillsとプロンプトで、繰り返す業務をスムーズに。"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setAdd(true)}>
            指示をボタンにする
          </Button>
        }
      />
      {!data.connections.claude && (
        <Notice>
          AI実行にはClaude APIキーが必要です。
          <button onClick={() => go("settings")}>連携・設定へ</button>
          。登録済みSkillsは全文を送信し、使用バージョンを記録します。
        </Notice>
      )}
      <div className="workflow-grid">
        {builtins.map(([id, title, sub, Icon, input], i) => (
          <section className="panel workflow-card" key={id}>
            <span className="workflow-index">WORKFLOW 0{i + 1}</span>
            <span className="quick-icon rose">
              <Icon size={25} />
            </span>
            <h2>{title}</h2>
            <p>{sub}</p>
            <div className="workflow-input">
              <Upload size={13} />
              必要な入力：{input}
            </div>
            <Button onClick={() => go(id)}>
              実行画面へ
              <ArrowRight size={15} />
            </Button>
          </section>
        ))}
      </div>
      <div className="special-workflows">
        <button onClick={() => go("documents", "revision")}>
          <span className="quick-icon sand">
            <FileText size={21} />
          </span>
          <div>
            <Tag>登録済みSkill 01</Tag>
            <h3>初稿戻し・赤字反映</h3>
            <p>PPTXの指摘を棚卸し → 確認 → 本文反映・注釈削除 → 別名保存</p>
          </div>
          <ArrowUpRight size={19} />
        </button>
        <button onClick={() => go("documents", "xideas")}>
          <span className="quick-icon lavender">
            <Presentation size={21} />
          </span>
          <div>
            <Tag>登録済みSkill 02</Tag>
            <h3>X投稿企画・SNS審査用PPT</h3>
            <p>企画Excel＋参考投稿 → 指定案数 → 既存スライドを複製</p>
          </div>
          <ArrowUpRight size={19} />
        </button>
      </div>
      <div className="section-heading">
        <div>
          <h2>あなたのワンクリック業務</h2>
          <span>MY WORKFLOWS</span>
        </div>
        <Tag>{data.workflows.length} 件</Tag>
      </div>
      {data.workflows.length ? (
        <div className="custom-workflows">
          {data.workflows.map((w) => (
            <section className="panel" key={w.id}>
              <div className="panel-heading">
                <span className="quick-icon lavender">
                  <Zap size={19} />
                </span>
                <button
                  className="icon-btn"
                  aria-label="指示を削除"
                  onClick={() => {
                    if (confirm("この指示を削除しますか？"))
                      act("削除", () =>
                        request("/workflows/" + w.id, null, "DELETE"),
                      );
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <h3>{w.name}</h3>
              <p className="clamp3">{w.instruction}</p>
              <Button
                icon={Play}
                onClick={() => {
                  if (
                    /初稿戻し|戻しの反映|赤字反映|修正指示を反映|先方コメント対応|クライアント指摘|指摘反映/.test(
                      w.instruction + " " + w.name,
                    )
                  ) {
                    go("documents", "revision");
                    return;
                  }
                  if (
                    /X投稿企画|審査用PPT|日立のX企画|SNS審査用フォーマット/.test(
                      w.instruction + " " + w.name,
                    )
                  ) {
                    go("documents", "xideas");
                    return;
                  }
                  setWorkflow(w);
                  setResult(null);
                  setContext("");
                }}
              >
                入力して実行
              </Button>
            </section>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            icon={Zap}
            title="過去の指示を、再利用できる仕事に。"
            action={
              <Button icon={Plus} onClick={() => setAdd(true)}>
                指示を登録
              </Button>
            }
          >
            過去チャットの指示を貼り付けて、
            <br />
            いつでも実行できるボタンを作れます。
          </Empty>
        </div>
      )}
      <div className="section-heading">
        <div>
          <h2>最近の実行</h2>
          <span>ACTIVITY</span>
        </div>
        <Tag>日本時間 / サーバー稼働中に自動実行</Tag>
      </div>
      <div className="panel run-list">
        {data.runs.length ? (
          data.runs.slice(0, 15).map((r) => (
            <button
              key={r.id}
              onClick={() =>
                r.result
                  ? setResult(r)
                  : go(r.type?.includes("Report") ? "reports" : "insights")
              }
            >
              <span
                className={`run-icon ${r.status === "failed" ? "failed" : ""}`}
              >
                {r.status === "failed" ? (
                  <TriangleAlert size={17} />
                ) : r.status === "running" ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Check size={17} />
                )}
              </span>
              <span>
                <strong>
                  {r.workflowName ||
                    {
                      daily: "日別の競合分析",
                      weekly: "週次の企画分析",
                      weeklyReport: "週次レポート",
                      monthlyReport: "月次レポート",
                    }[r.type] ||
                    "ワークフロー"}
                </strong>
                <small>
                  {r.error ||
                    new Date(r.createdAt).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                    })}
                </small>
              </span>
              <Tag
                color={
                  r.status === "failed"
                    ? "red"
                    : r.status === "running"
                      ? "amber"
                      : "green"
                }
              >
                {r.status === "failed"
                  ? "失敗"
                  : r.status === "running"
                    ? "実行中"
                    : "完了"}
              </Tag>
            </button>
          ))
        ) : (
          <p className="empty-line">実行履歴はまだありません。</p>
        )}
      </div>
      {add && (
        <Modal title="指示をボタンにする" onClose={() => setAdd(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const v = await act("指示を保存", () =>
                request("/workflows", form),
              );
              if (v) {
                setAdd(false);
                setForm({ name: "", instruction: "" });
              }
            }}
          >
            <div className="modal-body">
              <Field label="ボタンの名前">
                <input
                  required
                  placeholder="例：次月の投稿テーマを考える"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field
                label="実行する指示の全文"
                hint="未共有の過去チャットは参照できません。実行したい指示をそのまま貼り付けてください。"
              >
                <textarea
                  rows={9}
                  required
                  placeholder="入力データをもとに、…"
                  value={form.instruction}
                  onChange={(e) =>
                    setForm({ ...form, instruction: e.target.value })
                  }
                />
              </Field>
              <Notice>
                実行結果をアプリ内に保存します。外部送信・投稿はこのボタンから自動実行しません。
              </Notice>
            </div>
            <div className="modal-actions">
              <Button onClick={() => setAdd(false)}>キャンセル</Button>
              <Button type="submit" variant="primary" disabled={!!busy}>
                ボタンを作成
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {workflow && (
        <Modal title={workflow.name} wide onClose={() => setWorkflow(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await act(
                "Claudeで実行",
                () =>
                  request("/workflows/" + workflow.id + "/run", { context }),
                "実行結果を保存しました",
              );
              if (r) {
                setWorkflow(null);
                setResult(r);
              }
            }}
          >
            <div className="modal-body">
              <details>
                <summary>登録された指示を確認</summary>
                <pre className="text-content">{workflow.instruction}</pre>
              </details>
              <Field label="今回の入力データ">
                <textarea
                  rows={10}
                  required
                  placeholder="分析したい情報や条件を入力してください"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
              </Field>
              <Notice>入力と有効なSkillsをClaude APIに送信します。</Notice>
            </div>
            <div className="modal-actions">
              <Button
                type="submit"
                variant="primary"
                icon={Sparkles}
                disabled={!!busy}
              >
                この指示で実行
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {result && (
        <Modal title={result.result.title} wide onClose={() => setResult(null)}>
          <div className="modal-body">
            <p className="text-content">{result.result.summary}</p>
            <h3>推奨アクション</h3>
            <ul className="bullet-list">
              {result.result.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <Provenance item={result} />
          </div>
        </Modal>
      )}
    </>
  );
}

function Minutes() {
  const { data, act, busy, notify } = useApp();
  const [tab, setTab] = useState("tasks"),
    [input, setInput] = useState({ title: "", date: data.today, text: "" }),
    [edit, setEdit] = useState(null),
    [detail, setDetail] = useState(null),
    [filter, setFilter] = useState("all"),
    [batch, setBatch] = useState(false),
    [batchResult, setBatchResult] = useState(null);
  const tasks = data.tasks.filter(
    (t) => filter === "all" || t.status === filter,
  );
  async function saveTask(e) {
    e.preventDefault();
    const { id, ...body } = edit;
    const v = await act("アクションを保存", () =>
      request(id ? "/tasks/" + id : "/tasks", body, id ? "PATCH" : "POST"),
    );
    if (v) setEdit(null);
  }
  return (
    <>
      <PageHeader
        eyebrow="MEETING TO ACTION"
        title="話したことを、次のアクションへ。"
        description="議事録を読み解き、担当・期日・確認事項を整理。カレンダーにつなげます。"
        actions={
          <Button
            icon={Plus}
            onClick={() =>
              setEdit({
                title: "",
                assignee: "",
                dueDate: null,
                priority: "medium",
                status: "todo",
                sourceQuote: "",
              })
            }
          >
            アクションを追加
          </Button>
        }
      />
      <div className="tabs">
        <button
          className={tab === "tasks" ? "selected" : ""}
          onClick={() => setTab("tasks")}
        >
          アクション一覧 <span>{data.tasks.length}</span>
        </button>
        <button
          className={tab === "new" ? "selected" : ""}
          onClick={() => setTab("new")}
        >
          議事録を入力
          <Sparkles size={14} />
        </button>
        <button
          className={tab === "history" ? "selected" : ""}
          onClick={() => setTab("history")}
        >
          議事録の履歴
        </button>
      </div>
      {tab === "new" && (
        <div className="two-column">
          <section className="panel padded">
            <h2>定例会の議事録</h2>
            <p className="muted">
              テキストを貼り付けて、要約とタスクを抽出します。
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await act(
                  "議事録を分析",
                  () => request("/minutes", input),
                  "議事録とアクションを保存しました",
                );
                if (r) {
                  setTab("tasks");
                  setDetail(r);
                  setInput({ title: "", date: data.today, text: "" });
                }
              }}
            >
              <div className="form-grid">
                <Field label="会議名">
                  <input
                    required
                    value={input.title}
                    placeholder="例：SNS運用 週次定例"
                    onChange={(e) =>
                      setInput({ ...input, title: e.target.value })
                    }
                  />
                </Field>
                <Field label="会議日（日本時間）">
                  <input
                    type="date"
                    required
                    value={input.date}
                    onChange={(e) =>
                      setInput({ ...input, date: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label="議事録本文">
                <textarea
                  required
                  minLength={10}
                  rows={13}
                  value={input.text}
                  placeholder={
                    "議題、決定事項、担当者、期限などを入力…\n\n例：田中さんが10月23日までに投稿案を作成する。"
                  }
                  onChange={(e) => setInput({ ...input, text: e.target.value })}
                />
              </Field>
              <div className="form-bottom">
                <span>入力と有効なSkillsをClaudeに送信</span>
                <Button
                  variant="primary"
                  icon={Sparkles}
                  type="submit"
                  disabled={!!busy}
                >
                  アクションを抽出
                </Button>
              </div>
            </form>
          </section>
          <aside className="panel guide-card">
            <span className="quick-icon sage">
              <ClipboardList size={24} />
            </span>
            <h2>会議のあとは、この3ステップ。</h2>
            {[
              ["議事録を入力", "決定事項・担当・期日をAIが整理。"],
              ["内容を確認・調整", "不明な担当や期日は推測せず、要確認に。"],
              [
                "カレンダーへ登録",
                "確認したタスクを期日に終日予定として登録。",
              ],
            ].map(([t, s], i) => (
              <div className="guide-step" key={t}>
                <span>{i + 1}</span>
                <div>
                  <strong>{t}</strong>
                  <p>{s}</p>
                </div>
              </div>
            ))}
            <Notice>
              自動抽出後の内容はドラフトです。カレンダー登録前に、必ず担当と期日を確認してください。
            </Notice>
          </aside>
        </div>
      )}
      {tab === "tasks" && (
        <>
          <div className="toolbar">
            <div className="filter-pills">
              {[
                ["all", "すべて"],
                ["todo", "未着手"],
                ["doing", "進行中"],
                ["done", "完了"],
              ].map(([id, l]) => (
                <button
                  className={filter === id ? "active" : ""}
                  key={id}
                  onClick={() => setFilter(id)}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="inline-actions">
              <a className="btn" href="/api/tasks.ics">
                <Download size={15} />
                ICS出力
              </a>
              <Button
                icon={CalendarDays}
                disabled={
                  !!busy ||
                  !data.tasks.some(
                    (t) => !t.demo && t.dueDate && t.status !== "done",
                  )
                }
                onClick={() => {
                  setBatchResult(null);
                  setBatch(true);
                }}
              >
                カレンダーに一括登録
              </Button>
            </div>
          </div>
          <div className="panel table-wrap">
            {tasks.length ? (
              <table>
                <thead>
                  <tr>
                    <th>アクション</th>
                    <th>担当</th>
                    <th>期日</th>
                    <th>優先度</th>
                    <th>ステータス</th>
                    <th>カレンダー</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <button
                          className="table-title"
                          onClick={() => setEdit(t)}
                        >
                          {t.title}
                        </button>
                        {t.demo && (
                          <small className="sample-label">サンプル</small>
                        )}
                      </td>
                      <td>
                        {t.assignee || <span className="muted">未定</span>}
                      </td>
                      <td>
                        <span
                          className={
                            t.dueDate &&
                            t.dueDate < data.today &&
                            t.status !== "done"
                              ? "red-text"
                              : ""
                          }
                        >
                          {t.dueDate || "要確認"}
                        </span>
                      </td>
                      <td>
                        <Tag color={t.priority === "high" ? "red" : "neutral"}>
                          {priorities[t.priority]}
                        </Tag>
                      </td>
                      <td>
                        <select
                          aria-label={`${t.title}の進捗`}
                          value={t.status}
                          onChange={(e) =>
                            act("進捗を更新", () =>
                              request(
                                "/tasks/" + t.id,
                                { status: e.target.value },
                                "PATCH",
                              ),
                            )
                          }
                        >
                          <option value="todo">未着手</option>
                          <option value="doing">進行中</option>
                          <option value="done">完了</option>
                        </select>
                      </td>
                      <td>
                        <Button
                          variant="tiny"
                          icon={t.calendarEventId ? CheckCheck : CalendarDays}
                          disabled={!!busy || t.demo || !t.dueDate}
                          onClick={() => {
                            if (
                              confirm(
                                `「${t.title}」を ${t.dueDate} の終日予定としてGoogleカレンダーに${t.calendarEventId ? "更新" : "登録"}しますか？`,
                              )
                            )
                              act(
                                "カレンダーに登録",
                                () =>
                                  request("/tasks/" + t.id + "/calendar", {}),
                                "カレンダーに反映しました",
                              );
                          }}
                        >
                          {t.calendarEventId ? "再反映" : "登録"}
                        </Button>
                      </td>
                      <td>
                        <button
                          className="icon-btn"
                          aria-label="タスクを編集"
                          onClick={() => setEdit(t)}
                        >
                          <MoreHorizontal size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty
                icon={FileText}
                title="会議の「次にやること」を、ここに。"
                action={
                  <Button icon={Sparkles} onClick={() => setTab("new")}>
                    議事録から抽出する
                  </Button>
                }
              >
                議事録を入力するか、アクションを手動で追加してください。
              </Empty>
            )}
          </div>
          <Notice>
            期日未定のタスクはカレンダーに登録できません。ICS出力には実データの期日ありタスクを含みます。サンプルは対象外です。
          </Notice>
        </>
      )}
      {tab === "history" && (
        <div className="panel">
          {data.meetings.length ? (
            data.meetings.map((m) => (
              <button
                className="history-row"
                key={m.id}
                onClick={() => setDetail(m)}
              >
                <span className="quick-icon rose">
                  <FileText size={19} />
                </span>
                <span>
                  <strong>{m.title}</strong>
                  <small>
                    {m.date} ·{" "}
                    {data.tasks.filter((t) => t.meetingId === m.id).length}{" "}
                    アクション
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))
          ) : (
            <Empty icon={FileText} title="議事録はまだありません">
              入力した議事録と抽出結果をここに保存します。
            </Empty>
          )}
        </div>
      )}
      {batch && (
        <Modal
          title="カレンダーに登録するアクションを確認"
          wide
          onClose={() => setBatch(false)}
        >
          <div className="modal-body">
            <Notice>
              期日がある未完了の実タスクを、Googleカレンダーの終日予定として登録・更新します。50件を超える場合は先頭50件を処理します。
            </Notice>
            <ul>
              {data.tasks
                .filter((t) => !t.demo && t.dueDate && t.status !== "done")
                .slice(0, 50)
                .map((t) => (
                  <li key={t.id}>
                    {t.dueDate} · {t.title}（{t.assignee || "担当未定"}）
                  </li>
                ))}
            </ul>
            {batchResult && (
              <>
                <h3>登録結果</h3>
                {batchResult.results.map((r) => (
                  <p key={r.id}>
                    <Tag color={r.ok ? "green" : "red"}>
                      {r.ok ? "反映済み" : "失敗"}
                    </Tag>{" "}
                    {r.title}
                    {r.error && (
                      <small className="red-text"> · {r.error}</small>
                    )}
                  </p>
                ))}
              </>
            )}
          </div>
          <div className="modal-actions">
            <Button
              variant="primary"
              disabled={!!busy}
              onClick={async () => {
                const r = await act(
                  "カレンダーにまとめて登録",
                  () =>
                    request("/calendar/batch", {
                      ids: data.tasks
                        .filter(
                          (t) => !t.demo && t.dueDate && t.status !== "done",
                        )
                        .slice(0, 50)
                        .map((t) => t.id),
                    }),
                  "",
                );
                if (r) {
                  setBatchResult(r);
                  notify(
                    `${r.results.filter((v) => v.ok).length}/${r.results.length}件をカレンダーに反映しました`,
                    r.results.some((v) => !v.ok),
                  );
                }
              }}
            >
              確認した内容で登録する
            </Button>
          </div>
        </Modal>
      )}
      {edit && (
        <Modal
          title={edit.id ? "アクションを確認・編集" : "アクションを追加"}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={saveTask}>
            <div className="modal-body">
              <Field label="アクション">
                <input
                  required
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </Field>
              <div className="form-grid">
                <Field label="担当者">
                  <input
                    value={edit.assignee}
                    onChange={(e) =>
                      setEdit({ ...edit, assignee: e.target.value })
                    }
                  />
                </Field>
                <Field label="期日">
                  <input
                    type="date"
                    value={edit.dueDate || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, dueDate: e.target.value || null })
                    }
                  />
                </Field>
                <Field label="優先度">
                  <select
                    value={edit.priority}
                    onChange={(e) =>
                      setEdit({ ...edit, priority: e.target.value })
                    }
                  >
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </Field>
                <Field label="ステータス">
                  <select
                    value={edit.status}
                    onChange={(e) =>
                      setEdit({ ...edit, status: e.target.value })
                    }
                  >
                    <option value="todo">未着手</option>
                    <option value="doing">進行中</option>
                    <option value="done">完了</option>
                  </select>
                </Field>
              </div>
              <Field label="原文の根拠・メモ">
                <textarea
                  rows={3}
                  value={edit.sourceQuote}
                  onChange={(e) =>
                    setEdit({ ...edit, sourceQuote: e.target.value })
                  }
                />
              </Field>
              {edit.calendarEventId && (
                <Notice>
                  保存後、カレンダーの「再反映」で予定も更新してください。タスク削除はカレンダーの予定を削除しません。
                </Notice>
              )}
            </div>
            <div className="modal-actions">
              {edit.id && (
                <Button
                  variant="danger-ghost"
                  onClick={async () => {
                    if (
                      confirm(
                        "このタスクを削除しますか？登録済みのカレンダー予定は残ります。",
                      )
                    ) {
                      const r = await act("削除", () =>
                        request("/tasks/" + edit.id, null, "DELETE"),
                      );
                      if (r) setEdit(null);
                    }
                  }}
                >
                  削除
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={!!busy}>
                保存する
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title={detail.title} wide onClose={() => setDetail(null)}>
          <div className="modal-body prose">
            <Tag>{detail.date}</Tag>
            <h3>要約</h3>
            <p className="text-content">{detail.summary}</p>
            <h3>決定事項</h3>
            <ul>
              {detail.decisions.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
            {detail.questions.length > 0 && (
              <>
                <h3>確認が必要なこと</h3>
                <ul>
                  {detail.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </>
            )}
            <details>
              <summary>入力した議事録</summary>
              <pre className="text-content">{detail.text}</pre>
            </details>
            <Provenance item={detail} />
          </div>
        </Modal>
      )}
    </>
  );
}

function Insights() {
  const { data, act, busy, notify } = useApp();
  const [tab, setTab] = useState("research"),
    [dates, setDates] = useState(range(data.today)),
    [cadence, setCadence] = useState("weekly"),
    [add, setAdd] = useState(false),
    [detail, setDetail] = useState(null),
    [kind, setKind] = useState("all");
  const blank = {
    date: data.today,
    platform: "Instagram",
    accountType: "competitor",
    account: "",
    url: "",
    content: "",
    impressions: "",
    reach: "",
    engagements: "",
    likes: "",
    comments: "",
    saves: "",
    shares: "",
    views: "",
    followers: "",
  };
  const [form, setForm] = useState(blank);
  const observations = data.observations.filter(
    (o) =>
      o.date >= dates.from &&
      o.date <= dates.to &&
      (kind === "all" || o.accountType === kind),
  );
  async function importCsv(file) {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: async (result) => {
        if (result.errors.length)
          return notify(
            "CSV形式を確認してください：" + result.errors[0].message,
            true,
          );
        if (
          !result.meta.fields?.includes("date") ||
          !result.meta.fields.includes("url")
        )
          return notify("テンプレートの列名を使用してください。", true);
        await act(
          "CSVを取り込み",
          () => request("/observations", { rows: result.data }),
          (r) => `${r.added}件を登録、重複${r.skipped}件をスキップしました`,
        );
      },
    });
  }
  const met = (o) => {
    const keys = ["likes", "comments", "saves", "shares"].filter(
      (k) => o[k] != null,
    );
    const count =
      o.engagements != null
        ? o.engagements
        : keys.length
          ? keys.reduce((n, k) => n + o[k], 0)
          : null;
    const basis =
      o.reach > 0
        ? "reach"
        : o.impressions > 0
          ? "impressions"
          : o.followers > 0
            ? "followers"
            : null;
    return {
      count,
      rate: basis && count != null ? (count / o[basis]) * 100 : null,
      basis,
      keys,
    };
  };
  return (
    <>
      <PageHeader
        eyebrow="COMPETITOR & TREND INTELLIGENCE"
        title="気づきを集めて、企画に変える。"
        description="投稿の実測データから日別・週次で分析。日立の家電品らしい企画へ落とし込みます。"
        actions={
          <>
            <label className="btn">
              <Upload size={16} />
              CSVを取り込む
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={(e) => {
                  importCsv(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => {
                setForm(blank);
                setAdd(true);
              }}
            >
              投稿データを追加
            </Button>
          </>
        }
      />
      <div className="tabs">
        <button
          className={tab === "research" ? "selected" : ""}
          onClick={() => setTab("research")}
        >
          分析・企画案 <span>{data.researchs.length}</span>
        </button>
        <button
          className={tab === "data" ? "selected" : ""}
          onClick={() => setTab("data")}
        >
          投稿データ <span>{data.observations.length}</span>
        </button>
      </div>
      <div className="analysis-toolbar panel">
        <div>
          <span className="field-label">対象期間</span>
          <DateFields value={dates} onChange={setDates} />
        </div>
        <div className="analysis-actions">
          <select
            aria-label="分析種別"
            value={cadence}
            onChange={(e) => {
              setCadence(e.target.value);
              if (e.target.value === "daily")
                setDates({ from: data.today, to: data.today });
            }}
          >
            <option value="weekly">週次 · 企画への落とし込み</option>
            <option value="daily">日別 · 好調投稿・表現の整理</option>
          </select>
          <Button
            variant="primary"
            icon={Sparkles}
            disabled={!!busy}
            onClick={async () => {
              const r = await act(
                "競合データを分析",
                () => request("/research", { ...dates, cadence }),
                "分析を保存しました",
              );
              if (r) {
                setTab("research");
                setDetail(r);
              }
            }}
          >
            この期間を分析
          </Button>
        </div>
      </div>
      {tab === "research" && (
        <>
          {data.researchs.length ? (
            <div className="research-grid">
              {data.researchs.map((r) => (
                <section className="panel research-card" key={r.id}>
                  <div className="research-card-top">
                    <Tag color={r.cadence === "daily" ? "green" : "red"}>
                      {r.cadence === "daily"
                        ? "DAILY INSIGHT"
                        : "WEEKLY INSIGHT"}
                    </Tag>
                    {r.demo && <Tag color="amber">サンプル</Tag>}
                    <span>
                      {r.from} — {r.to}
                    </span>
                  </div>
                  <h2>
                    {r.cadence === "daily"
                      ? "日別の投稿・表現分析"
                      : "競合の気づきから、次の企画へ。"}
                  </h2>
                  <p className="clamp3">{r.summary}</p>
                  <div className="research-stats">
                    <span>
                      <strong>{r.observationIds?.length || 0}</strong> 対象投稿
                    </span>
                    <span>
                      <strong>{r.trends.length}</strong> 表現傾向
                    </span>
                    <span>
                      <strong>{r.ideas.length}</strong> 企画案
                    </span>
                  </div>
                  <div className="card-bottom">
                    <Button onClick={() => setDetail(r)}>
                      分析と企画案を見る
                      <ArrowRight size={14} />
                    </Button>
                    {r.sheetSyncedAt && (
                      <Tag color="green">
                        <Check size={12} />
                        シート追記済み
                      </Tag>
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="panel">
              <Empty
                icon={ChartNoAxesCombined}
                title="好調投稿の「なぜ？」を、企画のヒントに。"
                action={
                  <Button onClick={() => setTab("data")} icon={Upload}>
                    投稿データを準備
                  </Button>
                }
              >
                競合投稿のCSVを取り込み、対象期間を選んで分析してください。
                <br />
                取得したデータの範囲内で、日立家電向けの企画案を作成します。
              </Empty>
            </div>
          )}
        </>
      )}
      {tab === "data" && (
        <>
          <div className="toolbar">
            <div className="filter-pills">
              {[
                ["all", "すべて"],
                ["competitor", "競合投稿"],
                ["own", "日立アカウント実績"],
              ].map(([id, l]) => (
                <button
                  key={id}
                  className={kind === id ? "active" : ""}
                  onClick={() => setKind(id)}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="inline-actions">
              <a href="/api/template.csv" className="text-link">
                <Download size={14} />
                入力テンプレート
              </a>
              <a href="/api/observations.csv" className="btn">
                <Download size={14} />
                CSV出力
              </a>
            </div>
          </div>
          <div className="panel table-wrap">
            {observations.length ? (
              <table className="observations-table">
                <thead>
                  <tr>
                    <th>投稿日 / SNS</th>
                    <th>投稿内容</th>
                    <th>種別</th>
                    <th>ENG / 観測反応数</th>
                    <th>反応率</th>
                    <th>分母</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {observations.map((o) => {
                    const m = met(o);
                    return (
                      <tr key={o.id}>
                        <td>
                          <span className="date-cell">{o.date}</span>
                          <Platform value={o.platform} />
                        </td>
                        <td>
                          <a
                            className="table-title"
                            href={safeUrl(o.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {o.account}
                            <ArrowUpRight size={12} />
                          </a>
                          <p className="clamp2 table-snippet">{o.content}</p>
                          {o.demo && (
                            <small className="sample-label">架空データ</small>
                          )}
                        </td>
                        <td>
                          <Tag
                            color={o.accountType === "own" ? "red" : "neutral"}
                          >
                            {o.accountType === "own" ? "日立実績" : "競合"}
                          </Tag>
                        </td>
                        <td title={m.keys.join(" + ")}>
                          {fmt(m.count)}
                          <small className="table-sub">
                            {o.engagements != null
                              ? "公式ENG"
                              : m.keys
                                  .map(
                                    (k) =>
                                      ({
                                        likes: "いいね",
                                        comments: "コメント",
                                        saves: "保存",
                                        shares: "共有",
                                      })[k],
                                  )
                                  .join("・") || "未入力"}
                          </small>
                        </td>
                        <td>
                          {m.rate == null ? "—" : m.rate.toFixed(2) + "%"}
                        </td>
                        <td>
                          {m.basis
                            ? `${{ reach: "リーチ", impressions: "表示回数", followers: "フォロワー" }[m.basis]} ${fmt(o[m.basis])}`
                            : "未入力"}
                        </td>
                        <td>
                          <button
                            className="icon-btn"
                            aria-label="投稿データを削除"
                            onClick={() => {
                              if (
                                confirm(
                                  "この投稿データを削除しますか？既存分析には反映されません。",
                                )
                              )
                                act("削除", () =>
                                  request(
                                    "/observations/" + o.id,
                                    null,
                                    "DELETE",
                                  ),
                                );
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <Empty
                icon={Upload}
                title="実測データを、分析の出発点に。"
                action={
                  <a className="btn" href="/api/template.csv">
                    <Download size={14} />
                    CSVテンプレート
                  </a>
                }
              >
                Instagram / XのデータをCSVで取り込むか、手動で追加できます。
                <br />
                競合は対象アカウントの規約・利用条件に従って取得してください。
              </Empty>
            )}
          </div>
        </>
      )}
      <Notice>
        自動収集は未接続です。取得できない数値は空欄のまま保持し、観測済みの反応項目と分母が揃う投稿だけを比較します。自社実績は競合分析から除外し、定例資料に使用します。
      </Notice>
      {add && (
        <Modal title="投稿データを追加" wide onClose={() => setAdd(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await act(
                "投稿データを保存",
                () => request("/observations", { rows: [form] }),
                (v) => `${v.added}件を登録（重複スキップ ${v.skipped}件）`,
              );
              if (r) {
                setAdd(false);
                setTab("data");
              }
            }}
          >
            <div className="modal-body">
              <div className="form-grid">
                <Field label="投稿日">
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </Field>
                <Field label="SNS">
                  <select
                    value={form.platform}
                    onChange={(e) =>
                      setForm({ ...form, platform: e.target.value })
                    }
                  >
                    <option>Instagram</option>
                    <option>X</option>
                  </select>
                </Field>
                <Field label="データ種別">
                  <select
                    value={form.accountType}
                    onChange={(e) =>
                      setForm({ ...form, accountType: e.target.value })
                    }
                  >
                    <option value="competitor">競合投稿</option>
                    <option value="own">日立アカウント実績</option>
                  </select>
                </Field>
                <Field label="アカウント">
                  <input
                    required
                    placeholder="@account_name"
                    value={form.account}
                    onChange={(e) =>
                      setForm({ ...form, account: e.target.value })
                    }
                  />
                </Field>
                <Field label="投稿URL" wide>
                  <input
                    required
                    type="url"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                  />
                </Field>
                <Field label="投稿本文・表現のメモ" wide>
                  <textarea
                    rows={3}
                    required
                    value={form.content}
                    onChange={(e) =>
                      setForm({ ...form, content: e.target.value })
                    }
                  />
                </Field>
              </div>
              <h3 className="subsection-title">
                実測指標 <small>未取得の項目は空欄 / 取得済みの0は「0」</small>
              </h3>
              <div className="form-grid four">
                {[
                  ["impressions", "表示回数"],
                  ["reach", "リーチ"],
                  ["engagements", "ENG（公式集計値）"],
                  ["likes", "いいね"],
                  ["comments", "コメント"],
                  ["saves", "保存"],
                  ["shares", "共有"],
                  ["views", "再生数"],
                  ["followers", "フォロワー"],
                ].map(([id, l]) => (
                  <Field key={id} label={l}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="未入力"
                      value={form[id]}
                      onChange={(e) =>
                        setForm({ ...form, [id]: e.target.value })
                      }
                    />
                  </Field>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <Button type="submit" variant="primary" disabled={!!busy}>
                登録する
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal
          title={
            detail.cadence === "daily" ? "日別分析の結果" : "週次分析・企画案"
          }
          wide
          onClose={() => setDetail(null)}
        >
          <div className="modal-body">
            <div className="inline-actions">
              <Tag>
                {detail.from} — {detail.to}
              </Tag>
              {detail.demo && <Tag color="amber">架空データ</Tag>}
            </div>
            <p className="text-content">{detail.summary}</p>
            <h3 className="subsection-title">好調投稿と、その理由</h3>
            {detail.highPerformers.map((p, i) => (
              <div className="insight-result" key={i}>
                <p>{p.reason}</p>
                <SourceLinks ids={[p.observationId]} data={data} />
              </div>
            ))}
            <h3 className="subsection-title">観測した表現の傾向</h3>
            {detail.trends.map((t, i) => (
              <div className="insight-result" key={i}>
                <strong>{t.name}</strong>
                <p>{t.interpretation}</p>
                <SourceLinks ids={t.evidenceIds} data={data} />
              </div>
            ))}
            <h3 className="subsection-title">日立家電への企画案</h3>
            {detail.ideas.map((idea, i) => (
              <article className="idea-card" key={i}>
                <div className="inline-actions">
                  <Platform value={idea.platform} />
                  <Tag>{idea.product}</Tag>
                  <span className="idea-number">
                    IDEA {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3>{idea.title}</h3>
                <blockquote>{idea.hook}</blockquote>
                <p className="text-content">{idea.outline}</p>
                <SourceLinks ids={idea.evidenceIds} data={data} />
                <small className="caution">
                  <ShieldCheck size={13} />
                  {idea.caution}
                </small>
                <Button
                  variant="tiny"
                  icon={Plus}
                  onClick={() =>
                    act(
                      "投稿ボードへ追加",
                      () =>
                        request(`/research/${detail.id}/ideas/${i}/post`, {}),
                      "企画を投稿管理に追加しました",
                    )
                  }
                >
                  投稿管理に企画を追加
                </Button>
              </article>
            ))}
            <Provenance item={detail} />
          </div>
          <div className="modal-actions">
            <a className="btn" href={`/api/research/${detail.id}/csv`}>
              <Download size={15} />
              CSV出力
            </a>
            <Button
              variant="primary"
              icon={Link2}
              disabled={!!busy || detail.demo}
              onClick={() => {
                if (
                  confirm(
                    "この分析の企画案を指定スプレッドシートへ追記しますか？",
                  )
                )
                  act(
                    "スプレッドシートに追記",
                    () => request("/research/" + detail.id + "/sheet", {}),
                    "シートに追記しました",
                  );
              }}
            >
              指定シートに追記
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Posts() {
  const { data, act, busy } = useApp();
  const [edit, setEdit] = useState(null),
    [platform, setPlatform] = useState("all"),
    [view, setView] = useState("board");
  const posts = data.posts.filter(
    (p) => platform === "all" || p.platform === platform,
  );
  const blank = {
    title: "",
    platform: "Instagram",
    product: "",
    date: null,
    status: "idea",
    owner: "",
    caption: "",
    url: "",
    note: "",
  };
  const open = (p) => setEdit(p);
  const card = (p) => (
    <button
      className="post-card"
      key={p.id}
      onClick={() => open(p)}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
    >
      <div className="post-card-top">
        <Platform value={p.platform} />
        <MoreHorizontal size={16} />
      </div>
      {p.product && <span className="product-label">{p.product}</span>}
      <h3>{p.title}</h3>
      {p.demo && <span className="sample-label">サンプル</span>}
      <div className="post-card-footer">
        <span className={!p.date ? "muted" : ""}>
          <CalendarDays size={12} />
          {dateLabel(p.date)}
        </span>
        <span title={p.owner || "担当未定"} className="owner-avatar">
          {p.owner?.slice(0, 1) || "—"}
        </span>
      </div>
    </button>
  );
  return (
    <>
      <PageHeader
        eyebrow="CONTENT PIPELINE"
        title="ひとつの企画を、チームで育てる。"
        description="アイデア、制作、確認、公開まで。投稿の進捗と担当をひとつの場所で。"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEdit(blank)}>
            投稿を追加
          </Button>
        }
      />
      <div className="toolbar">
        <div className="filter-pills">
          {[
            ["all", "すべて"],
            ["Instagram", "Instagram"],
            ["X", "X"],
          ].map(([id, l]) => (
            <button
              key={id}
              className={platform === id ? "active" : ""}
              onClick={() => setPlatform(id)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="inline-actions">
          <small className="muted">{posts.length} 投稿</small>
          <div className="view-toggle">
            <button
              className={view === "board" ? "active" : ""}
              aria-label="ボード表示"
              onClick={() => setView("board")}
            >
              <Columns3 size={16} />
            </button>
            <button
              className={view === "list" ? "active" : ""}
              aria-label="一覧表示"
              onClick={() => setView("list")}
            >
              <ClipboardList size={16} />
            </button>
          </div>
        </div>
      </div>
      {view === "board" ? (
        <div className="kanban">
          {Object.entries(statusLabels).map(([status, label]) => (
            <section
              className={`kanban-column column-${status}`}
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (data.posts.some((p) => p.id === id))
                  act("進捗を更新", () =>
                    request("/posts/" + id, { status }, "PATCH"),
                  );
              }}
            >
              <div className="column-title">
                <h2>
                  <i />
                  {label}
                  <span>{posts.filter((p) => p.status === status).length}</span>
                </h2>
                <button
                  className="icon-btn"
                  aria-label={`${label}に投稿を追加`}
                  onClick={() => setEdit({ ...blank, status })}
                >
                  <Plus size={17} />
                </button>
              </div>
              <div className="column-content">
                {posts.filter((p) => p.status === status).map(card)}
                <button
                  className="add-post"
                  onClick={() => setEdit({ ...blank, status })}
                >
                  <Plus size={14} />
                  投稿を追加
                </button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="panel table-wrap">
          {posts.length ? (
            <table>
              <thead>
                <tr>
                  <th>投稿</th>
                  <th>SNS</th>
                  <th>公開日</th>
                  <th>担当</th>
                  <th>進捗</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button className="table-title" onClick={() => open(p)}>
                        {p.title}
                      </button>
                      {p.demo && (
                        <small className="sample-label">サンプル</small>
                      )}
                    </td>
                    <td>
                      <Platform value={p.platform} />
                    </td>
                    <td>{p.date || "未定"}</td>
                    <td>{p.owner || "未定"}</td>
                    <td>
                      <Tag
                        color={
                          p.status === "published"
                            ? "green"
                            : p.status === "review"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {statusLabels[p.status]}
                      </Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty icon={Columns3} title="最初の投稿を追加しましょう">
              企画案をここに集め、チームで進捗を管理できます。
            </Empty>
          )}
        </div>
      )}
      <div className="board-note">
        <MousePointer2 size={14} />
        カードをドラッグして進捗を変更できます。カードを開くと、本文・担当・日程を編集できます。
      </div>
      {edit && (
        <Modal
          title={edit.id ? "投稿を編集" : "新しい投稿"}
          wide
          onClose={() => setEdit(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const { id, ...body } = edit;
              const r = await act("投稿を保存", () =>
                request(
                  id ? "/posts/" + id : "/posts",
                  body,
                  id ? "PATCH" : "POST",
                ),
              );
              if (r) setEdit(null);
            }}
          >
            <div className="modal-body">
              <Field label="企画・投稿タイトル">
                <input
                  required
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </Field>
              <div className="form-grid">
                <Field label="SNS">
                  <select
                    value={edit.platform}
                    onChange={(e) =>
                      setEdit({ ...edit, platform: e.target.value })
                    }
                  >
                    <option>Instagram</option>
                    <option>X</option>
                  </select>
                </Field>
                <Field label="商品カテゴリ">
                  <input
                    value={edit.product}
                    placeholder="冷蔵庫、洗濯機など"
                    onChange={(e) =>
                      setEdit({ ...edit, product: e.target.value })
                    }
                  />
                </Field>
                <Field label="公開予定日">
                  <input
                    type="date"
                    value={edit.date || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, date: e.target.value || null })
                    }
                  />
                </Field>
                <Field label="担当者">
                  <input
                    value={edit.owner}
                    onChange={(e) =>
                      setEdit({ ...edit, owner: e.target.value })
                    }
                  />
                </Field>
                <Field label="進捗">
                  <select
                    value={edit.status}
                    onChange={(e) =>
                      setEdit({ ...edit, status: e.target.value })
                    }
                  >
                    {Object.entries(statusLabels).map(([id, l]) => (
                      <option value={id} key={id}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="公開済みURL">
                  <input
                    type="url"
                    value={edit.url}
                    onChange={(e) => setEdit({ ...edit, url: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="投稿本文・構成案">
                <textarea
                  rows={6}
                  value={edit.caption}
                  onChange={(e) =>
                    setEdit({ ...edit, caption: e.target.value })
                  }
                />
              </Field>
              <Field label="確認事項・メモ">
                <textarea
                  rows={3}
                  value={edit.note}
                  onChange={(e) => setEdit({ ...edit, note: e.target.value })}
                />
              </Field>
            </div>
            <div className="modal-actions">
              {edit.id && (
                <Button
                  variant="danger-ghost"
                  onClick={async () => {
                    if (confirm("この投稿を削除しますか？")) {
                      const r = await act("削除", () =>
                        request("/posts/" + edit.id, null, "DELETE"),
                      );
                      if (r) setEdit(null);
                    }
                  }}
                >
                  削除
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={!!busy}>
                保存する
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Reports() {
  const { data, act, busy, go } = useApp();
  const [period, setPeriod] = useState("weekly"),
    [dates, setDates] = useState(range(data.today)),
    [detail, setDetail] = useState(null),
    [referenceIds, setReferenceIds] = useState(data.reportReferenceIds || []);
  return (
    <>
      <PageHeader
        eyebrow="REPORTS & PRESENTATIONS"
        title="運用の成果を、伝わる資料に。"
        description="投稿進捗・アカウント実績・競合の示唆をまとめて、定例会の準備を軽やかに。"
      />
      <div className="report-builder panel">
        <div className="report-illustration" aria-hidden="true">
          <div className="mini-slide">
            <span />
            <strong>
              WEEKLY
              <br />
              SOCIAL
              <br />
              REPORT.
            </strong>
            <i />
            <small>KADEN CONCIERGE</small>
          </div>
          <div className="mini-slide-back" />
          <span className="quick-icon lavender">
            <Presentation size={21} />
          </span>
        </div>
        <div className="report-builder-form">
          <Tag color="red">
            <Sparkles size={12} />
            AI PRESENTATION BUILDER
          </Tag>
          <h2>次の定例資料を作成</h2>
          <p>データのある範囲を、出典とともに整理します。</p>
          <div className="report-controls">
            <select
              aria-label="資料の種別"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setDates(
                  range(data.today, e.target.value === "monthly" ? 30 : 7),
                );
              }}
            >
              <option value="weekly">週次定例レポート</option>
              <option value="monthly">月次定例レポート</option>
            </select>
            <DateFields value={dates} onChange={setDates} />
          </div>
          <Button
            variant="primary"
            icon={Sparkles}
            disabled={!!busy}
            onClick={async () => {
              const r = await act(
                "定例レポートを作成",
                () => request("/reports", { ...dates, period, referenceIds }),
                "資料ドラフトを保存しました",
              );
              if (r) setDetail(r);
            }}
          >
            この期間の資料を生成 <ArrowRight size={15} />
          </Button>
        </div>
      </div>
      <div className="panel report-reference-picker">
        <div className="panel-heading">
          <h2>参考にする過去の定例資料</h2>
          <button className="text-link" onClick={() => go("documents")}>
            Driveから資料を取り込む
            <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="report-reference-list">
          {data.documents.length ? (
            data.documents.map((d) => (
              <label key={d.id} className="checkbox-line">
                <input
                  type="checkbox"
                  checked={referenceIds.includes(d.id)}
                  onChange={(e) =>
                    setReferenceIds((ids) =>
                      e.target.checked
                        ? [...ids, d.id]
                        : ids.filter((id) => id !== d.id),
                    )
                  }
                />
                <span>{d.name}</span>
              </label>
            ))
          ) : (
            <p>
              Driveまたはファイルから定例資料を取り込むと、章立て・集計観点を参照して生成できます。
            </p>
          )}
          <div className="inline-actions">
            <small>
              選択資料は全文をClaudeに送信。過去の数値は今回の実績に流用しません。
            </small>
            <Button
              variant="tiny"
              disabled={!!busy}
              onClick={() =>
                act(
                  "参考資料を保存",
                  () =>
                    request("/report-references", { ids: referenceIds }, "PUT"),
                  "定期生成にも使う参考資料を保存しました",
                )
              }
            >
              定期生成の参考資料にも設定
            </Button>
          </div>
        </div>
      </div>
      <div className="report-features">
        {[
          ["01", "実績・進捗を集約", "登録データだけを根拠に構成"],
          ["02", "Skillsのルールを反映", "指示全文を適用し、使用版を記録"],
          ["03", "PowerPointで書き出し", "編集可能な.pptxでダウンロード"],
        ].map(([n, t, s]) => (
          <div key={n}>
            <span>{n}</span>
            <div>
              <strong>{t}</strong>
              <small>{s}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <h2>作成したレポート</h2>
          <span>YOUR REPORT LIBRARY</span>
        </div>
        <Tag>{data.reports.length} 件</Tag>
      </div>
      {data.reports.length ? (
        <div className="report-grid">
          {data.reports.map((r) => (
            <section className="panel report-card" key={r.id}>
              <button
                className={`report-thumbnail ${r.period === "monthly" ? "monthly" : ""}`}
                onClick={() => setDetail(r)}
              >
                <span>KADEN / SOCIAL REPORT</span>
                <h3>
                  {r.period === "monthly" ? "MONTHLY" : "WEEKLY"}
                  <br />
                  INSIGHTS.
                </h3>
                <small>
                  {r.from} — {r.to}
                </small>
                <Presentation size={48} strokeWidth={0.7} />
                {r.demo && <Tag color="amber">サンプル</Tag>}
              </button>
              <div className="report-card-body">
                <Tag>{r.period === "monthly" ? "月次" : "週次"}定例資料</Tag>
                <h3>{r.title}</h3>
                <p>
                  {r.slides.length + 1} スライド · AI生成ドラフト
                  {r.demo ? " / 架空データ" : ""}
                </p>
                <div className="card-bottom">
                  <button className="text-link" onClick={() => setDetail(r)}>
                    内容を確認
                    <ArrowRight size={13} />
                  </button>
                  <a
                    className="icon-btn"
                    href={`/api/reports/${r.id}/pptx`}
                    aria-label="PowerPointをダウンロード"
                  >
                    <Download size={17} />
                  </a>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty icon={Presentation} title="定例会の準備を、ここから。">
            投稿・実績・タスクを登録して、最初のレポートを作成しましょう。
            <br />
            週次・月次の定期生成は「連携・設定」から設定できます。
          </Empty>
        </div>
      )}
      <Notice>
        現在は標準レイアウトで出力します。指定テンプレートがあれば、その様式への対応が必要です。
        <button onClick={() => go("insights")}>
          日立アカウントの実績を登録
        </button>
        するとレポートに含められます。
      </Notice>
      {detail && (
        <Modal title={detail.title} wide onClose={() => setDetail(null)}>
          <div className="modal-body">
            <div className="inline-actions">
              <Tag>
                {detail.from} — {detail.to}
              </Tag>
              <Tag color="amber">確認・承認前のドラフト</Tag>
            </div>
            <p className="text-content">{detail.summary}</p>
            {detail.slides.map((s, i) => (
              <article className="slide-preview" key={i}>
                <span className="slide-page">
                  {String(i + 2).padStart(2, "0")}
                </span>
                <div>
                  <h3>{s.title}</h3>
                  <ul>
                    {s.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                  <small className="muted">{s.notes}</small>
                </div>
              </article>
            ))}
            <h3>ネクストアクション</h3>
            <ul>
              {detail.nextActions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
            <Provenance item={detail} />
          </div>
          <div className="modal-actions">
            <a className="btn primary" href={`/api/reports/${detail.id}/pptx`}>
              <Download size={16} />
              PowerPointをダウンロード
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}

function Documents({ initialMode = "library" }) {
  const { data, act, busy, notify, go } = useApp();
  const configuredFolderId = data.config.driveFolderId || "";
  const [tab, setTab] = useState(initialMode),
    [drive, setDrive] = useState(false),
    [folderId, setFolderId] = useState(configuredFolderId),
    [driveRows, setDriveRows] = useState([]),
    [pageToken, setPageToken] = useState(null),
    [loaded, setLoaded] = useState(false),
    [inspect, setInspect] = useState(null),
    [preview, setPreview] = useState(false);
  const [revisionDoc, setRevisionDoc] = useState(""),
    [revision, setRevision] = useState(null),
    [removeComments, setRemoveComments] = useState(false),
    [allowPartial, setAllowPartial] = useState(false);
  const [xform, setXform] = useState({
      workbookId: "",
      sheetName: "",
      month: data.today.slice(0, 7),
      count: 50,
      brief: "",
    }),
    [refs, setRefs] = useState(""),
    [xplan, setXplan] = useState(null),
    [template, setTemplate] = useState({
      templateId: "",
      templateSlide: 1,
      mapping: { title: 0, body: 0, reply: 0, claim: 0, visual: 0 },
    });
  useEffect(() => setTab(initialMode), [initialMode]);
  const ppts = data.documents.filter((d) => d.type === "pptx"),
    books = data.documents.filter((d) => d.type === "xlsx"),
    book = books.find((d) => d.id === xform.workbookId),
    deck = ppts.find((d) => d.id === template.templateId),
    slide = deck?.extracted.slides[template.templateSlide - 1];
  async function upload(file) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const r = await act(
      "資料を取り込み",
      async () => {
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: form,
        });
        const v = await res.json();
        if (!res.ok) throw new Error(v.error);
        return v;
      },
      "資料を取り込みました",
    );
    if (r) useDoc(r);
  }
  function useDoc(doc) {
    if (doc.type === "xlsx" && /SNS企画案/i.test(doc.name)) {
      setXform({
        ...xform,
        workbookId: doc.id,
        sheetName: doc.extracted.sheets[0]?.name || "",
      });
      setTab("xideas");
    } else {
      setInspect(doc);
      setPreview(false);
    }
  }
  async function loadDrive(token) {
    const r = await act(
      "Drive一覧を取得",
      () =>
        request(
          `/documents/drive?folderId=${encodeURIComponent(folderId)}${token ? "&pageToken=" + encodeURIComponent(token) : ""}`,
        ),
      "",
    );
    if (r) {
      setDriveRows((old) => (token ? [...old, ...r.files] : r.files));
      setPageToken(r.nextPageToken || null);
      setLoaded(true);
    }
  }
  function parseReferences() {
    const parsed = refs
      .split("\n")
      .filter((s) => s.trim())
      .map((line) => {
        const at = line.indexOf("|");
        if (at < 0)
          throw new Error(
            "参考投稿は「URL | 投稿本文・表現のメモ」の形式で、1投稿1行で入力してください。",
          );
        const url = line.slice(0, at).trim(),
          text = line.slice(at + 1).trim();
        if (!/^https?:\/\//.test(url) || !text)
          throw new Error("参考URLと投稿本文の両方を入力してください。");
        return { url, text };
      });
    return parsed;
  }
  function updateAnnotation(index, key, value) {
    setRevision((r) => ({
      ...r,
      annotations: r.annotations.map((a, i) =>
        i === index ? { ...a, [key]: value } : a,
      ),
    }));
  }
  return (
    <>
      <PageHeader
        eyebrow="DRIVE & DOCUMENT WORKFLOWS"
        title="資料も、いつもの様式も、そのままに。"
        description="共有Driveから資料を選択。PPTの指摘反映と、X企画の審査資料作成につなげます。"
        actions={
          <>
            <Button
              icon={FolderOpen}
              onClick={() => {
                setDrive(true);
                setLoaded(false);
                setDriveRows([]);
              }}
            >
              Driveから選ぶ
            </Button>
            <label className="btn primary">
              <Upload size={15} />
              PPTX・Excelを取り込む
              <input
                type="file"
                hidden
                accept=".pptx,.xlsx"
                onChange={(e) => {
                  upload(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        }
      />
      <div className="tabs">
        <button
          className={tab === "library" ? "selected" : ""}
          onClick={() => setTab("library")}
        >
          資料ライブラリ <span>{data.documents.length}</span>
        </button>
        <button
          className={tab === "revision" ? "selected" : ""}
          onClick={() => setTab("revision")}
        >
          PPT修正反映
        </button>
        <button
          className={tab === "xideas" ? "selected" : ""}
          onClick={() => setTab("xideas")}
        >
          X企画・審査PPT
        </button>
      </div>
      {tab === "library" && (
        <>
          <Notice>
            登録済みの資料はローカルにコピーして使用します。Drive上の原本は変更しません。Googleスライド・スプレッドシートはPPTX・XLSXに変換して取り込むため、変換時の見た目は確認が必要です。
          </Notice>
          <div className="panel table-wrap">
            {data.documents.length ? (
              <table>
                <thead>
                  <tr>
                    <th>資料名</th>
                    <th>形式・内容</th>
                    <th>取得元</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.documents.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <button
                          className="table-title"
                          onClick={() => {
                            setInspect(d);
                            setPreview(false);
                          }}
                        >
                          {d.name}
                        </button>
                        <small className="table-sub">
                          SHA256 · {d.sha256.slice(0, 16)}
                        </small>
                      </td>
                      <td>
                        <Tag>{d.type.toUpperCase()}</Tag>{" "}
                        {d.type === "pptx"
                          ? `${d.extracted.slides.length} スライド`
                          : `${d.extracted.sheets.length} シート`}
                      </td>
                      <td>
                        {d.source === "drive" ? "Google Drive" : "アップロード"}
                      </td>
                      <td>
                        <div className="inline-actions">
                          <Button
                            variant="tiny"
                            onClick={() => {
                              if (d.type === "pptx") {
                                setRevisionDoc(d.id);
                                setTab("revision");
                              } else {
                                setXform({
                                  ...xform,
                                  workbookId: d.id,
                                  sheetName: d.extracted.sheets[0]?.name || "",
                                });
                                setTab("xideas");
                              }
                            }}
                          >
                            {d.type === "pptx" ? "指摘を確認" : "X企画に使う"}
                            <ArrowRight size={12} />
                          </Button>
                          <Button
                            variant="tiny"
                            onClick={() => {
                              setInspect(d);
                              setPreview(false);
                            }}
                          >
                            内容を見る
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty
                icon={FolderOpen}
                title="共有資料を、ワークフローの出発点に。"
                action={
                  <Button icon={FolderOpen} onClick={() => setDrive(true)}>
                    指定のDriveフォルダを開く
                  </Button>
                }
              >
                定例資料、SNS企画案Excel、SNS審査用PPT、注釈付きPPTを取り込めます。
                <br />
                25MB以下、PPTXは80スライド以下に対応します。
              </Empty>
            )}
          </div>
        </>
      )}
      {tab === "revision" && (
        <>
          <div className="panel padded document-workflow">
            <div className="inline-actions">
              <Tag color="red">SKILL 01</Tag>
              <Tag>棚卸し → 反映 → 注釈削除 → 検証</Tag>
            </div>
            <h2 className="subsection-title">
              初稿戻し・クライアント指摘を反映する
            </h2>
            <p className="muted">
              スライド画像と図形・テキスト情報をClaudeで読み取り、修正案を全件確認してから別名保存します。
            </p>
            <div className="form-grid">
              <Field label="注釈付きPPTX">
                <select
                  value={revisionDoc}
                  onChange={(e) => setRevisionDoc(e.target.value)}
                >
                  <option value="">取り込んだ資料から選ぶ</option>
                  {ppts.map((d) => (
                    <option value={d.id} key={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="document-start">
                <Button
                  variant="primary"
                  icon={Sparkles}
                  disabled={!!busy || !revisionDoc}
                  onClick={async () => {
                    const r = await act(
                      "全スライドの指摘を棚卸し（数分かかる場合があります）",
                      () =>
                        request("/documents/" + revisionDoc + "/revisions", {}),
                      "指摘一覧を保存しました。確認してから反映してください。",
                    );
                    if (r) {
                      setRevision(r);
                      setRemoveComments(false);
                      setAllowPartial(false);
                    }
                  }}
                >
                  全スライドの指摘を棚卸し
                </Button>
              </div>
            </div>
            <Notice>
              赤字・矢印・付箋・青ボックス・黄色マーカーを画像と座標で読解します。読み取りが曖昧な場合は停止し、要確認として残します。画像内の本文や表セルの自動置換には未対応です。
            </Notice>
          </div>
          <div className="section-heading">
            <div>
              <h2>修正作業の履歴</h2>
              <span>REVISION LOG</span>
            </div>
          </div>
          <div className="panel">
            {data.revisions.length ? (
              data.revisions.map((r) => (
                <button
                  className="history-row"
                  key={r.id}
                  onClick={() => {
                    setRevision(r);
                    setRemoveComments(false);
                    setAllowPartial(false);
                  }}
                >
                  <span className="quick-icon sand">
                    <FileText size={19} />
                  </span>
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {r.annotations.length}件の指摘 · {r.unresolved.length}
                      件の未解決
                    </small>
                  </span>
                  <Tag
                    color={
                      r.status === "applied"
                        ? "green"
                        : r.status === "partial"
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {r.status === "applied"
                      ? "反映済み"
                      : r.status === "partial"
                        ? "部分反映"
                        : "確認待ち"}
                  </Tag>
                </button>
              ))
            ) : (
              <Empty icon={FileText} title="最初の修正指示を取り込みましょう">
                既存資料の本文とレイアウトを保持し、確認した変更だけを反映します。
              </Empty>
            )}
          </div>
        </>
      )}
      {tab === "xideas" && (
        <>
          <section className="panel padded document-workflow">
            <div className="inline-actions">
              <Tag color="red">SKILL 02</Tag>
              <Tag>Excelの月別X欄 → 企画 → 審査PPTX</Tag>
            </div>
            <h2 className="subsection-title">
              日立の家電公式Xの企画を作成する
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                let references;
                try {
                  references = parseReferences();
                } catch (err) {
                  notify(err.message, true);
                  return;
                }
                const r = await act(
                  `${xform.count}案のX企画を作成（5案ずつ検証）`,
                  () => request("/documents/xideas", { ...xform, references }),
                  "X企画案を保存しました",
                );
                if (r) setXplan(r);
              }}
            >
              <div className="form-grid">
                <Field label="SNS企画案Excel">
                  <select
                    required
                    value={xform.workbookId}
                    onChange={(e) => {
                      const d = books.find((d) => d.id === e.target.value);
                      setXform({
                        ...xform,
                        workbookId: e.target.value,
                        sheetName: d?.extracted.sheets[0]?.name || "",
                      });
                    }}
                  >
                    <option value="">取り込んだExcelから選ぶ</option>
                    {books.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="月別シート">
                  <select
                    required
                    value={xform.sheetName}
                    onChange={(e) =>
                      setXform({ ...xform, sheetName: e.target.value })
                    }
                  >
                    <option value="">シートを選ぶ</option>
                    {book?.extracted.sheets.map((s) => (
                      <option key={s.name}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="対象月">
                  <input
                    type="month"
                    required
                    value={xform.month}
                    onChange={(e) =>
                      setXform({ ...xform, month: e.target.value })
                    }
                  />
                </Field>
                <Field label="作成する企画数（1〜50案）">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={xform.count}
                    onChange={(e) =>
                      setXform({ ...xform, count: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
              <Field
                label="Xトレンド参考投稿（1投稿1行）"
                hint="URLのみでは本文を取得しません。内容の推測を防ぐため、投稿本文・表現のメモも入力してください。"
              >
                <textarea
                  rows={5}
                  required
                  value={refs}
                  placeholder={
                    "https://x.com/account/status/… | 実際の投稿本文・表現のメモ\nhttps://x.com/account/status/… | 実際の投稿本文・表現のメモ"
                  }
                  onChange={(e) => setRefs(e.target.value)}
                />
              </Field>
              <Field label="追加条件・対象商品・承認済み情報">
                <textarea
                  rows={4}
                  value={xform.brief}
                  placeholder="商品名・性能の承認済み情報、企画の条件、避ける表現など"
                  onChange={(e) =>
                    setXform({ ...xform, brief: e.target.value })
                  }
                />
              </Field>
              <div className="form-bottom">
                <span>
                  最大50案 / X加重文字数を検証 / クイズの答えはリプライに分離
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  icon={Sparkles}
                  disabled={!!busy}
                >
                  指定数のX企画を作成
                </Button>
              </div>
            </form>
          </section>
          <div className="section-heading">
            <div>
              <h2>作成したX企画</h2>
              <span>X PLANNING LIBRARY</span>
            </div>
          </div>
          <div className="panel">
            {data.xplans.length ? (
              data.xplans.map((p) => (
                <button
                  className="history-row"
                  key={p.id}
                  onClick={() => setXplan(p)}
                >
                  <span className="quick-icon lavender">
                    <Presentation size={19} />
                  </span>
                  <span>
                    <strong>
                      {p.month} · X投稿企画 {p.ideas.length}案
                    </strong>
                    <small>
                      {p.sheetName} /{" "}
                      {p.status === "exported"
                        ? "審査用PPT作成済み"
                        : "企画ドラフト"}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))
            ) : (
              <Empty icon={Presentation} title="企画の根拠から、審査資料まで。">
                Excel・参考投稿・審査用PPTが揃えば、いつもの形式で編集可能な資料を作成できます。
              </Empty>
            )}
          </div>
        </>
      )}
      {drive && (
        <Modal
          title="Google Driveから資料を選ぶ"
          wide
          onClose={() => setDrive(false)}
        >
          <div className="modal-body">
            <Notice>
              指定フォルダへの読み取り権限があるGoogleアカウントで接続してください。Driveを追加する前に認証済みの場合は、読み取り権限を付けて再接続が必要です。
            </Notice>
            <div className="drive-controls">
              <input
                aria-label="DriveフォルダIDまたはURL"
                placeholder="DriveフォルダID / フォルダURL"
                value={folderId}
                onChange={(e) => {
                  const match = e.target.value.match(/folders\/([\w-]+)/);
                  setFolderId(match ? match[1] : e.target.value);
                  setLoaded(false);
                }}
              />
              <Button disabled={!!busy || !folderId.trim()} onClick={() => loadDrive()}>
                一覧を取得
              </Button>
              <Button
                onClick={() => {
                  setDrive(false);
                  go("settings");
                }}
              >
                Google接続設定
              </Button>
            </div>
            {!folderId.trim() && (
              <p className="muted">
                共有フォルダのURLまたはIDを入力してください。「連携・設定」で初期フォルダを保存できます。
              </p>
            )}
            {configuredFolderId && folderId !== configuredFolderId && (
              <button
                className="text-link"
                onClick={() => {
                  setFolderId(configuredFolderId);
                  setLoaded(false);
                  setDriveRows([]);
                }}
              >
                <ChevronLeft size={13} />
                指定共有フォルダへ戻る
              </button>
            )}
            <div className="drive-list">
              {driveRows.map((file) => {
                const isFolder =
                    file.mimeType === "application/vnd.google-apps.folder",
                  supported =
                    isFolder ||
                    /\.(pptx|xlsx)$/i.test(file.name) ||
                    [
                      "application/vnd.google-apps.presentation",
                      "application/vnd.google-apps.spreadsheet",
                    ].includes(file.mimeType);
                return (
                  <button
                    disabled={!supported || !!busy}
                    key={file.id}
                    onClick={async () => {
                      if (isFolder) {
                        setFolderId(file.id);
                        setDriveRows([]);
                        setLoaded(false);
                        return;
                      }
                      const d = await act(
                        "Driveから資料を取り込み",
                        () =>
                          request("/documents/drive/import", {
                            fileId: file.id,
                          }),
                        "Driveの原本を変更せず取り込みました",
                      );
                      if (d) {
                        setDrive(false);
                        useDoc(d);
                      }
                    }}
                  >
                    {isFolder ? (
                      <FolderOpen size={18} />
                    ) : (
                      <FileText size={18} />
                    )}
                    <span>{file.name}</span>
                    {isFolder ? (
                      <ChevronRight size={15} />
                    ) : (
                      <Download size={15} />
                    )}
                  </button>
                );
              })}
            </div>
            {loaded && !driveRows.length && (
              <p className="empty-line">
                このフォルダに閲覧可能な資料がありません。
              </p>
            )}
            {pageToken && (
              <Button onClick={() => loadDrive(pageToken)} disabled={!!busy}>
                次の100件を読み込む
              </Button>
            )}
          </div>
        </Modal>
      )}
      {inspect && (
        <Modal title={inspect.name} wide layer={110} onClose={() => setInspect(null)}>
          <div className="modal-body">
            <div className="inline-actions">
              <Tag>{inspect.type.toUpperCase()}</Tag>
              <Tag>SHA256 · {inspect.sha256.slice(0, 16)}</Tag>
              {inspect.type === "pptx" && (
                <Button
                  variant="tiny"
                  disabled={!!busy}
                  onClick={async () => {
                    const r = await act(
                      "スライドを画像化",
                      () => request("/documents/" + inspect.id + "/render", {}),
                      "画像化しました",
                    );
                    if (r) setPreview(true);
                  }}
                >
                  スライドを画像で確認
                </Button>
              )}
            </div>
            {inspect.type === "pptx"
              ? inspect.extracted.slides.map((s) => (
                  <details className="document-slide" key={s.number}>
                    <summary>
                      スライド {s.number} · {s.shapes.length}図形
                    </summary>
                    {preview && (
                      <img
                        className="file-preview-img"
                        src={`/api/documents/${inspect.id}/slides/${s.number}`}
                        alt={`スライド${s.number}`}
                      />
                    )}
                    <div className="shape-list">
                      {s.shapes
                        .filter((shape) => shape.text || shape.table?.length)
                        .map((shape) => (
                          <div key={shape.id}>
                            <Tag>ID {shape.id}</Tag>
                            <strong>{shape.name}</strong>
                            <pre className="text-content">
                              {shape.text || JSON.stringify(shape.table)}
                            </pre>
                          </div>
                        ))}
                    </div>
                  </details>
                ))
              : inspect.extracted.sheets.map((s) => (
                  <details key={s.name}>
                    <summary>
                      {s.name} · {s.rows.length}行
                    </summary>
                    <div className="table-wrap">
                      <table>
                        <tbody>
                          {s.rows.slice(0, 100).map((row) => (
                            <tr key={row.row}>
                              <td>{row.row}</td>
                              {row.cells.map((cell, i) => (
                                <td key={i}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {s.rows.length > 100 && (
                      <small>
                        プレビューは先頭100行。処理時には全行を使用します。
                      </small>
                    )}
                  </details>
                ))}
          </div>
        </Modal>
      )}
      {revision && (
        <Modal
          title="指摘の棚卸し・反映内容の確認"
          wide
          onClose={() => setRevision(null)}
        >
          <div className="modal-body">
            <p>{revision.summary}</p>
            <Notice>
              棚卸しの網羅性と反映先を元スライドで確認してください。承認した指摘の本文置換と、指定したレビュー専用図形の削除だけを行います。
            </Notice>
            {revision.unresolved.length > 0 && (
              <Notice tone="warning">
                未解決：{revision.unresolved.join(" / ")}
                。部分反映ドラフトのみ作成できます。
              </Notice>
            )}
            {revision.annotations.map((a, i) => (
              <article className="approval-item" key={i}>
                <div className="inline-actions">
                  <Tag>スライド {a.slide}</Tag>
                  <Tag color={a.status === "applicable" ? "green" : "amber"}>
                    {a.status === "applicable" ? "反映案あり" : "要確認"}
                  </Tag>
                </div>
                <h3>{a.instruction}</h3>
                <details>
                  <summary>元スライドを画像で確認</summary>
                  <img
                    className="file-preview-img"
                    src={`/api/documents/${revision.documentId}/slides/${a.slide}`}
                    alt={`指摘のあるスライド${a.slide}`}
                  />
                </details>
                <p className="muted">{a.note}</p>
                <p className="small-text">
                  削除する注釈図形ID：
                  {a.annotationShapeIds.join(", ") || "なし"}
                </p>
                {a.replacements.map((r, j) => (
                  <div key={j}>
                    <Tag>
                      {r.field} · ID {r.shapeId}
                    </Tag>
                    <pre className="text-content">変更前：{r.oldText}</pre>
                    <Field label="変更後の本文">
                      <textarea
                        rows={3}
                        value={r.newText}
                        onChange={(e) =>
                          updateAnnotation(
                            i,
                            "replacements",
                            a.replacements.map((item, k) =>
                              k === j
                                ? { ...item, newText: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                ))}
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    disabled={a.status !== "applicable"}
                    checked={a.approved || false}
                    onChange={(e) =>
                      updateAnnotation(i, "approved", e.target.checked)
                    }
                  />
                  本文変更と注釈削除の対象を確認・承認した
                </label>
              </article>
            ))}
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={allowPartial}
                onChange={(e) => {
                  setAllowPartial(e.target.checked);
                  if (e.target.checked) setRemoveComments(false);
                }}
              />
              未解決・未承認を残し、部分反映ドラフトを作る
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={removeComments}
                disabled={allowPartial || revision.unresolved.length > 0}
                onChange={(e) => setRemoveComments(e.target.checked)}
              />
              全件反映できる場合、Officeコメントも一括削除する
            </label>
            {revision.verification && (
              <Notice>
                {revision.verification.verification} 置換
                {revision.verification.applied}件・注釈図形削除
                {revision.verification.deletedShapes}件。
              </Notice>
            )}
            <Provenance item={revision} />
          </div>
          <div className="modal-actions">
            {revision.outputId && (
              <a
                className="btn"
                href={`/api/documents/revisions/${revision.id}/download`}
              >
                <Download size={15} />
                保存済みPPTX
              </a>
            )}
            <Button
              variant="primary"
              disabled={!!busy}
              icon={CheckCheck}
              onClick={async () => {
                const r = await act(
                  "修正を反映して検証",
                  () =>
                    request("/documents/revisions/" + revision.id + "/apply", {
                      annotations: revision.annotations,
                      removeOfficeComments: removeComments,
                      allowPartial,
                    }),
                  "別名のPPTXを作成しました。ダウンロード後に目視確認してください。",
                );
                if (r) setRevision(r);
              }}
            >
              承認した修正を別名保存
            </Button>
          </div>
        </Modal>
      )}
      {xplan && (
        <Modal
          title={`${xplan.month} X投稿企画 ${xplan.ideas.length}案`}
          wide
          onClose={() => setXplan(null)}
        >
          <div className="modal-body">
            <Notice>
              投稿文・クイズの答え分離・加重文字数を検証したドラフトです。商品情報と表現を承認した後に使用してください。画像ラフは編集可能なテキスト構図として出力します。
            </Notice>
            <details>
              <summary>
                企画案の本文・リプライ・画像ラフを確認（{xplan.ideas.length}案）
              </summary>
              {xplan.ideas.map((idea, i) => (
                <article className="idea-card" key={i}>
                  <Tag>IDEA {String(i + 1).padStart(2, "0")}</Tag>
                  <h3>{idea.title}</h3>
                  <h4>投稿本文{idea.isQuiz ? "（問題）" : ""}</h4>
                  <p className="text-content">{idea.body}</p>
                  <h4>リプライ{idea.isQuiz ? "（答え）" : ""}</h4>
                  <p>{idea.reply || "なし"}</p>
                  <h4>画像ラフ</h4>
                  <p>{idea.visual}</p>
                  <p className="caution">
                    {idea.claim} / {idea.caution}
                  </p>
                  <div className="source-links">
                    {idea.sourceUrls.map((u) => (
                      <a
                        key={u}
                        href={safeUrl(u)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        参考投稿
                        <ExternalLink size={12} />
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </details>
            <h3 className="subsection-title">既存のSNS審査用PPTを複製</h3>
            <div className="form-grid">
              <Field label="審査用PPTX">
                <select
                  value={template.templateId}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      templateId: e.target.value,
                      templateSlide: 1,
                      mapping: {
                        title: 0,
                        body: 0,
                        reply: 0,
                        claim: 0,
                        visual: 0,
                      },
                    })
                  }
                >
                  <option value="">過去の審査用PPTを選ぶ</option>
                  {ppts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="複製するX企画スライド">
                <select
                  value={template.templateSlide}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      templateSlide: Number(e.target.value),
                      mapping: {
                        title: 0,
                        body: 0,
                        reply: 0,
                        claim: 0,
                        visual: 0,
                      },
                    })
                  }
                >
                  {deck?.extracted.slides.map((s) => (
                    <option key={s.number} value={s.number}>
                      スライド {s.number}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {deck && (
              <>
                <Button
                  variant="tiny"
                  onClick={() => {
                    setInspect(deck);
                    setPreview(false);
                  }}
                >
                  図形IDと元スライドを確認
                </Button>
                <div className="form-grid mapping-grid">
                  {[
                    ["title", "タイトル欄"],
                    ["body", "投稿本文欄"],
                    ["reply", "リプライ欄"],
                    ["claim", "訴求欄"],
                    ["visual", "画像ラフ欄"],
                  ].map(([key, label]) => (
                    <Field key={key} label={`${label}のテキストボックス`}>
                      <select
                        required
                        value={template.mapping[key]}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            mapping: {
                              ...template.mapping,
                              [key]: Number(e.target.value),
                            },
                          })
                        }
                      >
                        <option value="0">図形を選ぶ</option>
                        {slide?.shapes
                          .filter((s) => s.text)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              ID {s.id} · {s.name} · {s.text.slice(0, 25)}
                            </option>
                          ))}
                      </select>
                    </Field>
                  ))}
                </div>
              </>
            )}
            <Notice>
              元資料のスライドを保持し、指定ページを企画数ぶん複製して末尾に追加します。画像・位置・元の書式を引き継ぎ、指定テキストボックスの中身を置換。クイズの答えと出典はノートにも記載します。
            </Notice>
            {xplan.verification && (
              <Notice>{xplan.verification.verification}</Notice>
            )}
            <Provenance item={xplan} />
          </div>
          <div className="modal-actions">
            {xplan.outputPath === undefined && xplan.status === "exported" && (
              <a
                className="btn"
                href={`/api/documents/xideas/${xplan.id}/download`}
              >
                <Download size={15} />
                審査用PPTXを取得
              </a>
            )}
            <Button
              variant="primary"
              disabled={
                !!busy ||
                !template.templateId ||
                Object.values(template.mapping).some((v) => !v)
              }
              icon={Presentation}
              onClick={async () => {
                const r = await act(
                  "審査用PPTを複製して検証",
                  () =>
                    request(
                      "/documents/xideas/" + xplan.id + "/pptx",
                      template,
                    ),
                  "編集可能な審査用PPTXを作成しました",
                );
                if (r) setXplan(r);
              }}
            >
              審査用PPTXを作成
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Skills() {
  const { data, act, busy, notify, go } = useApp();
  const [edit, setEdit] = useState(null),
    [selected, setSelected] = useState(data.skills[0]?.id || null);
  const current = data.skills.find((s) => s.id === selected) || data.skills[0];
  const claudeProjectUrl = safeClaudeProjectUrl(data.config.claudeProjectUrl);
  async function loadFile(file) {
    if (!file) return;
    if (file.size > 180000)
      return notify("180KB以下のテキストファイルを選んでください。", true);
    setEdit({
      name: file.name.replace(/\.(md|txt)$/i, ""),
      content: await file.text(),
      enabled: true,
    });
  }
  return (
    <>
      <PageHeader
        eyebrow="YOUR KNOWLEDGE, YOUR RULES"
        title="いつもの指示を、正確に引き継ぐ。"
        description="Claudeプロジェクトの指示・Skillsを全文で管理。AI実行時に有効な指示を送信します。"
        actions={
          <>
            <label className="btn">
              <Upload size={15} />
              ファイルから登録
              <input
                hidden
                type="file"
                accept=".md,.txt"
                onChange={(e) => {
                  loadFile(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setEdit({ name: "", content: "", enabled: true })}
            >
              指示を登録
            </Button>
          </>
        }
      />
      <Notice>
        ClaudeのプロジェクトURLだけでは、非公開の指示・添付ファイル・過去チャットは取得できません。全文をコピーするか、.md
        /
        .txtを登録してください。関連ファイルや参照ルールもテキストで登録すると実行に反映されます。
      </Notice>
      <div className="skills-layout">
        <section className="panel skill-list">
          <div className="panel-heading">
            <h2>登録済みSkills</h2>
            <Tag>{data.skills.length}</Tag>
          </div>
          {data.skills.length ? (
            data.skills.map((s) => (
              <button
                key={s.id}
                className={`skill-row ${current?.id === s.id ? "selected" : ""}`}
                onClick={() => setSelected(s.id)}
              >
                <BookOpen size={18} />
                <span>
                  <strong>{s.name}</strong>
                  <small>SHA256 · {s.sha256.slice(0, 12)}</small>
                </span>
                <span
                  className={`status-dot ${s.enabled ? "connected" : ""}`}
                />
              </button>
            ))
          ) : (
            <Empty icon={BookOpen} title="指示を引き継ぎましょう">
              ブランドルールや分析の観点など、
              <br />
              いつもの指示を登録できます。
            </Empty>
          )}
        </section>
        <section className="panel skill-detail">
          {current ? (
            <>
              <div className="panel-heading">
                <div>
                  <Tag color={current.enabled ? "green" : "neutral"}>
                    {current.enabled ? "実行時に適用" : "無効"}
                  </Tag>
                  <h2>{current.name}</h2>
                </div>
                <Button onClick={() => setEdit(current)}>編集する</Button>
              </div>
              <div className="skill-meta">
                <span>
                  <Hash size={13} />
                  {current.sha256}
                </span>
                <small>
                  更新：
                  {new Date(current.updatedAt).toLocaleString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                  })}
                </small>
              </div>
              <pre className="skill-content">{current.content}</pre>
              <div className="skill-detail-footer">
                <span>
                  <ShieldCheck size={14} />
                  要約・切り詰めをせず全文を使用
                </span>
                <Button
                  variant="tiny"
                  onClick={() =>
                    act("適用状態を変更", () =>
                      request("/skills", {
                        ...current,
                        enabled: !current.enabled,
                      }),
                    )
                  }
                >
                  {current.enabled ? "無効にする" : "有効にする"}
                </Button>
              </div>
            </>
          ) : (
            <div className="skills-empty">
              <span className="claude-spark">✳</span>
              <h2>チームの知識を、AIの判断基準に。</h2>
              <p>
                ブランド表現、禁止事項、分析の視点、出力形式。
                <br />
                あなたのルールを、すべてのAI業務に反映します。
              </p>
              {claudeProjectUrl && (
                <a
                  href={claudeProjectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                >
                  Claudeプロジェクトを開く
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          )}
        </section>
      </div>
      <div className="instruction-footnotes">
        <div>
          <ShieldCheck size={19} />
          <h3>使った指示を追跡</h3>
          <p>
            すべての生成結果にSkills名とハッシュを記録。どの版を使ったか確認できます。
          </p>
        </div>
        <div>
          <FileText size={19} />
          <h3>全文をそのまま適用</h3>
          <p>
            有効な指示を省略せず送信。合計180KBを超える場合は、切り捨てずに停止します。
          </p>
        </div>
        <div>
          <Zap size={19} />
          <h3>実行指示はボタンにも</h3>
          <p>
            過去チャットの指示は
            <button className="text-link" onClick={() => go("actions")}>
              AIワークフロー
            </button>
            に登録して再利用できます。
          </p>
        </div>
      </div>
      {edit && (
        <Modal
          title={edit.id ? "Skillsを編集" : "新しいSkillsを登録"}
          wide
          onClose={() => setEdit(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await act("Skillsを保存", () =>
                request("/skills", edit),
              );
              if (r) {
                setSelected(r.id);
                setEdit(null);
              }
            }}
          >
            <div className="modal-body">
              <Field label="Skills名">
                <input
                  required
                  placeholder="例：日立家電 ブランド表現ルール"
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </Field>
              <Field
                label="指示の全文"
                hint="APIキー・個人情報など、プロンプトに含めるべきでない情報は登録しないでください。"
              >
                <textarea
                  className="mono"
                  required
                  rows={16}
                  value={edit.content}
                  placeholder="Claudeプロジェクトの指示・SKILL.mdをそのまま貼り付け"
                  onChange={(e) =>
                    setEdit({ ...edit, content: e.target.value })
                  }
                />
              </Field>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={edit.enabled}
                  onChange={(e) =>
                    setEdit({ ...edit, enabled: e.target.checked })
                  }
                />
                AI実行時にこの指示を適用する
              </label>
              <Notice>
                全文を送ってもモデルの厳密な遵守は保証できません。生成内容とブランドルールへの適合は人が確認してください。
              </Notice>
            </div>
            <div className="modal-actions">
              {edit.id && (
                <Button
                  variant="danger-ghost"
                  onClick={async () => {
                    if (
                      confirm(
                        "このSkillsを削除しますか？過去の生成履歴は残ります。",
                      )
                    ) {
                      const r = await act("削除", () =>
                        request("/skills/" + edit.id, null, "DELETE"),
                      );
                      if (r) setEdit(null);
                    }
                  }}
                >
                  削除
                </Button>
              )}
              <Button variant="primary" type="submit" disabled={!!busy}>
                全文を保存する
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Settings() {
  const { data, act, busy, notify, reload } = useApp();
  const [config, setConfig] = useState(data.config),
    [credentials, setCredentials] = useState({
      ANTHROPIC_API_KEY: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    }),
    [saved, setSaved] = useState(true);
  function update(key, value) {
    setSaved(false);
    setConfig((c) => ({ ...c, [key]: value }));
  }
  const cred = (key, value) => {
    setSaved(false);
    setCredentials((c) => ({ ...c, [key]: value }));
  };
  async function save(e) {
    e.preventDefault();
    const r = await act(
      "設定を保存",
      () => request("/settings", { config, credentials }, "PUT"),
      "設定を保存しました",
    );
    if (r) {
      setCredentials({
        ANTHROPIC_API_KEY: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
      });
      setSaved(true);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="CONNECTIONS & PREFERENCES"
        title="チームの仕事に、つなげる。"
        description="Claude、Google、定期実行。必要な連携を設定して、いつもの運用へ。"
      />
      <form onSubmit={save}>
        <section className="panel settings-section">
          <div className="settings-heading">
            <span className="settings-service claude-spark">✳</span>
            <div>
              <h2>Claude API</h2>
              <p>議事録・分析・企画・資料生成に使用</p>
            </div>
            <Tag color={data.connections.claude ? "green" : "amber"}>
              {data.connections.claude ? "キー登録済み" : "未設定"}
            </Tag>
          </div>
          <div className="form-grid">
            <Field
              label="Anthropic APIキー"
              hint="空欄のまま保存すると、登録済みのキーを保持します。"
            >
              <input
                type="password"
                autoComplete="off"
                placeholder={
                  data.connections.claude
                    ? "登録済み（値は表示しません）"
                    : "sk-ant-…"
                }
                value={credentials.ANTHROPIC_API_KEY}
                onChange={(e) => cred("ANTHROPIC_API_KEY", e.target.value)}
              />
            </Field>
            <Field label="使用するモデル">
              <input
                value={config.model}
                required
                onChange={(e) => update("model", e.target.value)}
              />
            </Field>
            <Field
              label="ClaudeプロジェクトURL（任意）"
              hint="https://claude.ai/project/ から始まるURL。Skills画面から開くためのリンクです。"
              wide
            >
              <input
                type="url"
                placeholder="https://claude.ai/project/…"
                value={config.claudeProjectUrl || ""}
                onChange={(e) => update("claudeProjectUrl", e.target.value)}
              />
            </Field>
          </div>
          <Notice>
            ClaudeのWeb版プロジェクトへの直接接続ではありません。APIキーと登録したSkillsを使い、Anthropic
            APIで実行します。API利用料金が発生します。
          </Notice>
        </section>
        <section className="panel settings-section">
          <div className="settings-heading">
            <span className="settings-service google-letter">G</span>
            <div>
              <h2>Google カレンダー・シート・Drive</h2>
              <p>確認したアクションと、企画案を連携</p>
            </div>
            <Tag color={data.connections.google ? "green" : "amber"}>
              {data.connections.google ? "認証済み" : "未接続"}
            </Tag>
          </div>
          <div className="form-grid">
            <Field label="OAuthクライアントID">
              <input
                autoComplete="off"
                placeholder={
                  data.connections.googleClient
                    ? "登録済み（変更時のみ入力）"
                    : "….apps.googleusercontent.com"
                }
                value={credentials.GOOGLE_CLIENT_ID}
                onChange={(e) => cred("GOOGLE_CLIENT_ID", e.target.value)}
              />
            </Field>
            <Field label="OAuthクライアントシークレット">
              <input
                type="password"
                autoComplete="off"
                placeholder={
                  data.connections.googleClient
                    ? "登録済み（変更時のみ入力）"
                    : "GOCSPX-…"
                }
                value={credentials.GOOGLE_CLIENT_SECRET}
                onChange={(e) => cred("GOOGLE_CLIENT_SECRET", e.target.value)}
              />
            </Field>
            <Field
              label="リダイレクトURI"
              wide
              hint="Google CloudのWebアプリ用OAuthクライアントに、このURIを正確に登録してください。"
            >
              <input
                required
                type="url"
                value={config.redirectUri}
                onChange={(e) => update("redirectUri", e.target.value)}
              />
            </Field>
            <Field
              label="カレンダーID"
              hint="primary、または登録先の共有カレンダーID"
            >
              <input
                value={config.calendarId}
                onChange={(e) => update("calendarId", e.target.value)}
              />
            </Field>
            <Field
              label="スプレッドシートID"
              hint="URLの /d/ と /edit の間。URL貼り付けにも対応。"
            >
              <input
                value={config.spreadsheetId}
                placeholder="スプレッドシートID / URL"
                onChange={(e) => {
                  const m = e.target.value.match(/\/d\/([\w-]+)/);
                  update("spreadsheetId", m ? m[1] : e.target.value);
                }}
              />
            </Field>
            <Field
              label="追記先のタブ名"
              hint="空の専用タブ、または書き出しCSVと同じ列形式のタブを使用"
            >
              <input
                required
                value={config.sheetName}
                onChange={(e) => update("sheetName", e.target.value)}
              />
            </Field>
            <Field
              label="Drive初期フォルダID（任意）"
              hint="共有フォルダのIDまたはURL。未設定の場合は資料を選ぶ画面で入力できます。"
              wide
            >
              <input
                value={config.driveFolderId || ""}
                placeholder="DriveフォルダID / フォルダURL"
                onChange={(e) => {
                  const match = e.target.value.match(/folders\/([\w-]+)/);
                  update("driveFolderId", match ? match[1] : e.target.value);
                }}
              />
            </Field>
          </div>
          <div className="settings-connect">
            <Button
              icon={Link2}
              disabled={!!busy || !saved}
              onClick={async () => {
                const r = await act(
                  "Google認証を開始",
                  () => request("/google/connect", {}),
                  "",
                );
                if (r) window.location.assign(r.url);
              }}
            >
              {data.connections.google ? "Googleを再接続" : "Googleを接続する"}
            </Button>
            {data.connections.google && (
              <Button
                variant="danger-ghost"
                onClick={() => {
                  if (confirm("Googleとの接続を解除しますか？"))
                    act("接続を解除", () =>
                      request("/google/connect", null, "DELETE"),
                    );
                }}
              >
                接続を解除
              </Button>
            )}
            {!saved && <small>設定を保存してから接続してください</small>}
          </div>
          <details className="setup-details">
            <summary>Google連携の準備手順</summary>
            <ol>
              <li>
                Google CloudでCalendar API、Google Sheets API、Google Drive
                APIを有効化。
              </li>
              <li>
                OAuth同意画面とWebアプリ用OAuthクライアントを作成。テスト中は利用アカウントをテストユーザーに追加。
              </li>
              <li>
                上記のリダイレクトURIを登録し、ID・シークレットを入力して設定を保存。
              </li>
              <li>
                「Googleを接続する」から認証。対象カレンダー・シートの編集権限を持つアカウントを使用。
              </li>
              <li>
                シートに専用タブを作成。カスタム列の既存様式は自動で書き換えません。
              </li>
            </ol>
          </details>
        </section>
        <section className="panel settings-section">
          <div className="settings-heading">
            <span className="settings-service schedule-service">
              <Clock3 size={23} />
            </span>
            <div>
              <h2>日別・週次・月次の定期実行</h2>
              <p>生成物はアプリ内に保存 / 日本時間（Asia/Tokyo）</p>
            </div>
            <label className="toggle" aria-label="定期実行">
              <input
                type="checkbox"
                checked={config.scheduleEnabled}
                onChange={(e) => update("scheduleEnabled", e.target.checked)}
              />
              <span />
            </label>
          </div>
          <div className="form-grid">
            <Field label="週次の実行曜日">
              <select
                value={config.weeklyDay}
                onChange={(e) => update("weeklyDay", Number(e.target.value))}
              >
                {[
                  "日曜日",
                  "月曜日",
                  "火曜日",
                  "水曜日",
                  "木曜日",
                  "金曜日",
                  "土曜日",
                ].map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="実行時刻（日本時間）">
              <select
                value={config.scheduleHour}
                onChange={(e) => update("scheduleHour", Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="schedule-checks">
            {[
              [
                "dailyEnabled",
                "日別の競合分析",
                "毎日、前日分の投稿データを分析",
              ],
              [
                "weeklyReportEnabled",
                "週次定例レポート",
                "指定曜日に、前日までの7日間を集計",
              ],
              [
                "monthlyReportEnabled",
                "月次定例レポート",
                "毎月1日に、前月分の資料を生成",
              ],
              [
                "autoSyncSheets",
                "週次企画案を指定シートにも自動追記",
                "有効にすると、週次分析後に確認操作なしで外部に書き込みます",
              ],
            ].map(([id, t, s]) => (
              <label key={id} className="schedule-option">
                <input
                  type="checkbox"
                  checked={config[id]}
                  onChange={(e) => update(id, e.target.checked)}
                />
                <span>
                  <strong>{t}</strong>
                  <small>{s}</small>
                </span>
              </label>
            ))}
          </div>
          <Notice>
            週次の競合分析は定期実行ONで有効になります。サーバー稼働中のみ動作し、過去の停止期間は遡及しません。SNSデータは事前の取り込みが必要です。失敗は「AIワークフロー」の履歴に記録します。
          </Notice>
        </section>
        <div className="settings-save">
          <span>
            <ShieldCheck size={15} />
            APIキーとOAuthトークンはサーバー内で暗号化して保存
          </span>
          <Button
            variant="primary"
            type="submit"
            disabled={!!busy}
            icon={Check}
          >
            設定を保存する
          </Button>
        </div>
      </form>
      <div className="settings-data panel">
        <div>
          <h3>サンプルデータ</h3>
          <p>画面と出力を試すための架空データです。実データは削除しません。</p>
        </div>
        <div className="inline-actions">
          <Button
            disabled={!!busy}
            onClick={() => act("サンプルを準備", () => request("/demo", {}))}
          >
            サンプルを追加
          </Button>
          <Button
            disabled={!!busy}
            onClick={() =>
              act("サンプルを削除", () => request("/demo", null, "DELETE"))
            }
          >
            サンプルを削除
          </Button>
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
