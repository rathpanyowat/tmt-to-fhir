/**
 * Module for processing TP (Trade Product) data
 */
const path = require('path');
const { readExcelFile, findFiles } = require('../utils/fileUtils');

/**
 * Process TP data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processTPData(templateJson, tmtDirPath, tmtBonusDirPath) {
  console.log('Processing TP data...');
  
  try {
    // Find the Concept directory with TP file
    const conceptDir = path.join(tmtBonusDirPath, 'Concept');
    
    // Find the TP file
    const tpFilePattern = /^TP\d{8}\.xls$/i;
    const tpFiles = findFiles(conceptDir, tpFilePattern);
    
    if (tpFiles.length === 0) {
      throw new Error('TP file not found');
    }
    
    const tpFile = tpFiles[0];
    console.log(`Found TP file: ${tpFile}`);
    
    // Find relationship files in the Relationship directory
    const relationshipDir = path.join(tmtBonusDirPath, 'Relationship');
    
    // Find specific relationship files for TP
    const gpToTpFile = findRelationshipFile(relationshipDir, 'gptotp');
    const tpToTpuFile = findRelationshipFile(relationshipDir, 'tptotpu');
    
    validateRelationshipFiles(gpToTpFile, tpToTpuFile);
    
    // Read all necessary files
    const tpRows = readExcelFile(tpFile);
    const gpToTpRows = readExcelFile(gpToTpFile);
    const tpToTpuRows = readExcelFile(tpToTpuFile);
    
    console.log(`Files loaded:
      - TP: ${tpRows.length} rows
      - GPtoTP: ${gpToTpRows.length} rows
      - TPtoTPU: ${tpToTpuRows.length} rows`);
    
    // Skip the header row if present
    let startIndex = determineStartIndex(tpRows);
    
    // Process each TP row
    let processedCount = processTPRows(
      templateJson,
      tpRows,
      gpToTpRows,
      tpToTpuRows,
      startIndex
    );
    
    console.log(`Added ${processedCount} TP concepts to the template`);
  } catch (error) {
    console.error('Error processing TP data:', error);
    throw error;
  }
}

/**
 * Find a relationship file with a specific pattern
 * @param {string} relationshipDir - Path to the relationship directory
 * @param {string} pattern - Pattern to match in the filename
 * @returns {string} Path to the found file
 */
function findRelationshipFile(relationshipDir, pattern) {
  const files = findFiles(relationshipDir, new RegExp(pattern, 'i'));
  return files.length > 0 ? files[0] : null;
}

/**
 * Validate that all required relationship files were found
 * @param {string} gpToTpFile - Path to GPtoTP file
 * @param {string} tpToTpuFile - Path to TPtoTPU file
 */
function validateRelationshipFiles(gpToTpFile, tpToTpuFile) {
  if (!gpToTpFile || !tpToTpuFile) {
    throw new Error(`One or more relationship files not found for TP. 
      GP->TP: ${gpToTpFile ? 'Found' : 'Not found'}
      TP->TPU: ${tpToTpuFile ? 'Found' : 'Not found'}`);
  }
  
  console.log(`Found relationship files for TP: 
    - GPtoTP: ${gpToTpFile}
    - TPtoTPU: ${tpToTpuFile}`);
}

/**
 * Determine the starting index based on header presence
 * @param {Array} rows - The rows from the Excel file
 * @returns {number} The starting index
 */
function determineStartIndex(rows) {
  if (rows.length > 0 && rows[0] && rows[0][0] === 'TMTID(TP)') {
    console.log('Header row found, starting from row 1');
    return 1;
  }
  return 0;
}

/**
 * Process TP rows and add concepts to the template
 * @param {Object} templateJson - The template to update
 * @param {Array} tpRows - The TP data rows
 * @param {Array} gpToTpRows - The GPtoTP relationship rows
 * @param {Array} tpToTpuRows - The TPtoTPU relationship rows
 * @param {number} startIndex - The starting index
 * @returns {number} The number of processed concepts
 */
function processTPRows(templateJson, tpRows, gpToTpRows, tpToTpuRows, startIndex) {
  let processedCount = 0;
  
  for (let i = startIndex; i < tpRows.length; i++) {
    if (!tpRows[i] || !tpRows[i][0]) continue; // Skip empty rows
    
    const tpCode = String(tpRows[i][0]);
    const tpDisplay = String(tpRows[i][1] || '');
    
    // Create a new concept entry for TP
    const tpConcept = createTPConcept(tpCode, tpDisplay);
    
    // Add parent relationship (GP)
    addGPParent(tpConcept, gpToTpRows, tpCode);
    
    // Add child relationships (TPU)
    addTPUChildren(tpConcept, tpToTpuRows, tpCode);
    
    // Add the concept to the template
    templateJson.concept.push(tpConcept);
    processedCount++;
    
    // Log progress every 100 items
    if (processedCount % 100 === 0) {
      console.log(`Processed ${processedCount} TP concepts...`);
    }
  }
  
  return processedCount;
}

/**
 * Create a TP concept object
 * @param {string} tpCode - The TP code
 * @param {string} tpDisplay - The TP display name
 * @returns {Object} The TP concept object
 */
function createTPConcept(tpCode, tpDisplay) {
  return {
    code: tpCode,
    display: tpDisplay,
    property: [
      {
        code: "class",
        valueCode: "TP"
      },
      {
        code: "status",
        valueCode: "active"
      },
      {
        code: "abstract",
        valueBoolean: "false"
      }
    ]
  };
}

/**
 * Add GP parent relationship to TP concept
 * @param {Object} tpConcept - The TP concept
 * @param {Array} gpToTpRows - The GPtoTP relationship rows
 * @param {string} tpCode - The TP code
 */
function addGPParent(tpConcept, gpToTpRows, tpCode) {
  const gpParent = gpToTpRows.find(row => 
    row && row.length > 1 && String(row[1]) === tpCode
  );
  
  if (gpParent) {
    tpConcept.property.push({
      code: "parent",
      valueCode: String(gpParent[0])
    });
  }
}

/**
 * Add TPU children relationships to TP concept
 * @param {Object} tpConcept - The TP concept
 * @param {Array} tpToTpuRows - The TPtoTPU relationship rows
 * @param {string} tpCode - The TP code
 */
function addTPUChildren(tpConcept, tpToTpuRows, tpCode) {
  const tpuChildren = tpToTpuRows.filter(row => 
    row && row.length > 1 && String(row[0]) === tpCode
  );
  
  if (tpuChildren && tpuChildren.length > 0) {
    tpuChildren.forEach(child => {
      tpConcept.property.push({
        code: "child",
        valueCode: String(child[1])
      });
    });
  }
}

module.exports = { processTPData }; 