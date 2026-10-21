// Writes PRIVACY.md from constants/privacy.js so the web copy (needed for the
// Google Play listing) always matches the in-app Privacy Policy.
// Run with: npm run privacy
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'constants', 'privacy.js'), 'utf8');
// The constants file uses `export const`; evaluate it as plain JavaScript.
const { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_EFFECTIVE } = new Function(
  `${src.replace(/export const /g, 'const ')}\nreturn { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_EFFECTIVE };`,
)();

const lines = [
  '# SLSU-GumaCart Privacy Policy',
  '',
  `_Effective ${PRIVACY_EFFECTIVE}_`,
  '',
  PRIVACY_INTRO,
  '',
];
PRIVACY_SECTIONS.forEach((section, i) => {
  lines.push(`## ${i + 1}. ${section.title}`, '');
  section.points.forEach((point) => lines.push(`- ${point}`));
  lines.push('');
});

fs.writeFileSync(path.join(__dirname, '..', 'PRIVACY.md'), lines.join('\n'));
console.log('Wrote PRIVACY.md');
