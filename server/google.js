import { google } from "googleapis";
import { createHash, randomBytes } from "node:crypto";
import { secret, setting, setSetting, encrypt, decrypt, put } from "./db.js";
import { metrics } from "./domain.js";

// Avoid implicit retries of append requests after ambiguous network failures.
google.options({ timeout: 30000, retry: false });

function client() {
  const id = secret("GOOGLE_CLIENT_ID"),
    key = secret("GOOGLE_CLIENT_SECRET");
  if (!id || !key)
    throw Object.assign(
      new Error(
        "Google OAuthのクライアントIDとシークレットを設定してください。",
      ),
      { status: 409 },
    );
  return new google.auth.OAuth2(
    id,
    key,
    setting("config", {}).redirectUri ||
      process.env.GOOGLE_REDIRECT_URI ||
      "http://127.0.0.1:3000/api/google/callback",
  );
}
export function googleAuthUrl() {
  const c = client(),
    state = randomBytes(32).toString("hex");
  setSetting("oauthState", {
    hash: createHash("sha256").update(state).digest("hex"),
    expires: Date.now() + 600000,
  });
  return {
    url: c.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
      state,
    }),
    state,
  };
}
export async function finishGoogleAuth(code, state) {
  const saved = setting("oauthState");
  if (
    !saved ||
    saved.expires < Date.now() ||
    createHash("sha256")
      .update(state || "")
      .digest("hex") !== saved.hash
  )
    throw Object.assign(
      new Error(
        "認証セッションが無効か期限切れです。接続をやり直してください。",
      ),
      { status: 400 },
    );
  setSetting("oauthState", null);
  const c = client(),
    { tokens } = await c.getToken(code);
  setSetting("googleTokens", encrypt(tokens));
}
export function googleStatus() {
  const t = setting("googleTokens");
  return Boolean(t);
}
export async function googleClient() {
  const tokens = setting("googleTokens");
  if (!tokens)
    throw Object.assign(
      new Error("Googleが未接続です。「連携・設定」から認証してください。"),
      { status: 409 },
    );
  const c = client();
  c.setCredentials(decrypt(tokens));
  c.on("tokens", (tokens) => {
    setSetting(
      "googleTokens",
      encrypt({ ...decrypt(setting("googleTokens")), ...tokens }),
    );
  });
  return c;
}
export async function syncTask(task) {
  if (task.demo)
    throw Object.assign(
      new Error("サンプルデータは外部サービスに登録できません。"),
      { status: 422 },
    );
  if (!task.dueDate)
    throw Object.assign(
      new Error("カレンダー登録前に期日を設定してください。"),
      { status: 422 },
    );
  const config = setting("config", {}),
    calendarId = config.calendarId || "primary";
  if (task.calendarEventId && task.calendarId !== calendarId)
    throw Object.assign(
      new Error(
        "このタスクは別のカレンダーに登録済みです。元のカレンダーを選択して更新してください。",
      ),
      { status: 409 },
    );
  const auth = await googleClient(),
    api = google.calendar({ version: "v3", auth });
  const next = new Date(task.dueDate + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  const eventId =
    task.calendarEventId || createHash("sha256").update(task.id).digest("hex");
  const resource = {
    summary: task.title,
    description: `KADEN Concierge\n担当: ${task.assignee || "未定"}\n${task.sourceQuote || ""}`,
    start: { date: task.dueDate },
    end: { date: next.toISOString().slice(0, 10) },
    extendedProperties: { private: { conciergeTaskId: task.id } },
  };
  try {
    if (task.calendarEventId)
      await api.events.update({ calendarId, eventId, requestBody: resource });
    else {
      try {
        await api.events.insert({
          calendarId,
          requestBody: { id: eventId, ...resource },
        });
      } catch (e) {
        if (e.code !== 409) throw e;
        await api.events.update({ calendarId, eventId, requestBody: resource });
      }
    }
  } catch (e) {
    throw Object.assign(
      new Error(
        `Googleカレンダー登録に失敗しました（${e.code || "通信エラー"}）。APIの有効化、共有権限、接続状態を確認してください。`,
      ),
      { status: 502 },
    );
  }
  return put("task", {
    ...task,
    calendarEventId: eventId,
    calendarId,
    calendarSyncedAt: new Date().toISOString(),
  });
}
export async function syncResearch(research, observations) {
  if (research.demo)
    throw Object.assign(
      new Error("サンプル分析は外部サービスに追記できません。"),
      { status: 422 },
    );
  const config = setting("config", {}),
    spreadsheetId = config.spreadsheetId;
  if (!spreadsheetId)
    throw Object.assign(
      new Error("指定スプレッドシートのID・タブ名を設定してください。"),
      { status: 409 },
    );
  const sheet = config.sheetName || "競合分析",
    escaped = "'" + sheet.replaceAll("'", "''") + "'";
  const auth = await googleClient(),
    api = google.sheets({ version: "v4", auth });
  const headers = [
    "実行ID",
    "期間開始",
    "期間終了",
    "企画タイトル",
    "SNS",
    "商品カテゴリ",
    "導入表現",
    "企画構成",
    "根拠URL",
    "表現上の確認事項",
  ];
  try {
    const existing = await api.spreadsheets.values.get({
      spreadsheetId,
      range: `${escaped}!A1:J`,
    });
    const rows = existing.data.values || [];
    if (rows.length && headers.some((h, i) => rows[0][i] !== h))
      throw Object.assign(
        new Error(
          "指定タブの列形式が一致しません。既存データを守るため停止しました。空の専用タブを作成するか、テンプレートと同じ列名を使用してください。",
        ),
        { safe: true, status: 422 },
      );
    if (rows.some((r) => r[0] === research.id))
      return put("research", {
        ...research,
        sheetSyncedAt: new Date().toISOString(),
        sheetId: spreadsheetId,
      });
    const values = research.ideas.map((idea) => [
      research.id,
      research.from,
      research.to,
      idea.title,
      idea.platform,
      idea.product,
      idea.hook,
      idea.outline,
      idea.evidenceIds
        .map((id) => observations.find((o) => o.id === id)?.url || "")
        .join("\n"),
      idea.caution,
    ]);
    if (!values.length)
      throw Object.assign(new Error("企画案がないため追記しませんでした。"), {
        safe: true,
        status: 422,
      });
    await api.spreadsheets.values.append({
      spreadsheetId,
      range: `${escaped}!A:J`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows.length ? values : [headers, ...values] },
    });
    return put("research", {
      ...research,
      sheetSyncedAt: new Date().toISOString(),
      sheetId: spreadsheetId,
    });
  } catch (e) {
    if (e.safe) throw e;
    throw Object.assign(
      new Error(
        `スプレッドシート追記に失敗しました（${e.code || "通信エラー"}）。タブ名、Sheets API、編集権限を確認してください。`,
      ),
      { status: 502 },
    );
  }
}
