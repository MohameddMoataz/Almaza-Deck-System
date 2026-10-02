const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: 'almaza_locale', value: 'ar', url: 'http://localhost:3000' }]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://localhost:3000');
    assert.equal(await page.locator('.brand strong').innerText(), 'الماظة لادارة مجموعات');
    const forbidden = await context.request.put('http://localhost:3000/api/power-of-chaos-cards', {
      data: { name: 'Pot of Greed', nameAr: 'غير مسموح' }
    });
    assert.equal(forbidden.status(), 403);
    await context.request.post('http://localhost:3000/api/auth/login', {
      form: { username: 'admin', password: 'admin@123' }
    });
    await page.goto('http://localhost:3000/users/admin');
    await page.locator('input[placeholder="ابحث في كروت YGOPRODeck"]').fill('جرة الطمع');
    await page.locator('.result-row').filter({ hasText: 'جرة الطمع' }).click({ timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('.smart-card-text p')?.textContent === 'اسحب بطاقتين.');
    assert.equal(await page.locator('.smart-card-name').innerText(), 'جرة الطمع');
    assert.equal(await page.locator('.smart-card-type-row').innerText(), 'بطاقة سحر');
    assert.equal(await page.locator('input[lang="ar"]').count(), 1);
    assert.equal(await page.locator('textarea[lang="ar"]').count(), 1);
    // Draft Arabic edits must not change the underlying English card or placement rules.
    await page.locator('input[lang="ar"]').fill('جرة الطمع المعدلة');
    await page.locator('textarea[lang="ar"]').fill('اسحب بطاقتين من مجموعتك إلى يدك.');
    assert.equal(await page.locator('.smart-card-name').innerText(), 'جرة الطمع المعدلة');
    await page.locator('.language-switcher select').selectOption('en');
    await page.waitForFunction(() => document.querySelector('.smart-card-name')?.textContent === 'Pot of Greed');
    assert.equal(await page.locator('.smart-card-text p').innerText(), 'Draw 2 cards.');
    await page.locator('.language-switcher select').selectOption('ar');
    await page.waitForFunction(() => document.querySelector('.smart-card-name')?.textContent === 'جرة الطمع المعدلة');
    await page.waitForFunction(() => {
      const image = document.querySelector('.smart-card-art img');
      return image && image.complete && image.naturalWidth > 0;
    }, { }, { timeout: 60000 });
    await fs.mkdir('artifacts', { recursive: true });
    await page.locator('.smart-card').screenshot({ path: 'artifacts/arabic-card.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.smart-card').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'artifacts/arabic-mobile.png' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, 'Mobile page must not scroll horizontally');
    const fit = await page.locator('.smart-card').evaluate((card) => {
      const bounds = card.getBoundingClientRect();
      return [...card.querySelectorAll('.smart-card-name, .smart-card-art, .smart-card-text')]
        .every((element) => element.getBoundingClientRect().right <= bounds.right + 1);
    });
    assert.ok(fit, 'Card content stays within the card');
    const shortHeight = await page.locator('.smart-card').evaluate((card) => card.getBoundingClientRect().height);
    await page.locator('textarea[lang="ar"]').fill('اختر وحشًا واحدًا في ملعب خصمك؛ أعده إلى يد مالكه، ثم اسحب بطاقة واحدة. '.repeat(25));
    const longHeight = await page.locator('.smart-card').evaluate((card) => card.getBoundingClientRect().height);
    assert.equal(longHeight, shortHeight, 'Long Arabic effects preserve the fixed card height');
    const descriptionFits = await page.locator('.smart-card-text p').evaluate((text) => {
      const parent = text.parentElement.getBoundingClientRect();
      const bounds = text.getBoundingClientRect();
      return bounds.bottom <= parent.bottom && bounds.right <= parent.right;
    });
    assert.ok(descriptionFits, 'Long Arabic effect scrolls within its description box');
    assert.deepEqual(errors, []);
    console.log('PASS: Arabic brand, Arabic search, name/effect/type, live Arabic edits, English switching, admin authorization, mobile width, and browser errors. No deck/card data was modified.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
