// ============================================================
// WebCraft AI — Google Sheets Logger
// ============================================================
// HOW TO SET UP (5 minutes):
//
// 1. Go to sheets.google.com → create a new spreadsheet
// 2. Name the first sheet "Leads"
// 3. Add these headers in row 1:
//    A1: Date  B1: Name  C1: Business Type  D1: Phone  E1: Email  F1: City
//
// 4. Click Extensions → Apps Script
// 5. Delete all existing code, paste THIS entire file
// 6. Click Save (floppy disk icon)
// 7. Click Deploy → New Deployment
//    - Type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 8. Click Deploy → Authorize → Allow
// 9. Copy the Web App URL (looks like https://script.google.com/macros/s/ABC.../exec)
//
// 10. In Vercel → Settings → Environment Variables → add:
//     Name:  GOOGLE_SHEET_URL
//     Value: (paste the URL from step 9)
//
// 11. Redeploy on Vercel
//
// Done! Every website built on WebCraft will now appear as a new row in your sheet.
// ============================================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Leads') || ss.getActiveSheet();

    // Add headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Date', 'Name', 'Business Type', 'Phone', 'Email', 'City']);
      sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    }

    // Format date nicely
    const date = new Date(data.date || new Date());
    const formatted = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm');

    // Append the new lead row
    sheet.appendRow([
      formatted,
      data.name     || '—',
      data.type     || '—',
      data.phone    || '—',
      data.email    || '—',
      data.location || '—',
    ]);

    // Auto-resize columns
    sheet.autoResizeColumns(1, 6);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function — run this manually in Apps Script to verify it works
function test() {
  doPost({
    postData: {
      contents: JSON.stringify({
        name: 'Test Business',
        type: 'Restaurant / Cafe',
        phone: '+91 98000 00000',
        email: 'test@test.com',
        location: 'Mumbai',
        date: new Date().toISOString(),
      })
    }
  });
}
