import { test, expect } from '@playwright/test'

test.describe('Editor Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('loads with Editor tab active', async ({ page }) => {
    await expect(page.locator('.sidebar__item--active')).toContainText('JSON Editor')
  })

  test('beautify formats JSON', async ({ page }) => {
    // Type JSON into the CodeMirror editor
    const editor = page.locator('.code-editor-wrap .cm-content')
    await editor.click()
    await page.keyboard.type('{"name":"test","value":123}')

    // Click Beautify
    await page.click('button:has-text("Beautify")')

    // Wait for formatted output
    await expect(editor).toContainText('"name": "test"')
  })

  test('switching tabs works', async ({ page }) => {
    await page.click('.sidebar__item[aria-label="JSON Compare"]')
    await expect(page.locator('.sidebar__item--active')).toContainText('JSON Compare')

    await page.click('.sidebar__item[aria-label="XML Editor"]')
    await expect(page.locator('.sidebar__item--active')).toContainText('XML Editor')

    await page.click('.sidebar__item[aria-label="Grid View"]')
    await expect(page.locator('.sidebar__item--active')).toContainText('Grid View')

    await page.click('.sidebar__item[aria-label="JSONPath"]')
    await expect(page.locator('.sidebar__item--active')).toContainText('JSONPath')

    await page.click('.sidebar__item[aria-label="YAML ↔ JSON"]')
    await expect(page.locator('.sidebar__item--active')).toContainText('YAML ↔ JSON')
  })

  test('theme toggle works', async ({ page }) => {
    // Default is dark
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    // Click theme toggle
    await page.click('button[aria-label="Toggle theme"]')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    // Toggle back
    await page.click('button[aria-label="Toggle theme"]')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('tree view renders after beautify', async ({ page }) => {
    const editor = page.locator('.code-editor-wrap .cm-content')
    await editor.click()
    await page.keyboard.type('{"items":[1,2,3]}')

    await page.click('button:has-text("Beautify")')
    await page.click('.view-toggle__btn:has-text("Tree")')

    // Should show tree nodes
    await expect(page.locator('.tree-view')).toBeVisible()
  })
})

test.describe('Tax Calculator', () => {
  test('defaults to Quebec', async ({ page }) => {
    await page.goto('/')
    await page.click('.sidebar__item[aria-label="Tax Calculator"]')

    await expect(page.locator('#tax-province')).toHaveValue('QC')
    await expect(page.locator('#tax-province option')).toHaveCount(2)
  })
})

test.describe('Persisted state migration', () => {
  // Rows written before tools/regions were removed must not blank the app.
  test('falls back to defaults for values that no longer exist', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'devtoolbox_state_v1',
        JSON.stringify({ activeTab: 'soap', taxProvince: 'BC', theme: 'dark' }),
      )
    })
    await page.goto('/')

    await expect(page.locator('.sidebar__item--active')).toContainText('JSON Editor')

    await page.click('.sidebar__item[aria-label="Tax Calculator"]')
    await expect(page.locator('#tax-province')).toHaveValue('QC')
  })
})
