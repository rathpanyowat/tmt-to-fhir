/**
 * Module for processing GPU (Generic Product Use) data
 */
const path = require('path');
const { readExcelFile, findFiles } = require('../utils/fileUtils');

/**
 * Process GPU data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processGPUData(templateJson, tmtDirPath, tmtBonusDirPath) {
  console.log('Processing GPU data...');
  
  try {
    // Find the Concept directory with GPU file
    const conceptDir = path.join(tmtBonusDirPath, 'Concept');
    
    // Find the GPU file
    const gpuFilePattern = /^GPU\d{8}\.xls$/i;
    const gpuFiles = findFiles(conceptDir, gpuFilePattern);
    
    if (gpuFiles.length === 0) {
      throw new Error('GPU file not found');
    }
    
    const gpuFile = gpuFiles[0];
    console.log(`Found GPU file: ${gpuFile}`);
    
    // Find relationship files in the Relationship directory
    const relationshipDir = path.join(tmtBonusDirPath, 'Relationship');
    
    // Find specific relationship files for GPU
    const gpToGpuFile = findRelationshipFile(relationshipDir, 'gptogpu');
    const gpuToTpuFile = findRelationshipFile(relationshipDir, 'gputotpu');
    const gpuToGppFile = findRelationshipFile(relationshipDir, 'gputogpp');
    
    validateRelationshipFiles(gpToGpuFile, gpuToTpuFile, gpuToGppFile);
    
    // Read all necessary files
    const gpuRows = readExcelFile(gpuFile);
    const gpToGpuRows = readExcelFile(gpToGpuFile);
    const gpuToTpuRows = readExcelFile(gpuToTpuFile);
    const gpuToGppRows = readExcelFile(gpuToGppFile);
    
    console.log(`Files loaded:
      - GPU: ${gpuRows.length} rows
      - GPtoGPU: ${gpToGpuRows.length} rows
      - GPUtoTPU: ${gpuToTpuRows.length} rows
      - GPUtoGPP: ${gpuToGppRows.length} rows`);
    
    // Skip the header row if present
    let startIndex = determineStartIndex(gpuRows);
    
    // Process each GPU row
    let processedCount = processGPURows(
      templateJson, 
      gpuRows, 
      gpToGpuRows, 
      gpuToTpuRows, 
      gpuToGppRows, 
      startIndex
    );
    
    console.log(`Added ${processedCount} GPU concepts to the template`);
  } catch (error) {
    console.error('Error processing GPU data:', error);
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
 * @param {string} gpToGpuFile - Path to GPtoGPU file
 * @param {string} gpuToTpuFile - Path to GPUtoTPU file
 * @param {string} gpuToGppFile - Path to GPUtoGPP file
 */
function validateRelationshipFiles(gpToGpuFile, gpuToTpuFile, gpuToGppFile) {
  if (!gpToGpuFile || !gpuToTpuFile || !gpuToGppFile) {
    throw new Error(`One or more relationship files not found for GPU. 
      GP->GPU: ${gpToGpuFile ? 'Found' : 'Not found'}
      GPU->TPU: ${gpuToTpuFile ? 'Found' : 'Not found'}
      GPU->GPP: ${gpuToGppFile ? 'Found' : 'Not found'}`);
  }
  
  console.log(`Found relationship files for GPU: 
    - GPtoGPU: ${gpToGpuFile}
    - GPUtoTPU: ${gpuToTpuFile}
    - GPUtoGPP: ${gpuToGppFile}`);
}

/**
 * Determine the starting index based on header presence
 * @param {Array} rows - The rows from the Excel file
 * @returns {number} The starting index
 */
function determineStartIndex(rows) {
  if (rows.length > 0 && rows[0] && rows[0][0] === 'TMTID(GPU)') {
    console.log('Header row found, starting from row 1');
    return 1;
  }
  return 0;
}

/**
 * Process GPU rows and add concepts to the template
 * @param {Object} templateJson - The template to update
 * @param {Array} gpuRows - The GPU data rows
 * @param {Array} gpToGpuRows - The GPtoGPU relationship rows
 * @param {Array} gpuToTpuRows - The GPUtoTPU relationship rows
 * @param {Array} gpuToGppRows - The GPUtoGPP relationship rows
 * @param {number} startIndex - The starting index
 * @returns {number} The number of processed concepts
 */
function processGPURows(templateJson, gpuRows, gpToGpuRows, gpuToTpuRows, gpuToGppRows, startIndex) {
  let processedCount = 0;
  
  for (let i = startIndex; i < gpuRows.length; i++) {
    if (!gpuRows[i] || !gpuRows[i][0]) continue; // Skip empty rows
    
    const gpuCode = String(gpuRows[i][0]);
    const gpuDisplay = String(gpuRows[i][1] || '');
    
    // Create a new concept entry for GPU
    const gpuConcept = createGPUConcept(gpuCode, gpuDisplay);
    
    // Add parent relationships (GP)
    addGPParents(gpuConcept, gpToGpuRows, gpuCode);
    
    // Add child relationships (TPU)
    addTPUChildren(gpuConcept, gpuToTpuRows, gpuCode);
    
    // Add child relationships (GPP)
    addGPPChildren(gpuConcept, gpuToGppRows, gpuCode);
    
    // Add the concept to the template
    templateJson.concept.push(gpuConcept);
    processedCount++;
    
    // Log progress every 100 items
    if (processedCount % 100 === 0) {
      console.log(`Processed ${processedCount} GPU concepts...`);
    }
  }
  
  return processedCount;
}

/**
 * Create a GPU concept object
 * @param {string} gpuCode - The GPU code
 * @param {string} gpuDisplay - The GPU display name
 * @returns {Object} The GPU concept object
 */
function createGPUConcept(gpuCode, gpuDisplay) {
  return {
    code: gpuCode,
    display: gpuDisplay,
    property: [
      {
        code: "class",
        valueCode: "GPU"
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
 * Add GP parent relationships to GPU concept
 * @param {Object} gpuConcept - The GPU concept
 * @param {Array} gpToGpuRows - The GPtoGPU relationship rows
 * @param {string} gpuCode - The GPU code
 */
function addGPParents(gpuConcept, gpToGpuRows, gpuCode) {
  const gpParents = gpToGpuRows.filter(row => 
    row && row.length > 1 && String(row[1]) === gpuCode
  );
  
  if (gpParents && gpParents.length > 0) {
    gpParents.forEach(parent => {
      gpuConcept.property.push({
        code: "parent",
        valueCode: String(parent[0])
      });
    });
  }
}

/**
 * Add TPU children relationships to GPU concept
 * @param {Object} gpuConcept - The GPU concept
 * @param {Array} gpuToTpuRows - The GPUtoTPU relationship rows
 * @param {string} gpuCode - The GPU code
 */
function addTPUChildren(gpuConcept, gpuToTpuRows, gpuCode) {
  const tpuChildren = gpuToTpuRows.filter(row => 
    row && row.length > 1 && String(row[0]) === gpuCode
  );
  
  if (tpuChildren && tpuChildren.length > 0) {
    tpuChildren.forEach(child => {
      gpuConcept.property.push({
        code: "child",
        valueCode: String(child[1])
      });
    });
  }
}

/**
 * Add GPP children relationships to GPU concept
 * @param {Object} gpuConcept - The GPU concept
 * @param {Array} gpuToGppRows - The GPUtoGPP relationship rows
 * @param {string} gpuCode - The GPU code
 */
function addGPPChildren(gpuConcept, gpuToGppRows, gpuCode) {
  const gppChildren = gpuToGppRows.filter(row => 
    row && row.length > 1 && String(row[0]) === gpuCode
  );
  
  if (gppChildren && gppChildren.length > 0) {
    gppChildren.forEach(child => {
      gpuConcept.property.push({
        code: "child",
        valueCode: String(child[1])
      });
    });
  }
}

module.exports = { processGPUData }; 