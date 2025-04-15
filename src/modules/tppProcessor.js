/**
 * Module for processing TPP (Trade Product Pack) data
 */
const path = require('path');
const { readExcelFile, findFiles } = require('../utils/fileUtils');

/**
 * Process TPP data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processTPPData(templateJson, tmtDirPath, tmtBonusDirPath) {
  console.log('Processing TPP data...');
  
  try {
    // Find the concept directory for TPP
    const conceptDir = path.join(tmtBonusDirPath, 'Concept');
    
    // Find the TPP concept file
    const tppFile = findConceptFile(conceptDir, 'tpp');
    if (!tppFile) {
      throw new Error('TPP concept file not found');
    }
    console.log(`Found TPP concept file: ${tppFile}`);
    
    // Find relationship files in the Relationship directory
    const relationshipDir = path.join(tmtBonusDirPath, 'Relationship');
    
    // Find specific relationship files for TPP
    const tpuToTppFile = findRelationshipFile(relationshipDir, 'tputotpp');
    const gppToTppFile = findRelationshipFile(relationshipDir, 'gpptotpp');
    const tppToTppFile = findRelationshipFile(relationshipDir, 'tpptotpp');
    
    validateRelationshipFiles(tpuToTppFile, gppToTppFile, tppToTppFile);
    
    // Read all necessary files
    const tppRows = readExcelFile(tppFile);
    const tpuToTppRows = readExcelFile(tpuToTppFile);
    const gppToTppRows = readExcelFile(gppToTppFile);
    const tppToTppRows = readExcelFile(tppToTppFile);
    
    console.log(`Files loaded:
      - TPP Concept: ${tppRows.length} rows
      - TPUtoTPP: ${tpuToTppRows.length} rows
      - GPPtoTPP: ${gppToTppRows.length} rows
      - TPPtoTPP: ${tppToTppRows.length} rows`);
    
    // Skip the header row if present
    let startIndex = determineStartIndex(tppRows);
    
    // Process each TPP row
    let processedCount = processTPPRows(
      templateJson,
      tppRows,
      tpuToTppRows,
      gppToTppRows,
      tppToTppRows,
      startIndex
    );
    
    console.log(`Added ${processedCount} TPP concepts to the template`);
  } catch (error) {
    console.error('Error processing TPP data:', error);
    throw error;
  }
}

/**
 * Find a concept file with a specific pattern
 * @param {string} conceptDir - Path to the concept directory
 * @param {string} pattern - Pattern to match in the filename
 * @returns {string} Path to the found file
 */
function findConceptFile(conceptDir, pattern) {
  const files = findFiles(conceptDir, new RegExp(pattern, 'i'));
  return files.length > 0 ? files[0] : null;
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
 * @param {string} tpuToTppFile - Path to TPUtoTPP file
 * @param {string} gppToTppFile - Path to GPPtoTPP file
 * @param {string} tppToTppFile - Path to TPPtoTPP file
 */
function validateRelationshipFiles(tpuToTppFile, gppToTppFile, tppToTppFile) {
  if (!tpuToTppFile || !gppToTppFile || !tppToTppFile) {
    throw new Error(`One or more relationship files not found for TPP. 
      TPU->TPP: ${tpuToTppFile ? 'Found' : 'Not found'}
      GPP->TPP: ${gppToTppFile ? 'Found' : 'Not found'}
      TPP->TPP: ${tppToTppFile ? 'Found' : 'Not found'}`);
  }
  
  console.log(`Found relationship files for TPP: 
    - TPUtoTPP: ${tpuToTppFile}
    - GPPtoTPP: ${gppToTppFile}
    - TPPtoTPP: ${tppToTppFile}`);
}

/**
 * Determine the starting index based on header presence
 * @param {Array} rows - The rows from the concept file
 * @returns {number} The starting index
 */
function determineStartIndex(rows) {
  if (rows.length > 0 && rows[0] && rows[0][0] === 'TMTID(TPP)') {
    console.log('Header row found, starting from row 1');
    return 1;
  }
  return 0;
}

/**
 * Process TPP rows and add concepts to the template
 * @param {Object} templateJson - The template to update
 * @param {Array} tppRows - The TPP concept rows
 * @param {Array} tpuToTppRows - The TPUtoTPP relationship rows
 * @param {Array} gppToTppRows - The GPPtoTPP relationship rows
 * @param {Array} tppToTppRows - The TPPtoTPP relationship rows
 * @param {number} startIndex - The starting index
 * @returns {number} The number of processed concepts
 */
function processTPPRows(templateJson, tppRows, tpuToTppRows, gppToTppRows, tppToTppRows, startIndex) {
  let processedCount = 0;
  
  for (let i = startIndex; i < tppRows.length; i++) {
    if (!tppRows[i] || !tppRows[i][0]) continue; // Skip empty rows
    
    const tppCode = String(tppRows[i][0]);
    const tppDisplay = String(tppRows[i][1] || '');
    
    // Create a new concept entry for TPP
    const tppConcept = createTPPConcept(tppCode, tppDisplay);
    
    // Add parent relationships
    // 1. TPU parents
    addTPUParents(tppConcept, tpuToTppRows, tppCode);
    
    // 2. GPP parents
    addGPPParents(tppConcept, gppToTppRows, tppCode);
    
    // 3. TPP parents
    addTPPParents(tppConcept, tppToTppRows, tppCode);
    
    // Add child relationships (TPP)
    addTPPChildren(tppConcept, tppToTppRows, tppCode);
    
    // Add the concept to the template
    templateJson.concept.push(tppConcept);
    processedCount++;
    
    // Log progress every 100 items
    if (processedCount % 100 === 0) {
      console.log(`Processed ${processedCount} TPP concepts...`);
    }
  }
  
  return processedCount;
}

/**
 * Create a TPP concept object
 * @param {string} tppCode - The TPP code
 * @param {string} tppDisplay - The TPP display name
 * @returns {Object} The TPP concept object
 */
function createTPPConcept(tppCode, tppDisplay) {
  return {
    code: tppCode,
    display: tppDisplay,
    property: [
      {
        code: "class",
        valueCode: "TPP"
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
 * Add TPU parent relationships to TPP concept
 * @param {Object} tppConcept - The TPP concept
 * @param {Array} tpuToTppRows - The TPUtoTPP relationship rows
 * @param {string} tppCode - The TPP code
 */
function addTPUParents(tppConcept, tpuToTppRows, tppCode) {
  const tpuParents = tpuToTppRows.filter(row => 
    row && row.length > 1 && String(row[1]) === tppCode
  );
  
  if (tpuParents && tpuParents.length > 0) {
    tpuParents.forEach(parent => {
      tppConcept.property.push({
        code: "parent",
        valueCode: String(parent[0])
      });
    });
  }
}

/**
 * Add GPP parent relationships to TPP concept
 * @param {Object} tppConcept - The TPP concept
 * @param {Array} gppToTppRows - The GPPtoTPP relationship rows
 * @param {string} tppCode - The TPP code
 */
function addGPPParents(tppConcept, gppToTppRows, tppCode) {
  const gppParents = gppToTppRows.filter(row => 
    row && row.length > 1 && String(row[1]) === tppCode
  );
  
  if (gppParents && gppParents.length > 0) {
    gppParents.forEach(parent => {
      tppConcept.property.push({
        code: "parent",
        valueCode: String(parent[0])
      });
    });
  }
}

/**
 * Add TPP parent relationships to TPP concept
 * @param {Object} tppConcept - The TPP concept
 * @param {Array} tppToTppRows - The TPPtoTPP relationship rows
 * @param {string} tppCode - The TPP code
 */
function addTPPParents(tppConcept, tppToTppRows, tppCode) {
  const tppParents = tppToTppRows.filter(row => 
    row && row.length > 1 && String(row[1]) === tppCode
  );
  
  if (tppParents && tppParents.length > 0) {
    tppParents.forEach(parent => {
      tppConcept.property.push({
        code: "parent",
        valueCode: String(parent[0])
      });
    });
  }
}

/**
 * Add TPP children relationships to TPP concept
 * @param {Object} tppConcept - The TPP concept
 * @param {Array} tppToTppRows - The TPPtoTPP relationship rows
 * @param {string} tppCode - The TPP code
 */
function addTPPChildren(tppConcept, tppToTppRows, tppCode) {
  const tppChildren = tppToTppRows.filter(row => 
    row && row.length > 1 && String(row[0]) === tppCode && String(row[0]) !== String(row[1])
  );
  
  if (tppChildren && tppChildren.length > 0) {
    tppChildren.forEach(child => {
      tppConcept.property.push({
        code: "child",
        valueCode: String(child[1])
      });
    });
  }
}

module.exports = { processTPPData }; 