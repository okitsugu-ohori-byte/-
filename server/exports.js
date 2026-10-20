import pptxgen from "pptxgenjs";
import { metrics, csvEscape } from "./domain.js";

export async function presentation(report) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "KADEN Concierge";
  pptx.subject = "SNS運用 定例レポート";
  pptx.title = report.title;
  pptx.company = "SNS運用ワークスペース";
  pptx.lang = "ja-JP";
  pptx.theme = {
    headFontFace: "Yu Gothic",
    bodyFontFace: "Yu Gothic",
    lang: "ja-JP",
  };
  const cover = pptx.addSlide();
  cover.background = { color: "F5F3EF" };
  cover.addText("KADEN / CONCIERGE", {
    x: 0.7,
    y: 0.6,
    w: 6,
    h: 0.3,
    fontSize: 13,
    color: "9B273B",
    bold: true,
    charSpacing: 3,
  });
  cover.addText(report.title, {
    x: 0.7,
    y: 2,
    w: 11.8,
    h: 1.5,
    fontSize: 32,
    bold: true,
    color: "222D35",
    breakLine: false,
    fit: "shrink",
  });
  cover.addText(
    `${report.from} — ${report.to}${report.demo ? "  • サンプル資料（架空データ）" : ""}`,
    { x: 0.75, y: 4.1, w: 11, h: 0.6, fontSize: 16, color: "63706D" },
  );
  cover.addText("AI生成ドラフト / 公開・提出前に内容と出典を確認", {
    x: 0.75,
    y: 6.6,
    w: 11,
    h: 0.3,
    fontSize: 10,
    color: "727B78",
  });
  for (const [i, content] of report.slides.entries()) {
    const s = pptx.addSlide();
    s.background = { color: "FAFAF8" };
    s.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.12,
      h: 7.5,
      fill: { color: "A62338" },
      line: { color: "A62338" },
    });
    s.addText(content.title, {
      x: 0.7,
      y: 0.6,
      w: 11.7,
      h: 0.85,
      fontSize: 26,
      bold: true,
      color: "222D35",
      fit: "shrink",
    });
    s.addText(
      content.bullets.map((text) => ({
        text,
        options: {
          bullet: { indent: 20 },
          breakLine: true,
          paraSpaceAfter: 18,
        },
      })),
      {
        x: 0.8,
        y: 1.8,
        w: 11.6,
        h: 4.7,
        fontSize: 18,
        color: "39443F",
        valign: "top",
        fit: "shrink",
      },
    );
    s.addText(
      `KADEN Concierge  |  ${report.from} — ${report.to}  |  ${i + 2}${report.demo ? "  サンプル" : ""}`,
      { x: 0.8, y: 6.9, w: 11, h: 0.25, fontSize: 9, color: "7F8884" },
    );
    s.addNotes(
      `${content.notes}\n${report.provenance ? JSON.stringify(report.provenance) : "サンプル生成・AI未使用"}`,
    );
  }
  return pptx.write({ outputType: "nodebuffer" });
}
export function observationsCsv(rows) {
  const keys = [
    "date",
    "platform",
    "accountType",
    "account",
    "url",
    "content",
    "impressions",
    "reach",
    "engagements",
    "likes",
    "comments",
    "saves",
    "shares",
    "views",
    "followers",
  ];
  return (
    "\uFEFF" +
    [
      keys.map(csvEscape).join(","),
      ...rows.map((r) => keys.map((k) => csvEscape(r[k])).join(",")),
    ].join("\r\n")
  );
}
export function researchCsv(row, observations) {
  const header = [
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
  const values = row.ideas.map((i) => [
    row.id,
    row.from,
    row.to,
    i.title,
    i.platform,
    i.product,
    i.hook,
    i.outline,
    i.evidenceIds
      .map((id) => observations.find((o) => o.id === id)?.url || "")
      .join("\n"),
    i.caution,
  ]);
  return (
    "\uFEFF" +
    [header, ...values].map((r) => r.map(csvEscape).join(",")).join("\r\n")
  );
}
