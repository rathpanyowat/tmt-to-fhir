/**
 * TMT to FHIR Converter
 * 
 * This application processes TMT data from Excel files and populates a FHIR CodeSystem template.
 */

const path = require('path');
const { 
  ensureDir, 
  extractZip, 
  readJsonFile, 
  writeJsonFile, 
  exploreDirectory, 
  cleanupDir 
} = require('./utils/fileUtils');
const { processGPData } = require('./modules/gpProcessor');
const { processTPUData } = require('./modules/tpuProcessor');
const { processTPData } = require('./modules/tpProcessor');
const { processGPUData } = require('./modules/gpuProcessor');
const { processGPPData } = require('./modules/gppProcessor');
const { processTPPData } = require('./modules/tppProcessor');
const { processVTMData } = require('./modules/vtmProcessor');
const { processSUBSData } = require('./modules/subsProcessor');

// Load configuration
let config;
try {
  const configPath = path.join(__dirname, '..', 'config.json');
  config = readJsonFile(configPath);
  console.log('Configuration loaded successfully');
} catch (error) {
  console.error('Error loading configuration:', error);
  console.log('Using default configuration');
  config = {
    version: "20250407",
    output: {
      fileName: "TMT-CS.json"
    },
    validation: {
      cleanupInvalidReferences: true,
      generateReport: true
    }
  };
}

// Constants
const BASE_DIR = path.join(__dirname, '..');
const INPUT_DIR = path.join(BASE_DIR, 'input');
const OUTPUT_DIR = path.join(BASE_DIR, 'output');
const TEMPLATE_FILE = path.join(INPUT_DIR, 'TMT-CS-template.json');
const ZIP_FILE = path.join(INPUT_DIR, `TMTRF${config.version}.zip`);
const EXTRACT_DIR = path.join(BASE_DIR, 'temp');
const OUTPUT_FILE = path.join(OUTPUT_DIR, config.output.fileName);

/**
 * Formats a date string in the format YYYYMMDD to YYYY-MM-DD
 * @param {string} versionDate - Date in YYYYMMDD format
 * @returns {string} Date in YYYY-MM-DD format
 */
function formatDateFromVersion(versionDate) {
  if (!versionDate || versionDate.length !== 8) {
    return "";
  }
  
  const year = versionDate.substring(0, 4);
  const month = versionDate.substring(4, 6);
  const day = versionDate.substring(6, 8);
  
  return `${year}-${month}-${day}T00:00:00+07:00`;
}

/**
 * Removes duplicate concepts from the template based on concept.code
 * @param {Object} templateJson - The template JSON object
 * @returns {number} The number of duplicate concepts removed
 */
function removeDuplicateConcepts(templateJson) {
  if (!templateJson.concept || !Array.isArray(templateJson.concept)) {
    console.log('No concepts found in template');
    return 0;
  }

  console.log(`Total concepts before deduplication: ${templateJson.concept.length}`);
  
  // Create a map to store unique concepts by code
  const uniqueConceptsMap = new Map();
  
  // Iterate through all concepts and keep only the first occurrence of each code
  for (const concept of templateJson.concept) {
    if (concept && concept.code) {
      if (!uniqueConceptsMap.has(concept.code)) {
        uniqueConceptsMap.set(concept.code, concept);
      }
    }
  }
  
  // Create new array with only unique concepts
  const uniqueConcepts = Array.from(uniqueConceptsMap.values());
  
  // Calculate number of duplicates removed
  const removedCount = templateJson.concept.length - uniqueConcepts.length;
  
  // Update the template with deduplicated concepts
  templateJson.concept = uniqueConcepts;
  
  console.log(`Removed ${removedCount} duplicate concepts`);
  console.log(`Total concepts after deduplication: ${templateJson.concept.length}`);
  
  return removedCount;
}

/**
 * Validates that all parent and child references in the code system point to existing concepts
 * @param {Object} templateJson - The template JSON object
 * @param {boolean} cleanupInvalidRefs - Whether to remove invalid references
 * @returns {Object} Object containing invalid references and statistics
 */
function validateParentChildReferences(templateJson, cleanupInvalidRefs = false) {
  console.log('Validating parent-child references...');
  
  // Create a set of all concept codes for quick lookup
  const conceptCodes = new Set();
  templateJson.concept.forEach(concept => {
    if (concept && concept.code) {
      conceptCodes.add(concept.code);
    }
  });
  
  // Track invalid references
  const invalidReferences = {
    parent: [],
    child: []
  };
  
  let removedCount = 0;
  
  // Check all concepts for invalid parent/child references
  templateJson.concept.forEach(concept => {
    if (!concept.property) return;
    
    if (cleanupInvalidRefs) {
      // Filter out invalid references if cleanup is enabled
      const validProperties = concept.property.filter(property => {
        if (property.code === "parent" && property.valueCode) {
          if (!conceptCodes.has(property.valueCode)) {
            invalidReferences.parent.push({
              concept: concept.code,
              reference: property.valueCode
            });
            removedCount++;
            return false;
          }
        }
        
        if (property.code === "child" && property.valueCode) {
          if (!conceptCodes.has(property.valueCode)) {
            invalidReferences.child.push({
              concept: concept.code,
              reference: property.valueCode
            });
            removedCount++;
            return false;
          }
        }
        
        return true;
      });
      
      concept.property = validProperties;
    } else {
      // Just track invalid references without removing them
      concept.property.forEach(property => {
        if (property.code === "parent" && property.valueCode) {
          if (!conceptCodes.has(property.valueCode)) {
            invalidReferences.parent.push({
              concept: concept.code,
              reference: property.valueCode
            });
          }
        }
        
        if (property.code === "child" && property.valueCode) {
          if (!conceptCodes.has(property.valueCode)) {
            invalidReferences.child.push({
              concept: concept.code,
              reference: property.valueCode
            });
          }
        }
      });
    }
  });
  
  // Log results
  const totalInvalid = invalidReferences.parent.length + invalidReferences.child.length;
  if (totalInvalid === 0) {
    console.log('All parent-child references are valid.');
  } else {
    console.log(`Found ${totalInvalid} invalid references:`);
    console.log(`- ${invalidReferences.parent.length} invalid parent references`);
    console.log(`- ${invalidReferences.child.length} invalid child references`);
    
    if (cleanupInvalidRefs) {
      console.log(`Removed ${removedCount} invalid references`);
    }
    
    // Log some examples if there are many invalid references
    if (invalidReferences.parent.length > 0) {
      const examples = invalidReferences.parent.slice(0, Math.min(5, invalidReferences.parent.length));
      console.log('Example invalid parent references:');
      examples.forEach(example => {
        console.log(`  Concept ${example.concept} references non-existent parent ${example.reference}`);
      });
    }
    
    if (invalidReferences.child.length > 0) {
      const examples = invalidReferences.child.slice(0, Math.min(5, invalidReferences.child.length));
      console.log('Example invalid child references:');
      examples.forEach(example => {
        console.log(`  Concept ${example.concept} references non-existent child ${example.reference}`);
      });
    }
  }
  
  return {
    valid: totalInvalid === 0,
    invalidReferences,
    stats: {
      totalConcepts: templateJson.concept.length,
      invalidParentRefs: invalidReferences.parent.length,
      invalidChildRefs: invalidReferences.child.length,
      removedCount: cleanupInvalidRefs ? removedCount : 0
    }
  };
}

/**
 * Main function to process the TMT data
 */
async function processTMTData() {
  console.log('TMT to FHIR Converter started');
  console.log(`Using version: ${config.version}`);
  console.log(`Using zip file: TMTRF${config.version}.zip`);
  
  try {
    // Ensure output and temp directories exist
    ensureDir(OUTPUT_DIR);
    ensureDir(EXTRACT_DIR);
    
    // Step 1: Extract the zip file
    console.log('Extracting zip file...');
    extractZip(ZIP_FILE, EXTRACT_DIR);
    console.log('Zip file extracted successfully');
    
    // Read the template file
    console.log('Reading template file...');
    const templateJson = readJsonFile(TEMPLATE_FILE);
    
    // Update version and date in the template
    templateJson.version = config.version;
    templateJson.date = formatDateFromVersion(config.version);
    templateJson.title = `Thai Medicines Terminology (TMT) ${config.version}`;
    
    // Remove the TEMPLATE concept from the template before adding new concepts
    console.log('Removing template concept from JSON...');
    templateJson.concept = templateJson.concept.filter(concept => concept.code !== 'TEMPLATE');
    
    // Explore directory to find the TMT folders
    console.log('Exploring extracted files...');
    const extractedFiles = exploreDirectory(EXTRACT_DIR);
    console.log(`Found ${extractedFiles.length} files`);
    
    // Find the TMT directory (with format TMTRFYYYYMMDD)
    const tmtDirPattern = /^TMTRF\d{8}$/;
    const tmtBonusDirPattern = /^TMTRF\d{8}_BONUS$/;
    
    const tmtDir = extractedFiles.find(file => 
      tmtDirPattern.test(file.name) && file.isDirectory
    );
    
    const tmtBonusDir = extractedFiles.find(file => 
      tmtBonusDirPattern.test(file.name) && file.isDirectory
    );
    
    if (!tmtDir || !tmtBonusDir) {
      console.log('Directory structure:', extractedFiles.map(f => `${f.name} (${f.isDirectory ? 'dir' : 'file'})`).join('\n'));
      throw new Error('Required TMT directories not found in the zip file');
    }
    
    console.log(`Processing data from ${tmtDir.name}...`);
    
    // Process data in sequence
    // Step 2: Process SUBS data
    processSUBSData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 3: Process VTM data
    processVTMData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 4: Process GP data
    processGPData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 5: Process GPU data
    processGPUData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 6: Process GPP data
    processGPPData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 7: Process TPU data
    processTPUData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 8: Process TP data
    processTPData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 9: Process TPP data
    processTPPData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // New Step: Validate parent-child references
    const cleanupInvalidRefs = config.validation && config.validation.cleanupInvalidReferences !== undefined 
      ? config.validation.cleanupInvalidReferences 
      : false;
    const validationResult = validateParentChildReferences(templateJson, cleanupInvalidRefs);
    
    // Step 10: Remove duplicate concepts
    console.log('Removing duplicate concepts...');
    removeDuplicateConcepts(templateJson);
    
    // Write the output file
    console.log('Writing output file...');
    writeJsonFile(OUTPUT_FILE, templateJson);
    
    console.log(`Conversion completed. Output saved to: ${OUTPUT_FILE}`);
    
    // Write validation results to a separate file if there are invalid references
    if (!validationResult.valid && config.validation && config.validation.generateReport) {
      const validationFilePath = path.join(OUTPUT_DIR, 'validation-report.json');
      writeJsonFile(validationFilePath, {
        version: config.version,
        date: new Date().toISOString(),
        validation: validationResult
      });
      console.log(`Validation report saved to: ${validationFilePath}`);
    }
  } catch (error) {
    console.error('Error processing TMT data:', error);
  } finally {
    // Clean up the temp directory
    console.log('Cleaning up temporary files...');
    cleanupDir(EXTRACT_DIR);
  }
}

// Start the application
processTMTData(); 