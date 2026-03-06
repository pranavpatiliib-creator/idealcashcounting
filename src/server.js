require("dotenv").config();

const express = require("express");
const { createBot } = require("./bot");
const { saveLead } = require("./storage/leadStore");
const { extractInboundMessages } = require("./webhookParser");
const { sendMessageBundle } = require("./whatsappClient");
const { toTwiml } = require("./twilioRenderer");
const {
  captureRawBody,
  verifyMetaSignature,
  verifyTwilioSignature,
  createSlidingWindowRateLimiter,
  getClientIp
} = require("./security");

const app = express();
const bot = createBot({ saveLead });
const handledMessageIds = new Map();
const ipRateLimiter = createSlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: Number(process.env.RATE_LIMIT_IP_PER_MIN || 180)
});
const senderRateLimiter = createSlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: Number(process.env.RATE_LIMIT_SENDER_PER_MIN || 40)
});
const maxBodySize = process.env.MAX_WEBHOOK_BODY_SIZE || "64kb";

app.disable("x-powered-by");

app.use(express.urlencoded({ extended: false, limit: maxBodySize, verify: captureRawBody }));
app.use(express.json({ limit: maxBodySize, verify: captureRawBody }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "idealautomation-whatsapp-bot",
    channels: ["meta_whatsapp_cloud_api", "twilio_whatsapp"]
  });
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const verifyToken = req.query["hub.verify_token"];

  if (mode === "subscribe" && verifyToken === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

function markAndCheckProcessed(messageId) {
  if (!messageId) return false;
  if (handledMessageIds.has(messageId)) return true;

  handledMessageIds.set(messageId, Date.now());

  for (const [id, seenAt] of handledMessageIds.entries()) {
    if (Date.now() - seenAt > 6 * 60 * 60 * 1000) {
      handledMessageIds.delete(id);
    }
  }

  return false;
}

function isIpRateLimited(req) {
  return !ipRateLimiter(getClientIp(req));
}

app.post("/webhook", async (req, res) => {
  if (isIpRateLimited(req)) {
    return res.status(429).json({ error: "Too many requests" });
  }

  if (!verifyMetaSignature(req)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const inboundMessages = extractInboundMessages(req.body);
  res.sendStatus(200);

  for (const incoming of inboundMessages) {
    if (markAndCheckProcessed(incoming.messageId)) {
      continue;
    }

    const senderKey = `meta:${incoming.phone || "unknown"}`;
    if (!senderRateLimiter(senderKey)) {
      continue;
    }

    try {
      const botReplies = await bot.handleIncoming({
        userId: incoming.phone,
        phone: incoming.phone,
        text: incoming.text,
        interactiveId: incoming.interactiveId,
        channel: "meta"
      });
      await sendMessageBundle(incoming.phone, botReplies);
    } catch (error) {
      console.error("Failed processing inbound WhatsApp message:", error.message);
    }
  }
});

app.post("/webhooks/twilio/whatsapp", async (req, res) => {
  if (isIpRateLimited(req)) {
    const rateLimitXml =
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Too many requests. Please try again after a minute.</Message></Response>';
    res.type("text/xml");
    return res.status(429).send(rateLimitXml);
  }

  if (!verifyTwilioSignature(req)) {
    return res.sendStatus(401);
  }

  const messageSid = String(req.body.MessageSid || "");
  if (messageSid && markAndCheckProcessed(`twilio:${messageSid}`)) {
    const duplicateXml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    res.type("text/xml");
    return res.status(200).send(duplicateXml);
  }

  const from = String(req.body.From || "");
  const phone = from.replace(/^whatsapp:/i, "");
  const text = String(req.body.Body || "");
  const interactiveId = String(req.body.ButtonPayload || "");

  const senderKey = `twilio:${phone || "unknown"}`;
  if (!senderRateLimiter(senderKey)) {
    const senderRateLimitXml =
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You are sending messages too quickly. Please wait a minute and try again.</Message></Response>';
    res.type("text/xml");
    return res.status(429).send(senderRateLimitXml);
  }

  try {
    const botReplies = await bot.handleIncoming({
      userId: phone || from || `anon:${req.ip}`,
      phone,
      text,
      interactiveId,
      channel: "twilio"
    });
    const twiml = toTwiml(botReplies);
    res.type("text/xml");
    return res.send(twiml);
  } catch (error) {
    console.error("Twilio webhook processing failed:", error.message);
    const fallback =
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry, we are unable to process your request right now.</Message></Response>';
    res.type("text/xml");
    return res.status(200).send(fallback);
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`IDEAL AUTOMATION WhatsApp bot running on port ${port}`);
});
