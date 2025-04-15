/**
 * Module for processing TPU (Trade Product Unit) data
 */
const BaseProcessor = require('./BaseProcessor');
const { readExcelFile } = require('../utils/fileUtils');

class TPUProcessor extends BaseProcessor {
  /**
   * Constructor for the TPUProcessor
   */
  constructor() {
    super('TPU');
  }

  /**
   * Find relationship files with specific patterns
   * @param {string} relationshipDir - Path to the relationship directory
   * @returns {Object} Object with paths to found files
   */
  findRelationshipFiles(relationshipDir) {
    return {
      gpuToTpu: this.findRelationshipFile(relationshipDir, 'gputotpu'),
      tpToTpu: this.findRelationshipFile(relationshipDir, 'tptotpu'),
      tpuToTpp: this.findRelationshipFile(relationshipDir, 'tputotpp')
    };
  }

  /**
   * Validate that all required relationship files were found
   * @param {Object} relationshipFiles - Object with paths to relationship files
   */
  validateRelationshipFiles(relationshipFiles) {
    if (!relationshipFiles.gpuToTpu || !relationshipFiles.tpToTpu || !relationshipFiles.tpuToTpp) {
      throw new Error(`One or more relationship files not found for TPU. 
        GPU->TPU: ${relationshipFiles.gpuToTpu ? 'Found' : 'Not found'}
        TP->TPU: ${relationshipFiles.tpToTpu ? 'Found' : 'Not found'}
        TPU->TPP: ${relationshipFiles.tpuToTpp ? 'Found' : 'Not found'}`);
    }
    
    console.log(`Found relationship files for TPU: 
      - GPUtoTPU: ${relationshipFiles.gpuToTpu}
      - TPtoTPU: ${relationshipFiles.tpToTpu}
      - TPUtoTPP: ${relationshipFiles.tpuToTpp}`);
  }

  /**
   * Read relationship files and return their contents
   * @param {Object} relationshipFiles - Object with paths to relationship files
   * @returns {Object} Object with contents of relationship files
   */
  readRelationshipFiles(relationshipFiles) {
    return {
      gpuToTpu: relationshipFiles.gpuToTpu ? readExcelFile(relationshipFiles.gpuToTpu) : [],
      tpToTpu: relationshipFiles.tpToTpu ? readExcelFile(relationshipFiles.tpToTpu) : [],
      tpuToTpp: relationshipFiles.tpuToTpp ? readExcelFile(relationshipFiles.tpuToTpp) : []
    };
  }

  /**
   * Log information about loaded files
   * @param {Array} entityRows - The entity data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   */
  logFilesLoaded(entityRows, relationshipRows) {
    console.log(`Files loaded:
      - TPU: ${entityRows.length} rows
      - GPUtoTPU: ${relationshipRows.gpuToTpu.length} rows
      - TPtoTPU: ${relationshipRows.tpToTpu.length} rows
      - TPUtoTPP: ${relationshipRows.tpuToTpp.length} rows`);
  }

  /**
   * Process TPU rows and add concepts to the template
   * @param {Object} templateJson - The template to update
   * @param {Array} tpuRows - The TPU data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   * @param {number} startIndex - The starting index
   * @returns {number} The number of processed concepts
   */
  processRows(templateJson, tpuRows, relationshipRows, startIndex) {
    let processedCount = 0;
    
    for (let i = startIndex; i < tpuRows.length; i++) {
      if (!tpuRows[i] || !tpuRows[i][0]) continue; // Skip empty rows
      
      const tpuCode = String(tpuRows[i][0]);
      const tpuDisplay = String(tpuRows[i][1] || '');
      
      // Create a new concept entry for TPU
      const tpuConcept = this.createConcept(tpuCode, tpuDisplay);
      
      // Add parent relationship (GPU)
      this.addGPUParent(tpuConcept, relationshipRows.gpuToTpu, tpuCode);
      
      // Add parent relationship (TP)
      this.addTPParent(tpuConcept, relationshipRows.tpToTpu, tpuCode);
      
      // Add child relationships (TPP)
      this.addTPPChildren(tpuConcept, relationshipRows.tpuToTpp, tpuCode);
      
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
   * Add GPU parent relationship to TPU concept
   * @param {Object} tpuConcept - The TPU concept
   * @param {Array} gpuToTpuRows - The GPUtoTPU relationship rows
   * @param {string} tpuCode - The TPU code
   */
  addGPUParent(tpuConcept, gpuToTpuRows, tpuCode) {
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
  addTPParent(tpuConcept, tpToTpuRows, tpuCode) {
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
  addTPPChildren(tpuConcept, tpuToTppRows, tpuCode) {
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
}

// Create an instance of the processor
const tpuProcessor = new TPUProcessor();

/**
 * Process TPU data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processTPUData(templateJson, tmtDirPath, tmtBonusDirPath) {
  return tpuProcessor.process(templateJson, tmtDirPath, tmtBonusDirPath);
}

module.exports = { processTPUData }; 