import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://127.0.0.1:4173';
const DIR = '/tmp/flow-screenshots';
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
  console.log(`  📸 ${name}`);
}

console.log('=== Login ===');
await page.goto(`${BASE}/login`);
await page.waitForSelector('#login-name', { timeout: 15000 });
await page.fill('#login-name', 'admin');
await page.fill('#login-password', 'admin12345678');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
console.log('URL after login:', page.url());

// Materials
console.log('\n=== Materials list ===');
await page.goto(`${BASE}/projects/test/modules/materials`);
await page.waitForSelector('table tbody tr', { timeout: 10000 });
await page.waitForTimeout(1000);
await shot('final-01-materials-list');

// Proposals
console.log('\n=== Proposals page ===');
await page.goto(`${BASE}/projects/test/modules/materials?view=proposals`);
await page.waitForTimeout(2000);
await shot('final-03-proposals');

// Generation tasks
console.log('\n=== Generation tasks ===');
await page.goto(`${BASE}/projects/test/modules/materials?view=operations`);
await page.waitForTimeout(2000);
await shot('final-04-generation-tasks');

// Roadmap
console.log('\n=== Roadmap ===');
await page.goto(`${BASE}/projects/test/modules/roadmap`);
await page.waitForTimeout(2000);
await shot('final-06-roadmap');

// Gantt
console.log('\n=== Gantt ===');
await page.goto(`${BASE}/projects/test/modules/gantt`);
await page.waitForTimeout(2000);
await shot('final-07-gantt');

// Board
console.log('\n=== Board ===');
await page.goto(`${BASE}/projects/test/modules/board`);
await page.waitForTimeout(2000);
await shot('final-08-board');

// Overview
console.log('\n=== Overview ===');
await page.goto(`${BASE}/projects/test`);
await page.waitForTimeout(2000);
await shot('final-09-overview');

// Release history
console.log('\n=== Release ===');
await page.goto(`${BASE}/projects/test/modules/release`);
await page.waitForTimeout(2000);
await shot('final-10-release');

console.log('\n=== Done ===');
await browser.close();
