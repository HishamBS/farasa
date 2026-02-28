#!/usr/bin/env node
/*
  Manual visual regression capture script for Whisper parity.
  Requires Playwright to be installed in the environment.
*/

import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3010'
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const outDir = join('logs', 'ui-regression', timestamp)

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

const states = [
  { name: 'chat-idle', path: '/chat' },
  { name: 'login', path: '/login' },
  { name: 'offline', path: '/offline' },
]

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const report = []

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  })

  for (const state of states) {
    const page = await context.newPage()
    const url = `${baseUrl}${state.path}`
    await page.goto(url, { waitUntil: 'networkidle' })

    const fileName = `${state.name}-${viewport.name}.png`
    const filePath = join(outDir, fileName)
    await page.screenshot({ path: filePath, fullPage: true })

    report.push({
      state: state.name,
      viewport: viewport.name,
      url,
      filePath,
    })

    await page.close()
  }

  await context.close()
}

await browser.close()
await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8')

console.log(`Saved ${report.length} screenshots in ${outDir}`)
