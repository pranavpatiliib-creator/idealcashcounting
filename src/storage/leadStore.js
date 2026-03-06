const fs = require("fs");
const path = require("path");
const Datastore = require("nedb-promises");
const {
  appendLeadToGoogleSheet,
  isGoogleSheetsEnabled
} = require("./googleSheetsStore");

const dbPath = path.resolve(process.env.LEADS_DB_FILE || "./data/leads.db");
const backupFilePath = path.resolve(process.env.LEADS_BACKUP_FILE || "./data/leads.jsonl");
const MAX_LEAD_JSON_BYTES = Number(process.env.MAX_LEAD_JSON_BYTES || 8192);
const ALLOWED_LEAD_TYPES = new Set(["quotation", "service_request", "sales_contact"]);

const FIELD_LIMITS = {
  source: 40,
  leadType: 40,
  userId: 80,
  phone: 20,
  name: 100,
  businessName: 160,
  productInterestedIn: 180,
  quantity: 16,
  deviceType: 140,
  problemDescription: 400,
  requirement: 260,
  location: 180,
  timestamp: 40
};

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(path.dirname(backupFilePath), { recursive: true });

const leadDb = Datastore.create({
  filename: dbPath,
  autoload: true,
  timestampData: true
});

function sanitizeValue(value, maxLength) {
  const cleaned = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, maxLength);
}

function sanitizeLead(lead) {
  const normalized = {};

  for (const [key, maxLength] of Object.entries(FIELD_LIMITS)) {
    if (lead[key] !== undefined && lead[key] !== null) {
      normalized[key] = sanitizeValue(lead[key], maxLength);
    }
  }

  if (!normalized.timestamp) {
    normalized.timestamp = new Date().toISOString();
  }

  if (!ALLOWED_LEAD_TYPES.has(normalized.leadType)) {
    normalized.leadType = "unknown";
  }

  if (!normalized.source) {
    normalized.source = "unknown";
  }

  return normalized;
}

async function saveLead(lead) {
  const safeLead = sanitizeLead(lead);
  const encodedLead = JSON.stringify(safeLead);
  if (Buffer.byteLength(encodedLead, "utf8") > MAX_LEAD_JSON_BYTES) {
    throw new Error("Lead payload too large");
  }

  const savedLead = await leadDb.insert(safeLead);
  fs.appendFileSync(backupFilePath, `${JSON.stringify(savedLead)}\n`, "utf8");

  if (isGoogleSheetsEnabled()) {
    try {
      await appendLeadToGoogleSheet(savedLead);
    } catch (error) {
      console.error("Google Sheets append failed:", error.message);
    }
  }

  return savedLead;
}

module.exports = {
  saveLead
};
