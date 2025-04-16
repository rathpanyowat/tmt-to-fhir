/**
 * Module for processing VTM (Virtual Therapeutic Moiety) data
 */
const BaseProcessor = require('./BaseProcessor');
const { readExcelFile } = require('../utils/fileUtils');

class VTMProcessor extends BaseProcessor {
  /**
   * Constructor for the VTMProcessor
   */
  constructor() {
    super('VTM');
  }

  /**
   * Find relationship files with specific patterns
   * @param {string} relationshipDir - Path to the relationship directory
   * @returns {Object} Object with paths to found files
   */
  findRelationshipFiles(relationshipDir) {
    return {
      subsToVtm: this.findRelationshipFile(relationshipDir, 'substovtm'),
      vtmToGp: this.findRelationshipFile(relationshipDir, 'vtmtogp')
    };
  }

  /**
   * Validate that all required relationship files were found
   * @param {Object} relationshipFiles - Object with paths to relationship files
   */
  validateRelationshipFiles(relationshipFiles) {
    if (!relationshipFiles.subsToVtm || !relationshipFiles.vtmToGp) {
      throw new Error(`One or more relationship files not found for VTM. 
        SUBS->VTM: ${relationshipFiles.subsToVtm ? 'Found' : 'Not found'}
        VTM->GP: ${relationshipFiles.vtmToGp ? 'Found' : 'Not found'}`);
    }
    
    console.log(`Found relationship files for VTM: 
      - SUBStoVTM: ${relationshipFiles.subsToVtm}
      - VTMtoGP: ${relationshipFiles.vtmToGp}`);
  }

  /**
   * Read relationship files and return their contents
   * @param {Object} relationshipFiles - Object with paths to relationship files
   * @returns {Object} Object with contents of relationship files
   */
  readRelationshipFiles(relationshipFiles) {
    return {
      subsToVtm: relationshipFiles.subsToVtm ? readExcelFile(relationshipFiles.subsToVtm) : [],
      vtmToGp: relationshipFiles.vtmToGp ? readExcelFile(relationshipFiles.vtmToGp) : []
    };
  }

  /**
   * Log information about loaded files
   * @param {Array} entityRows - The entity data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   */
  logFilesLoaded(entityRows, relationshipRows) {
    console.log(`Files loaded:
      - VTM: ${entityRows.length} rows
      - SUBStoVTM: ${relationshipRows.subsToVtm.length} rows
      - VTMtoGP: ${relationshipRows.vtmToGp.length} rows`);
  }

  /**
   * Process VTM rows and add concepts to the template
   * @param {Object} templateJson - The template to update
   * @param {Array} vtmRows - The VTM data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   * @param {number} startIndex - The starting index
   * @returns {number} The number of processed concepts
   */
  processRows(templateJson, vtmRows, relationshipRows, startIndex) {
    let processedCount = 0;
    
    for (let i = startIndex; i < vtmRows.length; i++) {
      if (!vtmRows[i] || !vtmRows[i][0]) continue; // Skip empty rows
      
      const vtmCode = String(vtmRows[i][0]);
      const vtmDisplay = String(vtmRows[i][1] || '');
      
      // Create a new concept entry for VTM
      const vtmConcept = this.createConcept(vtmCode, vtmDisplay);
      
      // Add parent relationship (SUBS)
      this.addSUBSParents(vtmConcept, relationshipRows.subsToVtm, vtmCode);
      
      // Add child relationships (GP)
      this.addGPChildren(vtmConcept, relationshipRows.vtmToGp, vtmCode);
      
      // Add the concept to the template
      templateJson.concept.push(vtmConcept);
      processedCount++;
      
      // Log progress every 100 items
      if (processedCount % 100 === 0) {
        console.log(`Processed ${processedCount} VTM concepts...`);
      }
    }
    
    return processedCount;
  }

  /**
   * Add SUBS parent relationships to VTM concept
   * @param {Object} vtmConcept - The VTM concept
   * @param {Array} subsToVtmRows - The SUBStoVTM relationship rows
   * @param {string} vtmCode - The VTM code
   */
  addSUBSParents(vtmConcept, subsToVtmRows, vtmCode) {
    const subsParents = subsToVtmRows.filter(row => 
      row && row.length > 1 && String(row[1]) === vtmCode
    );
    
    if (subsParents && subsParents.length > 0) {
      subsParents.forEach(parent => {
        this.addParentRelationship(vtmConcept, String(parent[0]), vtmCode);
      });
    }
  }

  /**
   * Add GP children relationships to VTM concept
   * @param {Object} vtmConcept - The VTM concept
   * @param {Array} vtmToGpRows - The VTMtoGP relationship rows
   * @param {string} vtmCode - The VTM code
   */
  addGPChildren(vtmConcept, vtmToGpRows, vtmCode) {
    const gpChildren = vtmToGpRows.filter(row => 
      row && row.length > 1 && String(row[0]) === vtmCode
    );
    
    if (gpChildren && gpChildren.length > 0) {
      gpChildren.forEach(child => {
        this.addChildRelationship(vtmConcept, String(child[1]), vtmCode);
      });
    }
  }
}

// Create an instance of the processor
const vtmProcessor = new VTMProcessor();

/**
 * Process VTM data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processVTMData(templateJson, tmtDirPath, tmtBonusDirPath) {
  return vtmProcessor.process(templateJson, tmtDirPath, tmtBonusDirPath);
}

module.exports = { processVTMData }; 