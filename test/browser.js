import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dataDir = mkdtempSync(join(tmpdir(), "kaden-browser-"));
const port = 3021,
  base = `http://127.0.0.1:${port}`;
const child = spawn("node", ["server/index.js"], {
  env: {
    ...process.env,
    DATA_DIR: dataDir,
    PORT: String(port),
    HOST: "127.0.0.1",
  },
  stdio: "pipe",
});
const errors = [];
child.stderr.on("data", (data) => {
  if (!String(data).includes("ExperimentalWarning")) process.stderr.write(data);
});
for (let n = 0; n < 100; n++) {
  try {
    if ((await fetch(base + "/api/health")).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 150));
}
mkdirSync("test-results", { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page
    .getByRole("heading", { name: "今日も、暮らしに寄りそう発信を。" })
    .waitFor();
  await page.getByRole("button", { name: "まずはサンプルで試す" }).click();
  await page.getByText("サンプル表示中", { exact: false }).waitFor();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  const nav = page.locator(".sidebar nav");
  await nav.getByRole("button", { name: "投稿管理" }).click();
  await page
    .getByRole("button", { name: "投稿を追加", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("企画・投稿タイトル").fill("ブラウザ検証用の企画");
  await dialog.getByLabel("担当者").fill("運用チーム");
  await dialog.getByLabel("公開予定日").fill("2026-10-23");
  await dialog.getByRole("button", { name: "保存する" }).click();
  await page.getByRole("button", { name: /ブラウザ検証用の企画/ }).waitFor();
  await page.reload();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "投稿管理" })
    .click();
  await page.getByRole("button", { name: /ブラウザ検証用の企画/ }).waitFor();
  await page
    .getByRole("button", { name: /ブラウザ検証用の企画/ })
    .dragTo(page.locator(".column-review"));
  await page
    .locator(".column-review")
    .getByRole("button", { name: /ブラウザ検証用の企画/ })
    .waitFor();
  await page.screenshot({ path: "test-results/posts.png", fullPage: true });
  await nav.getByRole("button", { name: "議事録・アクション" }).click();
  await page.getByRole("button", { name: "アクションを追加" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("アクション", { exact: true })
    .fill("ブラウザ確認用タスク");
  await page.getByRole("dialog").getByLabel("担当者").fill("佐藤");
  await page.getByRole("dialog").getByLabel("期日").fill("2026-10-24");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存する" })
    .click();
  await page
    .getByRole("button", { name: "ブラウザ確認用タスク", exact: true })
    .waitFor();
  await page
    .getByRole("row")
    .filter({ hasText: "ブラウザ確認用タスク" })
    .getByRole("combobox")
    .selectOption("doing");
  await nav.getByRole("button", { name: "競合・トレンド分析" }).click();
  await page.getByRole("button", { name: /投稿データ \d/ }).click();
  const csv =
    "date,platform,accountType,account,url,content,impressions,engagements,views\n2026-10-20,X,own,@hitachi_kaden,https://x.com/hitachi_kaden/status/111,入力本文,15000,600,3200";
  await page
    .locator('input[type=file][accept=".csv"]')
    .setInputFiles({
      name: "data.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await page.getByRole("cell", { name: "@hitachi_kaden" }).waitFor();
  await page.getByRole("button", { name: "投稿データを追加" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("アカウント", { exact: true })
    .fill("@competitor");
  await page
    .getByRole("dialog")
    .getByLabel("投稿URL")
    .fill("https://example.com/new-post");
  await page
    .getByRole("dialog")
    .getByLabel("投稿本文・表現のメモ")
    .fill("困りごとから始まる投稿");
  await page.getByRole("dialog").getByLabel("表示回数").fill("12000");
  await page.getByRole("dialog").getByLabel("ENG（公式集計値）").fill("420");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "登録する" })
    .click();
  await page.getByRole("cell", { name: "@competitor" }).waitFor();
  await nav.getByRole("button", { name: "Skills・指示の管理" }).click();
  await page.getByRole("button", { name: "指示を登録" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Skills名")
    .fill("ブラウザ検証用ルール");
  await page
    .getByRole("dialog")
    .getByLabel("指示の全文")
    .fill("商品性能を入力情報以上に断言しないこと。");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "全文を保存する" })
    .click();
  await page.getByRole("heading", { name: "ブラウザ検証用ルール" }).waitFor();
  await nav.getByRole("button", { name: "AIワークフロー" }).click();
  await page.getByRole("button", { name: "指示をボタンにする" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("ボタンの名前")
    .fill("投稿テーマを考える");
  await page
    .getByRole("dialog")
    .getByLabel("実行する指示の全文")
    .fill("入力の条件に合う投稿テーマを3つ提案してください。");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ボタンを作成" })
    .click();
  await page.getByRole("heading", { name: "投稿テーマを考える" }).waitFor();
  await nav.getByRole("button", { name: "Drive・資料ワークフロー" }).click();
  await page.getByRole("button", { name: "Driveから選ぶ" }).click();
  await page.getByRole("dialog").getByLabel("DriveフォルダIDまたはURL").fill("https://drive.google.com/drive/folders/test-folder-12345");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "一覧を取得" })
    .click();
  await page.getByRole("alert").filter({ hasText: "Googleが未接続" }).waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる" })
    .click();
  execFileSync("python3", ["test/fixtures.py", join(dataDir, "fixtures")]);
  await page
    .locator('input[type=file][accept=".pptx,.xlsx"]')
    .setInputFiles(join(dataDir, "fixtures", "review.pptx"));
  await page.getByRole("dialog", { name: "review.pptx" }).waitFor();
  await page
    .getByRole("dialog")
    .getByText("スライド 1 · 6図形", { exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("本日は洗濯の工夫をご紹介します。", { exact: true })
    .waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる" })
    .click();
  await page.getByRole("button", { name: "PPT修正反映", exact: true }).click();
  await page.screenshot({ path: "test-results/documents.png", fullPage: true });
  await nav.getByRole("button", { name: "定例レポート" }).click();
  await page.getByRole("button", { name: "内容を確認" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "PowerPointをダウンロード" })
    .click();
  const download = await downloadPromise;
  await download.saveAs("test-results/sample-report.pptx");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる" })
    .click();
  await nav.getByRole("button", { name: "連携・設定" }).click();
  assert.equal(await page.getByLabel("週次の実行曜日").inputValue(), "4");
  assert.equal(
    await page.getByLabel("実行時刻（日本時間）").inputValue(),
    "12",
  );
  await page.getByLabel("週次の実行曜日").selectOption("3");
  await page.getByRole("button", { name: "設定を保存する" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "設定を保存しました" })
    .waitFor();
  await page.reload();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "連携・設定" })
    .click();
  assert.equal(await page.getByLabel("週次の実行曜日").inputValue(), "3");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "ホーム", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/dashboard-with-data.png",
    fullPage: true,
  });
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 1,
  });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(base);
  await mobile
    .getByRole("heading", { name: "今日も、暮らしに寄りそう発信を。" })
    .waitFor();
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "mobile has no horizontal overflow",
  );
  await mobile.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await mobile.getByRole("button", { name: "メニュー", exact: true }).click();
  await mobile
    .locator(".sidebar nav")
    .getByRole("button", { name: "投稿管理" })
    .click();
  await mobile
    .getByRole("heading", { name: "ひとつの企画を、チームで育てる。" })
    .waitFor();
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "kanban scrolls within its container",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: dashboard, CRUD persistence, drag/drop, task status, CSV import, Skills, workflows, Drive error, PPTX upload, PPTX download, settings, mobile layout.",
  );
} finally {
  await browser.close();
  child.kill("SIGTERM");
}
