/**
 * Module for processing GPP (Generic Product Pack) data
 */
const BaseProcessor = require('./BaseProcessor');
const { readExcelFile } = require('../utils/fileUtils');

class GPPProcessor extends BaseProcessor {
  /**
   * Constructor for the GPPProcessor
   */
  constructor() {
    super('GPP');
  }

  /**
   * Find relationship files with specific patterns
   * @param {string} relationshipDir - Path to the relationship directory
   * @returns {Object} Object with paths to found files
   */
  findRelationshipFiles(relationshipDir) {
    return {
      gpuToGpp: this.findRelationshipFile(relationshipDir, 'gputogpp'),
      gppToGpp: this.findRelationshipFile(relationshipDir, 'gpptogpp'),
      gppToTpp: this.findRelationshipFile(relationshipDir, 'gpptotpp')
    };
  }

  /**
   * Validate that all required relationship files were found
   * @param {Object} relationshipFiles - Object with paths to relationship files
   */
  validateRelationshipFiles(relationshipFiles) {
    if (!relationshipFiles.gpuToGpp || !relationshipFiles.gppToGpp || !relationshipFiles.gppToTpp) {
      throw new Error(`One or more relationship files not found for GPP. 
        GPU->GPP: ${relationshipFiles.gpuToGpp ? 'Found' : 'Not found'}
        GPP->GPP: ${relationshipFiles.gppToGpp ? 'Found' : 'Not found'}
        GPP->TPP: ${relationshipFiles.gppToTpp ? 'Found' : 'Not found'}`);
    }
    
    console.log(`Found relationship files for GPP: 
      - GPUtoGPP: ${relationshipFiles.gpuToGpp}
      - GPPtoGPP: ${relationshipFiles.gppToGpp}
      - GPPtoTPP: ${relationshipFiles.gppToTpp}`);
  }

  /**
   * Read relationship files and return their contents
   * @param {Object} relationshipFiles - Object with paths to relationship files
   * @returns {Object} Object with contents of relationship files
   */
  readRelationshipFiles(relationshipFiles) {
    return {
      gpuToGpp: relationshipFiles.gpuToGpp ? readExcelFile(relationshipFiles.gpuToGpp) : [],
      gppToGpp: relationshipFiles.gppToGpp ? readExcelFile(relationshipFiles.gppToGpp) : [],
      gppToTpp: relationshipFiles.gppToTpp ? readExcelFile(relationshipFiles.gppToTpp) : []
    };
  }

  /**
   * Log information about loaded files
   * @param {Array} entityRows - The entity data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   */
  logFilesLoaded(entityRows, relationshipRows) {
    console.log(`Files loaded:
      - GPP: ${entityRows.length} rows
      - GPUtoGPP: ${relationshipRows.gpuToGpp.length} rows
      - GPPtoGPP: ${relationshipRows.gppToGpp.length} rows
      - GPPtoTPP: ${relationshipRows.gppToTpp.length} rows`);
  }

  /**
   * Process GPP rows and add concepts to the template
   * @param {Object} templateJson - The template to update
   * @param {Array} gppRows - The GPP data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   * @param {number} startIndex - The starting index
   * @returns {number} The number of processed concepts
   */
  processRows(templateJson, gppRows, relationshipRows, startIndex) {
    let processedCount = 0;
    
    for (let i = startIndex; i < gppRows.length; i++) {
      if (!gppRows[i] || !gppRows[i][0]) continue; // Skip empty rows
      
      const gppCode = String(gppRows[i][0]);
      const gppDisplay = String(gppRows[i][1] || '');
      
      // Create a new concept entry for GPP
      const gppConcept = this.createConcept(gppCode, gppDisplay);
      
      // Add parent relationships (GPU)
      this.addGPUParents(gppConcept, relationshipRows.gpuToGpp, gppCode);
      
      // Add parent relationships (GPP)
      this.addGPPParents(gppConcept, relationshipRows.gppToGpp, gppCode);
      
      // Add child relationships (TPP)
      this.addTPPChildren(gppConcept, relationshipRows.gppToTpp, gppCode);
      
      // Add child relationships (GPP)
      this.addGPPChildren(gppConcept, relationshipRows.gppToGpp, gppCode);
      
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
   * Add GPU parent relationships to GPP concept
   * @param {Object} gppConcept - The GPP concept
   * @param {Array} gpuToGppRows - The GPUtoGPP relationship rows
   * @param {string} gppCode - The GPP code
   */
  addGPUParents(gppConcept, gpuToGppRows, gppCode) {
    const gpuParents = gpuToGppRows.filter(row => 
      row && row.length > 1 && String(row[1]) === gppCode
    );
    
    if (gpuParents && gpuParents.length > 0) {
      gpuParents.forEach(parent => {
        this.addParentRelationship(gppConcept, String(parent[0]), gppCode);
      });
    }
  }

  /**
   * Add GPP parent relationships to GPP concept
   * @param {Object} gppConcept - The GPP concept
   * @param {Array} gppToGppRows - The GPPtoGPP relationship rows
   * @param {string} gppCode - The GPP code
   */
  addGPPParents(gppConcept, gppToGppRows, gppCode) {
    const gppParents = gppToGppRows.filter(row => 
      row && row.length > 1 && String(row[1]) === gppCode
    );
    
    if (gppParents && gppParents.length > 0) {
      gppParents.forEach(parent => {
        this.addParentRelationship(gppConcept, String(parent[0]), gppCode);
      });
    }
  }

  /**
   * Add TPP children relationships to GPP concept
   * @param {Object} gppConcept - The GPP concept
   * @param {Array} gppToTppRows - The GPPtoTPP relationship rows
   * @param {string} gppCode - The GPP code
   */
  addTPPChildren(gppConcept, gppToTppRows, gppCode) {
    const tppChildren = gppToTppRows.filter(row => 
      row && row.length > 1 && String(row[0]) === gppCode
    );
    
    if (tppChildren && tppChildren.length > 0) {
      tppChildren.forEach(child => {
        this.addChildRelationship(gppConcept, String(child[1]), gppCode);
      });
    }
  }

  /**
   * Add GPP children relationships to GPP concept
   * @param {Object} gppConcept - The GPP concept
   * @param {Array} gppToGppRows - The GPPtoGPP relationship rows
   * @param {string} gppCode - The GPP code
   */
  addGPPChildren(gppConcept, gppToGppRows, gppCode) {
    const gppChildren = gppToGppRows.filter(row => 
      row && row.length > 1 && String(row[0]) === gppCode
    );
    
    if (gppChildren && gppChildren.length > 0) {
      gppChildren.forEach(child => {
        this.addChildRelationship(gppConcept, String(child[1]), gppCode);
      });
    }
  }
}

// Create an instance of the processor
const gppProcessor = new GPPProcessor();

/**
 * Process GPP data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processGPPData(templateJson, tmtDirPath, tmtBonusDirPath) {
  return gppProcessor.process(templateJson, tmtDirPath, tmtBonusDirPath);
}

module.exports = { processGPPData }; 