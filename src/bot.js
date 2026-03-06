/**
 * IDEAL AUTOMATION — WhatsApp Chatbot Core
 * Handles incoming messages, session management, and lead capture.
 */

"use strict";

// ─── Configuration ────────────────────────────────────────────────────────────

const SESSION_TTL_MS               = 45 * 60 * 1000;
const MAX_INCOMING_TEXT_LENGTH     = Number(process.env.MAX_INCOMING_TEXT_LENGTH || 1000);
const MAX_FIELD_LENGTH_DEFAULT     = 240;
const DUPLICATE_MESSAGE_WINDOW_MS  = Number(process.env.DUPLICATE_MESSAGE_WINDOW_MS || 5000);

// ─── Static Content ───────────────────────────────────────────────────────────

const CLOSING_MESSAGE =
  "Thank you for reaching out to IDEAL AUTOMATION. We look forward to being of service.";

const MENU_ROWS = [
  { id: "menu_1", title: "1) Currency Counting",  description: "Currency counting machines"        },
  { id: "menu_2", title: "2) Fake Note Detection", description: "Fake note detection equipment"    },
  { id: "menu_3", title: "3) Billing Machines",    description: "Billing machines & software"      },
  { id: "menu_4", title: "4) Gold Testing",        description: "Gold purity testing machines"     },
  { id: "menu_5", title: "5) Safes & Lockers",     description: "Secure storage solutions"         },
  { id: "menu_6", title: "6) Service / Repair",    description: "Raise a service request"          },
  { id: "menu_7", title: "7) Contact Us",           description: "Phone and location details"      },
];

const SERVICE_FIELDS = [
  { key: "name",             prompt: "Kindly provide your full name.",                       maxLength: 80  },
  { key: "city",             prompt: "Kindly provide your city or location.",                maxLength: 120 },
  { key: "machineType",      prompt: "Please specify the type of machine requiring service.", maxLength: 120 },
  { key: "issueDescription", prompt: "Please describe the issue in brief.",                  maxLength: 320 },
];

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Strips control characters and collapses whitespace.
 */
function sanitizeUserText(input) {
  return String(input || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns a lowercase, sanitized version of the input for matching.
 */
function normalizeText(input) {
  return sanitizeUserText(input).toLowerCase();
}

/**
 * Returns true if any of the given substrings appear in `text`.
 */
function containsAny(text, values) {
  return values.some((v) => text.includes(v));
}

/**
 * Escapes a string for use in a RegExp.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns true if `value` appears as a whole word within `text`.
 */
function matchesCommandWord(text, value) {
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(value)}(\\s|$)`, "i");
  return pattern.test(text);
}

/**
 * Appends the standard closing line to a message.
 */
function withClosing(message) {
  return `${message}\n\n${CLOSING_MESSAGE}`;
}

// ─── Message Builders ─────────────────────────────────────────────────────────

function getWelcomeMessage() {
  return [
    "Welcome to *IDEAL AUTOMATION* 👋",
    "",
    "We are your trusted partner for banking automation and cash-handling equipment.",
    "Please select an option below so we may assist you promptly.",
    "",
    "1️⃣  Currency Counting Machines",
    "2️⃣  Fake Note Detection Equipment",
    "3️⃣  Billing Machines & Software",
    "4️⃣  Gold Purity Testing Machines",
    "5️⃣  Safes & Lockers",
    "6️⃣  Service / Repair Request",
    "7️⃣  Contact Us",
  ].join("\n");
}

function getContactMessage() {
  return [
    "*IDEAL AUTOMATION*",
    "━━━━━━━━━━━━━━━━━━━━",
    "📍 Ahilyanagar (Ahmednagar), Maharashtra",
    "📞 7020637398",
    "",
    "We are happy to assist you during business hours.",
  ].join("\n");
}

function buildMainMenu() {
  return {
    kind:       "list",
    body:       "How may we assist you today?",
    buttonText: "View Options",
    sections:   [{ title: "IDEAL AUTOMATION — Services", rows: MENU_ROWS }],
    footer:     "IDEAL AUTOMATION",
  };
}

// ─── Command Mapping ──────────────────────────────────────────────────────────

/**
 * Maps normalized free-text input to an internal menu command ID.
 */
function mapTextToCommand(text) {
  if (!text) return "";

  if (text === "1") return "menu_1";
  if (text === "2") return "menu_2";
  if (text === "3") return "menu_3";
  if (text === "4") return "menu_4";
  if (text === "5") return "menu_5";
  if (text === "6") return "menu_6";
  if (text === "7") return "menu_7";

  if (containsAny(text, ["currency counting", "currency machine"]))        return "menu_1";
  if (containsAny(text, ["fake note", "counterfeit"]))                     return "menu_2";
  if (containsAny(text, ["billing machine", "billing software", "billing"])) return "menu_3";
  if (containsAny(text, ["gold testing", "gold machine"]))                 return "menu_4";
  if (containsAny(text, ["safe", "locker"]))                               return "menu_5";
  if (containsAny(text, ["service", "repair", "maintenance", "issue",
                          "problem", "not working", "breakdown"]))         return "menu_6";
  if (containsAny(text, ["contact", "call", "phone", "number"]))           return "menu_7";
  if (containsAny(text, ["menu", "home", "start", "restart", "reset"]))   return "menu_home";

  return "";
}

/**
 * Returns true for greeting-style inputs.
 */
function isGreetingLike(normalizedText) {
  return ["hi", "hello", "hey", "namaste"].some(
    (v) => matchesCommandWord(normalizedText, v)
  );
}

/**
 * Returns true for menu/navigation-style inputs.
 */
function isMenuLike(normalizedText) {
  return ["menu", "home", "restart", "reset", "start"].some(
    (v) => matchesCommandWord(normalizedText, v)
  );
}

// ─── Bot Factory ──────────────────────────────────────────────────────────────

/**
 * Creates and returns a stateful bot instance.
 *
 * @param {{ saveLead: Function }} options
 */
function createBot({ saveLead }) {
  if (typeof saveLead !== "function") {
    throw new Error("createBot requires a `saveLead` function.");
  }

  const sessions = new Map();

  // ── Session Helpers ──────────────────────────────────────────────────────

  function newSession(phone) {
    return {
      updatedAt:            Date.now(),
      hasSeenWelcome:       false,
      mode:                 "idle",
      serviceFieldIndex:    0,
      serviceData:          {},
      phoneHint:            sanitizeUserText(phone).slice(0, 20),
      lastMessageSignature: "",
      lastMessageAt:        0,
    };
  }

  function getSession(userId, phone) {
    const existing = sessions.get(userId);

    if (!existing) {
      const session = newSession(phone);
      sessions.set(userId, session);
      return session;
    }

    // Expire stale sessions
    if (Date.now() - existing.updatedAt > SESSION_TTL_MS) {
      const session = newSession(phone);
      sessions.set(userId, session);
      return session;
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

  // ── Flow Handlers ────────────────────────────────────────────────────────

  function showWelcome(session) {
    session.hasSeenWelcome    = true;
    session.mode              = "idle";
    session.serviceFieldIndex = 0;
    session.serviceData       = {};
    return [{ kind: "text", text: getWelcomeMessage() }];
  }

  function startServiceCollection(session) {
    session.mode              = "service_collect";
    session.serviceFieldIndex = 0;
    session.serviceData       = {};
    session.hasSeenWelcome    = true;
    return [
      {
        kind: "text",
        text: [
          "We will be happy to arrange a service visit for you.",
          "Kindly answer a few brief questions.",
          "",
          SERVICE_FIELDS[0].prompt,
        ].join("\n"),
      },
    ];
  }

  /**
   * Stores the user's response for the current service field and advances
   * to the next field. Returns the next prompt string, or an empty string
   * when all fields have been collected.
   */
  function submitServiceField(session, value) {
    const currentField = SERVICE_FIELDS[session.serviceFieldIndex];
    if (!currentField) return "";

    const cleanValue = sanitizeUserText(value);
    if (!cleanValue) {
      return currentField.prompt;
    }

    const maxLength = Number(currentField.maxLength || MAX_FIELD_LENGTH_DEFAULT);
    if (cleanValue.length > maxLength) {
      return `Your response exceeds the allowed limit of ${maxLength} characters. Please shorten it and try again.`;
    }

    session.serviceData[currentField.key] = cleanValue;
    session.serviceFieldIndex += 1;

    const nextField = SERVICE_FIELDS[session.serviceFieldIndex];
    return nextField ? nextField.prompt : "";
  }

  async function completeServiceRequest(userId, phone, channel, session) {
    const lead = {
      source:             channel === "twilio" ? "twilio_whatsapp" : "whatsapp_business_api",
      leadType:           "service_request",
      userId,
      phone,
      timestamp:          new Date().toISOString(),
      name:               session.serviceData.name             || "",
      location:           session.serviceData.city             || "",
      deviceType:         session.serviceData.machineType      || "",
      problemDescription: session.serviceData.issueDescription || "",
    };

    await saveLead(lead);

    session.mode              = "idle";
    session.serviceFieldIndex = 0;
    session.serviceData       = {};

    return [
      {
        kind: "text",
        text: withClosing(
          "Your service request has been received. Our team will get in touch with you shortly."
        ),
      },
    ];
  }

  /**
   * Returns the response messages for a given menu command.
   */
  function getMenuResponse(commandId, session) {
    switch (commandId) {
      case "menu_1":
        return [
          {
            kind: "text",
            text: withClosing(
              [
                "*Currency Counting Machines*",
                "━━━━━━━━━━━━━━━━━━━━",
                "• High-speed and accurate note counting",
                "• Suitable for banks, retail counters, and cash-intensive businesses",
                "• Significantly reduces manual counting errors",
                "",
                "Would you like pricing details or to schedule a demonstration?",
              ].join("\n")
            ),
          },
        ];

      case "menu_2":
        return [
          {
            kind: "text",
            text: withClosing(
              [
                "*Fake Note Detection Equipment*",
                "━━━━━━━━━━━━━━━━━━━━",
                "• Rapid and reliable identification of counterfeit currency",
                "• Enhances cash-handling security at billing and cashier counters",
                "• Simple to operate with minimal training required",
              ].join("\n")
            ),
          },
        ];

      case "menu_3":
        return [
          {
            kind: "text",
            text: withClosing(
              [
                "*Billing Machines & Software*",
                "━━━━━━━━━━━━━━━━━━━━",
                "• Designed for retail shops and growing businesses",
                "• Enables faster, error-free billing operations",
                "• Supports daily sales tracking and invoice management",
              ].join("\n")
            ),
          },
        ];

      case "menu_4":
        return [
          {
            kind: "text",
            text: withClosing(
              [
                "*Gold Purity Testing Machines*",
                "━━━━━━━━━━━━━━━━━━━━",
                "• Widely used by jewellery shops for accurate purity verification",
                "• Delivers quick and dependable test results",
                "• Helps build customer trust and transparency",
              ].join("\n")
            ),
          },
        ];

      case "menu_5":
        return [
          {
            kind: "text",
            text: withClosing(
              [
                "*Safes & Lockers*",
                "━━━━━━━━━━━━━━━━━━━━",
                "• Robust storage solutions for cash and important documents",
                "• Suitable for shops, offices, and commercial establishments",
                "• Engineered to meet everyday security requirements",
              ].join("\n")
            ),
          },
        ];

      case "menu_6":
        return startServiceCollection(session);

      case "menu_7":
        return [{ kind: "text", text: withClosing(getContactMessage()) }];

      default:
        return [];
    }
  }

  // ── Main Entry Point ─────────────────────────────────────────────────────

  async function handleIncoming({ userId, phone, text, interactiveId, channel = "meta" }) {
    const sanitizedText   = sanitizeUserText(text);
    const normalized      = normalizeText(sanitizedText);
    const safeInteractive = sanitizeUserText(interactiveId).slice(0, 80);
    const session         = getSession(userId, phone);

    // Guard: message too long
    if (sanitizedText.length > MAX_INCOMING_TEXT_LENGTH) {
      return [
        {
          kind: "text",
          text: `Your message exceeds the allowed limit of ${MAX_INCOMING_TEXT_LENGTH} characters. Please shorten it and try again.`,
        },
      ];
    }

    // Guard: duplicate message within the dedup window
    const messageSignature = `${safeInteractive}|${normalized}`;
    const now = Date.now();
    if (
      messageSignature &&
      session.lastMessageSignature === messageSignature &&
      now - session.lastMessageAt <= DUPLICATE_MESSAGE_WINDOW_MS
    ) {
      return [];
    }
    session.lastMessageSignature = messageSignature;
    session.lastMessageAt        = now;

    // First-time visitor
    if (!session.hasSeenWelcome) {
      return showWelcome(session);
    }

    // Greetings and navigation resets
    if (isGreetingLike(normalized) || isMenuLike(normalized)) {
      return showWelcome(session);
    }

    const commandId = safeInteractive || mapTextToCommand(normalized);

    // ── Service collection flow ──────────────────────────────────────────
    if (session.mode === "service_collect") {

      // Allow user to navigate away mid-flow
      if (commandId && (commandId.startsWith("menu_") || commandId === "menu_home")) {
        session.mode              = "idle";
        session.serviceFieldIndex = 0;
        session.serviceData       = {};

        if (commandId === "menu_home") return showWelcome(session);

        const menuResponse = getMenuResponse(commandId, session);
        if (menuResponse.length > 0) return menuResponse;
      }

      const nextPrompt = submitServiceField(session, sanitizedText);
      if (nextPrompt) {
        return [{ kind: "text", text: nextPrompt }];
      }
      return completeServiceRequest(userId, phone, channel, session);
    }

    // ── Standard menu commands ───────────────────────────────────────────
    if (commandId === "menu_home") {
      return showWelcome(session);
    }

    if (commandId && commandId.startsWith("menu_")) {
      const response = getMenuResponse(commandId, session);
      if (response.length > 0) return response;
    }

    // Fallback
    return [
      {
        kind: "text",
        text: "We could not understand your request. Please choose one of the options below so we may assist you.",
      },
      buildMainMenu(),
    ];
  }

  // ── Public API ───────────────────────────────────────────────────────────

  return {
    handleIncoming,
    resetSessionForTests: resetSession,
    _internals: {
      sessions,
      mapTextToCommand,
      buildMainMenu,
    },
  };
}

module.exports = { createBot };