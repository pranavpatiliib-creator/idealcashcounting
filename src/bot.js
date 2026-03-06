const SESSION_TTL_MS = 45 * 60 * 1000;
const MAX_INCOMING_TEXT_LENGTH = Number(process.env.MAX_INCOMING_TEXT_LENGTH || 1000);
const MAX_FIELD_LENGTH_DEFAULT = 240;

const CLOSING_MESSAGE =
  "Thank you for contacting IDEAL AUTOMATION. We look forward to serving you.";

const MENU_ROWS = [
  {
    id: "menu_1",
    title: "1) Currency Counting",
    description: "Currency counting machines"
  },
  {
    id: "menu_2",
    title: "2) Fake Note Detect",
    description: "Fake note detectors"
  },
  {
    id: "menu_3",
    title: "3) Billing Machines",
    description: "Billing machines & software"
  },
  {
    id: "menu_4",
    title: "4) Gold Testing",
    description: "Gold testing machines"
  },
  {
    id: "menu_5",
    title: "5) Safes & Lockers",
    description: "Secure storage solutions"
  },
  {
    id: "menu_6",
    title: "6) Service / Repair",
    description: "Raise a service request"
  },
  {
    id: "menu_7",
    title: "7) Contact Us",
    description: "Phone and location details"
  }
];

const SERVICE_FIELDS = [
  { key: "name", prompt: "Please share your Name.", maxLength: 80 },
  { key: "city", prompt: "Please share your City.", maxLength: 120 },
  { key: "machineType", prompt: "Please share Machine Type.", maxLength: 120 },
  { key: "issueDescription", prompt: "Please describe the issue.", maxLength: 320 }
];

function sanitizeUserText(input) {
  return String(input || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(input) {
  return sanitizeUserText(input).toLowerCase();
}

function containsAny(text, values) {
  return values.some((value) => text.includes(value));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesCommandWord(text, value) {
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(value)}(\\s|$)`, "i");
  return pattern.test(text);
}

function buildMainMenu() {
  return {
    kind: "list",
    body: "How can we assist you today?",
    buttonText: "Select Option",
    sections: [{ title: "IDEAL AUTOMATION", rows: MENU_ROWS }],
    footer: "IDEAL AUTOMATION"
  };
}

function getWelcomeMessage() {
  return [
    "Welcome to IDEAL AUTOMATION 👋",
    "Your trusted partner for banking and automation equipment.",
    "",
    "How can we assist you today?",
    "",
    "1️⃣ Currency Counting Machines",
    "2️⃣ Fake Note Detectors",
    "3️⃣ Billing Machines & Software",
    "4️⃣ Gold Testing Machines",
    "5️⃣ Safes & Lockers",
    "6️⃣ Service / Repair Request",
    "7️⃣ Contact Us"
  ].join("\n");
}

function getContactMessage() {
  return [
    "IDEAL AUTOMATION",
    "📍 Ahilyanagar (Ahmednagar), Maharashtra",
    "📞 7020637398"
  ].join("\n");
}

function withClosing(message) {
  return `${message}\n\n${CLOSING_MESSAGE}`;
}

function mapTextToCommand(text) {
  if (!text) return "";

  if (text === "1") return "menu_1";
  if (text === "2") return "menu_2";
  if (text === "3") return "menu_3";
  if (text === "4") return "menu_4";
  if (text === "5") return "menu_5";
  if (text === "6") return "menu_6";
  if (text === "7") return "menu_7";

  if (containsAny(text, ["currency counting", "currency machine"])) return "menu_1";
  if (containsAny(text, ["fake note", "counterfeit"])) return "menu_2";
  if (containsAny(text, ["billing machine", "billing software", "billing"])) return "menu_3";
  if (containsAny(text, ["gold testing", "gold machine"])) return "menu_4";
  if (containsAny(text, ["safe", "locker"])) return "menu_5";
  if (
    containsAny(text, [
      "service",
      "repair",
      "maintenance",
      "issue",
      "problem",
      "not working",
      "breakdown"
    ])
  ) {
    return "menu_6";
  }
  if (containsAny(text, ["contact", "call", "phone", "number"])) return "menu_7";

  if (containsAny(text, ["menu", "home", "start", "restart", "reset"])) return "menu_home";
  return "";
}

function createBot({ saveLead }) {
  if (typeof saveLead !== "function") {
    throw new Error("createBot requires a saveLead function");
  }

  const sessions = new Map();

  function newSession(phone) {
    return {
      updatedAt: Date.now(),
      hasSeenWelcome: false,
      mode: "idle",
      serviceFieldIndex: 0,
      serviceData: {},
      phoneHint: sanitizeUserText(phone).slice(0, 20)
    };
  }

  function getSession(userId, phone) {
    const existing = sessions.get(userId);
    if (!existing) {
      const created = newSession(phone);
      sessions.set(userId, created);
      return created;
    }

    if (Date.now() - existing.updatedAt > SESSION_TTL_MS) {
      const created = newSession(phone);
      sessions.set(userId, created);
      return created;
    }

    existing.updatedAt = Date.now();
    if (!existing.phoneHint) {
      existing.phoneHint = sanitizeUserText(phone).slice(0, 20);
    }
    return existing;
  }

  function resetSession(userId, phone) {
    sessions.set(userId, newSession(phone));
  }

  function showWelcome(session) {
    session.hasSeenWelcome = true;
    session.mode = "idle";
    session.serviceFieldIndex = 0;
    session.serviceData = {};
    return [{ kind: "text", text: getWelcomeMessage() }, buildMainMenu()];
  }

  function startServiceCollection(session) {
    session.mode = "service_collect";
    session.serviceFieldIndex = 0;
    session.serviceData = {};
    session.hasSeenWelcome = true;
    return [{ kind: "text", text: SERVICE_FIELDS[0].prompt }];
  }

  function submitServiceField(session, value) {
    const currentField = SERVICE_FIELDS[session.serviceFieldIndex];
    if (!currentField) return "";

    const cleanValue = sanitizeUserText(value);
    if (!cleanValue) {
      return currentField.prompt;
    }

    const maxLength = Number(currentField.maxLength || MAX_FIELD_LENGTH_DEFAULT);
    if (cleanValue.length > maxLength) {
      return `Please keep your response within ${maxLength} characters.`;
    }

    session.serviceData[currentField.key] = cleanValue;
    session.serviceFieldIndex += 1;

    const nextField = SERVICE_FIELDS[session.serviceFieldIndex];
    return nextField ? nextField.prompt : "";
  }

  async function completeServiceRequest(userId, phone, channel, session) {
    const lead = {
      source: channel === "twilio" ? "twilio_whatsapp" : "whatsapp_business_api",
      leadType: "service_request",
      userId,
      phone,
      timestamp: new Date().toISOString(),
      name: session.serviceData.name || "",
      location: session.serviceData.city || "",
      deviceType: session.serviceData.machineType || "",
      problemDescription: session.serviceData.issueDescription || ""
    };

    await saveLead(lead);

    session.mode = "idle";
    session.serviceFieldIndex = 0;
    session.serviceData = {};

    return [
      {
        kind: "text",
        text: withClosing("Thank you. Our service team will contact you shortly.")
      }
    ];
  }

  function getMenuResponse(commandId, session) {
    if (commandId === "menu_1") {
      return [
        {
          kind: "text",
          text: withClosing(
            [
              "Currency Counting Machines:",
              "- Fast and accurate note counting",
              "- Suitable for banks, shops, and cash counters",
              "- Helps reduce manual counting errors",
              "",
              "Would you like price details or a demo?"
            ].join("\n")
          )
        }
      ];
    }

    if (commandId === "menu_2") {
      return [
        {
          kind: "text",
          text: withClosing(
            [
              "Fake Note Detectors:",
              "- Detect suspicious and counterfeit notes quickly",
              "- Improves cash handling security",
              "- Easy to use at billing and cashier counters"
            ].join("\n")
          )
        }
      ];
    }

    if (commandId === "menu_3") {
      return [
        {
          kind: "text",
          text: withClosing(
            [
              "Billing Machines & Software:",
              "- Suitable for shops and businesses",
              "- Supports faster billing operations",
              "- Helps with daily sales and invoice workflow"
            ].join("\n")
          )
        }
      ];
    }

    if (commandId === "menu_4") {
      return [
        {
          kind: "text",
          text: withClosing(
            [
              "Gold Testing Machines:",
              "- Used by jewellery shops for purity checking",
              "- Reliable and quick testing support",
              "- Helps improve customer trust"
            ].join("\n")
          )
        }
      ];
    }

    if (commandId === "menu_5") {
      return [
        {
          kind: "text",
          text: withClosing(
            [
              "Safes & Lockers:",
              "- Secure storage for cash and important documents",
              "- Suitable for shops, offices, and businesses",
              "- Designed for daily security needs"
            ].join("\n")
          )
        }
      ];
    }

    if (commandId === "menu_6") {
      return startServiceCollection(session);
    }

    if (commandId === "menu_7") {
      return [{ kind: "text", text: withClosing(getContactMessage()) }];
    }

    return [];
  }

  async function handleIncoming({ userId, phone, text, interactiveId, channel = "meta" }) {
    const sanitizedText = sanitizeUserText(text);
    const normalized = normalizeText(sanitizedText);
    const safeInteractiveId = sanitizeUserText(interactiveId).slice(0, 80);
    const session = getSession(userId, phone);

    if (sanitizedText.length > MAX_INCOMING_TEXT_LENGTH) {
      return [
        {
          kind: "text",
          text: `Please keep your message under ${MAX_INCOMING_TEXT_LENGTH} characters.`
        }
      ];
    }

    if (!session.hasSeenWelcome) {
      return showWelcome(session);
    }

    if (isGreetingLike(normalized) || isMenuLike(normalized)) {
      return showWelcome(session);
    }

    const commandId = safeInteractiveId || mapTextToCommand(normalized);

    if (session.mode === "service_collect") {
      if (commandId && (commandId.startsWith("menu_") || commandId === "menu_home")) {
        session.mode = "idle";
        session.serviceFieldIndex = 0;
        session.serviceData = {};

        if (commandId === "menu_home") {
          return showWelcome(session);
        }

        const menuResponse = getMenuResponse(commandId, session);
        if (menuResponse.length > 0) {
          return menuResponse;
        }
      }

      const nextPrompt = submitServiceField(session, sanitizedText);
      if (nextPrompt) {
        return [{ kind: "text", text: nextPrompt }];
      }
      return completeServiceRequest(userId, phone, channel, session);
    }

    if (commandId === "menu_home") {
      return showWelcome(session);
    }

    if (commandId && commandId.startsWith("menu_")) {
      const response = getMenuResponse(commandId, session);
      if (response.length > 0) {
        return response;
      }
    }

    return [
      {
        kind: "text",
        text: "Please choose from options 1 to 7 so we can assist you quickly."
      },
      buildMainMenu()
    ];
  }

  return {
    handleIncoming,
    resetSessionForTests: resetSession,
    _internals: {
      sessions,
      mapTextToCommand,
      buildMainMenu
    }
  };
}

function isGreetingLike(normalizedText) {
  return ["hi", "hello", "hey", "namaste"].some((value) => matchesCommandWord(normalizedText, value));
}

function isMenuLike(normalizedText) {
  return ["menu", "home", "restart", "reset", "start"].some((value) =>
    matchesCommandWord(normalizedText, value)
  );
}

module.exports = {
  createBot
};
