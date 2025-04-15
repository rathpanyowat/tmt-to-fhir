/**
 * Module for processing SUBS (Substance) data
 */
const path = require('path');
const { readExcelFile, findFiles } = require('../utils/fileUtils');

/**
 * Process SUBS data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processSUBSData(templateJson, tmtDirPath, tmtBonusDirPath) {
  console.log('Processing SUBS data...');
  
  try {
    // Find the Concept directory with SUBS file
    const conceptDir = path.join(tmtBonusDirPath, 'Concept');
    
    // Find the SUBS file
    const subsFilePattern = /^SUBS\d{8}\.xls$/i;
    const subsFiles = findFiles(conceptDir, subsFilePattern);
    
    if (subsFiles.length === 0) {
      throw new Error('SUBS file not found');
    }
    
    const subsFile = subsFiles[0];
    console.log(`Found SUBS file: ${subsFile}`);
    
    // Find relationship files in the Relationship directory
    const relationshipDir = path.join(tmtBonusDirPath, 'Relationship');
    
    // Find specific relationship files for SUBS
    const subsToVtmFile = findRelationshipFile(relationshipDir, 'substovtm');
    
    validateRelationshipFiles(subsToVtmFile);
    
    // Read all necessary files
    const subsRows = readExcelFile(subsFile);
    const subsToVtmRows = readExcelFile(subsToVtmFile);
    
    console.log(`Files loaded:
      - SUBS: ${subsRows.length} rows
      - SUBStoVTM: ${subsToVtmRows.length} rows`);
    
    // Skip the header row if present
    let startIndex = determineStartIndex(subsRows);
    
    // Process each SUBS row
    let processedCount = processSUBSRows(
      templateJson, 
      subsRows, 
      subsToVtmRows, 
      startIndex
    );
    
    console.log(`Added ${processedCount} SUBS concepts to the template`);
  } catch (error) {
    console.error('Error processing SUBS data:', error);
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
 */
function validateRelationshipFiles(subsToVtmFile) {
  if (!subsToVtmFile) {
    throw new Error(`Relationship file not found for SUBS. 
      SUBS->VTM: ${subsToVtmFile ? 'Found' : 'Not found'}`);
  }
  
  console.log(`Found relationship files for SUBS: 
    - SUBStoVTM: ${subsToVtmFile}`);
}

/**
 * Determine the starting index based on header presence
 * @param {Array} rows - The rows from the Excel file
 * @returns {number} The starting index
 */
function determineStartIndex(rows) {
  if (rows.length > 0 && rows[0] && rows[0][0] === 'TMTID(SUBS)') {
    console.log('Header row found, starting from row 1');
    return 1;
  }
  return 0;
}

/**
 * Process SUBS rows and add concepts to the template
 * @param {Object} templateJson - The template to update
 * @param {Array} subsRows - The SUBS data rows
 * @param {Array} subsToVtmRows - The SUBStoVTM relationship rows
 * @param {number} startIndex - The starting index
 * @returns {number} The number of processed concepts
 */
function processSUBSRows(templateJson, subsRows, subsToVtmRows, startIndex) {
  let processedCount = 0;
  
  for (let i = startIndex; i < subsRows.length; i++) {
    if (!subsRows[i] || !subsRows[i][0]) continue; // Skip empty rows
    
    const subsCode = String(subsRows[i][0]);
    const subsDisplay = String(subsRows[i][1] || '');
    
    // Create a new concept entry for SUBS
    const subsConcept = createSUBSConcept(subsCode, subsDisplay);
    
    // Add child relationships (VTM)
    addVTMChildren(subsConcept, subsToVtmRows, subsCode);
    
    // Add the concept to the template
    templateJson.concept.push(subsConcept);
    processedCount++;
    
    // Log progress every 100 items
    if (processedCount % 100 === 0) {
      console.log(`Processed ${processedCount} SUBS concepts...`);
    }
  }
  
  return processedCount;
}

/**
 * Create a SUBS concept object
 * @param {string} subsCode - The SUBS code
 * @param {string} subsDisplay - The SUBS display name
 * @returns {Object} The SUBS concept object
 */
function createSUBSConcept(subsCode, subsDisplay) {
  return {
    code: subsCode,
    display: subsDisplay,
    property: [
      {
        code: "class",
        valueCode: "SUBS"
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
 * Add VTM children relationships to SUBS concept
 * @param {Object} subsConcept - The SUBS concept
 * @param {Array} subsToVtmRows - The SUBStoVTM relationship rows
 * @param {string} subsCode - The SUBS code
 */
function addVTMChildren(subsConcept, subsToVtmRows, subsCode) {
  const vtmChildren = subsToVtmRows.filter(row => 
    row && row.length > 1 && String(row[0]) === subsCode
  );
  
  if (vtmChildren && vtmChildren.length > 0) {
    vtmChildren.forEach(child => {
      subsConcept.property.push({
        code: "child",
        valueCode: String(child[1])
      });
    });
  }
}

module.exports = { processSUBSData }; 