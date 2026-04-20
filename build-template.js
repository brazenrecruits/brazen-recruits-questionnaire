/**
 * Build merged MEPS template:
 *   Pages 1-9:  BrazenRecruits custom pages (from current template)
 *   Pages 10-25: APPLICATION.pdf (16 pages, real government form)
 *   Pages 26-27: Ear Wax SF 507 (2 pages, real government form)
 *   Pages 28+:  Remaining govt forms from current template (HRR 907, HRR 900,
 *               DD 1966, W-4, Medical Release, Drug/Alcohol) until we get originals
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function main() {
  // Load current template
  const b64Content = fs.readFileSync(
    '/sessions/great-brave-knuth/mnt/brazen-recruits-questionnaire/netlify/functions/meps-template-b64.js',
    'utf-8'
  );
  const b64Match = b64Content.match(/['"]([A-Za-z0-9+/=]{100,})['"]/);
  if (!b64Match) throw new Error('Could not extract base64 from template');
  const currentTemplate = await PDFDocument.load(Buffer.from(b64Match[1], 'base64'));

  // Load government forms
  const applicationPdf = await PDFDocument.load(
    fs.readFileSync('/sessions/great-brave-knuth/mnt/uploads/2. APPLICATION.pdf')
  );
  const earWaxPdf = await PDFDocument.load(
    fs.readFileSync('/sessions/great-brave-knuth/mnt/uploads/Ear Wax Removal (Jun2025).pdf')
  );

  console.log(`Current template: ${currentTemplate.getPageCount()} pages`);
  console.log(`APPLICATION.pdf: ${applicationPdf.getPageCount()} pages`);
  console.log(`Ear Wax PDF: ${earWaxPdf.getPageCount()} pages`);

  // Create new merged document
  const merged = await PDFDocument.create();

  // Step 1: Copy pages 1-9 from current template (indices 0-8)
  const brazenPages = await merged.copyPages(currentTemplate, [0,1,2,3,4,5,6,7,8]);
  for (const page of brazenPages) {
    merged.addPage(page);
  }
  console.log(`Added ${brazenPages.length} BrazenRecruits custom pages`);

  // Step 2: Copy all 16 pages from APPLICATION.pdf
  const appPageIndices = Array.from({length: applicationPdf.getPageCount()}, (_, i) => i);
  const appPages = await merged.copyPages(applicationPdf, appPageIndices);
  for (const page of appPages) {
    merged.addPage(page);
  }
  console.log(`Added ${appPages.length} APPLICATION pages`);

  // Step 3: Copy 2 pages from Ear Wax PDF
  const earWaxPageIndices = Array.from({length: earWaxPdf.getPageCount()}, (_, i) => i);
  const earWaxPages = await merged.copyPages(earWaxPdf, earWaxPageIndices);
  for (const page of earWaxPages) {
    merged.addPage(page);
  }
  console.log(`Added ${earWaxPages.length} Ear Wax pages`);

  // Step 4: Copy remaining government forms from current template (pages 10-18, indices 9-18)
  // These are: HRR 907, HRR 900, DD 1966, W-4, Medical Release (2pg), Drug/Alcohol, old Cerumen (skip), Certification
  // Skip old cerumen pages (indices 16,17) since we replaced them with real SF 507
  const remainingIndices = [9, 10, 11, 12, 13, 14, 15, 18]; // skip 16,17 (old cerumen)
  const remainingPages = await merged.copyPages(currentTemplate, remainingIndices);
  for (const page of remainingPages) {
    merged.addPage(page);
  }
  console.log(`Added ${remainingPages.length} remaining pages from current template`);

  // Save
  const mergedBytes = await merged.save();
  const outputPath = '/sessions/great-brave-knuth/mnt/brazen-recruits-questionnaire/netlify/functions/meps-template.pdf';
  fs.writeFileSync(outputPath, mergedBytes);
  console.log(`\nMerged template saved: ${outputPath}`);
  console.log(`Total pages: ${merged.getPageCount()}`);
  console.log(`File size: ${(mergedBytes.length / 1024).toFixed(1)} KB`);

  // Also check form fields survived the merge
  const reloaded = await PDFDocument.load(mergedBytes);
  const form = reloaded.getForm();
  const fields = form.getFields();
  console.log(`Form fields in merged PDF: ${fields.length}`);
  
  // Show field names from APPLICATION pages
  const appFieldNames = fields.filter(f => f.getName().startsWith('Check Box') || 
    ['Primary Beneficiary First', 'a If so which Languages', 'Email'].includes(f.getName()));
  console.log(`Sample APPLICATION fields preserved: ${appFieldNames.length > 0 ? 'YES' : 'NO'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
