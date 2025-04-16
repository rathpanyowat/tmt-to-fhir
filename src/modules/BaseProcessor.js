/**
 * Base class for TMT data processors
 */
const path = require('path');
const { readExcelFile, findFiles } = require('../utils/fileUtils');

class BaseProcessor {
  /**
   * Constructor for the BaseProcessor
   * @param {string} entityType - The type of entity being processed (e.g., "SUBS", "GP")
   */
  constructor(entityType) {
    this.entityType = entityType;
  }

  /**
   * Process data and update the template
   * @param {Object} templateJson - The template JSON object to update
   * @param {string} tmtDirPath - Path to the TMT directory
   * @param {string} tmtBonusDirPath - Path to the TMT bonus directory
   */
  process(templateJson, tmtDirPath, tmtBonusDirPath) {
    console.log(`Processing ${this.entityType} data...`);
    
    try {
      // Find the Concept directory with entity file
      const conceptDir = path.join(tmtBonusDirPath, 'Concept');
      
      // Find the entity file
      const entityFilePattern = new RegExp(`^${this.entityType}\\d{8}\\.xls$`, 'i');
      const entityFiles = findFiles(conceptDir, entityFilePattern);
      
      if (entityFiles.length === 0) {
        throw new Error(`${this.entityType} file not found`);
      }
      
      const entityFile = entityFiles[0];
      console.log(`Found ${this.entityType} file: ${entityFile}`);
      
      // Find relationship files in the Relationship directory
      const relationshipDir = path.join(tmtBonusDirPath, 'Relationship');
      
      // Find specific relationship files
      const relationshipFiles = this.findRelationshipFiles(relationshipDir);
      
      this.validateRelationshipFiles(relationshipFiles);
      
      // Read all necessary files
      const entityRows = readExcelFile(entityFile);
      const relationshipRows = this.readRelationshipFiles(relationshipFiles);
      
      this.logFilesLoaded(entityRows, relationshipRows);
      
      // Skip the header row if present
      let startIndex = this.determineStartIndex(entityRows);
      
      // Process each entity row
      let processedCount = this.processRows(
        templateJson, 
        entityRows, 
        relationshipRows, 
        startIndex
      );
      
      console.log(`Added ${processedCount} ${this.entityType} concepts to the template`);
      
      return processedCount;
    } catch (error) {
      console.error(`Error processing ${this.entityType} data:`, error);
      throw error;
    }
  }

  /**
   * Find relationship files with specific patterns
   * @param {string} relationshipDir - Path to the relationship directory
   * @returns {Object} Object with paths to found files
   */
  findRelationshipFiles(relationshipDir) {
    // To be implemented by subclasses
    throw new Error('findRelationshipFiles must be implemented by subclasses');
  }

  /**
   * Find a relationship file with a specific pattern
   * @param {string} relationshipDir - Path to the relationship directory
   * @param {string} pattern - Pattern to match in the filename
   * @returns {string} Path to the found file
   */
  findRelationshipFile(relationshipDir, pattern) {
    const files = findFiles(relationshipDir, new RegExp(pattern, 'i'));
    return files.length > 0 ? files[0] : null;
  }

  /**
   * Validate that all required relationship files were found
   * @param {Object} relationshipFiles - Object with paths to relationship files
   */
  validateRelationshipFiles(relationshipFiles) {
    // To be implemented by subclasses
    throw new Error('validateRelationshipFiles must be implemented by subclasses');
  }

  /**
   * Read relationship files and return their contents
   * @param {Object} relationshipFiles - Object with paths to relationship files
   * @returns {Object} Object with contents of relationship files
   */
  readRelationshipFiles(relationshipFiles) {
    // To be implemented by subclasses
    throw new Error('readRelationshipFiles must be implemented by subclasses');
  }

  /**
   * Log information about loaded files
   * @param {Array} entityRows - The entity data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   */
  logFilesLoaded(entityRows, relationshipRows) {
    // To be implemented by subclasses
    throw new Error('logFilesLoaded must be implemented by subclasses');
  }

  /**
   * Determine the starting index based on header presence
   * @param {Array} rows - The rows from the Excel file
   * @returns {number} The starting index
   */
  determineStartIndex(rows) {
    if (rows.length > 0 && rows[0] && rows[0][0] === `TMTID(${this.entityType})`) {
      console.log('Header row found, starting from row 1');
      return 1;
    }
    return 0;
  }

  /**
   * Process entity rows and add concepts to the template
   * @param {Object} templateJson - The template to update
   * @param {Array} entityRows - The entity data rows
   * @param {Object} relationshipRows - Object with relationship data rows
   * @param {number} startIndex - The starting index
   * @returns {number} The number of processed concepts
   */
  processRows(templateJson, entityRows, relationshipRows, startIndex) {
    // To be implemented by subclasses
    throw new Error('processRows must be implemented by subclasses');
  }

  /**
   * Create a concept object
   * @param {string} code - The concept code
   * @param {string} display - The concept display name
   * @returns {Object} The concept object
   */
  createConcept(code, display) {
    return {
      code: code,
      display: display,
      property: [
        {
          code: "class",
          valueCode: this.entityType
        },
        {
          code: "status",
          valueCode: "active"
        },
        {
          code: "abstract",
          valueBoolean: false
        }
      ]
    };
  }

  /**
   * Check and add parent relationship, preventing self-references
   * @param {Object} concept - The concept object to add the parent to
   * @param {string} parentCode - The parent code
   * @param {string} conceptCode - The current concept code
   * @returns {boolean} True if parent was added, false if skipped
   */
  addParentRelationship(concept, parentCode, conceptCode) {
    // Skip self-references (prevent circular references)
    if (String(parentCode) === String(conceptCode)) {
      console.warn(`Warning: Skipping self-reference parent relationship for ${this.entityType} code ${conceptCode}`);
      return false;
    }
    
    concept.property.push({
      code: "parent",
      valueCode: String(parentCode)
    });
    
    return true;
  }

  /**
   * Check and add child relationship, preventing self-references
   * @param {Object} concept - The concept object to add the child to
   * @param {string} childCode - The child code
   * @param {string} conceptCode - The current concept code
   * @returns {boolean} True if child was added, false if skipped
   */
  addChildRelationship(concept, childCode, conceptCode) {
    // Skip self-references (prevent circular references)
    if (String(childCode) === String(conceptCode)) {
      console.warn(`Warning: Skipping self-reference child relationship for ${this.entityType} code ${conceptCode}`);
      return false;
    }
    
    concept.property.push({
      code: "child",
      valueCode: String(childCode)
    });
    
    return true;
  }
}

module.exports = BaseProcessor; 