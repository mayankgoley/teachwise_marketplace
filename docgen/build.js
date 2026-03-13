#!/usr/bin/env node
/**
 * TeachWise Code Reference — Document Builder
 * Assembles all section files and generates the final .docx
 */

const { Document, Packer, LevelFormat } = require("docx");
const fs = require("fs");
const path = require("path");

// Import all section modules
const mainModule = require("./generate_code_reference");
const serviceSections = require("./sections_services");
const utilsModelSections = require("./sections_utils_models");
const crossCuttingSections = require("./sections_cross_cutting");

// Combine all sections in order:
//   Cover + How to Use + Sections 1-2 (from main)
//   Sections 3-10 (services)
//   Sections 11-19 (utils & models)
//   Sections A-D (cross-cutting)
const allSections = [
  ...mainModule.sections,
  ...serviceSections,
  ...utilsModelSections,
  ...crossCuttingSections,
];

console.log(`Assembling ${allSections.length} sections...`);

// Build the Document with numbering definitions
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "\u2022",
            alignment: "left",
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
          {
            level: 1,
            format: LevelFormat.BULLET,
            text: "\u25E6",
            alignment: "left",
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
          },
          {
            level: 2,
            format: LevelFormat.BULLET,
            text: "\u25AA",
            alignment: "left",
            style: { paragraph: { indent: { left: 2160, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: "left",
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
          {
            level: 1,
            format: LevelFormat.LOWER_LETTER,
            text: "%2.",
            alignment: "left",
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
          },
          {
            level: 2,
            format: LevelFormat.LOWER_ROMAN,
            text: "%3.",
            alignment: "left",
            style: { paragraph: { indent: { left: 2160, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: allSections,
});

// Generate and write
const outputPath = path.resolve(__dirname, "..", "TeachWise_Code_Reference.docx");

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
  console.log(`✓ Generated: ${outputPath}`);
  console.log(`  Size: ${sizeMB} MB`);
  console.log(`  Sections: ${allSections.length}`);
}).catch((err) => {
  console.error("Failed to generate document:", err);
  process.exit(1);
});
