import { generate } from "./ai.js";
import { list, get, put, setting } from "./db.js";
import { metrics, inRange, dateRange, jstDate } from "./domain.js";
import { syncResearch } from "./google.js";

export async function research(range, cadence = "weekly") {
  const observations = list("observation").filter(
    (o) => !o.demo && o.accountType !== "own" && inRange(o.date, range),
  );
  if (!observations.length)
    throw Object.assign(
      new Error(
        "対象期間の競合データがありません。先に投稿データを登録してください。",
      ),
      { status: 422 },
    );
  const { result, provenance } = await generate(
    "research",
    {
      range,
      cadence,
      observations: observations.map((o) => ({ ...o, metrics: metrics(o) })),
    },
    cadence === "daily"
      ? "入力された日別データの好調投稿と表現傾向を整理する。"
      : "週次で競合の好調投稿・表現傾向を分析し、日立家電向け企画に落とし込む。",
  );
  const ids = new Set(observations.map((o) => o.id));
  const referenced = [
    ...result.highPerformers.map((p) => p.observationId),
    ...result.trends.flatMap((t) => t.evidenceIds),
    ...result.ideas.flatMap((i) => i.evidenceIds),
  ];
  if (referenced.some((id) => !ids.has(id)))
    throw Object.assign(
      new Error(
        "生成結果に入力にない出典IDが含まれています。未保存で停止しました。",
      ),
      { status: 502 },
    );
  return put("research", {
    ...result,
    ...range,
    cadence,
    observationIds: observations.map((o) => o.id),
    provenance,
  });
}
export async function report(
  range,
  period = "weekly",
  referenceIds = setting("reportReferences", []),
) {
  const referenceDocuments = referenceIds
    .map((id) => get("document", id))
    .filter(Boolean)
    .map((d) => ({
      id: d.id,
      name: d.name,
      sha256: d.sha256,
      content: d.extracted,
    }));
  if (Buffer.byteLength(JSON.stringify(referenceDocuments)) > 180000)
    throw Object.assign(
      new Error(
        "参考資料の合計テキストが180KBを超えています。参考資料を減らすか分割してください。",
      ),
      { status: 422 },
    );
  const input = {
    range,
    period,
    referenceDocuments,
    ownMetrics: list("observation")
      .filter(
        (o) => !o.demo && o.accountType === "own" && inRange(o.date, range),
      )
      .map((o) => ({ ...o, metrics: metrics(o) })),
    posts: list("post").filter(
      (p) => !p.demo && p.date && inRange(p.date, range),
    ),
    tasks: list("task").filter(
      (t) => !t.demo && t.dueDate && inRange(t.dueDate, range),
    ),
    research: list("research").filter(
      (r) =>
        !r.demo &&
        r.cadence === "weekly" &&
        r.from <= range.to &&
        r.to >= range.from,
    ),
  };
  if (
    !input.ownMetrics.length &&
    !input.posts.length &&
    !input.tasks.length &&
    !input.research.length
  )
    throw Object.assign(
      new Error(
        "対象期間に資料の元データがありません。投稿・実績・タスク・競合分析のいずれかを登録してください。",
      ),
      { status: 422 },
    );
  const { result, provenance } = await generate(
    "report",
    input,
    `${period === "monthly" ? "月次" : "週次"}定例資料を作成。概要、日立アカウント実績（未入力なら「実績未入力」）、投稿進捗、競合からの示唆、ネクストアクションを最低限含める。重点指標はImp、ENG、再生数。公式ENGが未入力なら観測反応数との違いを明記。競合数値を日立の実績として扱わない。数値には投稿URLまたは入力IDをnotesに記載。参考定例資料がある場合は、その章立て・集計観点・用語を踏襲。ただし参考資料の過去数値を今回の実績に転用しない。`,
  );
  return put("report", {
    ...result,
    ...range,
    period,
    referenceDocuments: referenceDocuments.map(({ content, ...meta }) => meta),
    provenance,
    sourceCounts: {
      ownMetrics: input.ownMetrics.length,
      posts: input.posts.length,
      tasks: input.tasks.length,
      research: input.research.length,
    },
  });
}
let busy = false;
export async function schedulerTick(now = new Date()) {
  if (busy) return;
  const config = setting("config", {});
  if (!config.scheduleEnabled) return;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tokyo",
      weekday: "short",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  if (Number(parts.hour) < (config.scheduleHour ?? 12)) return;
  const today = jstDate(now),
    weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      parts.weekday,
    );
  const jobs = [];
  if (config.dailyEnabled)
    jobs.push({ kind: "daily", range: dateRange(1, dateRange(2, today).from) });
  if (weekday === (config.weeklyDay ?? 4)) {
    jobs.push({
      kind: "weekly",
      range: dateRange(7, dateRange(2, today).from),
    });
    if (config.weeklyReportEnabled)
      jobs.push({
        kind: "weeklyReport",
        range: dateRange(7, dateRange(2, today).from),
      });
  }
  if (parts.day === "01" && config.monthlyReportEnabled) {
    const end = dateRange(2, today).from;
    jobs.push({
      kind: "monthlyReport",
      range: { from: end.slice(0, 7) + "-01", to: end },
    });
  }
  busy = true;
  try {
    for (const job of jobs) {
      const id = `job:${job.kind}:${today}`;
      if (get("run", id)) continue;
      put("run", { id, type: job.kind, status: "running", range: job.range });
      try {
        const result = job.kind.endsWith("Report")
          ? await report(
              job.range,
              job.kind === "monthlyReport" ? "monthly" : "weekly",
            )
          : await research(job.range, job.kind);
        if (job.kind === "weekly" && config.autoSyncSheets)
          await syncResearch(result, list("observation"));
        put("run", {
          id,
          status: "success",
          resultId: result.id,
          finishedAt: new Date().toISOString(),
        });
      } catch (e) {
        put("run", {
          id,
          status: "failed",
          error: e.message,
          finishedAt: new Date().toISOString(),
        });
      }
    }
  } finally {
    busy = false;
  }
}
