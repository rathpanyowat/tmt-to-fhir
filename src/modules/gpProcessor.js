/**
 * Module for processing GP (Generic Product) data
 */
const path = require('path');
const { readExcelFile, findFiles } = require('../utils/fileUtils');

/**
 * Process GP data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processGPData(templateJson, tmtDirPath, tmtBonusDirPath) {
  console.log('Processing GP data...');
  
  try {
    // Find the Concept directory with GP file
    const conceptDir = path.join(tmtBonusDirPath, 'Concept');
    
    // Find the GP file
    const gpFilePattern = /^GP\d{8}\.xls$/i;
    const gpFiles = findFiles(conceptDir, gpFilePattern);
    
    if (gpFiles.length === 0) {
      throw new Error('GP file not found');
    }
    
    const gpFile = gpFiles[0];
    console.log(`Found GP file: ${gpFile}`);
    
    // Find relationship files in the Relationship directory
    const relationshipDir = path.join(tmtBonusDirPath, 'Relationship');
    
    // Find specific relationship files for GP
    const vtmToGpFile = findRelationshipFile(relationshipDir, 'vtmtogp');
    const gpToTpFile = findRelationshipFile(relationshipDir, 'gptotp');
    const gpToGpuFile = findRelationshipFile(relationshipDir, 'gptogpu');
    
    validateRelationshipFiles(vtmToGpFile, gpToTpFile, gpToGpuFile);
    
    // Read all necessary files
    const gpRows = readExcelFile(gpFile);
    const vtmToGpRows = readExcelFile(vtmToGpFile);
    const gpToTpRows = readExcelFile(gpToTpFile);
    const gpToGpuRows = readExcelFile(gpToGpuFile);
    
    console.log(`Files loaded:
      - GP: ${gpRows.length} rows
      - VTMtoGP: ${vtmToGpRows.length} rows
      - GPtoTP: ${gpToTpRows.length} rows
      - GPtoGPU: ${gpToGpuRows.length} rows`);
    
    // Skip the header row if present
    let startIndex = determineStartIndex(gpRows);
    
    // Process each GP row
    let processedCount = processGPRows(
      templateJson, 
      gpRows, 
      vtmToGpRows, 
      gpToTpRows, 
      gpToGpuRows, 
      startIndex
    );
    
    console.log(`Added ${processedCount} GP concepts to the template`);
  } catch (error) {
    console.error('Error processing GP data:', error);
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
 * @param {string} vtmToGpFile - Path to VTMtoGP file
 * @param {string} gpToTpFile - Path to GPtoTP file
 * @param {string} gpToGpuFile - Path to GPtoGPU file
 */
function validateRelationshipFiles(vtmToGpFile, gpToTpFile, gpToGpuFile) {
  if (!vtmToGpFile || !gpToTpFile || !gpToGpuFile) {
    throw new Error(`One or more relationship files not found for GP. 
      VTM->GP: ${vtmToGpFile ? 'Found' : 'Not found'}
      GP->TP: ${gpToTpFile ? 'Found' : 'Not found'}
      GP->GPU: ${gpToGpuFile ? 'Found' : 'Not found'}`);
  }
  
  console.log(`Found relationship files for GP: 
    - VTMtoGP: ${vtmToGpFile}
    - GPtoTP: ${gpToTpFile}
    - GPtoGPU: ${gpToGpuFile}`);
}

/**
 * Determine the starting index based on header presence
 * @param {Array} rows - The rows from the Excel file
 * @returns {number} The starting index
 */
function determineStartIndex(rows) {
  if (rows.length > 0 && rows[0] && rows[0][0] === 'TMTID(GP)') {
    console.log('Header row found, starting from row 1');
    return 1;
  }
  return 0;
}

/**
 * Process GP rows and add concepts to the template
 * @param {Object} templateJson - The template to update
 * @param {Array} gpRows - The GP data rows
 * @param {Array} vtmToGpRows - The VTMtoGP relationship rows
 * @param {Array} gpToTpRows - The GPtoTP relationship rows
 * @param {Array} gpToGpuRows - The GPtoGPU relationship rows
 * @param {number} startIndex - The starting index
 * @returns {number} The number of processed concepts
 */
function processGPRows(templateJson, gpRows, vtmToGpRows, gpToTpRows, gpToGpuRows, startIndex) {
  let processedCount = 0;
  
  for (let i = startIndex; i < gpRows.length; i++) {
    if (!gpRows[i] || !gpRows[i][0]) continue; // Skip empty rows
    
    const gpCode = String(gpRows[i][0]);
    const gpDisplay = String(gpRows[i][1] || '');
    
    // Create a new concept entry for GP
    const gpConcept = createGPConcept(gpCode, gpDisplay);
    
    // Add parent relationship (VTM)
    addVTMParent(gpConcept, vtmToGpRows, gpCode);
    
    // Add child relationships (TP)
    addTPChildren(gpConcept, gpToTpRows, gpCode);
    
    // Add child relationships (GPU)
    addGPUChildren(gpConcept, gpToGpuRows, gpCode);
    
    // Add the concept to the template
    templateJson.concept.push(gpConcept);
    processedCount++;
    
    // Log progress every 100 items
    if (processedCount % 100 === 0) {
      console.log(`Processed ${processedCount} GP concepts...`);
    }
  }
  
  return processedCount;
}

/**
 * Create a GP concept object
 * @param {string} gpCode - The GP code
 * @param {string} gpDisplay - The GP display name
 * @returns {Object} The GP concept object
 */
function createGPConcept(gpCode, gpDisplay) {
  return {
    code: gpCode,
    display: gpDisplay,
    property: [
      {
        code: "class",
        valueCode: "GP"
      },
      {
        code: "status",
        valueCode: "active"
      },
      {
        code: "abstract",
        valueBoolean: "true"
      }
    ]
  };
}

/**
 * Add VTM parent relationship to GP concept
 * @param {Object} gpConcept - The GP concept
 * @param {Array} vtmToGpRows - The VTMtoGP relationship rows
 * @param {string} gpCode - The GP code
 */
function addVTMParent(gpConcept, vtmToGpRows, gpCode) {
  const vtmParent = vtmToGpRows.find(row => 
    row && row.length > 1 && String(row[1]) === gpCode
  );
  
  if (vtmParent) {
    gpConcept.property.push({
      code: "parent",
      valueCode: String(vtmParent[0])
    });
  }
}

/**
 * Add TP children relationships to GP concept
 * @param {Object} gpConcept - The GP concept
 * @param {Array} gpToTpRows - The GPtoTP relationship rows
 * @param {string} gpCode - The GP code
 */
function addTPChildren(gpConcept, gpToTpRows, gpCode) {
  const tpChildren = gpToTpRows.filter(row => 
    row && row.length > 1 && String(row[0]) === gpCode
  );
  
  if (tpChildren && tpChildren.length > 0) {
    tpChildren.forEach(child => {
      gpConcept.property.push({
        code: "child",
        valueCode: String(child[1])
      });
    });
  }
}

/**
 * Add GPU children relationships to GP concept
 * @param {Object} gpConcept - The GP concept
 * @param {Array} gpToGpuRows - The GPtoGPU relationship rows
 * @param {string} gpCode - The GP code
 */
function addGPUChildren(gpConcept, gpToGpuRows, gpCode) {
  const gpuChildren = gpToGpuRows.filter(row => 
    row && row.length > 1 && String(row[0]) === gpCode
  );
  
  if (gpuChildren && gpuChildren.length > 0) {
    gpuChildren.forEach(child => {
      gpConcept.property.push({
        code: "child",
        valueCode: String(child[1])
      });
    });
  }
}

module.exports = { processGPData }; 