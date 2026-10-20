import { z } from "zod";

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "実在する日付を指定してください",
  );
export const platformSchema = z.enum(["Instagram", "X"]);
export const taskSchema = z.object({
  title: z.string().min(1).max(300),
  assignee: z.string().max(100).default(""),
  dueDate: dateSchema.nullable().default(null),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  sourceQuote: z.string().default(""),
  status: z.enum(["todo", "doing", "done"]).default("todo"),
});
export const postSchema = z.object({
  title: z.string().min(1).max(300),
  platform: platformSchema,
  product: z.string().max(100).default(""),
  date: dateSchema.nullable().default(null),
  status: z.enum(["idea", "draft", "review", "approved", "published"]),
  owner: z.string().max(100).default(""),
  caption: z.string().max(20000).default(""),
  url: z.union([z.string().url(), z.literal("")]).default(""),
  note: z.string().max(10000).default(""),
});
const metric = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.number().finite().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
);
export const observationSchema = z.object({
  date: dateSchema,
  platform: platformSchema,
  accountType: z.enum(["competitor", "own"]).default("competitor"),
  account: z.string().min(1).max(100),
  url: z
    .string()
    .url()
    .refine((s) => {
      try {
        return ["https:", "http:"].includes(new URL(s).protocol);
      } catch {
        return false;
      }
    }, "HTTP URLのみ使用できます"),
  content: z.string().max(10000),
  impressions: metric,
  reach: metric,
  engagements: metric,
  likes: metric,
  comments: metric,
  saves: metric,
  shares: metric,
  views: metric,
  followers: metric,
});
export function metrics(row) {
  const coverage = ["likes", "comments", "saves", "shares"].filter(
    (k) => row[k] !== null && row[k] !== undefined,
  );
  const reported = row.engagements !== null && row.engagements !== undefined;
  const engagement = reported
    ? row.engagements
    : coverage.reduce((n, k) => n + row[k], 0);
  const basis =
    row.reach > 0
      ? "reach"
      : row.impressions > 0
        ? "impressions"
        : row.followers > 0
          ? "followers"
          : null;
  return {
    engagement: reported || coverage.length ? engagement : null,
    rate:
      basis && (reported || coverage.length)
        ? (engagement / row[basis]) * 100
        : null,
    basis,
    coverage,
    engagementSource: reported ? "reported" : "observed",
    comparisonKey: [
      row.platform,
      basis,
      ...(reported ? ["officialENG"] : coverage),
    ].join(":"),
  };
}
export function jstDate(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(
    now,
  );
}
export function dateRange(days = 7, end = jstDate()) {
  const d = new Date(end + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days + 1);
  return { from: d.toISOString().slice(0, 10), to: end };
}
export function inRange(date, range) {
  return date >= range.from && date <= range.to;
}
export const rangeSchema = z
  .object({ from: dateSchema, to: dateSchema })
  .refine((r) => r.from <= r.to, "開始日と終了日を確認してください");
export function csvEscape(value) {
  const s = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function icsEscape(s) {
  return s
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r", "");
}
export function makeIcs(tasks) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KADEN Concierge//JP",
    "CALSCALE:GREGORIAN",
  ];
  for (const t of tasks.filter((t) => t.dueDate)) {
    const next = new Date(t.dueDate + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${t.id}@kaden-concierge`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "")}`,
      `DTSTART;VALUE=DATE:${t.dueDate.replaceAll("-", "")}`,
      `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replaceAll("-", "")}`,
      `SUMMARY:${icsEscape(t.title)}`,
      `DESCRIPTION:${icsEscape("担当: " + (t.assignee || "未定") + "\n" + (t.sourceQuote || ""))}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return (
    lines
      .map((line) => {
        let result = "",
          part = "";
        for (const char of line) {
          if (Buffer.byteLength(part + char) > 73) {
            result += part + "\r\n ";
            part = char;
          } else part += char;
        }
        return result + part;
      })
      .join("\r\n") + "\r\n"
  );
}
