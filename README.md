# TMT to FHIR Converter

This Node.js application processes Thai Medicines Terminology (TMT) data from Excel files and populates a FHIR CodeSystem JSON template.

## Requirements

- Node.js 14.x or higher
- npm 7.x or higher

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/tmt-to-fhir.git
cd tmt-to-fhir
npm install
```

## Input Files

Place your input files in the `input` directory:

1. **TMT-CS-template.json** - The FHIR CodeSystem template file (this file name is fixed)
2. **TMTRFYYYYMMDD.zip** - The zip file containing TMT data (the name of this file is configurable)

The zip file should contain:
- TMTRFYYYYMMDD folder with TMTRFYYYYMMDD_SNAPSHOT.xls
- TMTRFYYYYMMDD_BONUS folder with relationship files

## Configuration

The application uses a configuration file (`config.json`) to specify which input zip file to process:

```json
{
  "input": {
    "zipFile": "TMTRF20250407.zip"
  },
  "output": {
    "fileName": "TMT-CS-output.json"
  }
}
```

When you receive a new TMT zip file, simply update the `zipFile` value in `config.json` to point to the new file, then run the application.

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
6. Output the result to the specified output file (default: `output/TMT-CS-output.json`)

## Data Processing

The application processes the following data:

1. **TPU (Trade Product Unit) data**:
   - Maps TPU codes and their display names from the SNAPSHOT.xls file
   - Finds GPU parents from GPUtoTPUYYYYMMDD.xls
   - Finds TP parents from TPtoTPUYYYYMMDD.xls
   - Finds TPP children from TPUtoTPPYYYYMMDD.xls

2. **TP (Trade Product) data**:
   - Maps TP codes and display names from Concept/TPYYYYMMDD.xls
   - Finds GP parents from Relationship/GPtoTPYYYYMMDD.xls
   - Finds TPU children from Relationship/TPtoTPUYYYYMMDD.xls

## License

ISC
