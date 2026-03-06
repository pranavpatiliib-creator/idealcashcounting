const { twiml } = require("twilio");
const MAX_TWILIO_MESSAGE_LENGTH = Number(process.env.MAX_TWILIO_MESSAGE_LENGTH || 1500);

function sanitizeMessageText(input, maxLength = MAX_TWILIO_MESSAGE_LENGTH) {
  return String(input || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function asFlatText(message) {
  if (message.kind === "text") {
    return message.text || "";
  }

  if (message.kind === "list") {
    const lines = [message.body || ""];
    const sections = Array.isArray(message.sections) ? message.sections : [];

    for (const section of sections) {
      if (section.title) {
        lines.push(`- ${section.title}`);
      }
      const rows = Array.isArray(section.rows) ? section.rows : [];
      for (const row of rows) {
        const label = row.title || "";
        const description = row.description ? `: ${row.description}` : "";
        lines.push(`  ${label}${description}`);
      }
    }

    lines.push("Reply with the option name or number.");
    return lines.filter(Boolean).join("\n");
  }

  if (message.kind === "buttons") {
    const lines = [message.body || "", "Reply with one option:"];
    const buttons = Array.isArray(message.buttons) ? message.buttons : [];
    for (const button of buttons) {
      if (button.title) {
        lines.push(`- ${button.title}`);
      }
    }
    return lines.filter(Boolean).join("\n");
  }

  return "";
}

function toTwiml(messages) {
  const response = new twiml.MessagingResponse();
  for (const message of messages) {
    const text = sanitizeMessageText(asFlatText(message));
    if (text) {
      response.message(text);
    }
  }
  return response.toString();
}

module.exports = {
  toTwiml
};
