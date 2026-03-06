function extractTextFromIncomingMessage(message) {
  if (!message || typeof message !== "object") {
    return { text: "", interactiveId: "" };
  }

  if (message.type === "text") {
    return {
      text: message.text?.body || "",
      interactiveId: ""
    };
  }

  if (message.type === "interactive") {
    if (message.interactive?.type === "button_reply") {
      return {
        text: message.interactive.button_reply?.title || "",
        interactiveId: message.interactive.button_reply?.id || ""
      };
    }

    if (message.interactive?.type === "list_reply") {
      return {
        text: message.interactive.list_reply?.title || "",
        interactiveId: message.interactive.list_reply?.id || ""
      };
    }
  }

  if (message.type === "button") {
    return {
      text: message.button?.text || "",
      interactiveId: message.button?.payload || ""
    };
  }

  return { text: "", interactiveId: "" };
}

function extractInboundMessages(payload) {
  const results = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      const messages = Array.isArray(value?.messages) ? value.messages : [];

      for (const message of messages) {
        const parsed = extractTextFromIncomingMessage(message);
        results.push({
          messageId: message?.id || "",
          phone: message?.from || "",
          text: parsed.text,
          interactiveId: parsed.interactiveId,
          timestamp: message?.timestamp || ""
        });
      }
    }
  }

  return results;
}

module.exports = {
  extractInboundMessages
};
