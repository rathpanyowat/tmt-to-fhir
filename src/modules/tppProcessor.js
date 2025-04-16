/**
 * Module for processing TPP (Trade Product Pack) data
 */
const BaseProcessor = require('./BaseProcessor');
const { readExcelFile } = require('../utils/fileUtils');

class TPPProcessor extends BaseProcessor {
  /**
   * Constructor for the TPPProcessor
   */
  constructor() {
    super('TPP');
  }

  /**
   * Find relationship files with specific patterns
   * @param {string} relationshipDir - Path to the relationship directory
   * @returns {Object} Object with paths to found files
   */
  findRelationshipFiles(relationshipDir) {
    return {
      tpuToTpp: this.findRelationshipFile(relationshipDir, 'tputotpp'),
      gppToTpp: this.findRelationshipFile(relationshipDir, 'gpptotpp'),
      tppToTpp: this.findRelationshipFile(relationshipDir, 'tpptotpp')
    };
  }

  /**
   * Validate that all required relationship files were found
   * @param {Object} relationshipFiles - Object with paths to relationship files
   */
  validateRelationshipFiles(relationshipFiles) {
    if (!relationshipFiles.tpuToTpp || !relationshipFiles.gppToTpp || !relationshipFiles.tppToTpp) {
      throw new Error(`One or more relationship files not found for TPP. 
        TPU->TPP: ${relationshipFiles.tpuToTpp ? 'Found' : 'Not found'}
        GPP->TPP: ${relationshipFiles.gppToTpp ? 'Found' : 'Not found'}
        TPP->TPP: ${relationshipFiles.tppToTpp ? 'Found' : 'Not found'}`);
    }
    
    console.log(`Found relationship files for TPP: 
      - TPUtoTPP: ${relationshipFiles.tpuToTpp}
      - GPPtoTPP: ${relationshipFiles.gppToTpp}
      - TPPtoTPP: ${relationshipFiles.tppToTpp}`);
  }

  /**
   * Read relationship files and return their contents
   * @param {Object} relationshipFiles - Object with paths to relationship files
   * @returns {Object} Object with contents of relationship files
   */
  readRelationshipFiles(relationshipFiles) {
    return {
      tpuToTpp: relationshipFiles.tpuToTpp ? readExcelFile(relationshipFiles.tpuToTpp) : [],
      gppToTpp: relationshipFiles.gppToTpp ? readExcelFile(relationshipFiles.gppToTpp) : [],
      tppToTpp: relationshipFiles.tppToTpp ? readExcelFile(relationshipFiles.tppToTpp) : []
    };
  }

  /**
   * Log information about loaded files
   * @param {Array} entityRows - The entity data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   */
  logFilesLoaded(entityRows, relationshipRows) {
    console.log(`Files loaded:
      - TPP: ${entityRows.length} rows
      - TPUtoTPP: ${relationshipRows.tpuToTpp.length} rows
      - GPPtoTPP: ${relationshipRows.gppToTpp.length} rows
      - TPPtoTPP: ${relationshipRows.tppToTpp.length} rows`);
  }

  /**
   * Process TPP rows and add concepts to the template
   * @param {Object} templateJson - The template to update
   * @param {Array} tppRows - The TPP data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   * @param {number} startIndex - The starting index
   * @returns {number} The number of processed concepts
   */
  processRows(templateJson, tppRows, relationshipRows, startIndex) {
    let processedCount = 0;
    
    for (let i = startIndex; i < tppRows.length; i++) {
      if (!tppRows[i] || !tppRows[i][0]) continue; // Skip empty rows
      
      const tppCode = String(tppRows[i][0]);
      const tppDisplay = String(tppRows[i][1] || '');
      
      // Create a new concept entry for TPP
      const tppConcept = this.createConcept(tppCode, tppDisplay);
      
      // Add parent relationships
      // 1. TPU parents
      this.addTPUParents(tppConcept, relationshipRows.tpuToTpp, tppCode);
      
      // 2. GPP parents
      this.addGPPParents(tppConcept, relationshipRows.gppToTpp, tppCode);
      
      // 3. TPP parents
      this.addTPPParents(tppConcept, relationshipRows.tppToTpp, tppCode);
      
      // Add child relationships (TPP)
      this.addTPPChildren(tppConcept, relationshipRows.tppToTpp, tppCode);
      
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
   * Add TPU parent relationships to TPP concept
   * @param {Object} tppConcept - The TPP concept
   * @param {Array} tpuToTppRows - The TPUtoTPP relationship rows
   * @param {string} tppCode - The TPP code
   */
  addTPUParents(tppConcept, tpuToTppRows, tppCode) {
    const tpuParents = tpuToTppRows.filter(row => 
      row && row.length > 1 && String(row[1]) === tppCode
    );
    
    if (tpuParents && tpuParents.length > 0) {
      tpuParents.forEach(parent => {
        this.addParentRelationship(tppConcept, String(parent[0]), tppCode);
      });
    }
  }

  /**
   * Add GPP parent relationships to TPP concept
   * @param {Object} tppConcept - The TPP concept
   * @param {Array} gppToTppRows - The GPPtoTPP relationship rows
   * @param {string} tppCode - The TPP code
   */
  addGPPParents(tppConcept, gppToTppRows, tppCode) {
    const gppParents = gppToTppRows.filter(row => 
      row && row.length > 1 && String(row[1]) === tppCode
    );
    
    if (gppParents && gppParents.length > 0) {
      gppParents.forEach(parent => {
        this.addParentRelationship(tppConcept, String(parent[0]), tppCode);
      });
    }
  }

  /**
   * Add TPP parent relationships to TPP concept
   * @param {Object} tppConcept - The TPP concept
   * @param {Array} tppToTppRows - The TPPtoTPP relationship rows
   * @param {string} tppCode - The TPP code
   */
  addTPPParents(tppConcept, tppToTppRows, tppCode) {
    const tppParents = tppToTppRows.filter(row => 
      row && row.length > 1 && String(row[1]) === tppCode
    );
    
    if (tppParents && tppParents.length > 0) {
      tppParents.forEach(parent => {
        this.addParentRelationship(tppConcept, String(parent[0]), tppCode);
      });
    }
  }

  /**
   * Add TPP children relationships to TPP concept
   * @param {Object} tppConcept - The TPP concept
   * @param {Array} tppToTppRows - The TPPtoTPP relationship rows
   * @param {string} tppCode - The TPP code
   */
  addTPPChildren(tppConcept, tppToTppRows, tppCode) {
    const tppChildren = tppToTppRows.filter(row => 
      row && row.length > 1 && String(row[0]) === tppCode
    );
    
    if (tppChildren && tppChildren.length > 0) {
      tppChildren.forEach(child => {
        this.addChildRelationship(tppConcept, String(child[1]), tppCode);
      });
    }
  }
}

// Create an instance of the processor
const tppProcessor = new TPPProcessor();

/**
 * Process TPP data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processTPPData(templateJson, tmtDirPath, tmtBonusDirPath) {
  return tppProcessor.process(templateJson, tmtDirPath, tmtBonusDirPath);
}

module.exports = { processTPPData }; 