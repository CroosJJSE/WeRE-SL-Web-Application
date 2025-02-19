function getDistrictFromRegID(regID) {
  // District mapping based on RegID prefix
  const districtMapping = {
    "MAN": "Mannar", "COL": "Colombo", "BAT": "Batticaloa", "GAM": "Gampaha", "KAL": "Kalutara",
    "KAN": "Kandy", "KUR": "Kurunegala", "JAF": "Jaffna", "VAV": "Vavuniya", "TRI": "Trincomalee",
    "MTR": "Matara", "HAM": "Hambantota", "MON": "Monaragala", "ANU": "Anuradhapura", "POL": "Polonnaruwa",
    "PUT": "Puttalam", "RAT": "Ratnapura", "NUW": "Nuwara Eliya", "BAD": "Badulla", "KEG": "Kegalle",
    "MUL": "Mullaitivu", "MTL": "Matale", "AMP": "Ampara", "KIL": "Kilinochchi", "GAE": "Galle"
  };

  // Extract the first 3 characters of the RegID
  const districtPrefix = regID.substring(0, 3).toUpperCase();

  // Return the corresponding district or "Unknown" if not found
  return districtMapping[districtPrefix] || "Unknown";
}

function getDistrictCodeFromName(districtName) {
  const districtCodes = {
    "Mannar": "MAN", "Colombo": "COL", "Batticaloa": "BAT", "Gampaha": "GAM", 
    "Kalutara": "KAL", "Kandy": "KAN", "Kurunegala": "KUR", "Jaffna": "JAF", 
    "Vavuniya": "VAV", "Trincomalee": "TRI", "Matara": "MTR", "Hambantota": "HAM", 
    "Monaragala": "MON", "Anuradhapura": "ANU", "Polonnaruwa": "POL", "Puttalam": "PUT", 
    "Ratnapura": "RAT", "Nuwara Eliya": "NUW", "Badulla": "BAD", "Kegalle": "KEG", 
    "Mullaitivu": "MUL", "Matale": "MTL", "Ampara": "AMP", "Kilinochchi": "KIL", 
    "Galle": "GAE"
  };
  return districtCodes[districtName] || "UNK"; // Default to UNK if not found
}

function extractFileId(url) {
  const match = url.match(/\/d\/(.+?)(\/|$)/) || url.match(/id=([^&]+)/);
  return match ? match[1] : null;
}



function onRFGIFReturnSubmit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetReturn = ss.getSheetByName("RF_GIF_Return");
  const sheetMain = ss.getSheetByName("Main");
  const returnData = sheetReturn.getDataRange().getValues();
  const mainData = sheetMain.getDataRange().getValues();

  logToSheet("RF_GIF_Return", "Info", `Processing ${returnData.length - 1} entries`);

  const today = new Date();
  const formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "dd-MM-yyyy");

  for (let i = 1; i < returnData.length; i++) {
    const row = returnData[i];
    const regId = row[2];
    const type = row[3];
    const details = row[4];
    let Paid_amount = parseFloat(row[5]) || 0;

    // Skip row if it's already processed (check for "Valid" or "Invalid" in the status column)
    const status = row[0]; // Assuming status is in column 1
    if (status === "Valid" || status === "Invalid") {
      logToSheet("RF_GIF_Return", "Info", `Row ${i}: RegID ${regId} already processed. Skipping.`);
      continue;
    }

    logToSheet("RF_GIF_Return", "Processing", `Row ${i}: RegID ${regId}, Type: ${type}, Amount: ${Paid_amount}`);

    let isValid = false;
    let mainRowIndex = -1;

    // Find matching RegID in main sheet
    for (let j = 2; j < mainData.length; j++) {
      if (mainData[j][0] === regId) {
        isValid = true;
        mainRowIndex = j;
        break;
      }
    }

    const validCell = sheetReturn.getRange(i + 1, 1); // Assuming column 1 holds the status
    if (isValid) {
      validCell.setValue("Valid").setFontColor("green");
      logToSheet("RF_GIF_Return", "Info", `Valid RegID found: ${regId}`);

      if (type === "RF") {
        // Update RF_Paid_History (column 14, index 13) with date
        const currentPaidHistory = mainData[mainRowIndex][13] || "";
        const paidEntry = `${Paid_amount} [${formattedDate}]`;
        const newPaidHistory = currentPaidHistory ? `${currentPaidHistory} + ${paidEntry}` : paidEntry;
        sheetMain.getRange(mainRowIndex + 1, 14).setValue(newPaidHistory);
        Logger.log(`Updated RF_Paid_History for RegID ${regId}: ${newPaidHistory}`);

        // Process RF_Cur_Prj (column 15, index 14)
        let currentProjects = mainData[mainRowIndex][14] || "";
        Logger.log(`Current RF_Cur_Prj for RegID ${regId}: ${currentProjects}`);

        let updatedProjects = [];
        let completedProjects = [];

        if (currentProjects) {
          const projects = currentProjects.split(/\s*\+\s*/g).map(p => {
            const match = p.match(/^([^\d()]+)\s*\(\s*([\d,]+)\s*\)$/);
            if (match) {
              return {
                name: match[1].trim(),
                Prj_remainingAmount: parseFloat(match[2].replace(/,/g, "")) // Remove commas before parsing
              };
            }
            return null;
          }).filter(p => p); // Remove null values

          Logger.log(`Extracted Projects for RegID ${regId}: ${JSON.stringify(projects)}`);

          for (let project of projects) {
            Logger.log(`Checking Project ${project.name} with Remaining Amount: ${project.Prj_remainingAmount}, Paid_amount: ${Paid_amount}`);

            if (Paid_amount > 0) {
              if (project.Prj_remainingAmount <= Paid_amount) {
                completedProjects.push(project.name); // Mark as completed
                Paid_amount -= project.Prj_remainingAmount;
                Logger.log(`Project ${project.name} completed! Remaining Paid_amount: ${Paid_amount}`);
              } else {
                project.Prj_remainingAmount -= Paid_amount;
                Paid_amount = 0;
                updatedProjects.push(`${project.name} (${project.Prj_remainingAmount})`);
                Logger.log(`Updated ${project.name} Remaining Amount: ${project.Prj_remainingAmount}`);
              }
            } else {
              updatedProjects.push(`${project.name} (${project.Prj_remainingAmount})`);
            }
          }
        }

        // **Remove duplicates properly**
        let uniqueUpdatedProjects = [...new Set(updatedProjects)]; // Ensure no duplicates
        let finalUpdatedProjects = uniqueUpdatedProjects.join(" + ");
        sheetMain.getRange(mainRowIndex + 1, 15).setValue(finalUpdatedProjects);
        Logger.log(`Final RF_Cur_Prj for RegID ${regId}: ${finalUpdatedProjects}`);

        // **Update Com_prjs (column 17, index 16)**
        if (completedProjects.length > 0) {
          const currentCompleted = mainData[mainRowIndex][16] || "";
          const newCompleted = currentCompleted
            ? `${currentCompleted}, ${completedProjects.join(", ")}`
            : completedProjects.join(", ");
          sheetMain.getRange(mainRowIndex + 1, 17).setValue(newCompleted);
          Logger.log(`Updated Com_prjs for RegID ${regId}: ${newCompleted}`);
        }

        } else if (type === "GRANT") {
          // Update GIFor (column 20, index 19)
          const currentGIFor = mainData[mainRowIndex][19] || "";
          const newGIFor = currentGIFor ? `${currentGIFor} + ${details} [${formattedDate}]` : `${details} [${formattedDate}]`;
          sheetMain.getRange(mainRowIndex + 1, 20).setValue(newGIFor);
          Logger.log(`Updated GIFor for RegID ${regId}: ${newGIFor}`);
        }

    } else {
      validCell.setValue("Invalid").setFontColor("red");
      Logger.log(`Invalid RegID: ${regId} at row ${i + 1}`);
      logToSheet("RF_GIF_Return", "Error", `Invalid RegID: ${regId} at row ${i + 1}`);
    }
  }
}




// function onLoanInitFormSubmit() {
//   const ss = SpreadsheetApp.getActiveSpreadsheet();
//   const sheetLoanInit = ss.getSheetByName("Loan_INIT");
//   const sheetMain = ss.getSheetByName("Main");
//   const data = sheetLoanInit.getDataRange().getValues();
//   const mainData = sheetMain.getDataRange().getValues();

//   logToSheet("Loan_INIT", "Info", `Processing ${data.length - 1} entries`);

//   // Column indices for Loan_INIT
//   const statusCol = 0, timestampCol = 1, registeredCol = 2, mainRegIdCol  = 3, nameCol = 4;
//   const ageCol = 5, mainNicCol = 6, phoneCol = 7, districtCol = 8, addressCol = 9;
//   const totalChildrenCol = 10, schoolKidsCol = 11, othersCol = 12, descriptionCol = 13;
//   const industryCol = 14, loanTypeCol = 15, amountCol = 16, purposeCol = 17, pictureCol = 18;

//   // Process only unprocessed rows (if status is empty or "Pending")
//   for (let i = 1; i < data.length; i++) {
//     const row = data[i];
//     const registered = row[registeredCol];
//     const range = sheetLoanInit.getRange(i + 1, 1); // Adjusted to match the row

//     // Only process if the row is unprocessed
//     if (range.getValue() !== "Valid" && range.getValue() !== "Error") {
//       logToSheet("Loan_INIT", "Processing", `Processing row ${i}: Registered=${registered}`);

//       if (registered === "Yes") {
//         // Process registered users
//         const regId = row[mainRegIdCol];
//         let isValid = false;

//         for (let j = 1; j < mainData.length; j++) {
//           if (mainData[j][0] === regId) {
//             isValid = true;
//             const mainRow = j + 1;
//             const loanType = row[loanTypeCol];
//             const amount = parseFloat(row[amountCol]) || 0;
//             const purpose = (row[purposeCol] || "").toString();

//             // Update loan date
//             const timestamp = row[timestampCol];
//             const date = formatDate(timestamp);

//             try {
//               if (loanType === "RF") {
//                 // Update RF loan
//                 let existingRFLoan = (sheetMain.getRange(mainRow, 13).getValue() || "").toString();
//                 const formattedLoan = `${purpose} (${amount.toLocaleString()}) [${date}]`;
//                 let existingEntries = existingRFLoan ? existingRFLoan.split(" + ").filter(Boolean) : [];
//                 if (!existingEntries.includes(formattedLoan)) {
//                   existingEntries.push(formattedLoan);
//                 }
//                 const finalRFLoan = existingEntries.join(" + ");
//                 sheetMain.getRange(mainRow, 13).setValue(finalRFLoan);
//                 logToSheet("Loan_INIT", "Info", `Updated RF Loan for ${regId}: ${finalRFLoan}`);

//                 // Update RF_Cur_Prj
//                 let existingRFPrj = (sheetMain.getRange(mainRow, 15).getValue() || "").toString();
//                 const formattedPrj = `${purpose} (${amount.toLocaleString()})`;
//                 let rfPrjEntries = existingRFPrj ? existingRFPrj.split(" + ").filter(Boolean) : [];
//                 if (!rfPrjEntries.includes(formattedPrj)) {
//                   rfPrjEntries.push(formattedPrj);
//                 }
//                 const finalRFPrj = rfPrjEntries.join(" + ");
//                 sheetMain.getRange(mainRow, 15).setValue(finalRFPrj);
//                 logToSheet("Loan_INIT", "Info", `Updated RF Cur Prj for ${regId}: ${finalRFPrj}`);

//                 // Update RF Date
//                 sheetMain.getRange(mainRow, 16).setValue(date);
//               } else if (loanType === "GRANT") {
//                 // Update GRANT loan
//                 const currentGrant = parseFloat(sheetMain.getRange(mainRow, 19).getValue()) || 0;
//                 sheetMain.getRange(mainRow, 19).setValue(currentGrant + amount);

//                 // Update GRANT_Cur_Prj
//                 let existingGrantPrj = (sheetMain.getRange(mainRow, 21).getValue() || "").toString();
//                 const formattedGrantPurpose = `${purpose} (${amount.toLocaleString()}) [${date}]`;
//                 const finalGrantPrj = existingGrantPrj ? `${existingGrantPrj} + ${formattedGrantPurpose}` : formattedGrantPurpose;
//                 sheetMain.getRange(mainRow, 21).setValue(finalGrantPrj);
//                 logToSheet("Loan_INIT", "Info", `Updated GRANT for ${regId}: ${finalGrantPrj}`);

//                 // Update GRANT Date
//                 sheetMain.getRange(mainRow, 22).setValue(date);
//               }

//               range.setValue("Valid").setFontColor("green");
//               logToSheet("Loan_INIT", "Success", `Successfully processed ${loanType} for ${regId}`);
//             } catch (error) {
//               range.setValue("Error").setFontColor("red");
//               logToSheet("Loan_INIT", "Error", `Error processing ${regId}: ${error.toString()}`);
//             }
//             break;
//           }
//         }

//         if (!isValid) {
//           range.setValue("Invalid").setFontColor("red");
//           logToSheet("Loan_INIT", "Error", `Invalid RegID: ${regId}`);
//         }
//       } else if (registered === "No") {
//         // Process new registrations (similar logic)
//         const nic = row[mainNicCol];
//         let isNicValid = true;

//         for (let j = 1; j < mainData.length; j++) {
//           if (mainData[j][mainNicCol] === nic) {
//             isNicValid = false;
//             break;
//           }
//         }

//         if (!isNicValid) {
//           range.setValue("Invalid").setFontColor("red");
//           continue;
//         }

//         // Generate new RegID
//         const districtName = row[districtCol];
//         const districtCode = getDistrictCodeFromName(districtName);

//         const existingRegIDs = mainData.slice(1)
//           .filter(row => row[mainRegIdCol].startsWith(districtCode))
//           .map(row => parseInt(row[mainRegIdCol].replace(districtCode, ""), 10));

//         const nextID = existingRegIDs.length > 0 ? Math.max(...existingRegIDs) + 1 : 1;
//         const newRegId = `${districtCode}${nextID.toString().padStart(3, '0')}`;

//         // Prepare new Main entry
//         const loanType = row[loanTypeCol];
//         const amount = row[amountCol] || 0;
//         const purpose = row[purposeCol] || "";
//         const timestamp = row[timestampCol];
//         const date = formatDate(timestamp);

//         const newRow = [
//           newRegId, districtName, row[nameCol], row[ageCol], row[addressCol],
//           nic, row[phoneCol], row[totalChildrenCol], row[schoolKidsCol], row[othersCol],
//           row[descriptionCol], row[industryCol],
//           loanType === "RF" ? amount : 0, "", loanType === "RF" ? purpose : "",
//           "", row[pictureCol], loanType === "GRANT" ? amount : 0, "",
//           loanType === "GRANT" ? purpose : "", date
//         ];

//         sheetMain.appendRow(newRow);
//         sheetLoanInit.getRange(i + 1, mainRegIdCol  + 1).setValue(newRegId);
//         range.setValue("Valid").setFontColor("green");
//       }
//     }
//   }
// }

// Helper function to format date as DD-MM-YYYY
function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}





function getAdminPageUrl() {
  return ScriptApp.getService().getUrl() + '?page=admin';
}

function doGet(e) {
  if (e.parameter.page === 'admin') {
    return HtmlService.createHtmlOutputFromFile('admin')
      .setTitle('Admin Panel')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('WeRE SL')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function getAllProfiles() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Main');

  if (!sheet) {
    Logger.log("Sheet 'Main' not found!");
    logToSheet("System", "Error", "Sheet 'Main' not found!");
    return [];
  }

  const data = sheet.getDataRange().getValues();
  Logger.log("Total rows including headers: " + data.length);

  if (data.length < 3) {
    Logger.log("No data available after skipping title and headers.");
    return [];
  }

  // Skip the first two rows (titles and headers)
  const rowData = data.slice(2);

  const result = rowData.map((row, index) => {
    let grantDate = row[21];
    let rfDate = row[15]; // RF_Date

    // Convert to Date if it's a string
    if (typeof grantDate === "string") {
      grantDate = new Date(grantDate);
    }
    if (typeof rfDate === "string") {
      rfDate = new Date(rfDate);
    }

    // Format if valid Date object
    if (grantDate instanceof Date && !isNaN(grantDate)) {
      grantDate = Utilities.formatDate(grantDate, Session.getScriptTimeZone(), "dd-MM-yyyy");
    } else {
      grantDate = ""; // Handle invalid dates
    }

    if (rfDate instanceof Date && !isNaN(rfDate)) {
      rfDate = Utilities.formatDate(rfDate, Session.getScriptTimeZone(), "dd-MM-yyyy");
    } else {
      rfDate = ""; // Handle invalid dates
    }

    const formattedRow = {
      Reg_ID: row[0],
      District: row[1],
      Name: row[2],
      Age: row[3],
      Address: row[4],
      NIC: row[5],
      contact: row[6],
      total_children: row[7],
      school_kids: row[8],
      others: row[9],
      Description: row[10],
      Occupation: row[11],
      RF_Loan: row[12],
      RF_Paid_History: row[13],
      RF_Cur_Prj: row[14],
      RF_Date: rfDate,
      Com_prjs: row[16],
      Image: row[17],
      GRANT: row[18],
      GIFor: row[19],
      GRANT_Cur_Prj: row[20],
      GRANT_Date: grantDate
    };

    Logger.log("Formatted Data for row " + (index + 3) + ": " + JSON.stringify(formattedRow));

    return formattedRow;
  });

  return result; // Ensure the function returns the processed data
}







function setupLoggingSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let loggingSheet = ss.getSheetByName("System_Logs");
  
  if (!loggingSheet) {
    loggingSheet = ss.insertSheet("System_Logs");
    loggingSheet.getRange("A1:D1").setValues([["Timestamp", "Form", "Status", "Details"]]);
    loggingSheet.setFrozenRows(1);
    loggingSheet.getRange("A1:D1").setBackground("#d9ead3");
    
    // Set column widths for better readability
    loggingSheet.setColumnWidth(1, 150);  // Timestamp
    loggingSheet.setColumnWidth(2, 120);  // Form
    loggingSheet.setColumnWidth(3, 100);  // Status
    loggingSheet.setColumnWidth(4, 400);  // Details
  }
  
  return loggingSheet;
}

function logToSheet(formName, status, details) {
  const loggingSheet = setupLoggingSheet();
  const timestamp = new Date();
  
  // Insert new row after header
  loggingSheet.insertRowAfter(1);
  const newRow = loggingSheet.getRange("A2:D2");
  
  // Set values
  newRow.setValues([[timestamp, formName, status, details]]);
  
  // Color coding based on status
  let statusColor = "#ffffff"; // default white
  switch(status.toLowerCase()) {
    case "error":
      statusColor = "#f4cccc"; // light red
      break;
    case "completed":
      statusColor = "#d9ead3"; // light green
      break;
    case "processing":
      statusColor = "#fff2cc"; // light yellow
      break;
  }
  newRow.setBackground(statusColor);
  
  // Also log to console
  Logger.log(`${formName}: ${status} - ${details}`);
}

// Trigger setup
function createFormTriggers() {
  // Clear existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // Create new trigger for form submissions
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
  
  logToSheet("System", "Completed", "Form triggers created successfully");
}

// Main form submission handler
function onFormSubmit(e) {
  if (!e) {
    logToSheet("Unknown", "Error", "No event object received");
    return;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = e.range.getSheet();
  const activeSheetName = activeSheet.getName();
  
  logToSheet(activeSheetName, "Started", "Form submission received");
  
  try {
    if (activeSheetName === "RF_GIF_Return") {
      logToSheet("RF_GIF_Return", "Processing", "Starting RF/GIF Return form processing");
      onRFGIFReturnSubmit();
      logToSheet("RF_GIF_Return", "Completed", "Successfully processed RF/GIF Return form");
    } 
    else if (activeSheetName === "Loan_INIT") {
      logToSheet("Loan_INIT", "Processing", "Starting Loan Init form processing");
      onLoanInitFormSubmit();
      logToSheet("Loan_INIT", "Completed", "Successfully processed Loan Init form");
    } 
    else {
      logToSheet(activeSheetName, "Error", "Unknown form type");
    }
  } catch (error) {
    logToSheet(activeSheetName, "Error", `Error processing form: ${error.toString()}`);
    throw error;
  }
}

function cleanOldLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const loggingSheet = ss.getSheetByName("System_Logs");
  
  if (!loggingSheet) return;
  
  const data = loggingSheet.getDataRange().getValues();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Keep header row and delete old logs
  const rowsToDelete = [];
  for (let i = data.length - 1; i > 0; i--) {
    if (new Date(data[i][0]) < thirtyDaysAgo) {
      rowsToDelete.push(i + 1);
    }
  }
  
  // Delete rows in batches
  rowsToDelete.forEach(row => {
    loggingSheet.deleteRow(row);
  });
}


function onLoanInitFormSubmit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetLoanInit = ss.getSheetByName("Loan_INIT");
  const sheetMain = ss.getSheetByName("Main");
  const data = sheetLoanInit.getDataRange().getValues();
  const mainData = sheetMain.getDataRange().getValues();

  logToSheet("Loan_INIT", "Info", `Processing ${data.length - 1} entries`);

  // Column indices for Loan_INIT
  const statusCol = 0, timestampCol = 1, registeredCol = 2, mainRegIdCol = 3, nameCol = 4;
  const ageCol = 5, mainNicCol = 6, phoneCol = 7, districtCol = 8, addressCol = 9;
  const totalChildrenCol = 10, schoolKidsCol = 11, othersCol = 12, descriptionCol = 13;
  const industryCol = 14, loanTypeCol = 15, amountCol = 16, purposeCol = 17, pictureCol = 18;

  // Process only unprocessed rows (if status is empty or "Pending")
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const registered = row[registeredCol];
    const range = sheetLoanInit.getRange(i + 1, 1);

    // Only process if the row is unprocessed
    if (range.getValue() !== "Valid" && range.getValue() !== "Error") {
      logToSheet("Loan_INIT", "Processing", `Processing row ${i}: Registered=${registered}`);

      if (registered === "Yes") {
        // Process registered users
        const regId = String(row[mainRegIdCol] || ''); // Convert to string and handle null/undefined
        let isValid = false;

        for (let j = 1; j < mainData.length; j++) {
          if (mainData[j][0] === regId) {
            isValid = true;
            const mainRow = j + 1;
            const loanType = row[loanTypeCol];
            const amount = parseFloat(row[amountCol]) || 0;
            const purpose = (row[purposeCol] || "").toString();

            // Update loan date
            const timestamp = row[timestampCol];
            const date = formatDate(timestamp);

            try {
              if (loanType === "RF") {
                // Update RF loan
                let existingRFLoan = (sheetMain.getRange(mainRow, 13).getValue() || "").toString();
                const formattedLoan = `${purpose} (${amount.toLocaleString()}) [${date}]`;
                let existingEntries = existingRFLoan ? existingRFLoan.split(" + ").filter(Boolean) : [];
                if (!existingEntries.includes(formattedLoan)) {
                  existingEntries.push(formattedLoan);
                }
                const finalRFLoan = existingEntries.join(" + ");
                sheetMain.getRange(mainRow, 13).setValue(finalRFLoan);
                logToSheet("Loan_INIT", "Info", `Updated RF Loan for ${regId}: ${finalRFLoan}`);

                // Update RF_Cur_Prj
                let existingRFPrj = (sheetMain.getRange(mainRow, 15).getValue() || "").toString();
                const formattedPrj = `${purpose} (${amount.toLocaleString()})`;
                let rfPrjEntries = existingRFPrj ? existingRFPrj.split(" + ").filter(Boolean) : [];
                if (!rfPrjEntries.includes(formattedPrj)) {
                  rfPrjEntries.push(formattedPrj);
                }
                const finalRFPrj = rfPrjEntries.join(" + ");
                sheetMain.getRange(mainRow, 15).setValue(finalRFPrj);
                logToSheet("Loan_INIT", "Info", `Updated RF Cur Prj for ${regId}: ${finalRFPrj}`);

                // Update RF Date
                sheetMain.getRange(mainRow, 16).setValue(date);
              } else if (loanType === "GRANT") {
                // Update GRANT loan
                const currentGrant = parseFloat(sheetMain.getRange(mainRow, 19).getValue()) || 0;
                sheetMain.getRange(mainRow, 19).setValue(currentGrant + amount);

                // Update GRANT_Cur_Prj
                let existingGrantPrj = (sheetMain.getRange(mainRow, 21).getValue() || "").toString();
                const formattedGrantPurpose = `${purpose} (${amount.toLocaleString()}) [${date}]`;
                const finalGrantPrj = existingGrantPrj ? `${existingGrantPrj} + ${formattedGrantPurpose}` : formattedGrantPurpose;
                sheetMain.getRange(mainRow, 21).setValue(finalGrantPrj);
                logToSheet("Loan_INIT", "Info", `Updated GRANT for ${regId}: ${finalGrantPrj}`);

                // Update GRANT Date
                sheetMain.getRange(mainRow, 22).setValue(date);
              }

              range.setValue("Valid").setFontColor("green");
              logToSheet("Loan_INIT", "Success", `Successfully processed ${loanType} for ${regId}`);
            } catch (error) {
              range.setValue("Error").setFontColor("red");
              logToSheet("Loan_INIT", "Error", `Error processing ${regId}: ${error.toString()}`);
            }
            break;
          }
        }

        if (!isValid) {
          range.setValue("Invalid").setFontColor("red");
          logToSheet("Loan_INIT", "Error", `Invalid RegID: ${regId}`);
        }
      } else if (registered === "No") {
        // Process new registrations
        const nic = row[mainNicCol];
        let isNicValid = true;

        for (let j = 1; j < mainData.length; j++) {
          if (mainData[j][mainNicCol] === nic) {
            isNicValid = false;
            break;
          }
        }

        if (!isNicValid) {
          range.setValue("Invalid").setFontColor("red");
          logToSheet("Loan_INIT", "Error", `NIC already exists: ${nic}`);
          continue;
        }

        // Generate new RegID
        const districtName = row[districtCol];
        const districtCode = getDistrictCodeFromName(districtName);
        
        if (!districtCode) {
          range.setValue("Invalid").setFontColor("red");
          logToSheet("Loan_INIT", "Error", `Invalid district name: ${districtName}`);
          continue;
        }

        // Filter and convert RegIDs to string before using startsWith
        const existingRegIDs = mainData.slice(1)
          .map(row => String(row[0] || '')) // Convert to string and handle null/undefined
          .filter(regId => regId.startsWith(districtCode))
          .map(regId => parseInt(regId.replace(districtCode, ""), 10))
          .filter(id => !isNaN(id)); // Filter out any NaN values

        const nextID = existingRegIDs.length > 0 ? Math.max(...existingRegIDs) + 1 : 1;
        const newRegId = `${districtCode}${nextID.toString().padStart(3, '0')}`;

        try {
          // Prepare new Main entry
          const loanType = row[loanTypeCol];
          const amount = parseFloat(row[amountCol]) || 0;
          const purpose = (row[purposeCol] || "").toString();
          const timestamp = row[timestampCol];
          const date = formatDate(timestamp);

          const newRow = [
            newRegId,
            districtName,
            row[nameCol],
            row[ageCol],
            row[addressCol],
            nic,
            row[phoneCol],
            row[totalChildrenCol],
            row[schoolKidsCol],
            row[othersCol],
            row[descriptionCol],
            row[industryCol],
            loanType === "RF" ? amount : 0,
            "",
            loanType === "RF" ? purpose : "",
            "",
            row[pictureCol],
            loanType === "GRANT" ? amount : 0,
            "",
            loanType === "GRANT" ? purpose : "",
            date
          ];

          sheetMain.appendRow(newRow);
          sheetLoanInit.getRange(i + 1, mainRegIdCol + 1).setValue(newRegId);
          range.setValue("Valid").setFontColor("green");
          logToSheet("Loan_INIT", "Success", `Successfully created new registration: ${newRegId}`);
        } catch (error) {
          range.setValue("Error").setFontColor("red");
          logToSheet("Loan_INIT", "Error", `Error creating new registration: ${error.toString()}`);
        }
      }
    }
  }
}



function combineTextInMainTab() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Main");
  var lastRow = sheet.getLastRow();
  var tData = sheet.getRange("T2:T" + lastRow).getValues(); // Get data from column T
  var sData = sheet.getRange("S2:S" + lastRow).getValues(); // Get data from column S
  
  var combinedData = [];
  
  for (var i = 0; i < tData.length; i++) {
    var tValue = tData[i][0].toString().trim();
    var sValue = sData[i][0].toString().trim();
    if (tValue || sValue) {
      combinedData.push([tValue + " (" + sValue + ")"]); // Format: Tcol_data (S_col_data)
    } else {
      combinedData.push([""]); // Leave empty if both are empty
    }
  }
  
  sheet.getRange("S2:S" + lastRow).setValues(combinedData); // Output to column S
}

