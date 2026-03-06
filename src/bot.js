const SESSION_TTL_MS = 45 * 60 * 1000;

const MENU_ROWS = [
  {
    id: "menu_product_info",
    title: "1) Product Information",
    description: "View product categories"
  },
  {
    id: "menu_quote",
    title: "2) Request Price/Quote",
    description: "Get quotation support"
  },
  {
    id: "menu_service",
    title: "3) Repair/Service",
    description: "Raise service request"
  },
  {
    id: "menu_contact_sales",
    title: "4) Contact Sales Team",
    description: "Talk to sales quickly"
  },
  {
    id: "menu_company_info",
    title: "5) Company Information",
    description: "About IDEAL AUTOMATION"
  }
];

const PRODUCT_CATEGORIES = [
  {
    id: "cat_currency_counting",
    title: "Currency Counting Machines",
    menuTitle: "Currency Counting",
    shortDescription: "Fast and accurate counting for high cash volumes.",
    details:
      "Currency Counting Machines:\n- High speed counting\n- Batch/add modes\n- Suitable for banks, cash offices, and retail counters"
  },
  {
    id: "cat_fake_note_detectors",
    title: "Fake Note Detectors",
    menuTitle: "Fake Note Detector",
    shortDescription: "Quick counterfeit detection with UV/MG/IR checks.",
    details:
      "Fake Note Detectors:\n- Counterfeit detection support\n- Easy operation\n- Useful for retail, banks, and wholesale cash counters"
  },
  {
    id: "cat_billing",
    title: "Billing Machines & Software",
    menuTitle: "Billing & Software",
    shortDescription: "Billing setup for retail and wholesale operations.",
    details:
      "Billing Machines & Software:\n- Fast invoice generation\n- Inventory-friendly workflow\n- Designed for shops, wholesalers, and offices"
  },
  {
    id: "cat_gold_testing",
    title: "Gold Testing Machines",
    menuTitle: "Gold Testing",
    shortDescription: "Reliable purity testing support for jewelers.",
    details:
      "Gold Testing Machines:\n- Accurate purity test support\n- Suitable for jewelry showrooms\n- Helps improve customer confidence"
  },
  {
    id: "cat_safes_lockers",
    title: "Safes & Lockers",
    menuTitle: "Safes & Lockers",
    shortDescription: "Secure storage for cash, valuables, and documents.",
    details:
      "Safes & Lockers:\n- Security-focused storage\n- Multiple size options\n- Suitable for banks, offices, and business premises"
  },
  {
    id: "cat_thermal_rolls",
    title: "Thermal Paper Rolls",
    menuTitle: "Thermal Rolls",
    shortDescription: "Quality thermal rolls for billing/POS printers.",
    details:
      "Thermal Paper Rolls:\n- Clear print output\n- Billing and POS compatibility\n- Consistent quality for daily use"
  }
];

const QUOTE_FIELDS = [
  { key: "name", prompt: "Please share your Name." },
  {
    key: "phone",
    prompt: "Please share your Phone Number.",
    validator: (value) =>
      isValidPhone(value)
        ? ""
        : "Please share a valid Phone Number (10-15 digits, include country code if possible).",
    normalizer: cleanPhone
  },
  { key: "productInterestedIn", prompt: "Please share Product Interested In." },
  {
    key: "quantity",
    prompt: "Please share required Quantity.",
    validator: (value) =>
      Number.isInteger(Number(value)) && Number(value) > 0
        ? ""
        : "Please share a valid Quantity (example: 1, 2, 10).",
    normalizer: (value) => String(Math.trunc(Number(value)))
  },
  { key: "location", prompt: "Please share your Location." }
];

const SERVICE_FIELDS = [
  { key: "name", prompt: "Please share your Name." },
  {
    key: "phone",
    prompt: "Please share your Phone Number.",
    validator: (value) =>
      isValidPhone(value)
        ? ""
        : "Please share a valid Phone Number (10-15 digits, include country code if possible).",
    normalizer: cleanPhone
  },
  { key: "businessName", prompt: "Please share your Business Name." },
  { key: "deviceType", prompt: "Please share Device Type/Model." },
  { key: "problemDescription", prompt: "Please describe the Problem." },
  { key: "location", prompt: "Please share your Location." }
];

const SALES_FIELDS = [
  { key: "name", prompt: "Please share your Name." },
  {
    key: "phone",
    prompt: "Please share your Phone Number.",
    validator: (value) =>
      isValidPhone(value)
        ? ""
        : "Please share a valid Phone Number (10-15 digits, include country code if possible).",
    normalizer: cleanPhone
  },
  { key: "businessName", prompt: "Please share your Business Name." },
  { key: "requirement", prompt: "Please share your requirement briefly." },
  { key: "location", prompt: "Please share your Location." }
];

const FLOW_FIELDS = {
  quote: QUOTE_FIELDS,
  service: SERVICE_FIELDS,
  sales: SALES_FIELDS
};

function normalizeText(input) {
  return String(input || "").trim().toLowerCase();
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

function cleanPhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function isGreeting(text) {
  return ["hi", "hello", "hey", "namaste", "start"].some((value) =>
    matchesCommandWord(text, value)
  );
}

function isMenuRequest(text) {
  return ["menu", "restart", "reset", "home"].some((value) => matchesCommandWord(text, value));
}

function getCategoryById(categoryId) {
  return PRODUCT_CATEGORIES.find((item) => item.id === categoryId) || null;
}

function buildMainMenu() {
  return {
    kind: "list",
    body: "How can we assist you today?",
    buttonText: "Select Option",
    sections: [{ title: "Main Menu", rows: MENU_ROWS }],
    footer: "IDEAL AUTOMATION"
  };
}

function buildCategoryMenu() {
  return {
    kind: "list",
    body: "Please choose a product category:",
    buttonText: "View Categories",
    sections: [
      {
        title: "Products",
        rows: PRODUCT_CATEGORIES.map((item) => ({
          id: item.id,
          title: item.menuTitle || item.title,
          description: item.shortDescription
        }))
      }
    ],
    footer: "Product Information"
  };
}

function buildCategoryActions(categoryId) {
  return {
    kind: "buttons",
    body: "Choose an action:",
    buttons: [
      {
        id: `act_view_${categoryId}`,
        title: "View Details"
      },
      {
        id: `act_quote_${categoryId}`,
        title: "Request Price"
      },
      {
        id: `act_sales_${categoryId}`,
        title: "Talk To Sales"
      }
    ]
  };
}

function buildPostCompletionButtons() {
  return {
    kind: "buttons",
    body: "For faster assistance, connect with our sales team now.",
    buttons: [
      { id: "menu_contact_sales", title: "Contact Sales" },
      { id: "menu_product_info", title: "Products" },
      { id: "menu_home", title: "Main Menu" }
    ]
  };
}

function getWelcomeMessage() {
  return [
    "Hello!",
    "Welcome to IDEAL AUTOMATION.",
    "We provide Currency Counting Machines, Fake Note Detectors, Billing Machines & Software, Gold Testing Machines, Safes & Lockers, and Thermal Paper Rolls."
  ].join("\n");
}

function getCompanyInfoMessage() {
  return [
    "IDEAL AUTOMATION is a trusted sales and service provider in Ahilyanagar (Ahmednagar), Maharashtra.",
    "We support banks, jewelers, retailers, wholesalers, offices, and ATM handlers with automation equipment and after-sales service."
  ].join("\n");
}

function mapTextToCommand(text) {
  if (!text) return "";
  if (text === "1") return "menu_product_info";
  if (text === "2") return "menu_quote";
  if (text === "3") return "menu_service";
  if (text === "4") return "menu_contact_sales";
  if (text === "5") return "menu_company_info";

  if (containsAny(text, ["currency counting"])) return "cat_currency_counting";
  if (containsAny(text, ["fake note"])) return "cat_fake_note_detectors";
  if (containsAny(text, ["billing"])) return "cat_billing";
  if (containsAny(text, ["gold"])) return "cat_gold_testing";
  if (containsAny(text, ["safe", "locker"])) return "cat_safes_lockers";
  if (containsAny(text, ["thermal"])) return "cat_thermal_rolls";

  if (containsAny(text, ["price", "quote", "quotation", "cost", "rate"])) {
    return "menu_quote";
  }

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
    return "menu_service";
  }

  if (containsAny(text, ["sales", "call"])) {
    return "menu_contact_sales";
  }

  if (containsAny(text, ["about", "company", "location", "address"])) {
    return "menu_company_info";
  }

  if (
    containsAny(text, [
      "product",
      "currency",
      "counter",
      "machine",
      "fake note",
      "billing",
      "gold",
      "locker",
      "safe",
      "thermal"
    ])
  ) {
    return "menu_product_info";
  }

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
      mode: "idle",
      flowType: "",
      fieldIndex: 0,
      data: {},
      phoneHint: cleanPhone(phone || "")
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
    if (!existing.phoneHint && isValidPhone(phone)) {
      existing.phoneHint = cleanPhone(phone);
    }
    return existing;
  }

  function resetSession(userId, phone) {
    sessions.set(userId, newSession(phone));
  }

  function startFlow(session, flowType, seedData = {}) {
    session.mode = "collecting";
    session.flowType = flowType;
    session.fieldIndex = 0;
    session.data = { ...seedData };
  }

  function getCurrentField(session) {
    const fields = FLOW_FIELDS[session.flowType] || [];
    return fields[session.fieldIndex] || null;
  }

  function getNextPrompt(session) {
    const fields = FLOW_FIELDS[session.flowType] || [];
    while (session.fieldIndex < fields.length) {
      const field = fields[session.fieldIndex];

      if (field.key === "phone" && session.phoneHint && isValidPhone(session.phoneHint)) {
        session.data.phone = session.phoneHint;
        session.fieldIndex += 1;
        continue;
      }

      if (session.data[field.key]) {
        session.fieldIndex += 1;
        continue;
      }

      return field.prompt;
    }
    return "";
  }

  function submitField(session, rawInput) {
    const field = getCurrentField(session);
    if (!field) return "";

    const value = String(rawInput || "").trim();
    if (!value) {
      return field.prompt;
    }

    if (typeof field.validator === "function") {
      const validationError = field.validator(value);
      if (validationError) {
        return validationError;
      }
    }

    session.data[field.key] =
      typeof field.normalizer === "function" ? field.normalizer(value) : value;
    session.fieldIndex += 1;

    return getNextPrompt(session);
  }

  async function completeFlow(userId, phone, session) {
    const completedFlowType = session.flowType;
    const leadTypeMap = {
      quote: "quotation",
      service: "service_request",
      sales: "sales_contact"
    };

    const lead = {
      source: "whatsapp_business_api",
      leadType: leadTypeMap[session.flowType] || session.flowType,
      userId,
      phone,
      timestamp: new Date().toISOString(),
      ...session.data
    };

    await saveLead(lead);

    const completionMessageByFlow = {
      quote:
        "Thank you. Your quotation request is submitted. Pricing depends on model and quantity. Our sales team will contact you shortly.",
      service:
        "Thank you. Your repair/service request is submitted. Our support team will contact you shortly.",
      sales: "Thank you. Your sales callback request is submitted. Our sales team will contact you shortly."
    };

    session.mode = "idle";
    session.flowType = "";
    session.fieldIndex = 0;
    session.data = {};

    return [
      {
        kind: "text",
        text: completionMessageByFlow[completedFlowType] || "Thank you. Your request is submitted."
      },
      buildPostCompletionButtons()
    ];
  }

  async function routeMenu(session, commandId) {
    if (commandId === "menu_product_info") {
      return [buildCategoryMenu()];
    }

    if (commandId === "menu_quote") {
      startFlow(session, "quote");
      return [
        {
          kind: "text",
          text: "Pricing depends on model and quantity. Please share a few details for quotation."
        },
        { kind: "text", text: getNextPrompt(session) }
      ];
    }

    if (commandId === "menu_service") {
      startFlow(session, "service");
      return [
        {
          kind: "text",
          text: "For repair/service support, please share a few details."
        },
        { kind: "text", text: getNextPrompt(session) }
      ];
    }

    if (commandId === "menu_contact_sales") {
      startFlow(session, "sales");
      return [
        { kind: "text", text: "Please share details and our sales team will contact you quickly." },
        { kind: "text", text: getNextPrompt(session) }
      ];
    }

    if (commandId === "menu_company_info") {
      return [{ kind: "text", text: getCompanyInfoMessage() }, buildMainMenu()];
    }

    return [];
  }

  async function routeCategorySelect(session, categoryId) {
    const category = getCategoryById(categoryId);
    if (!category) return [];

    session.selectedCategory = category.id;

    return [
      {
        kind: "text",
        text: `${category.title}\n${category.shortDescription}`
      },
      buildCategoryActions(category.id)
    ];
  }

  async function routeCategoryAction(session, actionId) {
    const [, actionType, categoryId] = actionId.match(/^act_(view|quote|sales)_(.+)$/) || [];
    if (!actionType || !categoryId) {
      return [];
    }

    const category = getCategoryById(categoryId);
    if (!category) {
      return [{ kind: "text", text: "Please choose a valid product category." }, buildCategoryMenu()];
    }

    if (actionType === "view") {
      return [{ kind: "text", text: category.details }, buildCategoryActions(category.id)];
    }

    if (actionType === "quote") {
      startFlow(session, "quote", { productInterestedIn: category.title });
      return [
        {
          kind: "text",
          text: "Pricing depends on model and quantity. Please share a few details for quotation."
        },
        { kind: "text", text: getNextPrompt(session) }
      ];
    }

    startFlow(session, "sales", { requirement: `Need details for ${category.title}` });
    return [
      { kind: "text", text: "Please share details and our sales team will connect shortly." },
      { kind: "text", text: getNextPrompt(session) }
    ];
  }

  async function handleIncoming({ userId, phone, text, interactiveId }) {
    const normalized = normalizeText(text);
    const session = getSession(userId, phone);

    if (!normalized && !interactiveId) {
      resetSession(userId, phone);
      return [{ kind: "text", text: getWelcomeMessage() }, buildMainMenu()];
    }

    if (isGreeting(normalized) || isMenuRequest(normalized)) {
      resetSession(userId, phone);
      return [{ kind: "text", text: getWelcomeMessage() }, buildMainMenu()];
    }

    const commandId = interactiveId || mapTextToCommand(normalized);

    if (session.mode === "collecting") {
      const isExplicitMenuJump =
        (interactiveId && commandId && commandId.startsWith("menu_")) || isMenuRequest(normalized);

      if (isExplicitMenuJump) {
        session.mode = "idle";
        session.flowType = "";
        session.fieldIndex = 0;
        session.data = {};
        if (commandId && commandId.startsWith("menu_")) {
          return routeMenu(session, commandId);
        }
        return [{ kind: "text", text: getWelcomeMessage() }, buildMainMenu()];
      }

      const prompt = submitField(session, text);
      if (prompt) {
        return [{ kind: "text", text: prompt }];
      }
      return completeFlow(userId, phone, session);
    }

    if (commandId === "menu_home") {
      resetSession(userId, phone);
      return [{ kind: "text", text: getWelcomeMessage() }, buildMainMenu()];
    }

    if (commandId && commandId.startsWith("menu_")) {
      const response = await routeMenu(session, commandId);
      if (response.length > 0) return response;
    }

    if (commandId && commandId.startsWith("cat_")) {
      return routeCategorySelect(session, commandId);
    }

    if (commandId && commandId.startsWith("act_")) {
      return routeCategoryAction(session, commandId);
    }

    return [
      {
        kind: "text",
        text:
          "I can assist with IDEAL AUTOMATION products, quotation, repair/service, and sales support. Please choose an option below."
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
      isValidPhone,
      cleanPhone,
      buildMainMenu,
      buildCategoryMenu
    }
  };
}

module.exports = {
  createBot
};
