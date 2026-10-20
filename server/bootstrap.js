import { put, setting, setSetting, transaction } from "./db.js";
import { skillVersion } from "./ai.js";
export function bootstrap() {
  if (setting("userRequirementsImported")) return;
  const skills = [
    {
      name: "注釈付きPPTXの指摘棚卸し・修正反映",
      content:
        "クライアントの修正指示（赤字コメント・矢印・付箋・青ボックス・黄色マーカーなど）が書き込まれたPowerPoint資料を読み取り、指摘を全件棚卸し→本文/リプライ/訴求欄へ反映→レビュー用注釈を一括削除→検証済みの「修正反映版」PPTXを別名保存するスキル。「初稿戻し」「戻しの反映」「赤字反映」「修正指示を反映して」「先方コメント対応」「クライアント指摘の整理」「指摘反映してPPT更新」などのワードが出た場合、またはレビュー注釈付きのPPTXが添付された場合は必ずこのスキルを使う。SNS投稿案・提案書・レポートなど資料種別を問わず、注釈入りPPTXの修正反映作業全般に適用する。",
    },
    {
      name: "日立公式X企画・編集可能な審査用PPTX",
      content:
        "日立の家電公式X（@hitachi_kaden）向けのX投稿企画を、SNS企画案Excel（月別シートのX欄）とXトレンド参考投稿URLから50案（または指定数）作成し、過去の「SNS審査用」PowerPointのX企画ページ形式を複製した編集可能な審査用PPTX（投稿文完成稿＋画像ラフ＋ノート）に仕上げるスキル。「X投稿企画を作って」「審査用PPTにして」「企画案Excel／トレンドURLを送るので○月のX企画○案」「日立のX企画」「クイズは問題と答えで分けて」「SNS審査用フォーマットで」などの依頼、または SNS企画案_*.xlsx やトレンド投稿URLリストが添付されたら必ずこのスキルを使う。他社アカウントでも同じ構成（企画Excel＋審査用PPTフォーマット）の依頼なら使ってよい。",
    },
  ];
  transaction(() => {
    for (const skill of skills)
      put("skill", {
        ...skill,
        enabled: true,
        sha256: skillVersion(skill.content),
        source:
          "このチャットで共有されたスキル要件。Claudeプロジェクトの非公開ファイルは未取得。",
      });
    setSetting("userRequirementsImported", true);
  });
}
