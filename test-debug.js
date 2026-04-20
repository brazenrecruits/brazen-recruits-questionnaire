const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const BASE_DIR = '/sessions/great-brave-knuth/mnt/brazen-recruits-questionnaire';
const FUNCTIONS_DIR = path.join(BASE_DIR, 'netlify', 'functions');

console.log('====== PDF PACKET GENERATOR DEBUG TEST ======\n');

(async () => {
  try {
    // 1. Load BrazenRecruits template from meps-template-b64.js
    console.log('1. LOADING BRAZEN TEMPLATE (MEPS)\n');
    const mepsTemplateModule = require(path.join(FUNCTIONS_DIR, 'meps-template-b64.js'));
    const mepsB64String = mepsTemplateModule;

    if (!mepsB64String || typeof mepsB64String !== 'string') {
      throw new Error('meps-template-b64.js does not export a valid base64 string');
    }
    console.log('   ✓ Loaded meps-template-b64.js');
    console.log(`   - Base64 string length: ${mepsB64String.length} characters\n`);

    // Decode and load as PDF
    const mepsBuffer = Buffer.from(mepsB64String, 'base64');
    console.log(`   - Decoded buffer size: ${mepsBuffer.length} bytes`);

    const mepsPdf = await PDFDocument.load(mepsBuffer);
    console.log(`   - PDF loaded successfully`);
    console.log(`   - Page count: ${mepsPdf.getPageCount()} pages\n`);

    // 2. List ALL field names containing rrnco, meps, rsp
    console.log('2. SEARCHING FOR TARGET FIELD NAMES\n');
    const mepsForm = mepsPdf.getForm();
    const allFields = mepsForm.getFields();

    console.log(`   Total form fields in MEPS template: ${allFields.length}\n`);
    console.log('   All field names:\n');

    const targetPatterns = ['rrnco', 'meps', 'rsp'];
    const matchedFields = [];
    const allFieldNames = [];

    allFields.forEach((field) => {
      const fieldName = field.getName();
      allFieldNames.push(fieldName);

      const lowerName = fieldName.toLowerCase();
      const isMatch = targetPatterns.some(pattern => lowerName.includes(pattern));

      if (isMatch) {
        matchedFields.push(fieldName);
        console.log(`   → ${fieldName}`);
      }
    });

    console.log(`\n   Matched fields: ${matchedFields.length}`);
    console.log(`   Non-matched fields: ${allFieldNames.length - matchedFields.length}\n`);

    if (matchedFields.length === 0) {
      console.log('   ⚠️  WARNING: No fields matching rrnco, meps, or rsp found!\n');
      console.log('   Full field list (first 30):');
      allFieldNames.slice(0, 30).forEach((name, i) => {
        console.log(`      ${i + 1}. ${name}`);
      });
    }

    // 3. Try to set the matched fields with test values
    console.log('\n3. ATTEMPTING TO SET MATCHED FIELDS\n');

    const testValues = {
      'rrnco_first_name': 'TEST_FIRST',
      'rrnco_mi': 'T',
      'rrnco_last_name': 'TEST_LAST',
      'rrnco_rrb_state': 'TEXAS',
      'rrnco_rsid': 'TXD',
      'rrnco_rrb_team': 'D',
      'rrnco_phone': '555-0123',
      'rrnco_rank_grade': 'SGT / E-5',
      'rrnco_street': 'TEST STREET',
      'rrnco_city': 'TEST CITY',
      'rrnco_state': 'TX',
      'rrnco_zip': '75001',
      'rrnco_email': 'test@example.com',
      'meps_name': 'TEST MEPS C38',
      'meps_address': '207 S TEST ST',
      'meps_med_records_release': 'TEST MEPS C38',
      'rsp_street': 'TEST CROSSING RD',
      'rsp_city_state_zip': 'TEST CITY, TX, 75001',
    };

    let successCount = 0;
    let failureCount = 0;
    const failures = [];

    for (const [fieldName, testValue] of Object.entries(testValues)) {
      try {
        const field = mepsForm.getFieldMaybe(fieldName);
        if (field) {
          mepsForm.getTextField(fieldName).setText(testValue);
          console.log(`   ✓ ${fieldName}: SET successfully`);
          successCount++;
        } else {
          console.log(`   ✗ ${fieldName}: FIELD NOT FOUND`);
          failureCount++;
          failures.push(fieldName);
        }
      } catch (err) {
        console.log(`   ✗ ${fieldName}: ERROR - ${err.message}`);
        failureCount++;
        failures.push(fieldName);
      }
    }

    console.log(`\n   Summary: ${successCount} set, ${failureCount} failed\n`);
    if (failures.length > 0) {
      console.log(`   Failed to set: ${failures.join(', ')}\n`);
    }

    // 4. Check if other template files exist and can be loaded
    console.log('4. CHECKING OTHER TEMPLATE FILES\n');

    const templateFiles = [
      'application-template-b64.js',
      'earwax-template-b64.js'
    ];

    for (const filename of templateFiles) {
      const filepath = path.join(FUNCTIONS_DIR, filename);
      try {
        if (fs.existsSync(filepath)) {
          console.log(`   ✓ ${filename} exists`);
          const stats = fs.statSync(filepath);
          console.log(`     - Size: ${stats.size} bytes`);

          // Try to load it
          try {
            const templateModule = require(filepath);
            const b64String = templateModule;

            if (typeof b64String !== 'string') {
              console.log(`     ⚠️  WARNING: Does not export a string`);
            } else {
              console.log(`     - Base64 length: ${b64String.length} characters`);

              const buffer = Buffer.from(b64String, 'base64');
              console.log(`     - Decoded size: ${buffer.length} bytes`);

              const pdf = await PDFDocument.load(buffer);
              console.log(`     - PDF loaded: ${pdf.getPageCount()} pages`);
            }
          } catch (err) {
            console.log(`     ✗ Error loading: ${err.message}`);
          }
        } else {
          console.log(`   ✗ ${filename} NOT FOUND`);
        }
      } catch (err) {
        console.log(`   ✗ Error checking ${filename}: ${err.message}`);
      }
      console.log('');
    }

    // 5. Test merging all 3 PDFs
    console.log('5. TESTING PDF MERGE (CONCATENATE ALL 3 TEMPLATES)\n');

    try {
      // Load all three
      const appTemplateModule = require(path.join(FUNCTIONS_DIR, 'application-template-b64.js'));
      const appBuffer = Buffer.from(appTemplateModule, 'base64');
      const appPdf = await PDFDocument.load(appBuffer);

      const earwaxTemplateModule = require(path.join(FUNCTIONS_DIR, 'earwax-template-b64.js'));
      const earwaxBuffer = Buffer.from(earwaxTemplateModule, 'base64');
      const earwaxPdf = await PDFDocument.load(earwaxBuffer);

      console.log(`   MEPS pages: ${mepsPdf.getPageCount()}`);
      console.log(`   Application pages: ${appPdf.getPageCount()}`);
      console.log(`   Earwax pages: ${earwaxPdf.getPageCount()}`);

      // Create output document
      const outputPdf = await PDFDocument.create();

      // Copy pages from MEPS
      const mepsPages = await outputPdf.copyPages(mepsPdf, mepsPdf.getPageIndices());
      mepsPages.forEach(page => outputPdf.addPage(page));

      // Copy pages from Application
      const appPages = await outputPdf.copyPages(appPdf, appPdf.getPageIndices());
      appPages.forEach(page => outputPdf.addPage(page));

      // Copy pages from Earwax
      const earwaxPages = await outputPdf.copyPages(earwaxPdf, earwaxPdf.getPageIndices());
      earwaxPages.forEach(page => outputPdf.addPage(page));

      const finalPageCount = outputPdf.getPageCount();
      console.log(`\n   ✓ Merge successful!`);
      console.log(`   - Final document page count: ${finalPageCount}`);
      console.log(`   - Expected: ${mepsPdf.getPageCount() + appPdf.getPageCount() + earwaxPdf.getPageCount()}`);

      // Save to test file
      const testOutputPath = path.join(BASE_DIR, 'test-output.pdf');
      const pdfBytes = await outputPdf.save();
      fs.writeFileSync(testOutputPath, pdfBytes);
      console.log(`   - Test output saved to: test-output.pdf (${pdfBytes.length} bytes)\n`);

    } catch (err) {
      console.log(`   ✗ Merge failed: ${err.message}\n`);
    }

    console.log('====== TEST COMPLETE ======');

  } catch (err) {
    console.error('FATAL ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
