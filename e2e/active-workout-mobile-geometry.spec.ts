import { expect, test } from '@playwright/test'

test('active-workout header and controls fit narrow mobile screens', async ({ page }) => {
  const longTitle = 'Full Body Strength and Conditioning Session'

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/onboarding')
  await page.evaluate(() => localStorage.setItem('trainos-local-only-v1', 'true'))
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('link', { name: 'Train' }).click()
  await page.locator('.sticky-start').getByRole('button', { name: 'Start workout', exact: true }).click()
  await expect(page).toHaveURL(/\/workout\/active$/)

  await page.evaluate(async (title) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('trainos')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('activeWorkout', 'readwrite')
      const store = transaction.objectStore('activeWorkout')
      const request = store.getAll()
      request.onsuccess = () => {
        const workout = request.result[0]
        if (!workout) {
          transaction.abort()
          reject(new Error('The active workout was not created.'))
          return
        }
        store.put({ ...workout, title })
      }
      request.onerror = () => reject(request.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('The workout title update was aborted.'))
    })
    database.close()
  }, longTitle)
  await page.reload()
  await expect(page.locator('.active-title > span')).toHaveText(longTitle)

  const currentSet = page.locator('.active-set-row.current-set').first()
  await currentSet.locator('input').nth(0).fill('50')
  await currentSet.locator('input').nth(1).fill('8')
  await currentSet.locator('.set-check').click()
  await expect(page.getByText('REST TIMER')).toBeVisible()
  await page.evaluate(() => document.documentElement.classList.add('native-app'))

  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 812 })

    const titleBox = await page.locator('.active-title > span').boundingBox()
    const elapsedBox = await page.locator('.elapsed').boundingBox()
    const sessionButton = page.getByRole('button', { name: 'Open session menu' })
    const sessionButtonBox = await sessionButton.boundingBox()
    const restTimer = page.locator('.rest-timer')
    const restTimerBox = await restTimer.boundingBox()
    const controlDockBox = await page.locator('.session-control-dock').boundingBox()
    if (!titleBox || !elapsedBox || !sessionButtonBox || !restTimerBox || !controlDockBox) {
      throw new Error(`Expected workout controls to be laid out at ${width}px.`)
    }
    expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(elapsedBox.y)
    expect(sessionButtonBox.x).toBeGreaterThanOrEqual(0)
    expect(sessionButtonBox.x + sessionButtonBox.width).toBeLessThanOrEqual(width)
    expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(sessionButtonBox.x)
    expect(sessionButtonBox.width).toBeGreaterThanOrEqual(44)
    expect(sessionButtonBox.height).toBeGreaterThanOrEqual(44)
    const sessionLabel = page.locator('.active-header .button.finish > span')
    if (width <= 360) await expect(sessionLabel).toBeHidden()
    else await expect(sessionLabel).toBeVisible()
    expect(restTimerBox.y + restTimerBox.height).toBeLessThanOrEqual(controlDockBox.y)
    const horizontalOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll<HTMLElement>('body *')]
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.right > window.innerWidth + 1)
        .slice(0, 5)
        .map(({ element, rect }) => `${element.tagName.toLowerCase()}.${element.className}: ${rect.right.toFixed(1)}px`),
    }))
    expect(horizontalOverflow.scrollWidth, horizontalOverflow.elements.join('; ')).toBeLessThanOrEqual(width)

    const table = page.locator('.active-set-table').first()
    const tableBox = await table.boundingBox()
    const setRow = page.locator('.active-set-row').first()
    if (!tableBox) throw new Error(`Expected the set table to be laid out at ${width}px.`)
    for (const control of [...(await setRow.locator('input, select, .set-check').all())]) {
      const box = await control.boundingBox()
      if (!box) throw new Error(`Expected set-entry controls to be laid out at ${width}px.`)
      const description = await control.evaluate((element) => `${element.tagName.toLowerCase()}.${element.className}`)
      expect(box.width, `${width}px ${description} width`).toBeGreaterThanOrEqual(48)
      expect(box.height, `${width}px ${description} height`).toBeGreaterThanOrEqual(48)
      expect(box.x).toBeGreaterThanOrEqual(tableBox.x)
      expect(box.x + box.width).toBeLessThanOrEqual(tableBox.x + tableBox.width)
    }

    for (const label of ['Subtract 15 seconds', 'Pause rest timer', 'Add 15 seconds', 'Skip']) {
      const button = restTimer.getByRole('button', { name: label })
      await expect(button).toBeVisible()
      const box = await button.boundingBox()
      if (!box) throw new Error(`Expected "${label}" control to be laid out at ${width}px.`)
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const lastContent = await page.locator('.active-session-actions').boundingBox()
    const dock = await page.locator('.session-control-dock').boundingBox()
    if (!lastContent || !dock) throw new Error(`Expected workout content and dock to be laid out at ${width}px.`)
    expect(lastContent.y + lastContent.height).toBeLessThanOrEqual(dock.y)
  }
})
