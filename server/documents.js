import { Router } from "express";
import multer from "multer";
import { randomUUID, createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { join, resolve, extname } from "node:path";
import { spawn } from "node:child_process";
import { google } from "googleapis";
import twitterText from "twitter-text";
import { z } from "zod";
import { dataDir, list, get, put, remove, setting } from "./db.js";
import { googleClient } from "./google.js";
import { generate, schemas } from "./ai.js";

// Multipart filename parameters are commonly decoded as Latin-1 by Busboy.
function decodeFilename(name) {
  if ([...name].some(c => c.codePointAt(0) > 255)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}

const folder = join(dataDir, "documents");
mkdirSync(folder, { recursive: true, mode: 0o700 });
const upload = multer({
  dest: folder,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});
const engine = resolve("server/documents.py");
const inFlight = new Set();
async function guard(key, fn) {
  if (inFlight.has(key))
    throw Object.assign(new Error("同じドキュメントの処理が実行中です。"), {
      status: 409,
    });
  inFlight.add(key);
  try {
    return await fn();
  } finally {
    inFlight.delete(key);
  }
}
export function python(args, input) {
  return new Promise((accept, reject) => {
    const pythonBin =
      process.env.PYTHON_BIN ||
      (existsSync(resolve(".venv/bin/python"))
        ? resolve(".venv/bin/python")
        : "python3");
    const child = spawn(pythonBin, [engine, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "",
      stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        Object.assign(
          new Error(
            "資料処理が時間内に完了しませんでした。ファイルサイズを小さくしてください。",
          ),
          { status: 422 },
        ),
      );
    }, 200000);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.length > 20_000_000) child.kill("SIGKILL");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", () => {
      clearTimeout(timer);
      reject(
        Object.assign(new Error("資料処理用のPython環境を確認してください。"), {
          status: 500,
        }),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      let value;
      try {
        value = JSON.parse(output);
      } catch {
        return reject(
          Object.assign(
            new Error(
              "資料処理に失敗しました。OfficeファイルとPython依存関係を確認してください。",
            ),
            { status: 422 },
          ),
        );
      }
      if (code || value.error)
        reject(
          Object.assign(new Error(value.error || "資料処理に失敗しました"), {
            status: 422,
          }),
        );
      else accept(value);
    });
    child.stdin.end(input ? JSON.stringify(input) : "");
  });
}
const find = (kind, id) => {
  const doc = get(kind, id);
  if (!doc)
    throw Object.assign(new Error("ファイルが見つかりません。"), {
      status: 404,
    });
  return doc;
};
const publicDoc = (doc) => {
  const { path, renderDir, ...safe } = doc;
  return safe;
};
export async function importOffice(path, name, source = "upload") {
  const ext = extname(name).toLowerCase();
  if (![".pptx", ".xlsx"].includes(ext))
    throw Object.assign(new Error("PPTXまたはXLSXを選んでください。"), {
      status: 422,
    });
  const id = randomUUID(),
    target = join(folder, id + ext);
  const bytes = readFileSync(path);
  writeFileSync(target, bytes, { mode: 0o600 });
  try {
    const extracted = await python(["extract", target]);
    if (Buffer.byteLength(JSON.stringify(extracted)) > 1_500_000)
      throw Object.assign(
        new Error("抽出テキストが大きすぎます。資料を分割してください。"),
        { status: 422 },
      );
    return put("document", {
      id,
      name,
      source,
      type: ext.slice(1),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      path: target,
      extracted,
      renderDir: join(folder, id + "-render"),
    });
  } catch (e) {
    unlinkSync(target);
    throw e;
  }
}
async function renderDoc(doc) {
  await python(["render", doc.path, doc.renderDir]);
  return doc;
}
const revisionPrompt =
  "注釈入りPPTXの指摘を全件棚卸しする。赤字コメント・矢印・付箋・青ボックス・黄色マーカーを画像と座標・文字色から読解。指摘ごとに対象本文/リプライ/訴求欄のshapeIdと、正確な元テキスト・修正文を指定する。通常の本文や装飾は注釈に含めない。判断できない指摘、画像にしか存在しない本文、複雑な表セルはneeds_inputとしunresolvedにも記載。本文を含むshapeを削除しない。annotationShapeIdsは修正後に取り除くレビュー専用shapeのみ。原文がない置換を作らない。同じ指摘を重複登録しない。";

export const documentRoutes = Router();
documentRoutes.get("/", (_, res) => res.json(list("document").map(publicDoc)));
documentRoutes.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file)
    throw Object.assign(new Error("ファイルを選んでください。"), {
      status: 422,
    });
  try {
    res.json(
      publicDoc(await importOffice(req.file.path, decodeFilename(req.file.originalname))),
    );
  } finally {
    if (existsSync(req.file.path)) unlinkSync(req.file.path);
  }
});
documentRoutes.get("/drive", async (req, res) => {
  const folderId = z
    .string()
    .regex(/^[\w-]{10,200}$/)
    .parse(req.query.folderId || setting("config", {}).driveFolderId);
  const pageToken = z.string().max(1000).optional().parse(req.query.pageToken);
  try {
    const auth = await googleClient(),
      drive = google.drive({ version: "v3", auth });
    const r = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
      pageSize: 100,
      pageToken,
      orderBy: "folder,name",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    res.json(r.data);
  } catch (e) {
    if (e.status) throw e;
    throw Object.assign(
      new Error(
        `Drive一覧取得に失敗しました（${e.code || "通信エラー"}）。Drive APIの有効化、読み取りスコープ、フォルダの共有権限を確認してください。`,
      ),
      { status: 502 },
    );
  }
});
documentRoutes.post("/drive/import", async (req, res) => {
  const { fileId } = z
    .object({ fileId: z.string().regex(/^[\w-]{10,200}$/) })
    .parse(req.body);
  try {
    const auth = await googleClient(),
      drive = google.drive({ version: "v3", auth });
    const meta = await drive.files.get({
      fileId,
      fields: "name,size,mimeType",
      supportsAllDrives: true,
    });
    const mime = meta.data.mimeType;
    const native =
      mime === "application/vnd.google-apps.presentation"
        ? {
            mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ext: ".pptx",
          }
        : mime === "application/vnd.google-apps.spreadsheet"
          ? {
              mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ext: ".xlsx",
            }
          : null;
    if (
      !native &&
      ![".pptx", ".xlsx"].includes(extname(meta.data.name).toLowerCase())
    )
      throw Object.assign(
        new Error(
          "PowerPoint、Excel、Googleスライド、Googleスプレッドシートを選んでください。",
        ),
        { status: 422 },
      );
    if (Number(meta.data.size) > 25 * 1024 * 1024)
      throw Object.assign(new Error("25MB以下のファイルを選んでください。"), {
        status: 422,
      });
    const r = native
      ? await drive.files.export(
          { fileId, mimeType: native.mime },
          { responseType: "arraybuffer" },
        )
      : await drive.files.get(
          { fileId, alt: "media", supportsAllDrives: true },
          { responseType: "arraybuffer" },
        );
    const buffer = Buffer.from(r.data);
    if (buffer.length > 25 * 1024 * 1024)
      throw Object.assign(new Error("25MBを超えるファイルです。"), {
        status: 422,
      });
    const tmp = join(folder, randomUUID() + ".download");
    writeFileSync(tmp, buffer, { mode: 0o600 });
    try {
      res.json(
        publicDoc(
          await importOffice(
            tmp,
            meta.data.name + (native ? native.ext : ""),
            "drive",
          ),
        ),
      );
    } finally {
      unlinkSync(tmp);
    }
  } catch (e) {
    if (e.status) throw e;
    throw Object.assign(
      new Error(
        `Driveファイル取得に失敗しました（${e.code || "通信エラー"}）。ダウンロード権限を確認してください。`,
      ),
      { status: 502 },
    );
  }
});
documentRoutes.get("/:id", (req, res) =>
  res.json(publicDoc(find("document", req.params.id))),
);
documentRoutes.post("/:id/render", async (req, res) => {
  const doc = find("document", req.params.id);
  if (doc.type !== "pptx")
    throw Object.assign(new Error("PPTXのみ画像化できます。"), { status: 422 });
  await guard("render:" + doc.id, () => renderDoc(doc));
  res.json({ slides: doc.extracted.slides.length });
});
documentRoutes.get("/:id/slides/:number", (req, res) => {
  const doc = find("document", req.params.id),
    n = z.coerce.number().int().min(1).max(80).parse(req.params.number);
  const path = join(doc.renderDir, `slide-${n}.jpg`);
  if (!existsSync(path))
    return res
      .status(404)
      .json({
        error: "プレビュー画像はまだありません。画像化を実行してください。",
      });
  res.type("jpeg").sendFile(path);
});
documentRoutes.post("/:id/revisions", async (req, res) =>
  res.json(
    await guard("revise:" + req.params.id, async () => {
      const doc = find("document", req.params.id);
      if (doc.type !== "pptx")
        throw Object.assign(new Error("注釈付きPPTXを選んでください。"), {
          status: 422,
        });
      await renderDoc(doc);
      const annotations = [],
        unresolved = [],
        provenance = [];
      for (const slide of doc.extracted.slides) {
        const image = readFileSync(
          join(doc.renderDir, `slide-${slide.number}.jpg`),
        ).toString("base64");
        const generated = await generate(
          "revisions",
          {
            slide,
            comments: doc.extracted.comments,
            slideWidth: doc.extracted.slideWidth,
            slideHeight: doc.extracted.slideHeight,
          },
          revisionPrompt,
          { images: [image] },
        );
        for (const item of generated.result.annotations) {
          if (item.slide !== slide.number)
            throw Object.assign(
              new Error("指摘のスライド番号が一致しないため停止しました。"),
              { status: 502 },
            );
          const shapeIds = new Set(slide.shapes.map((s) => s.id));
          if (
            item.annotationShapeIds.some((id) => !shapeIds.has(id)) ||
            item.replacements.some(
              (r) =>
                !slide.shapes
                  .find((s) => s.id === r.shapeId)
                  ?.text.includes(r.oldText),
            )
          )
            throw Object.assign(
              new Error(
                "指摘の対象図形・元テキストが一致せず、未保存で停止しました。",
              ),
              { status: 502 },
            );
          annotations.push({ ...item, approved: false });
        }
        unresolved.push(...generated.result.unresolved);
        provenance.push(generated.provenance);
      }
      return put("revision", {
        documentId: doc.id,
        name: doc.name,
        summary: `${doc.extracted.slides.length}スライドを読解、${annotations.length}件の指摘を抽出。人による棚卸し確認が必要です。`,
        annotations,
        unresolved,
        provenance: provenance[0],
        perSlideProvenance: provenance,
        status: "review",
      });
    }),
  ),
);
documentRoutes.post("/revisions/:id/apply", async (req, res) =>
  res.json(
    await guard("apply:" + req.params.id, async () => {
      const saved = find("revision", req.params.id),
        doc = find("document", saved.documentId);
      const body = z
        .object({
          annotations: z
            .array(
              schemas.revisions.shape.annotations.element.extend({
                approved: z.boolean(),
              }),
            )
            .max(500),
          removeOfficeComments: z.boolean(),
          allowPartial: z.boolean().default(false),
        })
        .parse(req.body);
      if (!body.annotations.length)
        throw Object.assign(new Error("反映対象の指摘がありません。"), {
          status: 422,
        });
      // Approval is attached to the complete saved inventory, not a client-supplied subset.
      if (
        body.annotations.length !== saved.annotations.length ||
        body.annotations.some(
          (a, i) =>
            a.slide !== saved.annotations[i].slide ||
            a.instruction !== saved.annotations[i].instruction ||
            JSON.stringify(a.annotationShapeIds) !==
              JSON.stringify(saved.annotations[i].annotationShapeIds) ||
            a.replacements.length !==
              saved.annotations[i].replacements.length ||
            a.replacements.some(
              (r, j) =>
                r.shapeId !== saved.annotations[i].replacements[j].shapeId ||
                r.oldText !== saved.annotations[i].replacements[j].oldText,
            ),
        )
      )
        throw Object.assign(
          new Error(
            "棚卸し対象が元の指摘一覧と一致しません。指摘の一部を除いて完了扱いにはできません。",
          ),
          { status: 422 },
        );
      const approved = body.annotations.filter((a) => a.approved);
      if (!approved.length)
        throw Object.assign(new Error("承認した指摘がありません。"), {
          status: 422,
        });
      const complete =
        approved.length === body.annotations.length &&
        body.annotations.every((a) => a.status === "applicable") &&
        !saved.unresolved.length;
      if (!complete && !body.allowPartial)
        throw Object.assign(
          new Error(
            "未承認・未解決の指摘があります。全件確認するか「部分反映ドラフト」を選択してください。",
          ),
          { status: 422 },
        );
      if (body.removeOfficeComments && !complete)
        throw Object.assign(
          new Error(
            "未解決の指摘があるためOfficeコメントの一括削除を停止しました。部分反映時はコメントを保持してください。",
          ),
          { status: 422 },
        );
      const outputId = randomUUID(),
        output = join(folder, outputId + ".pptx");
      const verification = await python(["revise", doc.path, output], body);
      const updated = put("revision", {
        ...saved,
        annotations: body.annotations,
        outputId,
        outputPath: output,
        status: complete ? "applied" : "partial",
        verification,
        outputName:
          doc.name.replace(/\.pptx$/i, "") +
          (complete ? "_修正反映版" : "_部分反映ドラフト") +
          ".pptx",
      });
      const { outputPath, ...safe } = updated;
      return safe;
    }),
  ),
);
documentRoutes.get("/revisions/:id/download", (req, res) => {
  const r = find("revision", req.params.id);
  if (!r.outputPath)
    throw Object.assign(new Error("反映版がまだ作成されていません。"), {
      status: 422,
    });
  res.download(r.outputPath, r.outputName);
});
documentRoutes.post("/xideas", async (req, res) =>
  res.json(
    await guard("xideas", async () => {
      const body = z
        .object({
          workbookId: z.string(),
          sheetName: z.string(),
          month: z.string().min(1).max(100),
          count: z.number().int().min(1).max(50),
          references: z
            .array(
              z.object({
                url: z.string().url(),
                text: z.string().min(1).max(10000),
              }),
            )
            .min(1)
            .max(100),
          brief: z.string().max(30000).default(""),
        })
        .parse(req.body);
      const workbook = find("document", body.workbookId);
      if (workbook.type !== "xlsx")
        throw Object.assign(new Error("企画案Excelを選んでください。"), {
          status: 422,
        });
      const sheet = workbook.extracted.sheets.find(
        (s) => s.name === body.sheetName,
      );
      if (!sheet)
        throw Object.assign(new Error("月別シートが見つかりません。"), {
          status: 422,
        });
      if (JSON.stringify(sheet).length > 100000)
        throw Object.assign(
          new Error(
            "選択シートが大きすぎます。対象月のX企画欄を整理して再登録してください。",
          ),
          { status: 422 },
        );
      const ideas = [],
        provenance = [];
      const urls = new Set(body.references.map((r) => r.url));
      for (let start = 0; start < body.count; start += 5) {
        const count = Math.min(5, body.count - start);
        const generated = await generate(
          "xideas",
          {
            month: body.month,
            sheet,
            references: body.references,
            brief: body.brief,
            requiredCount: count,
            previousTitles: ideas.map((i) => i.title),
          },
          `日立家電公式X @hitachi_kaden の投稿企画を正確に${count}案作成。月別シートのX欄を使用。指定参考投稿の本文を根拠に、未取得のURL内容を推測しない。他SNS欄は参照対象外。既出案と重複しない。投稿文とリプライはXの加重文字数280以内。クイズは問題をbody、答えをreplyとanswerに分離。画像ラフは編集可能な説明・構図。商品性能・価格は入力にない場合断言しない。${body.brief}`,
        );
        if (generated.result.ideas.length !== count)
          throw Object.assign(
            new Error(
              "生成案数が指定数と一致せず停止しました。件数を減らして再実行してください。",
            ),
            { status: 502 },
          );
        for (const idea of generated.result.ideas) {
          if (idea.sourceUrls.some((u) => !urls.has(u)))
            throw Object.assign(
              new Error("参考入力にないURLが生成されたため停止しました。"),
              { status: 502 },
            );
          if (
            !twitterText.parseTweet(idea.body).valid ||
            (idea.reply && !twitterText.parseTweet(idea.reply).valid)
          )
            throw Object.assign(
              new Error(
                "Xの加重文字数上限を超えた投稿案があり、未保存で停止しました。",
              ),
              { status: 502 },
            );
          if (
            idea.isQuiz &&
            (!idea.answer || !idea.reply || idea.body.includes(idea.answer))
          )
            throw Object.assign(
              new Error("クイズの問題・答えの分離を検証できず停止しました。"),
              { status: 502 },
            );
        }
        ideas.push(...generated.result.ideas);
        provenance.push(generated.provenance);
      }
      return put("xplan", {
        ...body,
        ideas,
        provenance: provenance[0],
        batchProvenance: provenance,
        status: "draft",
      });
    }),
  ),
);
documentRoutes.post("/xideas/:id/pptx", async (req, res) =>
  res.json(
    await guard("x-ppt:" + req.params.id, async () => {
      const plan = find("xplan", req.params.id),
        body = z
          .object({
            templateId: z.string(),
            templateSlide: z.number().int().min(1).max(80),
            mapping: z.object({
              title: z.number().int().positive(),
              body: z.number().int().positive(),
              reply: z.number().int().positive(),
              claim: z.number().int().positive(),
              visual: z.number().int().positive(),
            }),
          })
          .parse(req.body);
      const template = find("document", body.templateId);
      if (template.type !== "pptx")
        throw Object.assign(new Error("審査用PPTXを選んでください。"), {
          status: 422,
        });
      if (new Set(Object.values(body.mapping)).size !== 5)
        throw Object.assign(
          new Error(
            "タイトル・本文・リプライ・訴求・画像ラフには別々のテキストボックスを指定してください。",
          ),
          { status: 422 },
        );
      const output = join(folder, randomUUID() + ".pptx"),
        verification = await python(["clone-x", template.path, output], {
          ...body,
          ideas: plan.ideas,
        });
      const updated = put("xplan", {
        ...plan,
        ...body,
        outputPath: output,
        status: "exported",
        verification,
      });
      const { outputPath, ...safe } = updated;
      return safe;
    }),
  ),
);
documentRoutes.get("/xideas/:id/download", (req, res) => {
  const plan = find("xplan", req.params.id);
  if (!plan.outputPath)
    throw Object.assign(new Error("審査用PPTがまだ作成されていません。"), {
      status: 422,
    });
  res.download(plan.outputPath, "X企画_審査用_ドラフト.pptx");
});
export function documentState() {
  return {
    documents: list("document").map(publicDoc),
    revisions: list("revision").map(({ outputPath, ...safe }) => safe),
    xplans: list("xplan").map(({ outputPath, ...safe }) => safe),
  };
}
