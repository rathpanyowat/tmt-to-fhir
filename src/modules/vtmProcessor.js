/**
 * Module for processing VTM (Virtual Therapeutic Moiety) data
 */
const path = require('path');
const { readExcelFile, findFiles } = require('../utils/fileUtils');

/**
 * Process VTM data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processVTMData(templateJson, tmtDirPath, tmtBonusDirPath) {
  console.log('Processing VTM data...');
  
  try {
    // Find the Concept directory with VTM file
    const conceptDir = path.join(tmtBonusDirPath, 'Concept');
    
    // Find the VTM file
    const vtmFilePattern = /^VTM\d{8}\.xls$/i;
    const vtmFiles = findFiles(conceptDir, vtmFilePattern);
    
    if (vtmFiles.length === 0) {
      throw new Error('VTM file not found');
    }
    
    const vtmFile = vtmFiles[0];
    console.log(`Found VTM file: ${vtmFile}`);
    
    // Find relationship files in the Relationship directory
    const relationshipDir = path.join(tmtBonusDirPath, 'Relationship');
    
    // Find specific relationship files for VTM
    const subsToVtmFile = findRelationshipFile(relationshipDir, 'substovtm');
    const vtmToGpFile = findRelationshipFile(relationshipDir, 'vtmtogp');
    
    validateRelationshipFiles(subsToVtmFile, vtmToGpFile);
    
    // Read all necessary files
    const vtmRows = readExcelFile(vtmFile);
    const subsToVtmRows = readExcelFile(subsToVtmFile);
    const vtmToGpRows = readExcelFile(vtmToGpFile);
    
    console.log(`Files loaded:
      - VTM: ${vtmRows.length} rows
      - SUBStoVTM: ${subsToVtmRows.length} rows
      - VTMtoGP: ${vtmToGpRows.length} rows`);
    
    // Skip the header row if present
    let startIndex = determineStartIndex(vtmRows);
    
    // Process each VTM row
    let processedCount = processVTMRows(
      templateJson, 
      vtmRows, 
      subsToVtmRows, 
      vtmToGpRows, 
      startIndex
    );
    
    console.log(`Added ${processedCount} VTM concepts to the template`);
  } catch (error) {
    console.error('Error processing VTM data:', error);
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
 * @param {string} subsToVtmFile - Path to SUBStoVTM file
 * @param {string} vtmToGpFile - Path to VTMtoGP file
 */
function validateRelationshipFiles(subsToVtmFile, vtmToGpFile) {
  if (!subsToVtmFile || !vtmToGpFile) {
    throw new Error(`One or more relationship files not found for VTM. 
      SUBS->VTM: ${subsToVtmFile ? 'Found' : 'Not found'}
      VTM->GP: ${vtmToGpFile ? 'Found' : 'Not found'}`);
  }
  
  console.log(`Found relationship files for VTM: 
    - SUBStoVTM: ${subsToVtmFile}
    - VTMtoGP: ${vtmToGpFile}`);
}

/**
 * Determine the starting index based on header presence
 * @param {Array} rows - The rows from the Excel file
 * @returns {number} The starting index
 */
function determineStartIndex(rows) {
  if (rows.length > 0 && rows[0] && rows[0][0] === 'TMTID(VTM)') {
    console.log('Header row found, starting from row 1');
    return 1;
  }
  return 0;
}

/**
 * Process VTM rows and add concepts to the template
 * @param {Object} templateJson - The template to update
 * @param {Array} vtmRows - The VTM data rows
 * @param {Array} subsToVtmRows - The SUBStoVTM relationship rows
 * @param {Array} vtmToGpRows - The VTMtoGP relationship rows
 * @param {number} startIndex - The starting index
 * @returns {number} The number of processed concepts
 */
function processVTMRows(templateJson, vtmRows, subsToVtmRows, vtmToGpRows, startIndex) {
  let processedCount = 0;
  
  for (let i = startIndex; i < vtmRows.length; i++) {
    if (!vtmRows[i] || !vtmRows[i][0]) continue; // Skip empty rows
    
    const vtmCode = String(vtmRows[i][0]);
    const vtmDisplay = String(vtmRows[i][1] || '');
    
    // Create a new concept entry for VTM
    const vtmConcept = createVTMConcept(vtmCode, vtmDisplay);
    
    // Add parent relationship (SUBS)
    addSUBSParents(vtmConcept, subsToVtmRows, vtmCode);
    
    // Add child relationships (GP)
    addGPChildren(vtmConcept, vtmToGpRows, vtmCode);
    
    // Add the concept to the template
    templateJson.concept.push(vtmConcept);
    processedCount++;
    
    // Log progress every 100 items
    if (processedCount % 100 === 0) {
      console.log(`Processed ${processedCount} VTM concepts...`);
    }
  }
  
  return processedCount;
}

/**
 * Create a VTM concept object
 * @param {string} vtmCode - The VTM code
 * @param {string} vtmDisplay - The VTM display name
 * @returns {Object} The VTM concept object
 */
function createVTMConcept(vtmCode, vtmDisplay) {
  return {
    code: vtmCode,
    display: vtmDisplay,
    property: [
      {
        code: "class",
        valueCode: "VTM"
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
 * Add SUBS parent relationships to VTM concept
 * @param {Object} vtmConcept - The VTM concept
 * @param {Array} subsToVtmRows - The SUBStoVTM relationship rows
 * @param {string} vtmCode - The VTM code
 */
function addSUBSParents(vtmConcept, subsToVtmRows, vtmCode) {
  const subsParents = subsToVtmRows.filter(row => 
    row && row.length > 1 && String(row[1]) === vtmCode
  );
  
  if (subsParents && subsParents.length > 0) {
    subsParents.forEach(parent => {
      vtmConcept.property.push({
        code: "parent",
        valueCode: String(parent[0])
      });
    });
  }
}

/**
 * Add GP children relationships to VTM concept
 * @param {Object} vtmConcept - The VTM concept
 * @param {Array} vtmToGpRows - The VTMtoGP relationship rows
 * @param {string} vtmCode - The VTM code
 */
function addGPChildren(vtmConcept, vtmToGpRows, vtmCode) {
  const gpChildren = vtmToGpRows.filter(row => 
    row && row.length > 1 && String(row[0]) === vtmCode
  );
  
  if (gpChildren && gpChildren.length > 0) {
    gpChildren.forEach(child => {
      vtmConcept.property.push({
        code: "child",
        valueCode: String(child[1])
      });
    });
  }
}

module.exports = { processVTMData }; 