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

async function sendGraphPayload(payload) {
  const token = getRequiredEnv("WHATSAPP_TOKEN");
  const endpoint = getGraphApiEndpoint();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp API error ${response.status}: ${errorText}`);
  }
}

function asTextPayload(to, text) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      body: text
    }
  };
}

function asListPayload(to, message) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: message.body
      },
      footer: message.footer ? { text: message.footer } : undefined,
      action: {
        button: message.buttonText || "Choose",
        sections: message.sections
      }
    }
  };
}

function asButtonsPayload(to, message) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: message.body
      },
      action: {
        buttons: message.buttons.map((item) => ({
          type: "reply",
          reply: {
            id: item.id,
            title: item.title
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
