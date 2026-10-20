import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "kaden-test-"));
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
const { app } = await import("../server/index.js");
const { list, setting, secret, setSetting, put, get, db } = await import(
  "../server/db.js"
);
const { metrics, observationSchema, makeIcs } = await import(
  "../server/domain.js"
);
const { schedulerTick } = await import("../server/jobs.js");
const { skillVersion } = await import("../server/ai.js");
let server,
  base,
  aiResult,
  aiCalls = [];
const nativeFetch = global.fetch;
global.fetch = async (url, options) => {
  if (String(url).startsWith("https://api.anthropic.com/")) {
    aiCalls.push(JSON.parse(options.body));
    return new Response(
      JSON.stringify({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              typeof aiResult === "function"
                ? aiResult(JSON.parse(options.body))
                : aiResult,
            ),
          },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 100 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  return nativeFetch(url, options);
};
async function api(path, body, method) {
  const r = await nativeFetch(base + "/api" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
}
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  global.fetch = nativeFetch;
  await new Promise((r) => server.close(r));
  db.close();
});

test("health, required schedule defaults and user-provided skill texts", async () => {
  assert.equal((await api("/health")).body.ok, true);
  const { body } = await api("/state");
  assert.equal(body.config.weeklyDay, 4);
  assert.equal(body.config.scheduleHour, 12);
  assert.equal(body.config.scheduleEnabled, false);
  assert.equal(body.config.driveFolderId, "");
  assert.equal(body.config.claudeProjectUrl, "");
  assert.equal(body.skills.length, 2);
  assert.ok(body.skills.every((s) => s.sha256 === skillVersion(s.content)));
  assert.equal(body.connections.claude, false);
});
test("actual calendar dates and nonnegative metrics are validated", () => {
  const row = {
    date: "2026-02-30",
    platform: "X",
    account: "@x",
    url: "https://x.com/test/status/1",
    content: "test",
  };
  assert.equal(observationSchema.safeParse(row).success, false);
  assert.equal(
    observationSchema.safeParse({ ...row, date: "2026-10-20", likes: -1 })
      .success,
    false,
  );
  const parsed = observationSchema.parse({
    ...row,
    date: "2026-10-20",
    likes: 0,
  });
  assert.equal(parsed.likes, 0);
  assert.equal(parsed.impressions, null);
});
test("reported ENG and partial observed reactions have distinct comparison keys", () => {
  const a = metrics({
    platform: "X",
    impressions: 1000,
    likes: 10,
    comments: 2,
    saves: null,
    shares: null,
    engagements: null,
  });
  assert.equal(a.engagement, 12);
  assert.equal(a.rate, 1.2);
  assert.deepEqual(a.coverage, ["likes", "comments"]);
  const b = metrics({ platform: "X", impressions: 1000, engagements: 80 });
  assert.equal(b.engagement, 80);
  assert.equal(b.engagementSource, "reported");
  assert.notEqual(a.comparisonKey, b.comparisonKey);
  assert.equal(metrics({ platform: "X", likes: null }).rate, null);
});
test("tasks support CRUD and calendar connection requirements", async () => {
  let r = await api("/tasks", {
    title: "確認用タスク",
    assignee: "田中",
    dueDate: "2026-10-23",
  });
  assert.equal(r.status, 200);
  const id = r.body.id;
  r = await api("/tasks/" + id, { status: "done" }, "PATCH");
  assert.equal(r.body.status, "done");
  assert.equal((await api("/tasks/" + id + "/calendar", {})).status, 409);
  const exported = await nativeFetch(base + "/api/tasks.ics");
  assert.equal(exported.status, 200);
  const ics = await exported.text();
  assert.match(ics, /20261023/);
  assert.match(ics, /DTEND;VALUE=DATE:20261024/);
  assert.ok(ics.split("\r\n").every((line) => Buffer.byteLength(line) <= 75));
  assert.equal((await api("/tasks/" + id, null, "DELETE")).status, 200);
});
test("ICS escapes user text and folds Japanese lines", () => {
  const ics = makeIcs([
    {
      id: "one",
      title: "テスト,;\n" + "長い議事録".repeat(40),
      assignee: "佐藤",
      dueDate: "2026-10-31",
    },
  ]);
  assert.match(ics, /\\,/);
  assert.match(ics, /DTEND;VALUE=DATE:20261101/);
  assert.ok(ics.split("\r\n").every((line) => Buffer.byteLength(line) <= 75));
});
test("post status updates persist in SQLite", async () => {
  let r = await api("/posts", {
    title: "投稿テスト",
    platform: "Instagram",
    status: "idea",
  });
  const id = r.body.id;
  assert.equal(
    (await api("/posts/" + id, { status: "review" }, "PATCH")).body.status,
    "review",
  );
  assert.match(
    db.prepare("SELECT json FROM entities WHERE id=?").get(id).json,
    /review/,
  );
  assert.equal(
    (await api("/posts/" + id, { status: "invented" }, "PATCH")).status,
    422,
  );
});
test("CSV import is transactional, keeps unknowns, deduplicates URL", async () => {
  const row = {
    date: "2026-10-20",
    platform: "X",
    accountType: "competitor",
    account: "@example",
    url: "https://x.com/example/status/123",
    content: "観測した本文",
    impressions: 1000,
    engagements: 70,
    likes: 10,
  };
  assert.equal(
    (await api("/observations", { rows: [row, { ...row, url: "invalid" }] }))
      .status,
    422,
  );
  assert.equal(list("observation").length, 0);
  const a = await api("/observations", { rows: [row] });
  assert.equal(a.body.added, 1);
  assert.equal(list("observation")[0].views, null);
  const b = await api("/observations", { rows: [row] });
  assert.equal(b.body.skipped, 1);
});
test("CSV export prevents formula injection and includes Imp/ENG/views", async () => {
  await api("/observations", {
    rows: [
      {
        date: "2026-10-20",
        platform: "X",
        account: "@sample",
        url: "https://example.com/2",
        content: '=HYPERLINK("danger")',
      },
    ],
  });
  const r = await nativeFetch(base + "/api/observations.csv");
  const text = await r.text();
  assert.match(text, /engagements/);
  assert.match(text, /views/);
  assert.match(text, /'=HYPERLINK/);
});
test("AI fails clearly without a key; sample data cannot be synced", async () => {
  const r = await api("/minutes", {
    title: "会議",
    date: "2026-10-20",
    text: "田中さんが確認用の投稿案を作成する。",
  });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /APIキー/);
  await api("/demo", {});
  const sample = list("task").find((t) => t.demo);
  assert.equal(
    (await api("/tasks/" + sample.id + "/calendar", {})).status,
    422,
  );
  const sampleResearch = list("research").find((r) => r.demo);
  assert.equal(
    (await api("/research/" + sampleResearch.id + "/sheet", {})).status,
    422,
  );
});
test("settings store credentials encrypted and never return secret values", async () => {
  const { body: state } = await api("/state");
  const apiKey = "test-key-never-use-in-production";
  const r = await api(
    "/settings",
    { config: state.config, credentials: { ANTHROPIC_API_KEY: apiKey } },
    "PUT",
  );
  assert.equal(r.status, 200);
  assert.equal(secret("ANTHROPIC_API_KEY"), apiKey);
  assert.ok(
    !JSON.stringify(setting("secret:ANTHROPIC_API_KEY")).includes(apiKey),
  );
  const newState = await api("/state");
  assert.ok(!JSON.stringify(newState.body).includes(apiKey));
  assert.equal(newState.body.connections.claude, true);
});
test("reference locations are explicit local settings and reject unsafe URLs", async () => {
  const { body: state } = await api("/state");
  const config = { ...state.config, driveFolderId: "test-folder-12345", claudeProjectUrl: "https://claude.ai/project/example-project" };
  assert.equal((await api("/settings", { config }, "PUT")).status, 200);
  assert.equal((await api("/state")).body.config.driveFolderId, config.driveFolderId);
  assert.equal((await api("/state")).body.config.claudeProjectUrl, config.claudeProjectUrl);
  assert.equal((await api("/settings", { config: { ...config, claudeProjectUrl: "javascript:alert(1)" } }, "PUT")).status, 422);
  assert.equal((await api("/documents/drive")).status, 409);
});
test("minutes extraction checks original quotes and records exact skills used (mocked Claude)", async () => {
  const text = "田中さんが10月23日までに投稿案を作成する。";
  aiResult = {
    summary: "投稿案を準備",
    decisions: ["投稿案を作成"],
    tasks: [
      {
        title: "投稿案の作成",
        assignee: "田中",
        dueDate: "2026-10-23",
        priority: "high",
        sourceQuote: text,
        status: "todo",
      },
    ],
    questions: [],
  };
  const r = await api("/minutes", {
    title: "週次定例",
    date: "2026-10-20",
    text,
  });
  assert.equal(r.status, 200);
  const task = list("task").find((t) => t.meetingId === r.body.id);
  assert.equal(task.assignee, "田中");
  assert.equal(task.dueDate, "2026-10-23");
  assert.equal(r.body.provenance.skills.length, 2);
  for (const s of list("skill"))
    assert.ok(aiCalls.at(-1).system.includes(s.content));
  aiResult = {
    ...aiResult,
    tasks: [{ ...aiResult.tasks[0], sourceQuote: "存在しない引用" }],
  };
  assert.equal(
    (
      await api("/minutes", {
        title: "不正引用テスト",
        date: "2026-10-20",
        text,
      })
    ).status,
    502,
  );
});
test("research excludes own/demo data and rejects fabricated sources (mocked Claude)", async () => {
  await api("/observations", {
    rows: [
      {
        date: "2026-10-20",
        platform: "X",
        accountType: "own",
        account: "@hitachi_kaden",
        url: "https://x.com/hitachi_kaden/status/123",
        content: "自社実績",
        impressions: 2000,
        engagements: 100,
        views: 500,
      },
    ],
  });
  const competitor = list("observation").find(
    (o) => !o.demo && o.accountType === "competitor",
  );
  aiResult = {
    summary: "観測範囲の分析",
    highPerformers: [{ observationId: competitor.id, reason: "入力値の比較" }],
    trends: [],
    ideas: [
      {
        title: "暮らしのヒント",
        platform: "X",
        product: "洗濯機",
        hook: "家事の工夫",
        outline: "共感から提案",
        evidenceIds: [competitor.id],
        caution: "承認資料を確認",
      },
    ],
  };
  const r = await api("/research", {
    from: "2026-10-20",
    to: "2026-10-20",
    cadence: "weekly",
  });
  assert.equal(r.status, 200);
  const input = JSON.parse(aiCalls.at(-1).messages[0].content.at(-1).text);
  assert.ok(
    input.observations.every((o) => o.accountType === "competitor" && !o.demo),
  );
  aiResult.ideas[0].evidenceIds = ["nonexistent"];
  assert.equal(
    (await api("/research", { from: "2026-10-20", to: "2026-10-20" })).status,
    502,
  );
  const copy = await api(`/research/${r.body.id}/ideas/0/post`, {});
  assert.equal(copy.status, 200);
  assert.equal(
    (await api(`/research/${r.body.id}/ideas/0/post`, {})).body.id,
    copy.body.id,
  );
});
test("reports produce a readable multi-slide PPTX (mocked Claude)", async () => {
  aiResult = {
    title: "週次レポート",
    summary: "入力実績",
    slides: [
      {
        title: "実績",
        bullets: ["IMP 2,000 / ENG 100 / 再生数 500"],
        notes: "自社入力値",
      },
      { title: "投稿進捗", bullets: ["レビューを実施"], notes: "投稿管理" },
      { title: "次のアクション", bullets: ["投稿案を作成"], notes: "議事録" },
    ],
    nextActions: ["投稿案の確認"],
  };
  const r = await api("/reports", {
    from: "2026-10-20",
    to: "2026-10-20",
    period: "weekly",
  });
  assert.equal(r.status, 200);
  const input = JSON.parse(aiCalls.at(-1).messages[0].content.at(-1).text);
  assert.equal(input.ownMetrics.length, 1);
  assert.equal(input.ownMetrics[0].engagements, 100);
  const file = await nativeFetch(base + `/api/reports/${r.body.id}/pptx`);
  assert.equal(file.status, 200);
  const path = join(process.env.DATA_DIR, "report.pptx");
  writeFileSync(path, Buffer.from(await file.arrayBuffer()));
  const result = execFileSync(
    "python3",
    [
      "-c",
      "from pptx import Presentation;import sys;p=Presentation(sys.argv[1]);print(len(p.slides));print(p.slides[1].shapes[1].text)",
      path,
    ],
    { encoding: "utf8" },
  );
  assert.match(result, /4\n/);
  assert.match(result, /実績/);
});
let pptDoc, bookDoc;
test("Office upload extracts all shapes, sheets, notes and validates ZIP files", async () => {
  const fixtures = join(process.env.DATA_DIR, "fixtures");
  execFileSync("python3", ["test/fixtures.py", fixtures]);
  for (const name of ["review.pptx", "SNS企画案_10月.xlsx"]) {
    const form = new FormData();
    form.append("file", new Blob([readFileSync(join(fixtures, name))]), name);
    const response = await nativeFetch(base + "/api/documents/upload", {
      method: "POST",
      body: form,
    });
    assert.equal(response.status, 200);
    const doc = await response.json();
    assert.equal(doc.name, name);
    if (name.endsWith("pptx")) pptDoc = doc;
    else bookDoc = doc;
    assert.ok(!("path" in doc));
  }
  assert.equal(pptDoc.extracted.slides.length, 1);
  assert.equal(pptDoc.extracted.slides[0].shapes.length, 6);
  assert.match(pptDoc.extracted.slides[0].notes, /審査用/);
  assert.equal(bookDoc.extracted.sheets[0].rows.length, 2);
  const bad = new FormData();
  bad.append("file", new Blob(["invalid zip"]), "bad.pptx");
  assert.equal(
    (
      await nativeFetch(base + "/api/documents/upload", {
        method: "POST",
        body: bad,
      })
    ).status,
    422,
  );
});
test("redline inventory uses slide images; approved revision preserves runs and deletes only annotation (mocked Claude)", async () => {
  const slide = pptDoc.extracted.slides[0],
    body = slide.shapes.find((s) => s.name === "body"),
    note = slide.shapes.find((s) => s.name === "review-note");
  aiResult = {
    summary: "赤字修正",
    annotations: [
      {
        slide: 1,
        instruction: "本日は→今日は",
        annotationShapeIds: [note.id],
        replacements: [
          {
            shapeId: body.id,
            oldText: "本日は",
            newText: "今日は",
            field: "body",
          },
        ],
        status: "applicable",
        note: "赤字の指摘",
      },
    ],
    unresolved: [],
  };
  const r = await api(`/documents/${pptDoc.id}/revisions`, {});
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(aiCalls.at(-1).messages[0].content[0].type, "image");
  const annotations = r.body.annotations.map((a) => ({ ...a, approved: true }));
  const applied = await api(`/documents/revisions/${r.body.id}/apply`, {
    annotations,
    removeOfficeComments: true,
    allowPartial: false,
  });
  assert.equal(applied.status, 200, JSON.stringify(applied.body));
  assert.equal(applied.body.verification.applied, 1);
  assert.equal(applied.body.verification.deletedShapes, 1);
  assert.ok(!("outputPath" in applied.body));
  const file = await nativeFetch(
    base + `/api/documents/revisions/${r.body.id}/download`,
  );
  const path = join(process.env.DATA_DIR, "revised.pptx");
  writeFileSync(path, Buffer.from(await file.arrayBuffer()));
  const result = execFileSync(
    "python3",
    [
      "-c",
      "from pptx import Presentation;import sys;p=Presentation(sys.argv[1]);print(p.slides[0].shapes[1].text);print(len(p.slides[0].shapes));print(p.slides[0].notes_slide.notes_text_frame.text)",
      path,
    ],
    { encoding: "utf8" },
  );
  assert.match(result, /今日は洗濯/);
  assert.match(result, /\n5\n/);
  assert.match(result, /審査用の元ノート/);
});
test("X planning validates counts, references, quiz separation and clones editable template (mocked Claude)", async () => {
  aiResult = {
    ideas: [
      {
        title: "季節の家事",
        body: "秋の家事をちょっと快適に。",
        reply: "暮らしの工夫を教えてください。",
        claim: "承認済み情報を確認",
        visual: "洗濯物を右側、見出しを左側に配置",
        isQuiz: false,
        answer: "",
        sourceUrls: ["https://x.com/example/status/123"],
        caution: "商品情報の確認",
      },
    ],
  };
  const r = await api("/documents/xideas", {
    workbookId: bookDoc.id,
    sheetName: bookDoc.extracted.sheets[0].name,
    month: "2026-10",
    count: 1,
    references: [
      { url: "https://x.com/example/status/123", text: "実際の参考投稿の本文" },
    ],
    brief: "",
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ideas.length, 1);
  const shapes = pptDoc.extracted.slides[0].shapes,
    mapping = Object.fromEntries(
      ["title", "body", "reply", "claim", "visual"].map((k) => [
        k,
        shapes.find((s) => s.name === k).id,
      ]),
    );
  const exported = await api(`/documents/xideas/${r.body.id}/pptx`, {
    templateId: pptDoc.id,
    templateSlide: 1,
    mapping,
  });
  assert.equal(exported.status, 200, JSON.stringify(exported.body));
  assert.equal(exported.body.verification.appendedSlides, 1);
  const file = await nativeFetch(
    base + `/api/documents/xideas/${r.body.id}/download`,
  );
  const path = join(process.env.DATA_DIR, "x-plan.pptx");
  writeFileSync(path, Buffer.from(await file.arrayBuffer()));
  const result = execFileSync(
    "python3",
    [
      "-c",
      "from pptx import Presentation;import sys;p=Presentation(sys.argv[1]);print(len(p.slides));print(p.slides[1].shapes[1].text);print(p.slides[1].notes_slide.notes_text_frame.text)",
      path,
    ],
    { encoding: "utf8" },
  );
  assert.match(result, /2\n/);
  assert.match(result, /秋の家事/);
  assert.match(result, /参考|出典/);
});
test("past meeting materials are persisted and supplied as references without replacing current metrics", async () => {
  assert.equal((await api('/report-references',{ids:[pptDoc.id]},'PUT')).status,200);
  assert.deepEqual((await api('/state')).body.reportReferenceIds,[pptDoc.id]);
  aiResult={title:'参考資料付き週次',summary:'実績を整理',slides:[{title:'概要',bullets:['今回の実績を使用'],notes:'出典'},{title:'進捗',bullets:['確認待ち'],notes:'投稿管理'},{title:'次週',bullets:['要確認事項の解消'],notes:'タスク'}],nextActions:[]};
  const r=await api('/reports',{from:'2026-10-20',to:'2026-10-20',period:'weekly'});
  assert.equal(r.status,200);
  const input=JSON.parse(aiCalls.at(-1).messages[0].content.at(-1).text);
  assert.equal(input.referenceDocuments[0].sha256,pptDoc.sha256);
  assert.equal(input.ownMetrics[0].impressions,2000);
  assert.equal(r.body.referenceDocuments[0].id,pptDoc.id);
});

test("unresolved instructions cannot be silently marked fully applied or comments erased", async () => {
  const body=pptDoc.extracted.slides[0].shapes.find(s=>s.name==='body');
  aiResult={summary:'要確認を含む',annotations:[{slide:1,instruction:'本文の修正',annotationShapeIds:[],replacements:[{shapeId:body.id,oldText:'本日は',newText:'今日は',field:'body'}],status:'applicable',note:'確認済み'},{slide:1,instruction:'不鮮明な付箋',annotationShapeIds:[],replacements:[],status:'needs_input',note:'読解不可'}],unresolved:['付箋の原文が不明']};
  const r=await api(`/documents/${pptDoc.id}/revisions`,{});
  assert.equal(r.status,200);
  const annotations=r.body.annotations.map((a,i)=>({...a,approved:i===0}));
  assert.equal((await api(`/documents/revisions/${r.body.id}/apply`,{annotations,removeOfficeComments:false,allowPartial:false})).status,422);
  assert.equal((await api(`/documents/revisions/${r.body.id}/apply`,{annotations:annotations.slice(0,1),removeOfficeComments:false,allowPartial:true})).status,422);
  assert.equal((await api(`/documents/revisions/${r.body.id}/apply`,{annotations,removeOfficeComments:true,allowPartial:true})).status,422);
  const partial=await api(`/documents/revisions/${r.body.id}/apply`,{annotations,removeOfficeComments:false,allowPartial:true});
  assert.equal(partial.status,200);assert.equal(partial.body.status,'partial');assert.match(partial.body.outputName,/部分反映ドラフト/);
});

test("batch calendar checks missing authentication before any external write", async()=>{
  const t=await api('/tasks',{title:'一括確認',dueDate:'2026-10-24'});
  assert.equal((await api('/calendar/batch',{ids:[t.body.id]})).status,409);
  assert.equal(get('task',t.body.id).calendarEventId,undefined);
});

test("scheduler uses Thursday noon JST and records failures without duplicate runs", async () => {
  const config = (await api("/state")).body.config;
  setSetting("config", {
    ...config,
    scheduleEnabled: true,
    dailyEnabled: false,
    weeklyReportEnabled: false,
    monthlyReportEnabled: false,
  });
  const before = list("run").length;
  await schedulerTick(new Date("2026-10-22T02:59:00Z"));
  assert.equal(list("run").length, before);
  aiResult = { summary: "分析", highPerformers: [], trends: [], ideas: [] };
  await schedulerTick(new Date("2026-10-22T03:00:00Z"));
  const runs = list("run");
  assert.equal(runs.length, before + 1);
  assert.equal(runs[0].type, "weekly");
  assert.equal(runs[0].status, "success");
  await schedulerTick(new Date("2026-10-22T03:05:00Z"));
  assert.equal(list("run").length, runs.length);
  setSetting("config", { ...config, scheduleEnabled: false });
});
test("cross-origin mutations are rejected and missing Google auth is actionable", async () => {
  const r = await nativeFetch(base + "/api/posts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
    },
    body: JSON.stringify({ title: "x", platform: "X", status: "idea" }),
  });
  assert.equal(r.status, 403);
  assert.equal((await api("/documents/drive")).status, 409);
});
test("removing sample data preserves real records and imported skills", async () => {
  const realPosts = list("post").filter((p) => !p.demo).length;
  await api("/demo", null, "DELETE");
  assert.equal(list("post").length, realPosts);
  assert.ok(list("post").every((p) => !p.demo));
  assert.equal(list("skill").length, 2);
});
