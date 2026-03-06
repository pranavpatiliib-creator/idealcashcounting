const crypto = require("crypto");
const twilio = require("twilio");

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function captureRawBody(req, _res, buffer) {
  req.rawBody = buffer;
}

function timingSafeCompare(a, b) {
  const aBuffer = Buffer.from(String(a || ""), "utf8");
  const bBuffer = Buffer.from(String(b || ""), "utf8");
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function verifyMetaSignature(req) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    return true;
  }

  const signature = req.get("x-hub-signature-256");
  if (!signature || !req.rawBody) {
    return false;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(req.rawBody)
    .digest("hex")}`;

  return timingSafeCompare(signature, expectedSignature);
}

function buildPublicRequestUrl(req) {
  const forwardedProto = req.get("x-forwarded-proto");
  const protocol = forwardedProto ? forwardedProto.split(",")[0].trim() : req.protocol;
  return `${protocol}://${req.get("host")}${req.originalUrl}`;
}

function verifyTwilioSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return true;
  }

  const twilioSignature = req.get("x-twilio-signature");
  if (!twilioSignature) {
    return false;
  }

  const requestUrl = buildPublicRequestUrl(req);
  return twilio.validateRequest(authToken, twilioSignature, requestUrl, req.body);
}

function createSlidingWindowRateLimiter({ windowMs, maxRequests }) {
  const requestLog = new Map();
  let lastCleanupAt = 0;

  function cleanup(now) {
    if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
      return;
    }
    for (const [key, timestamps] of requestLog.entries()) {
      const filtered = timestamps.filter((time) => now - time < windowMs);
      if (filtered.length === 0) {
        requestLog.delete(key);
      } else {
        requestLog.set(key, filtered);
      }
    }
    lastCleanupAt = now;
  }

  return function isAllowed(key) {
    const normalizedKey = String(key || "unknown");
    const now = Date.now();
    cleanup(now);

    const timestamps = requestLog.get(normalizedKey) || [];
    const recent = timestamps.filter((time) => now - time < windowMs);
    recent.push(now);
    requestLog.set(normalizedKey, recent);

    return recent.length <= maxRequests;
  };
}

function getClientIp(req) {
  const forwardedFor = req.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

module.exports = {
  captureRawBody,
  verifyMetaSignature,
  verifyTwilioSignature,
  createSlidingWindowRateLimiter,
  getClientIp
};
