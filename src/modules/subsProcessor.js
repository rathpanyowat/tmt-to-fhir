/**
 * Module for processing SUBS (Substance) data
 */
const BaseProcessor = require('./BaseProcessor');
const { readExcelFile } = require('../utils/fileUtils');

class SUBSProcessor extends BaseProcessor {
  /**
   * Constructor for the SUBSProcessor
   */
  constructor() {
    super('SUBS');
  }

  /**
   * Find relationship files with specific patterns
   * @param {string} relationshipDir - Path to the relationship directory
   * @returns {Object} Object with paths to found files
   */
  findRelationshipFiles(relationshipDir) {
    return {
      subsToVtm: this.findRelationshipFile(relationshipDir, 'substovtm')
    };
  }

  /**
   * Validate that all required relationship files were found
   * @param {Object} relationshipFiles - Object with paths to relationship files
   */
  validateRelationshipFiles(relationshipFiles) {
    if (!relationshipFiles.subsToVtm) {
      throw new Error(`Relationship file not found for SUBS. 
        SUBS->VTM: ${relationshipFiles.subsToVtm ? 'Found' : 'Not found'}`);
    }
    
    console.log(`Found relationship files for SUBS: 
      - SUBStoVTM: ${relationshipFiles.subsToVtm}`);
  }

  /**
   * Read relationship files and return their contents
   * @param {Object} relationshipFiles - Object with paths to relationship files
   * @returns {Object} Object with contents of relationship files
   */
  readRelationshipFiles(relationshipFiles) {
    return {
      subsToVtm: relationshipFiles.subsToVtm ? readExcelFile(relationshipFiles.subsToVtm) : []
    };
  }

  /**
   * Log information about loaded files
   * @param {Array} entityRows - The entity data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   */
  logFilesLoaded(entityRows, relationshipRows) {
    console.log(`Files loaded:
      - SUBS: ${entityRows.length} rows
      - SUBStoVTM: ${relationshipRows.subsToVtm.length} rows`);
  }

  /**
   * Process SUBS rows and add concepts to the template
   * @param {Object} templateJson - The template to update
   * @param {Array} subsRows - The SUBS data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   * @param {number} startIndex - The starting index
   * @returns {number} The number of processed concepts
   */
  processRows(templateJson, subsRows, relationshipRows, startIndex) {
    let processedCount = 0;
    
    for (let i = startIndex; i < subsRows.length; i++) {
      if (!subsRows[i] || !subsRows[i][0]) continue; // Skip empty rows
      
      const subsCode = String(subsRows[i][0]);
      const subsDisplay = String(subsRows[i][1] || '');
      
      // Create a new concept entry for SUBS
      const subsConcept = this.createConcept(subsCode, subsDisplay);
      
      // Add child relationships (VTM)
      this.addVTMChildren(subsConcept, relationshipRows.subsToVtm, subsCode);
      
      // Add the concept to the template
      templateJson.concept.push(subsConcept);
      processedCount++;
      
      // Log progress every 100 items
      if (processedCount % 100 === 0) {
        console.log(`Processed ${processedCount} SUBS concepts...`);
      }
    }
    
    return processedCount;
  }

  /**
   * Add VTM children relationships to SUBS concept
   * @param {Object} subsConcept - The SUBS concept
   * @param {Array} subsToVtmRows - The SUBStoVTM relationship rows
   * @param {string} subsCode - The SUBS code
   */
  addVTMChildren(subsConcept, subsToVtmRows, subsCode) {
    const vtmChildren = subsToVtmRows.filter(row => 
      row && row.length > 1 && String(row[0]) === subsCode
    );
    
    if (vtmChildren && vtmChildren.length > 0) {
      vtmChildren.forEach(child => {
        subsConcept.property.push({
          code: "child",
          valueCode: String(child[1])
        });
      });
    }
  }
}

// Create an instance of the processor
const subsProcessor = new SUBSProcessor();

/**
 * Process SUBS data and update the template
 * @param {Object} templateJson - The template JSON object to update
 * @param {string} tmtDirPath - Path to the TMT directory
 * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
 */
function processSUBSData(templateJson, tmtDirPath, tmtBonusDirPath) {
  return subsProcessor.process(templateJson, tmtDirPath, tmtBonusDirPath);
}

module.exports = { processSUBSData }; 