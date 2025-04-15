/**
 * Module for processing GP (Generic Product) data
 */
const BaseProcessor = require('./BaseProcessor');
const { readExcelFile } = require('../utils/fileUtils');

class GPProcessor extends BaseProcessor {
  /**
   * Constructor for the GPProcessor
   */
  constructor() {
    super('GP');
  }

  /**
   * Find relationship files with specific patterns
   * @param {string} relationshipDir - Path to the relationship directory
   * @returns {Object} Object with paths to found files
   */
  findRelationshipFiles(relationshipDir) {
    return {
      vtmToGp: this.findRelationshipFile(relationshipDir, 'vtmtogp'),
      gpToTp: this.findRelationshipFile(relationshipDir, 'gptotp'),
      gpToGpu: this.findRelationshipFile(relationshipDir, 'gptogpu')
    };
  }

  /**
   * Validate that all required relationship files were found
   * @param {Object} relationshipFiles - Object with paths to relationship files
   */
  validateRelationshipFiles(relationshipFiles) {
    if (!relationshipFiles.vtmToGp || !relationshipFiles.gpToTp || !relationshipFiles.gpToGpu) {
      throw new Error(`One or more relationship files not found for GP. 
        VTM->GP: ${relationshipFiles.vtmToGp ? 'Found' : 'Not found'}
        GP->TP: ${relationshipFiles.gpToTp ? 'Found' : 'Not found'}
        GP->GPU: ${relationshipFiles.gpToGpu ? 'Found' : 'Not found'}`);
    }
    
    console.log(`Found relationship files for GP: 
      - VTMtoGP: ${relationshipFiles.vtmToGp}
      - GPtoTP: ${relationshipFiles.gpToTp}
      - GPtoGPU: ${relationshipFiles.gpToGpu}`);
  }

  /**
   * Read relationship files and return their contents
   * @param {Object} relationshipFiles - Object with paths to relationship files
   * @returns {Object} Object with contents of relationship files
   */
  readRelationshipFiles(relationshipFiles) {
    return {
      vtmToGp: relationshipFiles.vtmToGp ? readExcelFile(relationshipFiles.vtmToGp) : [],
      gpToTp: relationshipFiles.gpToTp ? readExcelFile(relationshipFiles.gpToTp) : [],
      gpToGpu: relationshipFiles.gpToGpu ? readExcelFile(relationshipFiles.gpToGpu) : []
    };
  }

  /**
   * Log information about loaded files
   * @param {Array} entityRows - The entity data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   */
  logFilesLoaded(entityRows, relationshipRows) {
    console.log(`Files loaded:
      - GP: ${entityRows.length} rows
      - VTMtoGP: ${relationshipRows.vtmToGp.length} rows
      - GPtoTP: ${relationshipRows.gpToTp.length} rows
      - GPtoGPU: ${relationshipRows.gpToGpu.length} rows`);
  }

  /**
   * Process GP rows and add concepts to the template
   * @param {Object} templateJson - The template to update
   * @param {Array} gpRows - The GP data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   * @param {number} startIndex - The starting index
   * @returns {number} The number of processed concepts
   */
  processRows(templateJson, gpRows, relationshipRows, startIndex) {
    let processedCount = 0;
    
    for (let i = startIndex; i < gpRows.length; i++) {
      if (!gpRows[i] || !gpRows[i][0]) continue; // Skip empty rows
      
      const gpCode = String(gpRows[i][0]);
      const gpDisplay = String(gpRows[i][1] || '');
      
      // Create a new concept entry for GP
      const gpConcept = this.createConcept(gpCode, gpDisplay);
      
      // Add parent relationship (VTM)
      this.addVTMParent(gpConcept, relationshipRows.vtmToGp, gpCode);
      
      // Add child relationships (TP)
      this.addTPChildren(gpConcept, relationshipRows.gpToTp, gpCode);
      
      // Add child relationships (GPU)
      this.addGPUChildren(gpConcept, relationshipRows.gpToGpu, gpCode);
      
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
   * Add VTM parent relationship to GP concept
   * @param {Object} gpConcept - The GP concept
   * @param {Array} vtmToGpRows - The VTMtoGP relationship rows
   * @param {string} gpCode - The GP code
   */
  addVTMParent(gpConcept, vtmToGpRows, gpCode) {
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
  addTPChildren(gpConcept, gpToTpRows, gpCode) {
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
  addGPUChildren(gpConcept, gpToGpuRows, gpCode) {
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
}

// Create an instance of the processor
const gpProcessor = new GPProcessor();

/**
 * Process GP data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processGPData(templateJson, tmtDirPath, tmtBonusDirPath) {
  return gpProcessor.process(templateJson, tmtDirPath, tmtBonusDirPath);
}

module.exports = { processGPData }; 