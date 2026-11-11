import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const screenshotDirectory = resolve(process.cwd(), 'outputs/hardening-sprint-2/after')

test('active workout set entry fits and remains tappable from 320px to 768px', async ({ page }) => {
  mkdirSync(screenshotDirectory, { recursive: true })
  await page.goto('/onboarding')
  await page.evaluate(() => localStorage.setItem('trainos-local-only-v1', 'true'))
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('link', { name: 'Train' }).click()
  await page.locator('.sticky-start').getByRole('button', { name: 'Start workout', exact: true }).click()

  await expect(page).toHaveURL(/\/workout\/active$/)
  const firstSet = page.locator('.active-set-row').first()
  await firstSet.locator('input').nth(0).fill('95')
  await firstSet.locator('input').nth(1).fill('8')
  await firstSet.locator('.set-check').click()
  await expect(page.locator('.rest-timer')).toBeVisible()

  for (const width of [320, 375, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await page.locator('.active-set-row.current-set').scrollIntoViewIfNeeded()
    const geometry = await page.evaluate(() => {
      const table = document.querySelector<HTMLElement>('.active-set-table')!
      const row = document.querySelector<HTMLElement>('.active-set-row.current-set')!
      const controls = [...row.querySelectorAll<HTMLElement>('input, select, button')]
      const dock = document.querySelector<HTMLElement>('.session-control-dock')!
      const timer = document.querySelector<HTMLElement>('.rest-timer')!
      const nav = document.querySelector<HTMLElement>('.bottom-nav')!
      const rect = (element: HTMLElement) => {
        const { left, right, top, bottom, width: elementWidth, height } = element.getBoundingClientRect()
        return { left, right, top, bottom, width: elementWidth, height }
      }
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        tableWidth: table.clientWidth,
        tableScrollWidth: table.scrollWidth,
        row: rect(row),
        controls: controls.map(rect),
        dock: rect(dock),
        timer: rect(timer),
        nav: nav ? rect(nav) : null,
        navVisible: nav !== null && getComputedStyle(nav).display !== 'none',
      }
    })

    expect(geometry.documentWidth, `document overflow at ${width}px`).toBeLessThanOrEqual(width)
    expect(geometry.tableScrollWidth, `set table overflow at ${width}px`).toBeLessThanOrEqual(geometry.tableWidth)
    expect(geometry.controls).toHaveLength(4)
    for (const [index, control] of geometry.controls.entries()) {
      expect(control.left, `control ${index} clipped at ${width}px`).toBeGreaterThanOrEqual(geometry.row.left - 1)
      expect(control.right, `control ${index} clipped at ${width}px`).toBeLessThanOrEqual(geometry.row.right + 1)
      expect(control.width, `control ${index} is too narrow at ${width}px`).toBeGreaterThanOrEqual(44)
      expect(control.height, `control ${index} is too short at ${width}px`).toBeGreaterThanOrEqual(44)
    }
    expect(geometry.row.bottom, `set row hidden behind fixed controls at ${width}px`).toBeLessThanOrEqual(geometry.timer.top)
    expect(geometry.dock.bottom, `dock falls below the viewport at ${width}px`).toBeLessThanOrEqual(844)
    if (geometry.navVisible && geometry.nav) {
      expect(geometry.dock.bottom, `dock overlaps bottom navigation at ${width}px`).toBeLessThanOrEqual(geometry.nav.top)
    }
    expect(geometry.timer.bottom, `timer overlaps workout dock at ${width}px`).toBeLessThanOrEqual(geometry.dock.top)
    await page.screenshot({ path: resolve(screenshotDirectory, `active-workout-${width}.png`), fullPage: true })
  }

  await page.goto('/today')
  for (const width of [320, 375, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 })
    const navigation = page.getByRole('navigation', { name: 'Main navigation' })
    const navigationLinks = navigation.getByRole('link')
    await expect(navigationLinks).toHaveCount(5)
    const navigationTargets = await navigationLinks.evaluateAll((links) => links.map((link) => {
      const { width: targetWidth, height } = link.getBoundingClientRect()
      return { width: targetWidth, height }
    }))
    expect(navigationTargets).toHaveLength(5)
    for (const [index, target] of navigationTargets.entries()) {
      expect(target.width, `navigation target ${index} is too narrow at ${width}px`).toBeGreaterThanOrEqual(44)
      expect(target.height, `navigation target ${index} is too short at ${width}px`).toBeGreaterThanOrEqual(44)
    }
  }
})
