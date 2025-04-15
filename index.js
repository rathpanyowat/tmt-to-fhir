/**
 * TMT to FHIR Converter
 * 
 * This application processes TMT data from Excel files and populates a FHIR CodeSystem template.
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const XLSX = require('xlsx');
const fsExtra = require('fs-extra');

// Load configuration
let config;
try {
  const configPath = path.join(__dirname, 'config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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
const INPUT_DIR = path.join(__dirname, 'input');
const OUTPUT_DIR = path.join(__dirname, 'output');
const TEMPLATE_FILE = path.join(INPUT_DIR, 'TMT-CS-template.json');
const ZIP_FILE = path.join(INPUT_DIR, config.input.zipFile);
const EXTRACT_DIR = path.join(__dirname, 'temp');
const OUTPUT_FILE = path.join(OUTPUT_DIR, config.output.fileName);

// Ensure output and temp directories exist
fsExtra.ensureDirSync(OUTPUT_DIR);
fsExtra.ensureDirSync(EXTRACT_DIR);

/**
 * Main function to process the TMT data
 */
async function processTMTData() {
  console.log('TMT to FHIR Converter started');
  console.log(`Using input zip file: ${config.input.zipFile}`);
  
  try {
    // Step 1: Extract the zip file
    console.log('Extracting zip file...');
    const zip = new AdmZip(ZIP_FILE);
    zip.extractAllTo(EXTRACT_DIR, true);
    console.log('Zip file extracted successfully');
    
    // Read the template file
    console.log('Reading template file...');
    const templateJson = JSON.parse(fs.readFileSync(TEMPLATE_FILE, 'utf8'));
    
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
    
    // Step 2: Process TPU data
    processTPUData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Step 3: Process TP data
    processTPData(templateJson, tmtDir.path, tmtBonusDir.path);
    
    // Write the output file
    console.log('Writing output file...');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(templateJson, null, 2));
    
    console.log(`Conversion completed. Output saved to: ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('Error processing TMT data:', error);
  } finally {
    // Clean up the temp directory
    console.log('Cleaning up temporary files...');
    fsExtra.removeSync(EXTRACT_DIR);
  }
}

/**
 * Recursively explore a directory and return all files and directories
 */
function exploreDirectory(dir, relativePath = '') {
  const result = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const relPath = path.join(relativePath, item);
    const stat = fs.statSync(itemPath);
    
    result.push({
      name: item,
      path: itemPath,
      relativePath: relPath,
      isDirectory: stat.isDirectory()
    });
    
    if (stat.isDirectory()) {
      result.push(...exploreDirectory(itemPath, relPath));
    }
  }
  
  return result;
}

/**
 * Process TPU data from the snapshot file and update the template
 */
function processTPUData(templateJson, tmtDirPath, tmtBonusDirPath) {
  console.log('Processing TPU data...');
  
  try {
    // Find the snapshot file
    const snapshotPattern = /_SNAPSHOT\.xls$/i;
    let snapshotFile = null;
    
    // List files in the directory and find the snapshot file
    const tmtFiles = fs.readdirSync(tmtDirPath);
    for (const file of tmtFiles) {
      if (snapshotPattern.test(file)) {
        snapshotFile = path.join(tmtDirPath, file);
        break;
      }
    }
    
    if (!snapshotFile) {
      console.log(`Files in ${tmtDirPath}:`, fs.readdirSync(tmtDirPath).join(', '));
      throw new Error('Snapshot file not found');
    }
    
    console.log(`Found snapshot file: ${snapshotFile}`);
    
    // Find relationship files
    const relationshipDir = path.join(tmtBonusDirPath, 'Relationship');
    
    // Check if the Relationship directory exists
    if (!fs.existsSync(relationshipDir) || !fs.statSync(relationshipDir).isDirectory()) {
      console.log(`Files in ${tmtBonusDirPath}:`, fs.readdirSync(tmtBonusDirPath).join(', '));
      throw new Error('Relationship directory not found');
    }
    
    // List all relationship files
    const relationshipFiles = fs.readdirSync(relationshipDir);
    console.log('Relationship files:', relationshipFiles);
    
    // Find the specific relationship files we need
    let gpuToTpuFile = null;
    let tpToTpuFile = null;
    let tpuToTppFile = null;
    
    for (const file of relationshipFiles) {
      const lowerFile = file.toLowerCase();
      if (lowerFile.includes('gputotpu')) {
        gpuToTpuFile = path.join(relationshipDir, file);
      } else if (lowerFile.includes('tptotpu')) {
        tpToTpuFile = path.join(relationshipDir, file);
      } else if (lowerFile.includes('tputotpp')) {
        tpuToTppFile = path.join(relationshipDir, file);
      }
    }
    
    if (!gpuToTpuFile || !tpToTpuFile || !tpuToTppFile) {
      throw new Error(`One or more relationship files not found. 
        GPU->TPU: ${gpuToTpuFile ? 'Found' : 'Not found'}
        TP->TPU: ${tpToTpuFile ? 'Found' : 'Not found'}
        TPU->TPP: ${tpuToTppFile ? 'Found' : 'Not found'}`);
    }
    
    console.log(`Found relationship files: 
      - GPUtoTPU: ${gpuToTpuFile}
      - TPtoTPU: ${tpToTpuFile}
      - TPUtoTPP: ${tpuToTppFile}`);
    
    // Read the snapshot file
    const workbook = XLSX.readFile(snapshotFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log(`Snapshot file loaded, ${rows.length} rows found`);
    if (rows.length > 0) {
      console.log('First row:', JSON.stringify(rows[0]));
    }
    
    // Read the relationship files
    const gpuToTpuWorkbook = XLSX.readFile(gpuToTpuFile);
    const gpuToTpuSheet = gpuToTpuWorkbook.Sheets[gpuToTpuWorkbook.SheetNames[0]];
    const gpuToTpuRows = XLSX.utils.sheet_to_json(gpuToTpuSheet, { header: 1 });
    
    const tpToTpuWorkbook = XLSX.readFile(tpToTpuFile);
    const tpToTpuSheet = tpToTpuWorkbook.Sheets[tpToTpuWorkbook.SheetNames[0]];
    const tpToTpuRows = XLSX.utils.sheet_to_json(tpToTpuSheet, { header: 1 });
    
    const tpuToTppWorkbook = XLSX.readFile(tpuToTppFile);
    const tpuToTppSheet = tpuToTppWorkbook.Sheets[tpuToTppWorkbook.SheetNames[0]];
    const tpuToTppRows = XLSX.utils.sheet_to_json(tpuToTppSheet, { header: 1 });
    
    console.log(`Relationship files loaded:
      - GPUtoTPU: ${gpuToTpuRows.length} rows
      - TPtoTPU: ${tpToTpuRows.length} rows
      - TPUtoTPP: ${tpuToTppRows.length} rows`);
    
    // Skip the header row (if any)
    let startIndex = 0;
    if (rows.length > 0 && rows[0] && rows[0][0] === 'TMTID(TPU)') {
      startIndex = 1;
      console.log('Header row found, starting from row 1');
    }
    
    // Process each TPU row
    let processedCount = 0;
    for (let i = startIndex; i < rows.length; i++) {
      if (!rows[i] || !rows[i][0]) continue; // Skip empty rows
      
      const tpuCode = String(rows[i][0]);
      const tpuDisplay = String(rows[i][1] || '');
      
      // Create a new concept entry for TPU
      const tpuConcept = {
        code: tpuCode,
        display: tpuDisplay,
        property: [
          {
            code: "class",
            valueCode: "TPU"
          },
          {
            code: "status",
            valueCode: "active"
          },
          {
            code: "abstract",
            valueBoolean: "true"
          }
        ]
      };
      
      // Find parent 1 (GPU)
      const gpuParent = gpuToTpuRows.find(row => 
        row && row.length > 1 && String(row[1]) === tpuCode
      );
      
      if (gpuParent) {
        tpuConcept.property.push({
          code: "parent",
          valueCode: String(gpuParent[0])
        });
      }
      
      // Find parent 2 (TP)
      const tpParent = tpToTpuRows.find(row => 
        row && row.length > 1 && String(row[1]) === tpuCode
      );
      
      if (tpParent) {
        tpuConcept.property.push({
          code: "parent",
          valueCode: String(tpParent[0])
        });
      }
      
      // Find children (TPP)
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
      
      // Add the concept to the template
      templateJson.concept.push(tpuConcept);
      processedCount++;
      
      // Log progress every 100 items
      if (processedCount % 100 === 0) {
        console.log(`Processed ${processedCount} TPU concepts...`);
      }
    }
    
    console.log(`Added ${processedCount} TPU concepts to the template`);
  } catch (error) {
    console.error('Error processing TPU data:', error);
    throw error;
  }
}

/**
 * Process TP data from the TP file and update the template
 */
function processTPData(templateJson, tmtDirPath, tmtBonusDirPath) {
  console.log('Processing TP data...');
  
  try {
    // Find the Concept directory with TP file
    const conceptDir = path.join(tmtBonusDirPath, 'Concept');
    
    // Check if the Concept directory exists
    if (!fs.existsSync(conceptDir) || !fs.statSync(conceptDir).isDirectory()) {
      console.log(`Files in ${tmtBonusDirPath}:`, fs.readdirSync(tmtBonusDirPath).join(', '));
      throw new Error('Concept directory not found');
    }
    
    // Find the TP file
    const tpFilePattern = /^TP\d{8}\.xls$/i;
    let tpFile = null;
    
    // List files in the directory and find the TP file
    const conceptFiles = fs.readdirSync(conceptDir);
    for (const file of conceptFiles) {
      if (tpFilePattern.test(file)) {
        tpFile = path.join(conceptDir, file);
        break;
      }
    }
    
    if (!tpFile) {
      console.log(`Files in ${conceptDir}:`, fs.readdirSync(conceptDir).join(', '));
      throw new Error('TP file not found');
    }
    
    console.log(`Found TP file: ${tpFile}`);
    
    // Find relationship files
    const relationshipDir = path.join(tmtBonusDirPath, 'Relationship');
    
    // Check if the Relationship directory exists
    if (!fs.existsSync(relationshipDir) || !fs.statSync(relationshipDir).isDirectory()) {
      console.log(`Files in ${tmtBonusDirPath}:`, fs.readdirSync(tmtBonusDirPath).join(', '));
      throw new Error('Relationship directory not found');
    }
    
    // List all relationship files
    const relationshipFiles = fs.readdirSync(relationshipDir);
    console.log('Relationship files:', relationshipFiles);
    
    // Find the specific relationship files we need for TP
    let gpToTpFile = null;
    let tpToTpuFile = null;
    
    for (const file of relationshipFiles) {
      const lowerFile = file.toLowerCase();
      if (lowerFile.includes('gptotp')) {
        gpToTpFile = path.join(relationshipDir, file);
      } else if (lowerFile.includes('tptotpu')) {
        tpToTpuFile = path.join(relationshipDir, file);
      }
    }
    
    if (!gpToTpFile || !tpToTpuFile) {
      throw new Error(`One or more relationship files not found for TP. 
        GP->TP: ${gpToTpFile ? 'Found' : 'Not found'}
        TP->TPU: ${tpToTpuFile ? 'Found' : 'Not found'}`);
    }
    
    console.log(`Found relationship files for TP: 
      - GPtoTP: ${gpToTpFile}
      - TPtoTPU: ${tpToTpuFile}`);
    
    // Read the TP file
    const tpWorkbook = XLSX.readFile(tpFile);
    const tpSheet = tpWorkbook.Sheets[tpWorkbook.SheetNames[0]];
    const tpRows = XLSX.utils.sheet_to_json(tpSheet, { header: 1 });
    
    console.log(`TP file loaded, ${tpRows.length} rows found`);
    if (tpRows.length > 0) {
      console.log('First row:', JSON.stringify(tpRows[0]));
    }
    
    // Read the relationship files
    const gpToTpWorkbook = XLSX.readFile(gpToTpFile);
    const gpToTpSheet = gpToTpWorkbook.Sheets[gpToTpWorkbook.SheetNames[0]];
    const gpToTpRows = XLSX.utils.sheet_to_json(gpToTpSheet, { header: 1 });
    
    const tpToTpuWorkbook = XLSX.readFile(tpToTpuFile);
    const tpToTpuSheet = tpToTpuWorkbook.Sheets[tpToTpuWorkbook.SheetNames[0]];
    const tpToTpuRows = XLSX.utils.sheet_to_json(tpToTpuSheet, { header: 1 });
    
    console.log(`Relationship files loaded:
      - GPtoTP: ${gpToTpRows.length} rows
      - TPtoTPU: ${tpToTpuRows.length} rows`);
    
    // Skip the header row (if any)
    let startIndex = 0;
    if (tpRows.length > 0 && tpRows[0] && tpRows[0][0] === 'TMTID(TP)') {
      startIndex = 1;
      console.log('Header row found, starting from row 1');
    }
    
    // Process each TP row
    let processedCount = 0;
    for (let i = startIndex; i < tpRows.length; i++) {
      if (!tpRows[i] || !tpRows[i][0]) continue; // Skip empty rows
      
      const tpCode = String(tpRows[i][0]);
      const tpDisplay = String(tpRows[i][1] || '');
      
      // Create a new concept entry for TP
      const tpConcept = {
        code: tpCode,
        display: tpDisplay,
        property: [
          {
            code: "class",
            valueCode: "TP"
          },
          {
            code: "status",
            valueCode: "active"
          },
          {
            code: "abstract",
            valueBoolean: "true"
          }
        ]
      };
      
      // Find parent (GP)
      const gpParent = gpToTpRows.find(row => 
        row && row.length > 1 && String(row[1]) === tpCode
      );
      
      if (gpParent) {
        tpConcept.property.push({
          code: "parent",
          valueCode: String(gpParent[0])
        });
      }
      
      // Find children (TPU)
      const tpuChildren = tpToTpuRows.filter(row => 
        row && row.length > 1 && String(row[0]) === tpCode
      );
      
      if (tpuChildren && tpuChildren.length > 0) {
        tpuChildren.forEach(child => {
          tpConcept.property.push({
            code: "child",
            valueCode: String(child[1])
          });
        });
      }
      
      // Add the concept to the template
      templateJson.concept.push(tpConcept);
      processedCount++;
      
      // Log progress every 100 items
      if (processedCount % 100 === 0) {
        console.log(`Processed ${processedCount} TP concepts...`);
      }
    }
    
    console.log(`Added ${processedCount} TP concepts to the template`);
  } catch (error) {
    console.error('Error processing TP data:', error);
    throw error;
  }
}

// Start the application
processTMTData();
