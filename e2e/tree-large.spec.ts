import { test, expect } from '@playwright/test'

/**
 * The reason the tree was rewritten: a large array used to mean either a
 * "Show more" button clicked hundreds of times, or that many rows in the DOM.
 */
test('a large array stays cheap to render', async ({ page }) => {
  await page.goto('/')

  const rows = 5000
  const payload = JSON.stringify(
    Array.from({ length: rows }, (_, i) => ({ id: i, name: `item-${i}`, tags: ['a', 'b'] })),
  )

  const editor = page.locator('.code-editor-wrap .cm-content')
  await editor.click()
  // insertText goes in as a single edit rather than thousands of keystrokes.
  await page.keyboard.insertText(payload)

  await page.getByRole('button', { name: 'Validate' }).click()
  await page.getByRole('button', { name: 'Tree', exact: true }).click()
  await page.locator('.tree-view').waitFor()
  // A megabyte of JSON is parsed off the main thread, so wait for the row list
  // to actually exist rather than for a fixed delay.
  await expect
    .poll(
      async () =>
        page
          .locator('.tree-view__sizer')
          .evaluate((el) => Number.parseInt((el as HTMLElement).style.height, 10) || 0),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(rows * 20)

  const mounted = await page.locator('.tree-view__row-slot').count()
  const scrollHeight = await page
    .locator('.tree-view__sizer')
    .evaluate((el) => Number.parseInt((el as HTMLElement).style.height, 10))

  console.log(`document rows: ~${rows}, mounted: ${mounted}, sizer: ${scrollHeight}px`)

  // Only a screenful is in the DOM…
  expect(mounted).toBeLessThan(120)
  // …while the scrollbar still spans the whole document.
  expect(scrollHeight).toBeGreaterThan(rows * 20)

  // Scrolling reveals later rows without any paging control.
  await expect(page.getByRole('button', { name: /Show more/ })).toHaveCount(0)
  await page.locator('.tree-view').evaluate((el) => el.scrollTo(0, 100000))
  await page.waitForTimeout(300)
  const afterScroll = await page.locator('.tree-view__row-slot').count()
  expect(afterScroll).toBeLessThan(120)
})
