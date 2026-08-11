import { test } from '@playwright/test'

/**
 * Not a assertion suite — this captures a reference image of the tree so a
 * refactor of how it is rendered can be compared against how it looked before.
 * Run with `--update-snapshots` semantics in mind: the screenshot lands in
 * `e2e/__screens__` and is meant to be eyeballed, not diffed by CI.
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
  longString: 'a fairly long string value that shows how a row behaves when it runs past the pane width',
})

test('capture tree view reference', async ({ page }) => {
  await page.goto('/')

  const editor = page.locator('.code-editor-wrap .cm-content')
  await editor.click()
  await page.keyboard.insertText(SAMPLE)

  await page.getByRole('button', { name: 'Beautify' }).click()
  await page.getByRole('button', { name: 'Tree', exact: true }).click()

  const tree = page.locator('.tree-view')
  await tree.waitFor()
  await page.waitForTimeout(300)
  await tree.screenshot({ path: 'e2e/__screens__/tree.png' })
})
