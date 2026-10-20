import express from "express";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { pathToFileURL } from "node:url";
import {
  db,
  list,
  get,
  put,
  remove,
  setting,
  setSetting,
  secret,
  setSecret,
  transaction,
} from "./db.js";
import {
  dateSchema,
  taskSchema,
  postSchema,
  observationSchema,
  metrics,
  jstDate,
  rangeSchema,
  makeIcs,
} from "./domain.js";
import { generate, skillVersion } from "./ai.js";
import {
  googleAuthUrl,
  finishGoogleAuth,
  googleStatus,
  syncTask,
  syncResearch,
} from "./google.js";
import { research, report, schedulerTick } from "./jobs.js";
import { presentation, observationsCsv, researchCsv } from "./exports.js";
import { seedSample, clearSample } from "./sample.js";
import { documentRoutes, documentState } from "./documents.js";
import { bootstrap } from "./bootstrap.js";

const configSchema = z.object({
  model: z.string().min(1).max(120).default("claude-sonnet-4-5"),
  calendarId: z.string().max(300).default("primary"),
  spreadsheetId: z
    .string()
    .regex(/^[\w-]*$/)
    .default(""),
  sheetName: z.string().min(1).max(100).default("競合分析"),
  driveFolderId: z.string().regex(/^[\w-]{0,200}$/).default(""),
  claudeProjectUrl: z.string().max(300).regex(/^$|^https:\/\/claude\.ai\/project\/[A-Za-z0-9-]+\/?$/).default(""),
  redirectUri: z
    .string()
    .url()
    .refine((s) => {
      try {
        const u = new URL(s);
        return (
          u.protocol === "https:" ||
          (u.protocol === "http:" &&
            ["localhost", "127.0.0.1"].includes(u.hostname))
        );
      } catch {
        return false;
      }
    })
    .default("http://127.0.0.1:3000/api/google/callback"),
  scheduleEnabled: z.boolean().default(false),
  dailyEnabled: z.boolean().default(true),
  weeklyDay: z.number().int().min(0).max(6).default(4),
  scheduleHour: z.number().int().min(0).max(23).default(12),
  weeklyReportEnabled: z.boolean().default(true),
  monthlyReportEnabled: z.boolean().default(true),
  autoSyncSheets: z.boolean().default(false),
});
const mustGet = (kind, id) => {
  const value = get(kind, id);
  if (!value)
    throw Object.assign(new Error("対象データが見つかりません。"), {
      status: 404,
    });
  return value;
};
// Zod defaults must not reset fields omitted from PATCH requests.
const patch = (schema, body) =>
  Object.fromEntries(
    Object.entries(schema.partial().parse(body)).filter(([key]) =>
      Object.hasOwn(body, key),
    ),
  );
const locks = new Set();
async function locked(id, fn) {
  if (locks.has(id))
    throw Object.assign(
      new Error("この処理は実行中です。完了後に確認してください。"),
      { status: 409 },
    );
  locks.add(id);
  try {
    return await fn();
  } finally {
    locks.delete(id);
  }
}
export const app = express();
bootstrap();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store",
  });
  if (process.env.APP_PASSWORD) {
    const raw = Buffer.from(
      (req.headers.authorization || "").replace(/^Basic /, ""),
      "base64",
    ).toString();
    const entered = raw.slice(raw.indexOf(":") + 1);
    const hash = (s) => createHash("sha256").update(s).digest();
    if (!timingSafeEqual(hash(entered), hash(process.env.APP_PASSWORD))) {
      res.set(
        "WWW-Authenticate",
        'Basic realm="KADEN Concierge", charset="UTF-8"',
      );
      return res.status(401).send("認証が必要です");
    }
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.origin;
    const allowed = new Set([
      `http://${req.headers.host}`,
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      process.env.APP_ORIGIN,
    ]);
    if (origin && !allowed.has(origin))
      return res.status(403).json({ error: "許可されていない送信元です。" });
    if (req.headers["sec-fetch-site"] === "cross-site")
      return res
        .status(403)
        .json({ error: "外部サイトからの操作を拒否しました。" });
  }
  next();
});
app.use(express.json({ limit: "3mb" }));
app.get("/api/health", (_, res) =>
  res.json({
    ok: true,
    date: jstDate(),
    scheduler: "稼働中のプロセス内で実行",
  }),
);
app.get("/api/state", (_, res) => {
  const data = Object.fromEntries(
    [
      "task",
      "post",
      "meeting",
      "observation",
      "research",
      "report",
      "skill",
      "workflow",
      "run",
    ].map((kind) => [kind + "s", list(kind)]),
  );
  res.json({
    ...data,
    ...documentState(),
    reportReferenceIds: setting("reportReferences", []),
    config: configSchema.parse(setting("config", {})),
    connections: {
      claude: Boolean(secret("ANTHROPIC_API_KEY")),
      google: googleStatus(),
      googleClient: Boolean(
        secret("GOOGLE_CLIENT_ID") && secret("GOOGLE_CLIENT_SECRET"),
      ),
    },
    today: jstDate(),
  });
});
app.put("/api/settings", (req, res) => {
  const { config, credentials } = z
    .object({
      config: configSchema,
      credentials: z
        .object({
          ANTHROPIC_API_KEY: z.string().max(500).optional(),
          GOOGLE_CLIENT_ID: z.string().max(500).optional(),
          GOOGLE_CLIENT_SECRET: z.string().max(500).optional(),
        })
        .optional(),
    })
    .parse(req.body);
  const old = setting("config", {}),
    changedGoogle =
      credentials?.GOOGLE_CLIENT_ID ||
      credentials?.GOOGLE_CLIENT_SECRET ||
      (old.redirectUri && old.redirectUri !== config.redirectUri);
  transaction(() => {
    setSetting("config", config);
    for (const [name, value] of Object.entries(credentials || {}))
      if (value?.trim()) setSecret(name, value.trim());
    if (changedGoogle) setSetting("googleTokens", null);
  });
  res.json({ saved: true });
});
app.post("/api/google/connect", (_, res) => {
  const { url, state } = googleAuthUrl();
  res.setHeader(
    "Set-Cookie",
    `kaden_oauth=${state}; HttpOnly; SameSite=Lax; Path=/api/google; Max-Age=600${process.env.APP_ORIGIN?.startsWith("https:") ? "; Secure" : ""}`,
  );
  res.json({ url });
});
app.get("/api/google/callback", async (req, res) => {
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("kaden_oauth="))
    ?.split("=")[1];
  if (!cookie || cookie !== req.query.state)
    throw Object.assign(
      new Error("認証元のブラウザを確認できません。接続をやり直してください。"),
      { status: 400 },
    );
  if (req.query.error)
    throw Object.assign(
      new Error("Google認証が許可されませんでした。接続をやり直してください。"),
      { status: 400 },
    );
  await finishGoogleAuth(
    z.string().parse(req.query.code),
    z.string().parse(req.query.state),
  );
  res.setHeader(
    "Set-Cookie",
    "kaden_oauth=; HttpOnly; SameSite=Lax; Path=/api/google; Max-Age=0",
  );
  res.redirect("/?connected=google");
});
app.delete("/api/google/connect", (_, res) => {
  setSetting("googleTokens", null);
  res.json({ disconnected: true });
});
app.post("/api/skills", (req, res) => {
  const input = z
    .object({
      id: z.string().optional(),
      name: z.string().min(1).max(100),
      content: z.string().min(1).max(180000),
      enabled: z.boolean().default(true),
    })
    .parse(req.body);
  if (input.id) mustGet("skill", input.id);
  res.json(put("skill", { ...input, sha256: skillVersion(input.content) }));
});
app.delete("/api/skills/:id", (req, res) => {
  remove("skill", req.params.id);
  res.json({ deleted: true });
});
app.post("/api/workflows", (req, res) => {
  const input = z
    .object({
      name: z.string().min(1).max(100),
      instruction: z.string().min(1).max(30000),
    })
    .parse(req.body);
  res.json(put("workflow", input));
});
app.delete("/api/workflows/:id", (req, res) => {
  remove("workflow", req.params.id);
  res.json({ deleted: true });
});
app.post("/api/workflows/:id/run", async (req, res) => {
  const workflow = mustGet("workflow", req.params.id),
    { context } = z
      .object({ context: z.string().min(1).max(100000) })
      .parse(req.body);
  const output = await locked("workflow:" + workflow.id, () =>
    generate("custom", { context }, workflow.instruction),
  );
  res.json(
    put("run", {
      type: "workflow",
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: "success",
      instructionSnapshot: workflow.instruction,
      ...output,
    }),
  );
});
app.post("/api/minutes", async (req, res) => {
  const input = z
    .object({
      title: z.string().min(1).max(200),
      date: dateSchema,
      text: z.string().min(10).max(100000),
    })
    .parse(req.body);
  const { result, provenance } = await locked("minutes", () =>
    generate("minutes", input),
  );
  const badQuotes = result.tasks.some(
    (t) => !t.sourceQuote || !input.text.includes(t.sourceQuote),
  );
  if (badQuotes)
    throw Object.assign(
      new Error(
        "抽出タスクの原文根拠を確認できませんでした。未保存で停止しました。議事録の記述を確認して再実行してください。",
      ),
      { status: 502 },
    );
  let meeting;
  transaction(() => {
    meeting = put("meeting", {
      ...input,
      summary: result.summary,
      decisions: result.decisions,
      questions: result.questions,
      provenance,
    });
    result.tasks.forEach((task) =>
      put("task", { ...task, meetingId: meeting.id }),
    );
  });
  res.json(meeting);
});
app.post("/api/tasks", (req, res) =>
  res.json(put("task", taskSchema.parse(req.body))),
);
app.patch("/api/tasks/:id", (req, res) => {
  const old = mustGet("task", req.params.id);
  res.json(put("task", { ...old, ...patch(taskSchema, req.body) }));
});
app.delete("/api/tasks/:id", (req, res) => {
  remove("task", req.params.id);
  res.json({ deleted: true });
});
app.post("/api/tasks/:id/calendar", async (req, res) =>
  res.json(
    await locked("calendar:" + req.params.id, () =>
      syncTask(mustGet("task", req.params.id)),
    ),
  ),
);
app.post("/api/calendar/batch", async (req, res) => {
  const ids = z.array(z.string()).min(1).max(50).parse(req.body.ids),
    tasks = [...new Set(ids)].map((id) => mustGet("task", id));
  if (!googleStatus())
    throw Object.assign(
      new Error("Googleが未接続です。「連携・設定」から認証してください。"),
      { status: 409 },
    );
  if (tasks.some((t) => t.demo || !t.dueDate))
    throw Object.assign(
      new Error(
        "サンプルまたは期日未定のタスクが含まれています。登録前に確認してください。",
      ),
      { status: 422 },
    );
  const results = [];
  for (const task of tasks) {
    try {
      await locked("calendar:" + task.id, () =>
        syncTask(mustGet("task", task.id)),
      );
      results.push({ id: task.id, title: task.title, ok: true });
    } catch (e) {
      results.push({
        id: task.id,
        title: task.title,
        ok: false,
        error: e.message,
      });
    }
  }
  res.json({ results });
});
app.get("/api/tasks.ics", (req, res) => {
  const tasks = list("task").filter((t) => !t.demo);
  if (!tasks.some((t) => t.dueDate))
    return res
      .status(422)
      .json({ error: "期日が設定されたタスクがありません。" });
  res
    .set({
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kaden-actions.ics"',
    })
    .send(makeIcs(tasks));
});
app.post("/api/posts", (req, res) =>
  res.json(put("post", postSchema.parse(req.body))),
);
app.patch("/api/posts/:id", (req, res) =>
  res.json(
    put("post", {
      ...mustGet("post", req.params.id),
      ...patch(postSchema, req.body),
    }),
  ),
);
app.delete("/api/posts/:id", (req, res) => {
  remove("post", req.params.id);
  res.json({ deleted: true });
});
app.post("/api/observations", (req, res) => {
  const rows = z.array(observationSchema).min(1).max(1000).parse(req.body.rows),
    existing = list("observation");
  const keys = new Set(
    existing
      .filter((o) => !o.demo)
      .map((o) => `${o.accountType}:${o.platform}:${o.url}`),
  );
  let added = 0,
    skipped = 0;
  transaction(() => {
    for (const row of rows) {
      const key = `${row.accountType}:${row.platform}:${row.url}`;
      if (keys.has(key)) {
        skipped++;
        continue;
      }
      put("observation", row);
      keys.add(key);
      added++;
    }
  });
  res.json({ added, skipped });
});
app.delete("/api/observations/:id", (req, res) => {
  remove("observation", req.params.id);
  res.json({ deleted: true });
});
app.get("/api/observations.csv", (_, res) =>
  res
    .set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="social-posts.csv"',
    })
    .send(observationsCsv(list("observation"))),
);
app.get("/api/template.csv", (_, res) =>
  res
    .set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="import-template.csv"',
    })
    .send(
      "\uFEFFdate,platform,accountType,account,url,content,impressions,reach,engagements,likes,comments,saves,shares,views,followers\r\n",
    ),
);
app.post("/api/research", async (req, res) => {
  const range = rangeSchema.parse(req.body),
    cadence = z
      .enum(["daily", "weekly"])
      .default("weekly")
      .parse(req.body.cadence);
  res.json(await locked("research", () => research(range, cadence)));
});
app.post("/api/research/:id/sheet", async (req, res) =>
  res.json(
    await locked("sheet:" + req.params.id, () =>
      syncResearch(mustGet("research", req.params.id), list("observation")),
    ),
  ),
);
app.get("/api/research/:id/csv", (req, res) =>
  res
    .set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="weekly-ideas.csv"',
    })
    .send(researchCsv(mustGet("research", req.params.id), list("observation"))),
);
app.post("/api/research/:id/ideas/:index/post", (req, res) => {
  const r = mustGet("research", req.params.id),
    i = r.ideas[Number(req.params.index)];
  if (!i)
    throw Object.assign(new Error("企画が見つかりません。"), { status: 404 });
  const existing = list("post").find(
    (p) => p.researchId === r.id && p.ideaIndex === Number(req.params.index),
  );
  res.json(
    existing ||
      put("post", {
        title: i.title,
        platform: i.platform,
        product: i.product,
        caption: i.hook + "\n\n" + i.outline,
        note: i.caution,
        status: "idea",
        date: null,
        owner: "",
        url: "",
        researchId: r.id,
        ideaIndex: Number(req.params.index),
        demo: Boolean(r.demo),
      }),
  );
});
app.put("/api/report-references", (req, res) => {
  const ids = z.array(z.string()).max(5).parse(req.body.ids);
  ids.forEach((id) => mustGet("document", id));
  setSetting("reportReferences", ids);
  res.json({ saved: true });
});
app.post("/api/reports", async (req, res) => {
  const range = rangeSchema.parse(req.body),
    period = z.enum(["weekly", "monthly"]).parse(req.body.period),
    ids = z.array(z.string()).max(5).optional().parse(req.body.referenceIds);
  if (ids) ids.forEach((id) => mustGet("document", id));
  res.json(await locked("report", () => report(range, period, ids)));
});
app.get("/api/reports/:id/pptx", async (req, res) => {
  const r = mustGet("report", req.params.id);
  res
    .set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": 'attachment; filename="kaden-report.pptx"',
    })
    .send(await presentation(r));
});
app.post("/api/demo", (_, res) => {
  seedSample();
  res.json({ created: true });
});
app.delete("/api/demo", (_, res) => {
  clearSample();
  res.json({ deleted: true });
});
app.use("/api/documents", documentRoutes);
const dist = resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*path}", (req, res) => {
    if (req.path.startsWith("/api/"))
      return res.status(404).json({ error: "APIが見つかりません。" });
    res.sendFile(join(dist, "index.html"));
  });
}
app.use((error, req, res, next) => {
  if (error instanceof z.ZodError)
    return res
      .status(422)
      .json({
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("\n"),
      });
  if (error.type === "entity.too.large")
    return res.status(413).json({ error: "入力が大きすぎます（上限3MB）。" });
  if (error instanceof SyntaxError)
    return res.status(400).json({ error: "JSONの形式が不正です。" });
  res
    .status(error.status || 500)
    .json({
      error: error.status
        ? error.message
        : "処理に失敗しました。設定と入力内容を確認してください。",
    });
});
export function start() {
  const host = process.env.HOST || "127.0.0.1",
    port = Number(process.env.PORT || 3000);
  if (
    !["127.0.0.1", "localhost", "::1"].includes(host) &&
    !process.env.APP_PASSWORD
  )
    throw new Error(
      "外部公開にはAPP_PASSWORDを設定し、TLSプロキシ経由で利用してください。",
    );
  const server = app.listen(port, host, () =>
    console.log(`KADEN Concierge listening on ${host}:${port}`),
  );
  const timer = setInterval(
    () => schedulerTick().catch(() => console.error("Scheduler failed")),
    30000,
  );
  timer.unref();
  schedulerTick().catch(() => console.error("Scheduler failed"));
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  start();
