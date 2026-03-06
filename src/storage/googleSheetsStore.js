const { google } = require("googleapis");

function isGoogleSheetsEnabled() {
  return Boolean(
    process.env.GOOGLE_SHEETS_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY
  );
}

function createAuthClient() {
  const privateKey = String(process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

async function appendLeadToGoogleSheet(lead) {
  if (!isGoogleSheetsEnabled()) {
    return false;
  }

  const auth = createAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const sheetTab = process.env.GOOGLE_SHEETS_TAB || "Leads";

  const values = [
    [
      lead.timestamp || "",
      lead.leadType || "",
      lead.name || "",
      lead.phone || "",
      lead.businessName || "",
      lead.productInterestedIn || "",
      lead.quantity || "",
      lead.deviceType || "",
      lead.problemDescription || "",
      lead.requirement || "",
      lead.location || "",
      lead.source || "",
      lead.userId || ""
    ]
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetTab}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values }
  });

  return true;
}

module.exports = {
  appendLeadToGoogleSheet,
  isGoogleSheetsEnabled
};
