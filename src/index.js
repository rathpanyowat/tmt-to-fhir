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
    
    // Step 2: Process GP data
    processGPData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 3: Process GPU data
    processGPUData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 4: Process GPP data
    processGPPData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 5: Process TPU data
    processTPUData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 6: Process TP data
    processTPData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Write the output file
    console.log('Writing output file...');
    writeJsonFile(OUTPUT_FILE, templateJson);
    
    console.log(`Conversion completed. Output saved to: ${OUTPUT_FILE}`);
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