# TMT to FHIR Converter

This Node.js application processes Thai Medicines Terminology (TMT) data from Excel files and populates a FHIR CodeSystem JSON template.

## Requirements

- Node.js 14.x or higher
- npm 7.x or higher

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

## Input Files

Place your input files in the `input` directory:

1. **TMTRFYYYYMMDD.zip** - The zip file containing TMT data (the name of this file is configurable)

The zip file should contain:
- TMTRFYYYYMMDD folder with TMTRFYYYYMMDD_SNAPSHOT.xls
- TMTRFYYYYMMDD_BONUS folder with relationship files

## Configuration

The application uses a configuration file (`config.json`) to specify which input zip file to process:

```json
{
  "version": "20250407",
  "output": {
    "fileName": "TMT-CS.json"
  },
  "validation": {
    "cleanupInvalidReferences": true,
    "generateReport": true
  }
} 
```

When you receive a new TMT zip file, simply update the `version` value in `config.json` to point to the new file, then run the application.

## New Feature: Validation of Parent-Child Relationships

The converter now includes validation of parent-child relationships to ensure referential integrity in the output file. This helps identify and optionally fix issues where concepts reference non-existent parents or children.

### Configuration Options

In `config.json`, you can control validation behavior:

```json
{
  "validation": {
    "cleanupInvalidReferences": true,
    "generateReport": true
  }
}
```

- `cleanupInvalidReferences`: When set to `true`, any references to non-existent concepts will be removed from the output file.
- `generateReport`: When set to `true`, a validation report will be generated in the output directory when invalid references are found.

### Validation Report

If invalid references are found, a `validation-report.json` file will be generated in the output directory with details about the problematic references.

## Usage

Run the application:

```bash
npm start
```

The application will:
1. Load the configuration from `config.json`
2. Extract the specified zip file
3. Read the template file (TMT-CS-template.json)
4. Process the TPU data from the SNAPSHOT.xls file
5. Establish parent-child relationships from relationship files
6. Output the result to the specified output file (default: `output/TMT-CS.json`)
