/**
 * Module for processing GPP (Generic Product Pack) data
 */
const path = require('path');
const { readExcelFile, findFiles } = require('../utils/fileUtils');

/**
 * Process GPP data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processGPPData(templateJson, tmtDirPath, tmtBonusDirPath) {
  console.log('Processing GPP data...');
  
  try {
    // Find the Concept directory with GPP file
    const conceptDir = path.join(tmtBonusDirPath, 'Concept');
    
    // Find the GPP file
    const gppFilePattern = /^GPP\d{8}\.xls$/i;
    const gppFiles = findFiles(conceptDir, gppFilePattern);
    
    if (gppFiles.length === 0) {
      throw new Error('GPP file not found');
    }
    
    const gppFile = gppFiles[0];
    console.log(`Found GPP file: ${gppFile}`);
    
    // Find relationship files in the Relationship directory
    const relationshipDir = path.join(tmtBonusDirPath, 'Relationship');
    
    // Find specific relationship files for GPP
    const gpuToGppFile = findRelationshipFile(relationshipDir, 'gputogpp');
    const gppToGppFile = findRelationshipFile(relationshipDir, 'gpptogpp');
    const gppToTppFile = findRelationshipFile(relationshipDir, 'gpptotpp');
    
    validateRelationshipFiles(gpuToGppFile, gppToGppFile, gppToTppFile);
    
    // Read all necessary files
    const gppRows = readExcelFile(gppFile);
    const gpuToGppRows = readExcelFile(gpuToGppFile);
    const gppToGppRows = readExcelFile(gppToGppFile);
    const gppToTppRows = readExcelFile(gppToTppFile);
    
    console.log(`Files loaded:
      - GPP: ${gppRows.length} rows
      - GPUtoGPP: ${gpuToGppRows.length} rows
      - GPPtoGPP: ${gppToGppRows.length} rows
      - GPPtoTPP: ${gppToTppRows.length} rows`);
    
    // Skip the header row if present
    let startIndex = determineStartIndex(gppRows);
    
    // Process each GPP row
    let processedCount = processGPPRows(
      templateJson, 
      gppRows, 
      gpuToGppRows, 
      gppToGppRows, 
      gppToTppRows, 
      startIndex
    );
    
    console.log(`Added ${processedCount} GPP concepts to the template`);
  } catch (error) {
    console.error('Error processing GPP data:', error);
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
 * @param {string} gpuToGppFile - Path to GPUtoGPP file
 * @param {string} gppToGppFile - Path to GPPtoGPP file
 * @param {string} gppToTppFile - Path to GPPtoTPP file
 */
function validateRelationshipFiles(gpuToGppFile, gppToGppFile, gppToTppFile) {
  if (!gpuToGppFile || !gppToGppFile || !gppToTppFile) {
    throw new Error(`One or more relationship files not found for GPP. 
      GPU->GPP: ${gpuToGppFile ? 'Found' : 'Not found'}
      GPP->GPP: ${gppToGppFile ? 'Found' : 'Not found'}
      GPP->TPP: ${gppToTppFile ? 'Found' : 'Not found'}`);
  }
  
  console.log(`Found relationship files for GPP: 
    - GPUtoGPP: ${gpuToGppFile}
    - GPPtoGPP: ${gppToGppFile}
    - GPPtoTPP: ${gppToTppFile}`);
}

/**
 * Determine the starting index based on header presence
 * @param {Array} rows - The rows from the Excel file
 * @returns {number} The starting index
 */
function determineStartIndex(rows) {
  if (rows.length > 0 && rows[0] && rows[0][0] === 'TMTID(GPP)') {
    console.log('Header row found, starting from row 1');
    return 1;
  }
  return 0;
}

/**
 * Process GPP rows and add concepts to the template
 * @param {Object} templateJson - The template to update
 * @param {Array} gppRows - The GPP data rows
 * @param {Array} gpuToGppRows - The GPUtoGPP relationship rows
 * @param {Array} gppToGppRows - The GPPtoGPP relationship rows
 * @param {Array} gppToTppRows - The GPPtoTPP relationship rows
 * @param {number} startIndex - The starting index
 * @returns {number} The number of processed concepts
 */
function processGPPRows(templateJson, gppRows, gpuToGppRows, gppToGppRows, gppToTppRows, startIndex) {
  let processedCount = 0;
  
  for (let i = startIndex; i < gppRows.length; i++) {
    if (!gppRows[i] || !gppRows[i][0]) continue; // Skip empty rows
    
    const gppCode = String(gppRows[i][0]);
    const gppDisplay = String(gppRows[i][1] || '');
    
    // Create a new concept entry for GPP
    const gppConcept = createGPPConcept(gppCode, gppDisplay);
    
    // Add parent relationships (GPU)
    addGPUParents(gppConcept, gpuToGppRows, gppCode);
    
    // Add parent relationships (GPP)
    addGPPParents(gppConcept, gppToGppRows, gppCode);
    
    // Add child relationships (TPP)
    addTPPChildren(gppConcept, gppToTppRows, gppCode);
    
    // Add child relationships (GPP)
    addGPPChildren(gppConcept, gppToGppRows, gppCode);
    
    // Add the concept to the template
    templateJson.concept.push(gppConcept);
    processedCount++;
    
    // Log progress every 100 items
    if (processedCount % 100 === 0) {
      console.log(`Processed ${processedCount} GPP concepts...`);
    }
  }
  
  return processedCount;
}

/**
 * Create a GPP concept object
 * @param {string} gppCode - The GPP code
 * @param {string} gppDisplay - The GPP display name
 * @returns {Object} The GPP concept object
 */
function createGPPConcept(gppCode, gppDisplay) {
  return {
    code: gppCode,
    display: gppDisplay,
    property: [
      {
        code: "class",
        valueCode: "GPP"
      },
      {
        code: "status",
        valueCode: "active"
      },
      {
        code: "abstract",
        valueBoolean: false
      }
    ]
  };
}

/**
 * Add GPU parent relationships to GPP concept
 * @param {Object} gppConcept - The GPP concept
 * @param {Array} gpuToGppRows - The GPUtoGPP relationship rows
 * @param {string} gppCode - The GPP code
 */
function addGPUParents(gppConcept, gpuToGppRows, gppCode) {
  const gpuParents = gpuToGppRows.filter(row => 
    row && row.length > 1 && String(row[1]) === gppCode
  );
  
  if (gpuParents && gpuParents.length > 0) {
    gpuParents.forEach(parent => {
      gppConcept.property.push({
        code: "parent",
        valueCode: String(parent[0])
      });
    });
  }
}

/**
 * Add GPP parent relationships to GPP concept
 * @param {Object} gppConcept - The GPP concept
 * @param {Array} gppToGppRows - The GPPtoGPP relationship rows
 * @param {string} gppCode - The GPP code
 */
function addGPPParents(gppConcept, gppToGppRows, gppCode) {
  const gppParents = gppToGppRows.filter(row => 
    row && row.length > 1 && String(row[1]) === gppCode
  );
  
  if (gppParents && gppParents.length > 0) {
    gppParents.forEach(parent => {
      gppConcept.property.push({
        code: "parent",
        valueCode: String(parent[0])
      });
    });
  }
}

/**
 * Add TPP children relationships to GPP concept
 * @param {Object} gppConcept - The GPP concept
 * @param {Array} gppToTppRows - The GPPtoTPP relationship rows
 * @param {string} gppCode - The GPP code
 */
function addTPPChildren(gppConcept, gppToTppRows, gppCode) {
  const tppChildren = gppToTppRows.filter(row => 
    row && row.length > 1 && String(row[0]) === gppCode
  );
  
  if (tppChildren && tppChildren.length > 0) {
    tppChildren.forEach(child => {
      gppConcept.property.push({
        code: "child",
        valueCode: String(child[1])
      });
    });
  }
}

/**
 * Add GPP children relationships to GPP concept
 * @param {Object} gppConcept - The GPP concept
 * @param {Array} gppToGppRows - The GPPtoGPP relationship rows
 * @param {string} gppCode - The GPP code
 */
function addGPPChildren(gppConcept, gppToGppRows, gppCode) {
  const gppChildren = gppToGppRows.filter(row => 
    row && row.length > 1 && String(row[0]) === gppCode
  );
  
  if (gppChildren && gppChildren.length > 0) {
    gppChildren.forEach(child => {
      gppConcept.property.push({
        code: "child",
        valueCode: String(child[1])
      });
    });
  }
}

module.exports = { processGPPData }; 