const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const {
  verifyMetaSignature,
  createSlidingWindowRateLimiter
} = require("../src/security");

function makeRequest({ rawBody, signature }) {
  const headers = {
    "x-hub-signature-256": signature || ""
  };
  return {
    rawBody,
    get(name) {
      return headers[String(name || "").toLowerCase()] || "";
    }
  };
}

test("meta signature verification succeeds for valid signature", () => {
  const originalSecret = process.env.META_APP_SECRET;
  process.env.META_APP_SECRET = "test_secret";

  const payload = Buffer.from(JSON.stringify({ hello: "world" }), "utf8");
  const signature = `sha256=${crypto
    .createHmac("sha256", process.env.META_APP_SECRET)
    .update(payload)
    .digest("hex")}`;

  const req = makeRequest({ rawBody: payload, signature });
  assert.equal(verifyMetaSignature(req), true);

  if (originalSecret === undefined) {
    delete process.env.META_APP_SECRET;
  } else {
    process.env.META_APP_SECRET = originalSecret;
  }
});

test("meta signature verification fails for invalid signature", () => {
  const originalSecret = process.env.META_APP_SECRET;
  process.env.META_APP_SECRET = "test_secret";

  const payload = Buffer.from(JSON.stringify({ hello: "world" }), "utf8");
  const req = makeRequest({ rawBody: payload, signature: "sha256=bad" });
  assert.equal(verifyMetaSignature(req), false);

  if (originalSecret === undefined) {
    delete process.env.META_APP_SECRET;
  } else {
    process.env.META_APP_SECRET = originalSecret;
  }
});

test("rate limiter blocks requests over threshold within window", () => {
  const limiter = createSlidingWindowRateLimiter({ windowMs: 60 * 1000, maxRequests: 2 });
  assert.equal(limiter("ip:1"), true);
  assert.equal(limiter("ip:1"), true);
  assert.equal(limiter("ip:1"), false);
});
