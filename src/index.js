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
    input: {
      zipFile: "TMTRF20250407.zip"
    },
    output: {
      fileName: "TMT-CS-output.json"
    }
  };
}

// Constants
const BASE_DIR = path.join(__dirname, '..');
const INPUT_DIR = path.join(BASE_DIR, 'input');
const OUTPUT_DIR = path.join(BASE_DIR, 'output');
const TEMPLATE_FILE = path.join(INPUT_DIR, 'TMT-CS-template.json');
const ZIP_FILE = path.join(INPUT_DIR, config.input.zipFile);
const EXTRACT_DIR = path.join(BASE_DIR, 'temp');
const OUTPUT_FILE = path.join(OUTPUT_DIR, config.output.fileName);

/**
 * Main function to process the TMT data
 */
async function processTMTData() {
  console.log('TMT to FHIR Converter started');
  console.log(`Using input zip file: ${config.input.zipFile}`);
  
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
    
    // Step 4: Process TPU data
    processTPUData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 5: Process TP data
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