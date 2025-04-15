/**
 * Module for processing TPU (Trade Product Unit) data
 */
const path = require('path');
const { readExcelFile, findFiles } = require('../utils/fileUtils');

/**
 * Process TPU data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processTPUData(templateJson, tmtDirPath, tmtBonusDirPath) {
  console.log('Processing TPU data...');
  
  try {
    // Find the snapshot file
    const snapshotPattern = /_SNAPSHOT\.xls$/i;
    const snapshotFiles = findFiles(tmtDirPath, snapshotPattern);
    
    if (snapshotFiles.length === 0) {
      throw new Error('Snapshot file not found');
    }
    
    const snapshotFile = snapshotFiles[0];
    console.log(`Found snapshot file: ${snapshotFile}`);
    
    // Find relationship files in the Relationship directory
    const relationshipDir = path.join(tmtBonusDirPath, 'Relationship');
    
    // Find specific relationship files for TPU
    const gpuToTpuFile = findRelationshipFile(relationshipDir, 'gputotpu');
    const tpToTpuFile = findRelationshipFile(relationshipDir, 'tptotpu');
    const tpuToTppFile = findRelationshipFile(relationshipDir, 'tputotpp');
    
    validateRelationshipFiles(gpuToTpuFile, tpToTpuFile, tpuToTppFile);
    
    // Read all necessary files
    const snapshotRows = readExcelFile(snapshotFile);
    const gpuToTpuRows = readExcelFile(gpuToTpuFile);
    const tpToTpuRows = readExcelFile(tpToTpuFile);
    const tpuToTppRows = readExcelFile(tpuToTppFile);
    
    console.log(`Files loaded:
      - Snapshot: ${snapshotRows.length} rows
      - GPUtoTPU: ${gpuToTpuRows.length} rows
      - TPtoTPU: ${tpToTpuRows.length} rows
      - TPUtoTPP: ${tpuToTppRows.length} rows`);
    
    // Skip the header row if present
    let startIndex = determineStartIndex(snapshotRows);
    
    // Process each TPU row
    let processedCount = processTPURows(
      templateJson,
      snapshotRows,
      gpuToTpuRows,
      tpToTpuRows,
      tpuToTppRows,
      startIndex
    );
    
    console.log(`Added ${processedCount} TPU concepts to the template`);
  } catch (error) {
    console.error('Error processing TPU data:', error);
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
 * @param {string} gpuToTpuFile - Path to GPUtoTPU file
 * @param {string} tpToTpuFile - Path to TPtoTPU file
 * @param {string} tpuToTppFile - Path to TPUtoTPP file
 */
function validateRelationshipFiles(gpuToTpuFile, tpToTpuFile, tpuToTppFile) {
  if (!gpuToTpuFile || !tpToTpuFile || !tpuToTppFile) {
    throw new Error(`One or more relationship files not found for TPU. 
      GPU->TPU: ${gpuToTpuFile ? 'Found' : 'Not found'}
      TP->TPU: ${tpToTpuFile ? 'Found' : 'Not found'}
      TPU->TPP: ${tpuToTppFile ? 'Found' : 'Not found'}`);
  }
  
  console.log(`Found relationship files for TPU: 
    - GPUtoTPU: ${gpuToTpuFile}
    - TPtoTPU: ${tpToTpuFile}
    - TPUtoTPP: ${tpuToTppFile}`);
}

/**
 * Determine the starting index based on header presence
 * @param {Array} rows - The rows from the snapshot file
 * @returns {number} The starting index
 */
function determineStartIndex(rows) {
  if (rows.length > 0 && rows[0] && rows[0][0] === 'TMTID(TPU)') {
    console.log('Header row found, starting from row 1');
    return 1;
  }
  return 0;
}

/**
 * Process TPU rows and add concepts to the template
 * @param {Object} templateJson - The template to update
 * @param {Array} snapshotRows - The snapshot data rows
 * @param {Array} gpuToTpuRows - The GPUtoTPU relationship rows
 * @param {Array} tpToTpuRows - The TPtoTPU relationship rows
 * @param {Array} tpuToTppRows - The TPUtoTPP relationship rows
 * @param {number} startIndex - The starting index
 * @returns {number} The number of processed concepts
 */
function processTPURows(templateJson, snapshotRows, gpuToTpuRows, tpToTpuRows, tpuToTppRows, startIndex) {
  let processedCount = 0;
  
  for (let i = startIndex; i < snapshotRows.length; i++) {
    if (!snapshotRows[i] || !snapshotRows[i][0]) continue; // Skip empty rows
    
    const tpuCode = String(snapshotRows[i][0]);
    const tpuDisplay = String(snapshotRows[i][1] || '');
    
    // Create a new concept entry for TPU
    const tpuConcept = createTPUConcept(tpuCode, tpuDisplay);
    
    // Add parent relationship (GPU)
    addGPUParent(tpuConcept, gpuToTpuRows, tpuCode);
    
    // Add parent relationship (TP)
    addTPParent(tpuConcept, tpToTpuRows, tpuCode);
    
    // Add child relationships (TPP)
    addTPPChildren(tpuConcept, tpuToTppRows, tpuCode);
    
    // Add the concept to the template
    templateJson.concept.push(tpuConcept);
    processedCount++;
    
    // Log progress every 100 items
    if (processedCount % 100 === 0) {
      console.log(`Processed ${processedCount} TPU concepts...`);
    }
  }
  
  return processedCount;
}

/**
 * Create a TPU concept object
 * @param {string} tpuCode - The TPU code
 * @param {string} tpuDisplay - The TPU display name
 * @returns {Object} The TPU concept object
 */
function createTPUConcept(tpuCode, tpuDisplay) {
  return {
    code: tpuCode,
    display: tpuDisplay,
    property: [
      {
        code: "class",
        valueCode: "TPU"
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
 * Add GPU parent relationship to TPU concept
 * @param {Object} tpuConcept - The TPU concept
 * @param {Array} gpuToTpuRows - The GPUtoTPU relationship rows
 * @param {string} tpuCode - The TPU code
 */
function addGPUParent(tpuConcept, gpuToTpuRows, tpuCode) {
  const gpuParent = gpuToTpuRows.find(row => 
    row && row.length > 1 && String(row[1]) === tpuCode
  );
  
  if (gpuParent) {
    tpuConcept.property.push({
      code: "parent",
      valueCode: String(gpuParent[0])
    });
  }
}

/**
 * Add TP parent relationship to TPU concept
 * @param {Object} tpuConcept - The TPU concept
 * @param {Array} tpToTpuRows - The TPtoTPU relationship rows
 * @param {string} tpuCode - The TPU code
 */
function addTPParent(tpuConcept, tpToTpuRows, tpuCode) {
  const tpParent = tpToTpuRows.find(row => 
    row && row.length > 1 && String(row[1]) === tpuCode
  );
  
  if (tpParent) {
    tpuConcept.property.push({
      code: "parent",
      valueCode: String(tpParent[0])
    });
  }
}

/**
 * Add TPP children relationships to TPU concept
 * @param {Object} tpuConcept - The TPU concept
 * @param {Array} tpuToTppRows - The TPUtoTPP relationship rows
 * @param {string} tpuCode - The TPU code
 */
function addTPPChildren(tpuConcept, tpuToTppRows, tpuCode) {
  const tppChildren = tpuToTppRows.filter(row => 
    row && row.length > 1 && String(row[0]) === tpuCode
  );
  
  if (tppChildren && tppChildren.length > 0) {
    tppChildren.forEach(child => {
      tpuConcept.property.push({
        code: "child",
        valueCode: String(child[1])
      });
    });
  }
}

module.exports = { processTPUData }; 