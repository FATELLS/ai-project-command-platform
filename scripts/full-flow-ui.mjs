import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://127.0.0.1:4173';
const DIR = '/tmp/flow-screenshots';
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
  console.log(`  📸 ${name}.png`);
}

async function waitClick(selector, options = {}) {
  await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
  await page.click(selector, options);
}

console.log('=== Step 0: Login ===');
await page.goto(`${BASE}/login`);
// Wait for SPA to render the login form
await page.waitForSelector('#login-name', { state: 'visible', timeout: 15000 });
await page.fill('#login-name', 'admin');
await page.fill('#login-password', 'admin12345678');
await page.click('button[type="submit"]');
await page.waitForURL('**/projects**', { timeout: 10000 });
await page.waitForTimeout(1000);
console.log('✅ Logged in');

// Step 1: Materials list
console.log('\n=== Step 1: Materials list ===');
await page.goto(`${BASE}/projects/test/modules/materials`);
await page.waitForSelector('table tbody tr', { timeout: 10000 });
await page.waitForTimeout(800);
await shot('01-materials-list');
const matRows = await page.locator('table tbody tr').count();
console.log(`  Materials: ${matRows}`);

// Step 2: Open generation modal from proposals view
console.log('\n=== Step 2: Open generation modal ===');
// Navigate to proposals view
await page.goto(`${BASE}/projects/test/modules/materials?view=proposals`);
await page.waitForTimeout(1500);
await shot('02-proposals-view');

// Find and click the generation button
const genBtn = page.locator('button:has-text("生成项目更新建议"), button:has-text("生成作战更新建议")').first();
await genBtn.waitFor({ state: 'visible', timeout: 10000 });
await genBtn.click();
await page.waitForTimeout(2000);
await shot('03-generation-modal');
console.log('  Modal opened');

// Wait for modal content to load
await page.waitForSelector('.generation-material-row', { timeout: 10000 });
const checkboxes = await page.locator('.generation-material-row input[type="checkbox"]').count();
console.log(`  Material checkboxes: ${checkboxes}`);

// Select first 2 eligible materials (same template type)
await page.locator('.generation-material-row input[type="checkbox"]').first().check();
await page.waitForTimeout(500);

// Check more if not disabled
for (let i = 1; i < checkboxes; i++) {
  const cb = page.locator(`.generation-material-row:nth-child(${i+1}) input[type="checkbox"]`);
  const isDisabled = await cb.isDisabled().catch(() => true);
  if (!isDisabled) {
    const isChecked = await cb.isChecked().catch(() => false);
    if (!isChecked) {
      await cb.check().catch(() => {});
      await page.waitForTimeout(200);
    }
    if (i >= 2) break; // max 3 materials
  }
}
await shot('04-materials-selected');
console.log('  Materials selected');

// Click the submit button in the modal
const submitBtn = page.locator('.generation-form button[type="submit"]').first();
const isDisabled = await submitBtn.isDisabled().catch(() => true);
console.log(`  Submit disabled: ${isDisabled}`);
if (!isDisabled) {
  await submitBtn.click();
  console.log('  Submit clicked, waiting for task creation...');
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
}
await shot('05-task-created');
console.log('  Task page:', page.url());

// Step 3: Wait for generation to complete
console.log('\n=== Step 3: Wait for generation ===');
// Poll for completion
let succeeded = false;
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(5000);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const text = await page.textContent('body');
  if (text?.includes('已生成') || text?.includes('succeeded')) {
    succeeded = true;
    console.log(`  ✅ Generation succeeded after ${(i+1)*5}s`);
    break;
  }
  if (text?.includes('failed') || text?.includes('失败')) {
    console.log(`  ❌ Generation failed after ${(i+1)*5}s`);
    break;
  }
  console.log(`  ⏳ Still processing... (${(i+1)*5}s)`);
}
await shot('06-generation-result');

// Step 4: View proposal
console.log('\n=== Step 4: View proposal ===');
const proposalLink = page.locator('a:has-text("查看"), a[href*="proposals"], a[href*="change-proposals"]').first();
const linkExists = await proposalLink.count();
if (linkExists > 0) {
  await proposalLink.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await shot('07-proposal-detail');
  console.log('  Proposal page:', page.url());

  // Look for approve/merge buttons
  const approveBtn = page.locator('button:has-text("通过"), button:has-text("采纳"), button:has-text("合并到草稿"), button:has-text("应用")');
  const approveCount = await approveBtn.count();
  console.log(`  Approve buttons: ${approveCount}`);
  if (approveCount > 0) {
    await approveBtn.first().click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    await shot('08-after-approve');
    console.log('  After approve:', page.url());
  }
}

// Step 5: View roadmap
console.log('\n=== Step 5: View roadmap ===');
await page.goto(`${BASE}/projects/test/modules/roadmap`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await shot('09-roadmap');
console.log('  Roadmap page:', page.url());

// Gantt
await page.goto(`${BASE}/projects/test/modules/gantt`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await shot('10-gantt');

// Board
await page.goto(`${BASE}/projects/test/modules/board`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await shot('11-board');

// Back to overview
await page.goto(`${BASE}/projects/test`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await shot('12-overview');

console.log('\n=== Done ===');
await browser.close();
