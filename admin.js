// The admin password
const ADMIN_PASSWORD = "7777"; // Change this to your desired password

function gs_admin_validateAdminPassword(password) {
  return password === ADMIN_PASSWORD;
}

function gs_admin_updateProfile(profile) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Main');
  const data = sheet.getDataRange().getValues();
  
  // Find the row with matching Reg_ID
  const rowIndex = data.findIndex(row => row[0] === profile.Reg_ID);
  
  if (rowIndex === -1) {
    throw new Error('Profile not found');
  }

  // Get the current image link from the sheet
  const currentImageLink = data[rowIndex][17]; // Get existing image link

  // Column mappings (0-based index)
  const updates = [
    { col: 0, value: profile.Reg_ID },      // Reg_ID
    { col: 1, value: profile.District },     // District
    { col: 2, value: profile.Name },         // Name
    { col: 3, value: profile.Age },          // Age
    { col: 4, value: profile.Address },      // Address
    { col: 5, value: profile.NIC },          // NIC
    { col: 6, value: profile.contact },      // Contact
    { col: 7, value: profile.total_children },// Total Children
    { col: 8, value: profile.school_kids },  // School Kids
    { col: 9, value: profile.others },       // Others
    { col: 10, value: profile.Description }, // Description
    { col: 11, value: profile.Occupation },  // Occupation
    { col: 12, value: profile.RF_Loan },     // RF_Loan
    { col: 13, value: profile.RF_Paid_History }, // RF_Paid_History
    { col: 14, value: profile.RF_Cur_Prj },  // RF_Cur_Prj
    { col: 15, value: profile.RF_Date },     // RF_Date
    { col: 16, value: profile.Com_prjs },    // Com_prjs
    { col: 17, value: currentImageLink },    // Image - preserve existing link
    { col: 18, value: profile.GRANT },       // GRANT
    { col: 19, value: profile.GIFor },       // GIFor
    { col: 20, value: profile.GRANT_Cur_Prj },// GRANT_Cur_Prj
    { col: 21, value: profile.GRANT_Date }   // GRANT_Date
  ];

  // Prepare the range and values for batch update
  const range = sheet.getRange(rowIndex + 1, 1, 1, updates.length);
  const values = new Array(updates.length).fill(null);
  
  // Fill in the values array
  updates.forEach((update, index) => {
    values[index] = update.value || ''; // Convert null/undefined to empty string
  });

  // Perform batch update
  range.setValues([values]);

  // Log the update for tracking
  Logger.log(`Profile updated: ${profile.Reg_ID}`);
  Logger.log(`Image link preserved: ${currentImageLink}`);
  
  return true;
}