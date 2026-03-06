const fs = require("fs");
const path = require("path");
const Datastore = require("nedb-promises");
const {
  appendLeadToGoogleSheet,
  isGoogleSheetsEnabled
} = require("./googleSheetsStore");

const dbPath = path.resolve(process.env.LEADS_DB_FILE || "./data/leads.db");
const backupFilePath = path.resolve(process.env.LEADS_BACKUP_FILE || "./data/leads.jsonl");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(path.dirname(backupFilePath), { recursive: true });

const leadDb = Datastore.create({
  filename: dbPath,
  autoload: true,
  timestampData: true
});

async function saveLead(lead) {
  const savedLead = await leadDb.insert(lead);
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
