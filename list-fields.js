const { PDFDocument } = require('pdf-lib');
const templateB64 = require('./netlify/functions/meps-template-b64.js');

async function listFields() {
  const pdfBytes = Buffer.from(templateB64, 'base64');
  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();
  const fields = form.getFields();

  // Look for fields related to RRNCO, MEPS, RSP, recruiter, unit
  const keywords = ['rrnco', 'meps', 'rsp', 'recruiter', 'unit', 'rrb', 'rsid', 'grade', 'rank', 'phone', 'fax', 'email', 'med_rec', 'first_name', 'last_name', 'address', 'city', 'state', 'zip', 'street'];

  for (const field of fields) {
    const name = field.getName().toLowerCase();
    if (keywords.some(kw => name.includes(kw))) {
      console.log(`${field.constructor.name}: "${field.getName()}"`);
    }
  }

  console.log('\n--- ALL FIELDS (first 2 pages context) ---');
  for (const field of fields) {
    const name = field.getName();
    // Print all fields to find the RRNCO/MEPS/RSP ones
    console.log(`${field.constructor.name}: "${name}"`);
  }
}

listFields().catch(console.error);
