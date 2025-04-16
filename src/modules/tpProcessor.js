/**
 * Module for processing TP (Trade Product) data
 */
const BaseProcessor = require('./BaseProcessor');
const { readExcelFile } = require('../utils/fileUtils');

class TPProcessor extends BaseProcessor {
  /**
   * Constructor for the TPProcessor
   */
  constructor() {
    super('TP');
  }

  /**
   * Find relationship files with specific patterns
   * @param {string} relationshipDir - Path to the relationship directory
   * @returns {Object} Object with paths to found files
   */
  findRelationshipFiles(relationshipDir) {
    return {
      gpToTp: this.findRelationshipFile(relationshipDir, 'gptotp'),
      tpToTpu: this.findRelationshipFile(relationshipDir, 'tptotpu')
    };
  }

  /**
   * Validate that all required relationship files were found
   * @param {Object} relationshipFiles - Object with paths to relationship files
   */
  validateRelationshipFiles(relationshipFiles) {
    if (!relationshipFiles.gpToTp || !relationshipFiles.tpToTpu) {
      throw new Error(`One or more relationship files not found for TP. 
        GP->TP: ${relationshipFiles.gpToTp ? 'Found' : 'Not found'}
        TP->TPU: ${relationshipFiles.tpToTpu ? 'Found' : 'Not found'}`);
    }
    
    console.log(`Found relationship files for TP: 
      - GPtoTP: ${relationshipFiles.gpToTp}
      - TPtoTPU: ${relationshipFiles.tpToTpu}`);
  }

  /**
   * Read relationship files and return their contents
   * @param {Object} relationshipFiles - Object with paths to relationship files
   * @returns {Object} Object with contents of relationship files
   */
  readRelationshipFiles(relationshipFiles) {
    return {
      gpToTp: relationshipFiles.gpToTp ? readExcelFile(relationshipFiles.gpToTp) : [],
      tpToTpu: relationshipFiles.tpToTpu ? readExcelFile(relationshipFiles.tpToTpu) : []
    };
  }

  /**
   * Log information about loaded files
   * @param {Array} entityRows - The entity data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   */
  logFilesLoaded(entityRows, relationshipRows) {
    console.log(`Files loaded:
      - TP: ${entityRows.length} rows
      - GPtoTP: ${relationshipRows.gpToTp.length} rows
      - TPtoTPU: ${relationshipRows.tpToTpu.length} rows`);
  }

  /**
   * Process TP rows and add concepts to the template
   * @param {Object} templateJson - The template to update
   * @param {Array} tpRows - The TP data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   * @param {number} startIndex - The starting index
   * @returns {number} The number of processed concepts
   */
  processRows(templateJson, tpRows, relationshipRows, startIndex) {
    let processedCount = 0;
    
    for (let i = startIndex; i < tpRows.length; i++) {
      if (!tpRows[i] || !tpRows[i][0]) continue; // Skip empty rows
      
      const tpCode = String(tpRows[i][0]);
      const tpDisplay = String(tpRows[i][1] || '');
      
      // Create a new concept entry for TP
      const tpConcept = this.createConcept(tpCode, tpDisplay);
      
      // Add parent relationship (GP)
      this.addGPParent(tpConcept, relationshipRows.gpToTp, tpCode);
      
      // Add child relationships (TPU)
      this.addTPUChildren(tpConcept, relationshipRows.tpToTpu, tpCode);
      
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
   * Add GP parent relationship to TP concept
   * @param {Object} tpConcept - The TP concept
   * @param {Array} gpToTpRows - The GPtoTP relationship rows
   * @param {string} tpCode - The TP code
   */
  addGPParent(tpConcept, gpToTpRows, tpCode) {
    const gpParent = gpToTpRows.find(row => 
      row && row.length > 1 && String(row[1]) === tpCode
    );
    
    if (gpParent) {
      this.addParentRelationship(tpConcept, String(gpParent[0]), tpCode);
    }
  }

  /**
   * Add TPU children relationships to TP concept
   * @param {Object} tpConcept - The TP concept
   * @param {Array} tpToTpuRows - The TPtoTPU relationship rows
   * @param {string} tpCode - The TP code
   */
  addTPUChildren(tpConcept, tpToTpuRows, tpCode) {
    const tpuChildren = tpToTpuRows.filter(row => 
      row && row.length > 1 && String(row[0]) === tpCode
    );
    
    if (tpuChildren && tpuChildren.length > 0) {
      tpuChildren.forEach(child => {
        this.addChildRelationship(tpConcept, String(child[1]), tpCode);
      });
    }
  }
}

// Create an instance of the processor
const tpProcessor = new TPProcessor();

/**
 * Process TP data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processTPData(templateJson, tmtDirPath, tmtBonusDirPath) {
  return tpProcessor.process(templateJson, tmtDirPath, tmtBonusDirPath);
}

module.exports = { processTPData }; 