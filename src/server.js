require("dotenv").config();

const express = require("express");
const { createBot } = require("./bot");
const { saveLead } = require("./storage/leadStore");
const { extractInboundMessages } = require("./webhookParser");
const { sendMessageBundle } = require("./whatsappClient");

const app = express();
const bot = createBot({ saveLead });
const handledMessageIds = new Map();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "idealautomation-whatsapp-bot",
    channel: "whatsapp_business_api"
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

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const inboundMessages = extractInboundMessages(req.body);

  for (const incoming of inboundMessages) {
    if (markAndCheckProcessed(incoming.messageId)) {
      continue;
    }

    try {
      const botReplies = await bot.handleIncoming({
        userId: incoming.phone,
        phone: incoming.phone,
        text: incoming.text,
        interactiveId: incoming.interactiveId
      });
      await sendMessageBundle(incoming.phone, botReplies);
    } catch (error) {
      console.error("Failed processing inbound WhatsApp message:", error.message);
    }
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`IDEAL AUTOMATION WhatsApp Business bot running on port ${port}`);
});
