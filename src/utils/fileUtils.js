/**
 * Utility functions for file operations
 */
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const XLSX = require('xlsx');
const fsExtra = require('fs-extra');

/**
 * Ensure a directory exists, create if it doesn't
 * @param {string} dir - Directory path
 */
function ensureDir(dir) {
  fsExtra.ensureDirSync(dir);
}

/**
 * Extract a zip file to a destination directory
 * @param {string} zipFilePath - Path to the zip file
 * @param {string} destDir - Destination directory
 */
function extractZip(zipFilePath, destDir) {
  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo(destDir, true);
}

/**
 * Read a JSON file and parse its contents
 * @param {string} filePath - Path to the JSON file
 * @returns {Object} Parsed JSON object
 */
function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Write a JSON object to a file
 * @param {string} filePath - Path to output file
 * @param {Object} data - Data to write
 */
function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Recursively explore a directory and return all files and directories
 * @param {string} dir - Directory to explore
 * @param {string} relativePath - Relative path (for recursion)
 * @returns {Array} Array of file and directory objects
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
 * Read an Excel file and convert to JSON
 * @param {string} filePath - Path to Excel file
 * @returns {Object} Excel data as JSON object
 */
function readExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1 });
}

/**
 * Find files matching a pattern in a directory
 * @param {string} dirPath - Directory to search
 * @param {RegExp} pattern - Pattern to match against filenames
 * @returns {Array} Array of matching file paths
 */
function findFiles(dirPath, pattern) {
  const files = fs.readdirSync(dirPath);
  return files
    .filter(file => pattern.test(file))
    .map(file => path.join(dirPath, file));
}

/**
 * Clean up a directory by removing it
 * @param {string} dirPath - Directory to remove
 */
function cleanupDir(dirPath) {
  fsExtra.removeSync(dirPath);
}

module.exports = {
  ensureDir,
  extractZip,
  readJsonFile,
  writeJsonFile,
  exploreDirectory,
  readExcelFile,
  findFiles,
  cleanupDir
}; 