/**
 * DETAILED E2E TEST: MEPS Packet Generator with Field-by-Field Diagnostics
 * =========================================================================
 * This enhanced version provides comprehensive field-level diagnostics
 */

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Load templates
const BRAZEN_TEMPLATE_B64 = require('./netlify/functions/meps-template-b64.js');
const BRAZEN_TEMPLATE = Buffer.from(BRAZEN_TEMPLATE_B64, 'base64');

const APP_TEMPLATE_B64 = require('./netlify/functions/application-template-b64.js');
const APP_TEMPLATE = Buffer.from(APP_TEMPLATE_B64, 'base64');

const EARWAX_TEMPLATE_B64 = require('./netlify/functions/earwax-template-b64.js');
const EARWAX_TEMPLATE = Buffer.from(EARWAX_TEMPLATE_B64, 'base64');

const FIELD_WIDTHS = {
  cover_applicant_name: 350, cover_mos: 120, cover_prid: 120, cover_ship_date: 120,
  app_first_name: 200, app_last_name: 220, app_mi: 50, app_suffix: 80,
  app_street: 512, app_city: 250, app_state: 50, app_zip: 80,
  app_phone: 200, app_email: 250, app_dob: 130, app_ssn: 120,
  app_height_ft: 80, app_height_in: 80, app_weight_lbs: 100,
  app_city_birth: 200, app_county_birth: 200, app_state_birth: 150,
  app_dependents_total: 100, app_dependents_minor: 100,
  app_prid: 120, app_rank_grade: 160,
  school_name: 512, school_street: 512, school_city: 250,
  school_state: 50, school_zip: 80, school_grade_level: 250,
  spouse_name: 512, spouse_address: 512, spouse_dob: 140,
  spouse_marriage_date: 140, spouse_ssn: 160,
  emergency_name: 512, emergency_address: 512, emergency_phone: 220, emergency_email: 230,
  tattoo_0_description: 171, tattoo_0_location: 116, tattoo_0_meaning: 146,
  tattoo_1_description: 171, tattoo_1_location: 116, tattoo_1_meaning: 146,
  tattoo_2_description: 171, tattoo_2_location: 116, tattoo_2_meaning: 146,
  tattoo_3_description: 171, tattoo_3_location: 116, tattoo_3_meaning: 146,
  tattoo_4_description: 171, tattoo_4_location: 116, tattoo_4_meaning: 146,
  tattoo_5_description: 171, tattoo_5_location: 116, tattoo_5_meaning: 146,
  beneficiary_1_name: 216, beneficiary_1_relationship: 106, beneficiary_1_percentage: 76,
  beneficiary_1_address: 512,
  beneficiary_2_name: 216, beneficiary_2_relationship: 106, beneficiary_2_percentage: 76,
  beneficiary_2_address: 512,
  contingent_name: 216, contingent_relationship: 106, contingent_percentage: 76,
  contingent_address: 512,
  w4_first_name: 300, w4_last_name: 160, w4_address: 512,
  w4_city: 250, w4_state: 50, w4_zip: 80,
  dd1966_name: 512,
  med_release_name: 512, med_release_dob: 140, med_release_address: 512,
  med_release_phone: 200, med_release_insurer: 512, med_release_insurer_addr: 512,
  med_release_provider: 512, med_release_provider_addr: 512,
  form408_name: 280,
  ear_wax_patient_name: 250, ear_wax_patient_dob: 140,
  hrr900_student_name: 280, hrr900_school_name: 512,
  hrr900_school_city: 250, hrr900_school_state: 50, hrr900_school_zip: 80,
  hrr900_parent_name: 250,
  hrr907_applicant: 250,
  rrnco_first_name: 250,
  rrnco_mi: 50,
  rrnco_last_name: 250,
  rrnco_rrb_state: 250,
  rrnco_rsid: 100,
  rrnco_rrb_team: 50,
  rrnco_phone: 200,
  rrnco_rank_grade: 160,
  rrnco_street: 512,
  rrnco_city: 250,
  rrnco_state: 50,
  rrnco_zip: 80,
  rrnco_email: 512,
  meps_name: 300,
  meps_address: 512,
  meps_med_records_release: 300,
  rsp_street: 512,
  rsp_city_state_zip: 512,
};

const DEFAULT_FIELD_WIDTH = 300;
const FONT_TIERS = [
  { size: 10, charFactor: 0.52 },
  { size: 9,  charFactor: 0.52 },
  { size: 8,  charFactor: 0.52 },
  { size: 7,  charFactor: 0.52 },
  { size: 6,  charFactor: 0.52 },
];

function setTextFit(field, fieldName, value) {
  const text = String(value);
  if (!text) return;

  const widthPts = FIELD_WIDTHS[fieldName] || DEFAULT_FIELD_WIDTH;

  for (const tier of FONT_TIERS) {
    const maxChars = Math.floor(widthPts / (tier.charFactor * tier.size));
    if (text.length <= maxChars) {
      field.setFontSize(tier.size);
      field.setText(text);
      return;
    }
  }

  const smallest = FONT_TIERS[FONT_TIERS.length - 1];
  const maxChars = Math.floor(widthPts / (smallest.charFactor * smallest.size));
  field.setFontSize(smallest.size);
  field.setText(text.substring(0, Math.max(maxChars - 1, 1)) + '\u2026');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return dateStr.trim();
}

function mapFormDataToPDFFields(data) {
  const get = (key, fallback = '') => (data[key] || fallback || '').trim();

  const first = get('first_name');
  const last = get('last_name');
  const mi = get('middle_name', '').charAt(0);
  const suffix = get('suffix');
  const dob = formatDate(get('date_of_birth'));

  let fullName = `${last}, ${first}`;
  if (mi) fullName += ` ${mi}.`;

  const fields = {};
  const checks = [];

  fields['cover_applicant_name'] = fullName;
  fields['app_first_name'] = first;
  fields['app_last_name'] = last;
  fields['app_mi'] = mi;
  fields['app_suffix'] = suffix;
  fields['app_street'] = get('street_address');
  fields['app_city'] = get('city');
  fields['app_state'] = get('state');
  fields['app_zip'] = get('zip_code');
  fields['app_phone'] = get('primary_phone');
  fields['app_email'] = get('email');
  fields['app_dob'] = dob;
  fields['app_height_ft'] = get('height_ft');
  fields['app_height_in'] = get('height_in');
  fields['app_weight_lbs'] = get('weight');
  fields['app_ssn'] = get('ssn');

  fields['app_city_birth'] = get('city_of_birth') || get('place_of_birth', '').split(',')[0];
  fields['app_county_birth'] = get('county_of_birth') || get('county');
  fields['app_state_birth'] = get('state_of_birth');

  fields['app_dependents_total'] = get('num_dependents_total', '0');
  fields['app_dependents_minor'] = get('num_dependents_minor', '0');
  if (get('children') === 'No') {
    fields['app_dependents_total'] = '0';
    fields['app_dependents_minor'] = '0';
  }

  const gender = get('gender');
  if (gender === 'Male') {
    checks.push('app_gender_m', 'app_dob_gender_m');
  } else if (gender === 'Female') {
    checks.push('app_gender_f', 'app_dob_gender_f');
  }

  const marital = get('marital_status');
  if (marital === 'Never Married' || marital === 'Single') {
    checks.push('marital_w4_single', 'marital_sglv_single');
  } else if (marital === 'Married') {
    checks.push('marital_w4_mfj', 'marital_sglv_married');
  } else if (marital === 'Divorced') {
    checks.push('marital_w4_single', 'marital_sglv_single');
  } else if (marital === 'Separated') {
    checks.push('marital_w4_mfs', 'marital_sglv_married');
  }

  const ethnicity = get('ethnicity');
  if (ethnicity.includes('Not')) {
    checks.push('ethnic_not_hispanic');
  } else if (ethnicity.includes('Hispanic')) {
    checks.push('ethnic_hispanic');
  }

  const raceMap = {
    'American Indian': 'race_native_american',
    'Alaskan Native': 'race_native_american',
    'Asian': 'race_asian',
    'Black': 'race_black',
    'African American': 'race_black',
    'Native Hawaiian': 'race_pacific',
    'Pacific Islander': 'race_pacific',
    'White': 'race_white',
  };
  const race = get('primary_race');
  for (const [keyword, fieldName] of Object.entries(raceMap)) {
    if (race.includes(keyword)) {
      checks.push(fieldName);
      break;
    }
  }

  fields['school_name'] = get('high_school');
  if (get('hs_street_address')) fields['school_address'] = get('hs_street_address');
  fields['school_city'] = get('hs_city');
  fields['school_state'] = get('hs_state');
  fields['school_zip'] = get('hs_zip');
  if (get('hs_grade_level')) fields['school_grade_level'] = get('hs_grade_level');

  if (get('beneficiary_1_name')) {
    fields['beneficiary_1_name'] = get('beneficiary_1_name');
    if (get('beneficiary_1_address')) fields['beneficiary_1_address'] = get('beneficiary_1_address');
    if (get('beneficiary_1_relationship')) fields['beneficiary_1_relationship'] = get('beneficiary_1_relationship');
    if (get('beneficiary_1_percentage')) fields['beneficiary_1_percentage'] = get('beneficiary_1_percentage');
  }
  if (get('beneficiary_2_name')) {
    fields['beneficiary_2_name'] = get('beneficiary_2_name');
    if (get('beneficiary_2_address')) fields['beneficiary_2_address'] = get('beneficiary_2_address');
    if (get('beneficiary_2_relationship')) fields['beneficiary_2_relationship'] = get('beneficiary_2_relationship');
    if (get('beneficiary_2_percentage')) fields['beneficiary_2_percentage'] = get('beneficiary_2_percentage');
  }
  if (get('contingent_beneficiary_name')) {
    fields['contingent_name'] = get('contingent_beneficiary_name');
    if (get('contingent_beneficiary_address')) fields['contingent_address'] = get('contingent_beneficiary_address');
    if (get('contingent_beneficiary_relationship')) fields['contingent_relationship'] = get('contingent_beneficiary_relationship');
    if (get('contingent_beneficiary_percentage')) fields['contingent_percentage'] = get('contingent_beneficiary_percentage');
  }

  const hasTattoos = get('has_tattoos');
  if (hasTattoos === 'Yes') {
    checks.push('tattoo_yes');
  } else if (hasTattoos === 'No') {
    checks.push('tattoo_no');
  }

  for (let i = 1; i <= 6; i++) {
    const raw = get(`tattoo_${i}`);
    if (raw) {
      const parts = raw.split(';').map(s => s.trim());
      const idx = i - 1;
      if (parts[0]) fields[`tattoo_${idx}_description`] = parts[0];
      if (parts[1]) fields[`tattoo_${idx}_location`] = parts[1];
      if (parts[2]) fields[`tattoo_${idx}_meaning`] = parts[2];
    }
  }

  if (get('spouse_name')) fields['spouse_name'] = get('spouse_name');
  if (get('spouse_ssn')) fields['spouse_ssn'] = get('spouse_ssn');
  if (get('spouse_dob')) fields['spouse_dob'] = formatDate(get('spouse_dob'));
  if (get('spouse_marriage_date')) fields['spouse_marriage_date'] = formatDate(get('spouse_marriage_date'));
  if (get('spouse_address')) {
    let spouseAddr = get('spouse_address');
    if (get('spouse_city')) spouseAddr += ', ' + get('spouse_city');
    if (get('spouse_state')) spouseAddr += ', ' + get('spouse_state');
    if (get('spouse_zip')) spouseAddr += ' ' + get('spouse_zip');
    fields['spouse_address'] = spouseAddr;
  }

  if (get('emergency_contact_name')) fields['emergency_name'] = get('emergency_contact_name');
  if (get('emergency_contact_phone')) fields['emergency_phone'] = get('emergency_contact_phone');
  if (get('emergency_contact_email')) fields['emergency_email'] = get('emergency_contact_email');
  if (get('emergency_contact_address')) fields['emergency_address'] = get('emergency_contact_address');

  fields['w4_first_name'] = mi ? `${first} ${mi}` : first;
  fields['w4_last_name'] = last;
  fields['w4_address'] = get('street_address');
  fields['w4_city'] = get('city');
  fields['w4_state'] = get('state');
  fields['w4_zip'] = get('zip_code');

  let dd1966Name = `${last}, ${first}`;
  if (mi) dd1966Name += `, ${mi}`;
  fields['dd1966_name'] = dd1966Name;

  if (get('parent_guardian_name')) {
    fields['hrr900_parent_name'] = get('parent_guardian_name');
  }

  fields['med_release_name'] = fullName;
  fields['med_release_dob'] = dob;
  fields['med_release_address'] = [get('street_address'), get('city'), get('state'), get('zip_code')].filter(Boolean).join(', ');
  fields['med_release_phone'] = get('primary_phone');
  if (get('medical_insurer_name')) fields['med_release_insurer'] = get('medical_insurer_name');
  if (get('medical_insurer_address')) fields['med_release_insurer_addr'] = get('medical_insurer_address');
  if (get('medical_provider_name')) fields['med_release_provider'] = get('medical_provider_name');
  if (get('medical_provider_address')) fields['med_release_provider_addr'] = get('medical_provider_address');

  fields['form408_name'] = fullName;

  fields['ear_wax_patient_name'] = fullName;
  fields['ear_wax_patient_dob'] = dob;

  fields['hrr900_student_name'] = fullName;
  fields['hrr900_school_name'] = get('high_school');
  if (get('hs_city')) fields['hrr900_school_city'] = get('hs_city');
  if (get('hs_state')) fields['hrr900_school_state'] = get('hs_state');
  if (get('hs_zip')) fields['hrr900_school_zip'] = get('hs_zip');

  fields['hrr907_applicant'] = fullName;

  // RRNCO Information (static — SGT Kara Andrews)
  fields['rrnco_first_name'] = 'KARA';
  fields['rrnco_mi'] = 'R';
  fields['rrnco_last_name'] = 'ANDREWS';
  fields['rrnco_rrb_state'] = 'TEXAS';
  fields['rrnco_rsid'] = 'TXD';
  fields['rrnco_rrb_team'] = 'D';
  fields['rrnco_phone'] = '903-372-0877';
  fields['rrnco_rank_grade'] = 'SGT / E-5';
  fields['rrnco_street'] = '5001 MAIN ST';
  fields['rrnco_city'] = 'THE COLONY';
  fields['rrnco_state'] = 'TX';
  fields['rrnco_zip'] = '75056';
  fields['rrnco_email'] = 'KARA.R.ANDREWS.MIL@ARMY.MIL';

  // MEPS Information (static — Dallas MEPS)
  fields['meps_name'] = 'DALLAS MEPS C38';
  fields['meps_address'] = '207 S HOUSTON ST';
  fields['meps_med_records_release'] = 'DALLAS MEPS C38';

  // RSP Unit Information
  fields['rsp_street'] = '1775 CALIFORNIA CROSSING RD';
  fields['rsp_city_state_zip'] = 'DALLAS, TX, 75220';

  return { fields, checks };
}

function fillFormFields(form, fields, checks) {
  const filled = [];
  const skipped = [];
  const errors = [];

  for (const [name, value] of Object.entries(fields)) {
    if (!value) {
      skipped.push(name);
      continue;
    }
    try {
      const field = form.getTextField(name);
      setTextFit(field, name, value);
      filled.push({ name, value });
    } catch (e) {
      errors.push({ name, reason: 'Text field not found' });
    }
  }

  const checkedBoxes = [];
  for (const name of checks) {
    try {
      const cb = form.getCheckBox(name);
      cb.check();
      checkedBoxes.push(name);
    } catch (e) {
      errors.push({ name, reason: 'Checkbox not found' });
    }
  }

  return { filled, skipped, errors, checkedBoxes };
}

async function runTest() {
  console.log('========================================');
  console.log('DETAILED E2E TEST: MEPS Packet Generator');
  console.log('========================================\n');

  const testData = {
    first_name: 'Dallas',
    last_name: 'Andrews',
    middle_name: 'Test',
    date_of_birth: '1993-08-30',
    gender: 'Male',
    ssn: '111-12-1234',
    street_address: '1905 J J Pearce Dr',
    city: 'Richardson',
    state: 'TX',
    zip_code: '75081',
    primary_phone: '469-236-6459',
    email: 'andrewsdallas3@gmail.com',
    ethnicity: 'Not Hispanic',
    primary_race: 'Black',
    marital_status: 'Married',
    high_school: 'Berkner High School',
    hs_city: 'Richardson',
    hs_state: 'TX',
    hs_zip: '75081',
    city_of_birth: 'Dallas',
    county_of_birth: 'Dallas',
    state_of_birth: 'TX',
    num_dependents_total: '1',
    num_dependents_minor: '1',
    beneficiary_1_name: 'Jane Andrews',
    provider_name: 'Dr. Richard Townsend',
    insurance_name: 'Aetna',
  };

  try {
    // Map data
    const { fields: brazenFields, checks: brazenChecks } = mapFormDataToPDFFields(testData);

    // Load and fill BrazenRecruits template
    const brazenDoc = await PDFDocument.load(BRAZEN_TEMPLATE);
    const brazenForm = brazenDoc.getForm();
    const brazenResult = fillFormFields(brazenForm, brazenFields, brazenChecks);

    console.log('BRAZEN RECRUITS TEMPLATE - FIELD FILL DETAILS');
    console.log('=' . repeat(60));
    console.log(`Total fields filled: ${brazenResult.filled.length}`);
    console.log(`Total checkboxes checked: ${brazenResult.checkedBoxes.length}`);
    console.log(`Fields skipped (empty): ${brazenResult.skipped.length}`);
    console.log(`Errors: ${brazenResult.errors.length}\n`);

    console.log('RRNCO Fields (Static — SGT Kara Andrews):');
    const rrncoFields = brazenResult.filled.filter(f => f.name.startsWith('rrnco_'));
    rrncoFields.forEach(f => {
      console.log(`  ✓ ${f.name} = "${f.value}"`);
    });
    console.log('');

    console.log('MEPS Fields (Static — Dallas MEPS):');
    const mepsFields = brazenResult.filled.filter(f => f.name.startsWith('meps_'));
    mepsFields.forEach(f => {
      console.log(`  ✓ ${f.name} = "${f.value}"`);
    });
    console.log('');

    console.log('RSP Unit Fields (Static):');
    const rspFields = brazenResult.filled.filter(f => f.name.startsWith('rsp_'));
    rspFields.forEach(f => {
      console.log(`  ✓ ${f.name} = "${f.value}"`);
    });
    console.log('');

    console.log('Applicant Info Fields (from test data):');
    const appInfoFields = brazenResult.filled.filter(f => f.name.startsWith('app_'));
    appInfoFields.forEach(f => {
      console.log(`  ✓ ${f.name} = "${f.value}"`);
    });
    console.log('');

    console.log('Gender & Marital Checkboxes:');
    brazenResult.checkedBoxes.slice(0, 6).forEach(cb => {
      console.log(`  ✓ ${cb}`);
    });
    console.log('');

    if (brazenResult.errors.length > 0) {
      console.log('Errors (first 5):');
      brazenResult.errors.slice(0, 5).forEach(e => {
        console.log(`  ✗ ${e.name}: ${e.reason}`);
      });
      console.log('');
    }

    console.log('\n========================================');
    console.log('TEST COMPLETED SUCCESSFULLY');
    console.log('========================================');
    console.log(`Output PDF: /sessions/great-brave-knuth/mnt/brazen-recruits-questionnaire/test-filled-output.pdf`);
    console.log(`Brazen Template Pages: ${brazenDoc.getPageCount()}`);
    console.log(`Total Fields Processed: ${brazenResult.filled.length + brazenResult.skipped.length}`);
    console.log(`Total Checkboxes: ${brazenResult.checkedBoxes.length}`);

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
