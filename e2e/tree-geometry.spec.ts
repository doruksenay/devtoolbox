import { test } from '@playwright/test'
import fs from 'node:fs'

/**
 * Dumps the on-screen geometry of every tree row so a rendering refactor can be
 * checked against the layout it replaced. Eyeballing a screenshot cannot tell
 * you that a row moved two pixels; this can.
 *
 * Writes `e2e/__screens__/tree-geometry.json`. Run it before the change, keep a
 * copy, run it after, diff the two.
 */
const SAMPLE = JSON.stringify({
  id: 42,
  name: 'root object',
  active: true,
  nothing: null,
  emptyObject: {},
  emptyArray: [],
  nested: {
    level2: {
      level3: {
        deep: 'value at depth three',
        numbers: [1, 2, 3],
      },
      sibling: 'text',
    },
    list: [
      { sku: 'A-1', qty: 2, tags: ['red', 'small'] },
      { sku: 'B-2', qty: 7, tags: ['blue'] },
    ],
  },
})

test('dump tree row geometry', async ({ page }) => {
  await page.goto('/')

  const editor = page.locator('.code-editor-wrap .cm-content')
  await editor.click()
  await page.keyboard.insertText(SAMPLE)
  await page.getByRole('button', { name: 'Beautify' }).click()
  await page.getByRole('button', { name: 'Tree', exact: true }).click()

  const tree = page.locator('.tree-view')
  await tree.waitFor()

  // Expand everything reachable so deeper levels are measured too.
  for (let pass = 0; pass < 4; pass++) {
    const carets = page.locator('.tree-view [aria-expanded="false"]')
    const n = await carets.count()
    if (n === 0) break
    for (let i = n - 1; i >= 0; i--) await carets.nth(i).click()
  }
  await page.waitForTimeout(200)

  const rows = await page.evaluate(() => {
    const root = document.querySelector('.tree-view')!
    const origin = root.getBoundingClientRect()
    // Every visible line is either a branch row or a leaf.
    return [...root.querySelectorAll('.tree-node__row, .tree-leaf')].map((el) => {
      const r = el.getBoundingClientRect()
      return {
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
        left: Math.round(r.left - origin.left),
        height: Math.round(r.height),
      }
    })
  })

  fs.mkdirSync('e2e/__screens__', { recursive: true })
  fs.writeFileSync('e2e/__screens__/tree-geometry.json', JSON.stringify(rows, null, 2))
  console.log(`captured ${rows.length} rows`)
})
