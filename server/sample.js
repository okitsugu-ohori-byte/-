import { put, list, remove, transaction } from "./db.js";
import { jstDate, dateRange } from "./domain.js";
export function seedSample() {
  if (list("post").some((p) => p.demo)) return;
  transaction(() => {
    const today = jstDate(),
      yesterday = dateRange(2, today).from;
    const posts = [
      ["毎日の料理に、ちょっとした余白を。", "Instagram", "冷蔵庫", "review"],
      ["週末のお掃除、もっと軽やかに。", "X", "クリーナー", "draft"],
      ["衣替えの季節に知りたい洗濯のこと", "Instagram", "洗濯機", "idea"],
      ["暮らしの小さな発見を、家電と。", "X", "家電全般", "approved"],
    ];
    posts.forEach(([title, platform, product, status], i) =>
      put("post", {
        title,
        platform,
        product,
        status,
        date: i < 2 ? today : yesterday,
        owner: ["田中", "佐藤", "鈴木"][i % 3],
        caption:
          "サンプルの投稿案です。商品性能・数値を含む表現は承認資料で確認してください。",
        note: "サンプル / 架空データ",
        url: "",
        demo: true,
      }),
    );
    put("task", {
      title: "来週の投稿案をレビューする",
      assignee: "田中（サンプル）",
      dueDate: today,
      priority: "high",
      status: "todo",
      sourceQuote: "次回までに投稿案を確認する（サンプル）",
      demo: true,
    });
    put("task", {
      title: "撮影カット案と確認事項を整理",
      assignee: "佐藤（サンプル）",
      dueDate: today,
      priority: "medium",
      status: "doing",
      sourceQuote: "撮影の準備を進める（サンプル）",
      demo: true,
    });
    const observations = [
      ["Instagram", "@sample_living", 4800, 144, 18],
      ["Instagram", "@sample_kitchen", 6200, 186, 24],
      ["X", "@sample_appliance", 12000, 216, 12],
    ].map(([platform, account, reach, likes, saves], i) =>
      put("observation", {
        date: yesterday,
        platform,
        account,
        accountType: "competitor",
        url: `https://example.com/sample-post-${i + 1}`,
        content: [
          "暮らしの困りごとから始めるショート動画",
          "手順を見せるカルーセル投稿",
          "季節の家事のお悩みを問いかけ",
        ][i],
        reach,
        likes,
        saves,
        impressions: 0,
        comments: 12,
        shares: 6,
        views: 0,
        followers: 0,
        demo: true,
      }),
    );
    const ideas = [
      {
        title: "「こんな時どうする？」から始める家事のヒント",
        platform: "Instagram",
        product: "洗濯機",
        hook: "毎日の「ちょっと困った」をひとつずつ。",
        outline:
          "共感できるお悩み → 家事の工夫 → 商品説明では承認済み情報のみ使用 → 保存を促すCTA。",
        evidenceIds: [observations[0].id],
        caution:
          "サンプル企画です。実在する投稿や実績に基づく分析ではありません。",
      },
    ];
    put("research", {
      ...dateRange(7),
      cadence: "weekly",
      summary:
        "サンプル分析：暮らしのお悩み起点の表現と、手順が伝わる構成を検討します。数値はすべて架空です。",
      highPerformers: [
        { observationId: observations[1].id, reason: "サンプルの比較根拠" },
      ],
      trends: [
        {
          name: "暮らしのお悩み起点",
          evidenceIds: [observations[0].id],
          interpretation:
            "困りごとを入り口に、家事の工夫を伝える表現（サンプル）",
        },
      ],
      ideas,
      observationIds: observations.map((o) => o.id),
      demo: true,
    });
    put("report", {
      ...dateRange(7),
      period: "weekly",
      title: "SNS運用 ウィークリーレポート（サンプル）",
      summary: "画面と資料出力の確認用サンプルです。",
      slides: [
        {
          title: "今週のハイライト",
          bullets: [
            "レビュー待ちの投稿を確認",
            "暮らしのお悩み起点の表現を検討",
          ],
          notes: "架空データ / サンプル",
        },
        {
          title: "投稿進捗",
          bullets: [
            "サンプル投稿4件を登録",
            "担当・期日・承認ステータスを管理",
          ],
          notes: "サンプル",
        },
        {
          title: "次週のアクション",
          bullets: ["承認資料の確認", "投稿案レビューと撮影準備"],
          notes: "サンプル",
        },
      ],
      nextActions: ["投稿案の確認"],
      demo: true,
    });
  });
}
export function clearSample() {
  transaction(() => {
    for (const kind of ["post", "task", "observation", "research", "report"])
      for (const row of list(kind)) if (row.demo) remove(kind, row.id);
  });
}
