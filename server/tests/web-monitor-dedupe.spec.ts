import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateContentHash, semanticDecideNovelty, type WebCandidate } from "../src/services/langgraphPipeline";

function candidate(contentText: string): WebCandidate {
  return {
    key: "k",
    title: "title",
    link: "https://example.com/a",
    publishedAt: null,
    contentText,
    contentHtml: null
  };
}

test("candidateContentHash is stable for same content", () => {
  const a = candidateContentHash(candidate("Hello world"));
  const b = candidateContentHash(candidate("Hello world"));
  assert.equal(a, b);
});

test("semanticDecideNovelty returns noise for highly similar content", async () => {
  const decision = await semanticDecideNovelty({
    candidate: candidate("Hello world this is a very similar paragraph used for testing"),
    recentSummaries: ["Hello world this is a very similar paragraph used for testing with tiny changes"],
    budget: { used: 0, max: 3 }
  });

  assert.equal(decision.decision, "noise");
});
