import { test } from "node:test";
import assert from "node:assert/strict";
import { formatFeedIntakeJob } from "../src/services/feedIntake";

test("formatFeedIntakeJob maps result and error payload", () => {
  const row = {
    id: "job-1",
    status: "failed",
    stage: "failed",
    progress: 100,
    result_feed_id: null,
    source_type: null,
    warning: null,
    error_code: "INTAKE_CONVERSION_FAILED",
    error_message: "boom"
  };

  const formatted = formatFeedIntakeJob(row);
  assert.equal(formatted.jobId, "job-1");
  assert.equal(formatted.status, "failed");
  assert.equal(formatted.stage, "failed");
  assert.equal(formatted.progress, 100);
  assert.equal(formatted.result, undefined);
  assert.deepEqual(formatted.error, {
    code: "INTAKE_CONVERSION_FAILED",
    message: "boom"
  });
});

test("formatFeedIntakeJob maps success result payload", () => {
  const row = {
    id: "job-2",
    status: "done",
    stage: "done",
    progress: 100,
    result_feed_id: "feed-1",
    source_type: "web_monitor",
    warning: "playwright_failed",
    error_code: null,
    error_message: null
  };

  const formatted = formatFeedIntakeJob(row);
  assert.deepEqual(formatted.result, {
    feedId: "feed-1",
    sourceType: "web_monitor",
    warning: "playwright_failed"
  });
  assert.equal(formatted.error, undefined);
});
