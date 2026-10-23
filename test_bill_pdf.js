import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing PDF Bill Generator implementation...');

const pdfGenPath = path.join(__dirname, 'services', 'pdfBillGenerator.ts');
if (!fs.existsSync(pdfGenPath)) {
  console.error('FAIL: services/pdfBillGenerator.ts does not exist');
  process.exit(1);
}

const content = fs.readFileSync(pdfGenPath, 'utf8');

const checks = [
  ['downloadBillPdf function', content.includes('export async function downloadBillPdf')],
  ['Hospital logo loading', content.includes('/logo-icon.png') && content.includes('/logo.png')],
  ['Vector logo fallback', content.includes('drawVectorLogo')],
  ['Hospital Name MediConnect HMS', content.includes('MediConnect HMS')],
  ['Invoice layout & alignment', content.includes('INVOICE') && content.includes('TAX INVOICE') || content.includes('doc.text(\'INVOICE\'')],
  ['Itemized table with jspdf-autotable', content.includes('autoTable(doc,')],
  ['Status Badge pill (PAID / DUE / OVERDUE)', content.includes('PAID IN FULL') && content.includes('PAYMENT DUE')],
  ['Digital Stamp & Seal', content.includes('OFFICIAL SEAL') && content.includes('VERIFIED')],
  ['Authorized Signatory', content.includes('Authorized Finance Officer')],
  ['BillingHistory integration', fs.readFileSync(path.join(__dirname, 'pages', 'PatientPortal', 'BillingHistory.tsx'), 'utf8').includes('downloadBillPdf')],
  ['AdminDashboard integration', fs.readFileSync(path.join(__dirname, 'components', 'AdminDashboard', 'AdminDashboard.tsx'), 'utf8').includes('downloadBillPdf')],
];

let allPassed = true;
for (const [name, passed] of checks) {
  if (passed) {
    console.log(`  ✓ PASS: ${name}`);
  } else {
    console.error(`  ✗ FAIL: ${name}`);
    allPassed = false;
  }
}

if (!allPassed) {
  process.exit(1);
}

console.log('\nAll PDF Bill Generator checks PASSED!');
