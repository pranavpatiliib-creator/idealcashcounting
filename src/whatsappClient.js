const REQUEST_TIMEOUT_MS = Number(process.env.WHATSAPP_API_TIMEOUT_MS || 10000);

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getGraphApiEndpoint() {
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v22.0";
  const phoneNumberId = getRequiredEnv("WHATSAPP_PHONE_NUMBER_ID");
  return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
}

function normalizeRecipient(to) {
  const cleaned = String(to || "").replace(/[^\d+]/g, "");
  if (!/^\+?\d{6,20}$/.test(cleaned)) {
    throw new Error("Invalid recipient format");
  }
  return cleaned.replace(/^\+/, "");
}

function clampText(text, maxLength) {
  const normalized = String(text || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized.slice(0, maxLength);
}

function normalizeSections(sections) {
  const normalizedSections = [];
  const sourceSections = Array.isArray(sections) ? sections : [];

  for (const section of sourceSections.slice(0, 10)) {
    const rows = Array.isArray(section?.rows) ? section.rows : [];
    normalizedSections.push({
      title: clampText(section?.title || "Options", 24),
      rows: rows.slice(0, 10).map((row) => ({
        id: clampText(row?.id || "", 200),
        title: clampText(row?.title || "Option", 24),
        description: clampText(row?.description || "", 72)
      }))
    });
  }

  return normalizedSections;
}

async function sendGraphPayload(payload) {
  const token = getRequiredEnv("WHATSAPP_TOKEN");
  const endpoint = getGraphApiEndpoint();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp API error ${response.status}: ${errorText}`);
  }
}

function asTextPayload(to, text) {
  return {
    messaging_product: "whatsapp",
    to: normalizeRecipient(to),
    type: "text",
    text: {
      body: clampText(text, 1024)
    }
  };
}

function asListPayload(to, message) {
  return {
    messaging_product: "whatsapp",
    to: normalizeRecipient(to),
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: clampText(message.body, 1024)
      },
      footer: message.footer ? { text: clampText(message.footer, 60) } : undefined,
      action: {
        button: clampText(message.buttonText || "Choose", 20),
        sections: normalizeSections(message.sections)
      }
    }
  };
}

function asButtonsPayload(to, message) {
  return {
    messaging_product: "whatsapp",
    to: normalizeRecipient(to),
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: clampText(message.body, 1024)
      },
      action: {
        buttons: message.buttons.map((item) => ({
          type: "reply",
          reply: {
            id: item.id,
            title: clampText(item.title, 20)
          }
        }))
      }
    }
  };
}

async function sendMessage(to, message) {
  if (message.kind === "text") {
    await sendGraphPayload(asTextPayload(to, message.text));
    return;
  }

  if (message.kind === "list") {
    await sendGraphPayload(asListPayload(to, message));
    return;
  }

  if (message.kind === "buttons") {
    await sendGraphPayload(asButtonsPayload(to, message));
  }
}

async function sendMessageBundle(to, messages) {
  for (const message of messages) {
    await sendMessage(to, message);
  }
}

module.exports = {
  sendMessageBundle
};
