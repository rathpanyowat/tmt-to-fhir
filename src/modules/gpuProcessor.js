/**
 * Module for processing GPU (Generic Product Use) data
 */
const BaseProcessor = require('./BaseProcessor');
const { readExcelFile } = require('../utils/fileUtils');

class GPUProcessor extends BaseProcessor {
  /**
   * Constructor for the GPUProcessor
   */
  constructor() {
    super('GPU');
  }

  /**
   * Find relationship files with specific patterns
   * @param {string} relationshipDir - Path to the relationship directory
   * @returns {Object} Object with paths to found files
   */
  findRelationshipFiles(relationshipDir) {
    return {
      gpToGpu: this.findRelationshipFile(relationshipDir, 'gptogpu'),
      gpuToTpu: this.findRelationshipFile(relationshipDir, 'gputotpu'),
      gpuToGpp: this.findRelationshipFile(relationshipDir, 'gputogpp')
    };
  }

  /**
   * Validate that all required relationship files were found
   * @param {Object} relationshipFiles - Object with paths to relationship files
   */
  validateRelationshipFiles(relationshipFiles) {
    if (!relationshipFiles.gpToGpu || !relationshipFiles.gpuToTpu || !relationshipFiles.gpuToGpp) {
      throw new Error(`One or more relationship files not found for GPU. 
        GP->GPU: ${relationshipFiles.gpToGpu ? 'Found' : 'Not found'}
        GPU->TPU: ${relationshipFiles.gpuToTpu ? 'Found' : 'Not found'}
        GPU->GPP: ${relationshipFiles.gpuToGpp ? 'Found' : 'Not found'}`);
    }
    
    console.log(`Found relationship files for GPU: 
      - GPtoGPU: ${relationshipFiles.gpToGpu}
      - GPUtoTPU: ${relationshipFiles.gpuToTpu}
      - GPUtoGPP: ${relationshipFiles.gpuToGpp}`);
  }

  /**
   * Read relationship files and return their contents
   * @param {Object} relationshipFiles - Object with paths to relationship files
   * @returns {Object} Object with contents of relationship files
   */
  readRelationshipFiles(relationshipFiles) {
    return {
      gpToGpu: relationshipFiles.gpToGpu ? readExcelFile(relationshipFiles.gpToGpu) : [],
      gpuToTpu: relationshipFiles.gpuToTpu ? readExcelFile(relationshipFiles.gpuToTpu) : [],
      gpuToGpp: relationshipFiles.gpuToGpp ? readExcelFile(relationshipFiles.gpuToGpp) : []
    };
  }

  /**
   * Log information about loaded files
   * @param {Array} entityRows - The entity data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   */
  logFilesLoaded(entityRows, relationshipRows) {
    console.log(`Files loaded:
      - GPU: ${entityRows.length} rows
      - GPtoGPU: ${relationshipRows.gpToGpu.length} rows
      - GPUtoTPU: ${relationshipRows.gpuToTpu.length} rows
      - GPUtoGPP: ${relationshipRows.gpuToGpp.length} rows`);
  }

  /**
   * Process GPU rows and add concepts to the template
   * @param {Object} templateJson - The template to update
   * @param {Array} gpuRows - The GPU data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   * @param {number} startIndex - The starting index
   * @returns {number} The number of processed concepts
   */
  processRows(templateJson, gpuRows, relationshipRows, startIndex) {
    let processedCount = 0;
    
    for (let i = startIndex; i < gpuRows.length; i++) {
      if (!gpuRows[i] || !gpuRows[i][0]) continue; // Skip empty rows
      
      const gpuCode = String(gpuRows[i][0]);
      const gpuDisplay = String(gpuRows[i][1] || '');
      
      // Create a new concept entry for GPU
      const gpuConcept = this.createConcept(gpuCode, gpuDisplay);
      
      // Add parent relationships (GP)
      this.addGPParents(gpuConcept, relationshipRows.gpToGpu, gpuCode);
      
      // Add child relationships (TPU)
      this.addTPUChildren(gpuConcept, relationshipRows.gpuToTpu, gpuCode);
      
      // Add child relationships (GPP)
      this.addGPPChildren(gpuConcept, relationshipRows.gpuToGpp, gpuCode);
      
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
   * Add GP parent relationships to GPU concept
   * @param {Object} gpuConcept - The GPU concept
   * @param {Array} gpToGpuRows - The GPtoGPU relationship rows
   * @param {string} gpuCode - The GPU code
   */
  addGPParents(gpuConcept, gpToGpuRows, gpuCode) {
    const gpParents = gpToGpuRows.filter(row => 
      row && row.length > 1 && String(row[1]) === gpuCode
    );
    
    if (gpParents && gpParents.length > 0) {
      gpParents.forEach(parent => {
        this.addParentRelationship(gpuConcept, String(parent[0]), gpuCode);
      });
    }
  }

  /**
   * Add TPU children relationships to GPU concept
   * @param {Object} gpuConcept - The GPU concept
   * @param {Array} gpuToTpuRows - The GPUtoTPU relationship rows
   * @param {string} gpuCode - The GPU code
   */
  addTPUChildren(gpuConcept, gpuToTpuRows, gpuCode) {
    const tpuChildren = gpuToTpuRows.filter(row => 
      row && row.length > 1 && String(row[0]) === gpuCode
    );
    
    if (tpuChildren && tpuChildren.length > 0) {
      tpuChildren.forEach(child => {
        this.addChildRelationship(gpuConcept, String(child[1]), gpuCode);
      });
    }
  }

  /**
   * Add GPP children relationships to GPU concept
   * @param {Object} gpuConcept - The GPU concept
   * @param {Array} gpuToGppRows - The GPUtoGPP relationship rows
   * @param {string} gpuCode - The GPU code
   */
  addGPPChildren(gpuConcept, gpuToGppRows, gpuCode) {
    const gppChildren = gpuToGppRows.filter(row => 
      row && row.length > 1 && String(row[0]) === gpuCode
    );
    
    if (gppChildren && gppChildren.length > 0) {
      gppChildren.forEach(child => {
        this.addChildRelationship(gpuConcept, String(child[1]), gpuCode);
      });
    }
  }
}

// Create an instance of the processor
const gpuProcessor = new GPUProcessor();

/**
 * Process GPU data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processGPUData(templateJson, tmtDirPath, tmtBonusDirPath) {
  return gpuProcessor.process(templateJson, tmtDirPath, tmtBonusDirPath);
}

module.exports = { processGPUData }; 