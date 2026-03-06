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

test("first message returns welcome text with 7 options", async () => {
  const savedLeads = [];
  const bot = createTestBot(savedLeads);

  const response = await bot.handleIncoming({
    userId: "u1",
    phone: "919999999999",
    text: "hello"
  });

  assert.equal(response.length, 1);
  assert.equal(response[0].kind, "text");
  assert.match(response[0].text, /Welcome to IDEAL AUTOMATION/i);
  assert.match(response[0].text, /1️⃣ Currency Counting Machines/i);
  assert.match(response[0].text, /7️⃣ Contact Us/i);
});

test("option 1 returns currency machine info with price/demo question", async () => {
  const savedLeads = [];
  const bot = createTestBot(savedLeads);
  const userId = "u2";
  const phone = "919888888888";

  await bot.handleIncoming({ userId, phone, text: "hi" });
  const response = await bot.handleIncoming({ userId, phone, text: "1" });

  assert.equal(response[0].kind, "text");
  assert.match(response[0].text, /Currency Counting Machines/i);
  assert.match(response[0].text, /price details or a demo/i);
  assert.match(response[0].text, /Thank you for contacting IDEAL AUTOMATION/i);
});

test("option 6 collects service request fields and stores lead", async () => {
  const savedLeads = [];
  const bot = createTestBot(savedLeads);
  const userId = "u3";
  const phone = "919777777777";

  await bot.handleIncoming({ userId, phone, text: "hi" });
  const start = await bot.handleIncoming({ userId, phone, text: "6", channel: "twilio" });
  assert.match(start[0].text, /Please share your Name/i);

  const s1 = await bot.handleIncoming({ userId, phone, text: "Ravi", channel: "twilio" });
  assert.match(s1[0].text, /Please share your City/i);

  const s2 = await bot.handleIncoming({ userId, phone, text: "Ahmednagar", channel: "twilio" });
  assert.match(s2[0].text, /Machine Type/i);

  const s3 = await bot.handleIncoming({ userId, phone, text: "Currency Counter", channel: "twilio" });
  assert.match(s3[0].text, /describe the issue/i);

  const done = await bot.handleIncoming({
    userId,
    phone,
    text: "Machine is not counting notes properly",
    channel: "twilio"
  });
  assert.match(done[0].text, /Our service team will contact you shortly/i);
  assert.match(done[0].text, /Thank you for contacting IDEAL AUTOMATION/i);

  assert.equal(savedLeads.length, 1);
  assert.equal(savedLeads[0].leadType, "service_request");
  assert.equal(savedLeads[0].source, "twilio_whatsapp");
  assert.equal(savedLeads[0].name, "Ravi");
  assert.equal(savedLeads[0].location, "Ahmednagar");
  assert.equal(savedLeads[0].deviceType, "Currency Counter");
});

test("option 7 returns contact details with closing message", async () => {
  const savedLeads = [];
  const bot = createTestBot(savedLeads);
  const userId = "u4";
  const phone = "919666666666";

  await bot.handleIncoming({ userId, phone, text: "hi" });
  const response = await bot.handleIncoming({ userId, phone, text: "7" });

  assert.match(response[0].text, /Ahilyanagar \(Ahmednagar\)/i);
  assert.match(response[0].text, /7020637398/i);
  assert.match(response[0].text, /Thank you for contacting IDEAL AUTOMATION/i);
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

test("suppresses duplicate inbound message within short window", async () => {
  const savedLeads = [];
  const bot = createTestBot(savedLeads);
  const payload = {
    userId: "u6",
    phone: "919444444444",
    text: "hello"
  };

  const first = await bot.handleIncoming(payload);
  assert.equal(first.length, 1);

  const second = await bot.handleIncoming(payload);
  assert.equal(second.length, 0);
});
