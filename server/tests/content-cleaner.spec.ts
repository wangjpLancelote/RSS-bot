import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanHtmlForReading, cleanTextForReading } from "../src/services/contentCleaner";

test("cleanHtmlForReading removes common non-main blocks", () => {
  const input = `
    <article>
      <h1>Deep Learning Notes</h1>
      <p>Transformer models changed NLP and are now used in many tasks.</p>
      <section class="comments">评论 24 条，登录后可回复</section>
      <div class="like-bar">点赞 1200 次</div>
      <div class="content-body">This paragraph should stay in the article body.</div>
    </article>
    <aside class="related">相关阅读</aside>
  `;

  const cleaned = cleanHtmlForReading(input);
  const text = cleaned.contentText;

  assert.ok(text.includes("Transformer models changed NLP"));
  assert.ok(text.includes("This paragraph should stay"));
  assert.ok(!text.includes("评论 24 条"));
  assert.ok(!text.includes("点赞 1200 次"));
  assert.ok(!text.includes("相关阅读"));
});

test("cleanTextForReading drops noisy short interaction lines", () => {
  const input = `
    这是一段文章正文，解释了数据处理流程和关键设计决策。
    点赞
    登录后评论
    注册即可查看更多
    This is another meaningful paragraph that should remain.
  `;

  const output = cleanTextForReading(input);
  assert.ok(output.includes("这是一段文章正文"));
  assert.ok(output.includes("meaningful paragraph"));
  assert.ok(!output.includes("点赞"));
  assert.ok(!output.includes("登录后评论"));
  assert.ok(!output.includes("注册即可查看更多"));
});
