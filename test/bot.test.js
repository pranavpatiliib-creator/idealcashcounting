const test = require("node:test");
const assert = require("node:assert/strict");

const { createBot } = require("../src/bot");

function createTestBot(savedLeads) {
  return createBot({
    saveLead: async (lead) => {
      savedLeads.push(lead);
    }
  });
}

test("returns welcome and menu list", async () => {
  const savedLeads = [];
  const bot = createTestBot(savedLeads);

  const response = await bot.handleIncoming({
    userId: "u1",
    phone: "919999999999",
    text: "hi"
  });

  assert.equal(response.length, 2);
  assert.equal(response[0].kind, "text");
  assert.match(response[0].text, /IDEAL AUTOMATION/i);
  assert.equal(response[1].kind, "list");
  assert.equal(response[1].sections[0].rows.length, 5);
});

test("quote flow captures required details and stores lead", async () => {
  const savedLeads = [];
  const bot = createTestBot(savedLeads);

  const start = await bot.handleIncoming({
    userId: "u2",
    phone: "919888888888",
    interactiveId: "menu_quote",
    text: ""
  });
  assert.match(start[0].text, /Pricing depends on model and quantity/i);
  assert.match(start[1].text, /Please share your Name/i);

  const nameStep = await bot.handleIncoming({
    userId: "u2",
    phone: "919888888888",
    text: "Pranav Patil"
  });
  assert.match(nameStep[0].text, /Product Interested In/i);

  const productStep = await bot.handleIncoming({
    userId: "u2",
    phone: "919888888888",
    text: "Currency Counting Machine"
  });
  assert.match(productStep[0].text, /Quantity/i);

  const quantityStep = await bot.handleIncoming({
    userId: "u2",
    phone: "919888888888",
    text: "2"
  });
  assert.match(quantityStep[0].text, /Location/i);

  const completed = await bot.handleIncoming({
    userId: "u2",
    phone: "919888888888",
    text: "Ahilyanagar"
  });
  assert.equal(completed[0].kind, "text");
  assert.match(completed[0].text, /quotation request is submitted/i);
  assert.equal(savedLeads.length, 1);
  assert.equal(savedLeads[0].leadType, "quotation");
  assert.equal(savedLeads[0].quantity, "2");
});

test("service flow captures repair details", async () => {
  const savedLeads = [];
  const bot = createTestBot(savedLeads);
  const userId = "u3";
  const phone = "919777777777";

  const start = await bot.handleIncoming({
    userId,
    phone,
    interactiveId: "menu_service",
    text: ""
  });
  assert.match(start[0].text, /repair\/service/i);

  const s1 = await bot.handleIncoming({ userId, phone, text: "Ravi" });
  assert.match(s1[0].text, /Business Name/i);

  const s2 = await bot.handleIncoming({ userId, phone, text: "ABC Retail" });
  assert.match(s2[0].text, /Device Type/i);

  const s3 = await bot.handleIncoming({ userId, phone, text: "CC-100" });
  assert.match(s3[0].text, /Problem/i);

  const s4 = await bot.handleIncoming({ userId, phone, text: "Machine not counting notes" });
  assert.match(s4[0].text, /Location/i);

  const done = await bot.handleIncoming({ userId, phone, text: "Ahmednagar" });
  assert.match(done[0].text, /repair\/service request is submitted/i);
  assert.equal(savedLeads[0].leadType, "service_request");
});

test("twilio text action works for category and lead source is twilio", async () => {
  const savedLeads = [];
  const bot = createTestBot(savedLeads);
  const userId = "u4";
  const phone = "919666666666";

  const p1 = await bot.handleIncoming({
    userId,
    phone,
    interactiveId: "menu_product_info",
    text: "",
    channel: "twilio"
  });
  assert.equal(p1[0].kind, "list");

  const p2 = await bot.handleIncoming({
    userId,
    phone,
    text: "currency counting",
    channel: "twilio"
  });
  assert.equal(p2[1].kind, "buttons");

  const p3 = await bot.handleIncoming({
    userId,
    phone,
    text: "request price",
    channel: "twilio"
  });
  assert.match(p3[0].text, /Pricing depends on model and quantity/i);

  await bot.handleIncoming({ userId, phone, text: "Rakesh", channel: "twilio" });
  await bot.handleIncoming({
    userId,
    phone,
    text: "Currency Counting Machines",
    channel: "twilio"
  });
  await bot.handleIncoming({ userId, phone, text: "1", channel: "twilio" });
  await bot.handleIncoming({ userId, phone, text: "Ahilyanagar", channel: "twilio" });

  assert.equal(savedLeads.length, 1);
  assert.equal(savedLeads[0].source, "twilio_whatsapp");
});

test("rejects oversized incoming messages", async () => {
  const savedLeads = [];
  const bot = createTestBot(savedLeads);
  const veryLongText = "A".repeat(1200);

  const response = await bot.handleIncoming({
    userId: "u5",
    phone: "919555555555",
    text: veryLongText
  });

  assert.match(response[0].text, /Please keep your message under/i);
});
