/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type Page,
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

let context: BrowserContext
let extensionId: string

test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${dist}`,
            `--load-extension=${dist}`,
        ],
    })
    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker')
    }
    extensionId = new URL(serviceWorker.url()).host
})

test.afterAll(async () => {
    await context.close()
})

// Module-eval crashes in the extension bundle (e.g. a top-level throw during
// import) otherwise surface as 20-45s selector timeouts with no indication
// of the real cause. Collecting `pageerror` per-page and asserting on it
// immediately fails fast with the actual error message instead.
const trackPageErrors = (page: Page): Error[] => {
    const errors: Error[] = []
    page.on('pageerror', error => errors.push(error))
    return errors
}

// Regression guard for the popup sizing collapse: a real browser-action
// popup auto-sizes to the rendered body dimensions, so if our injected
// popup CSS loses the cascade to expo's own reset stylesheet (equal
// specificity `html,body{height:100%}`), the popup collapses to a sliver
// instead of 360x600. Loading popup.html in a page at the *default*
// (non-360x600) viewport reproduces the failure mode: if our fixed-size
// rule doesn't win, body fills the ambient viewport instead of 360x600.
test('popup.html body is fixed at 360x600 regardless of ambient viewport', async () => {
    const page = await context.newPage()
    const pageErrors = trackPageErrors(page)
    await page.goto(`chrome-extension://${extensionId}/popup.html`)

    // Fail fast on a module-eval crash instead of masking it behind an
    // unrelated size-mismatch assertion below.
    expect(pageErrors, 'page threw an uncaught error').toEqual([])

    const size = await page.evaluate(() => ({
        width: getComputedStyle(document.body).width,
        height: getComputedStyle(document.body).height,
    }))

    expect(size).toEqual({ width: '360px', height: '600px' })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// Regression guard (M3 rendering-cluster, scroll feel): react-native-web
// renders <Text> as selectable HTML by default (native RN text isn't
// selectable), so a click-drag over a label selects text instead of feeling
// like a native drag gesture — the actual wheel-scroll mechanism was never
// broken, but this made the whole surface feel like a web page instead of an
// app. Global `user-select: none` (scripts/build.mjs GLOBAL_WEB_CSS) fixes
// the feel; inputs are re-enabled explicitly so typing/selecting-to-copy
// still works — assert both sides.
test('global CSS disables text selection but keeps inputs selectable', async () => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(page.getByTestId('create-password-input')).toBeVisible({
        timeout: 20_000,
    })

    const styles = await page.evaluate(() => {
        const input = document.querySelector('input')
        const label = document.querySelector('div[dir="auto"]')
        return {
            inputUserSelect: input ? getComputedStyle(input).userSelect : null,
            labelUserSelect: label ? getComputedStyle(label).userSelect : null,
        }
    })

    expect(styles.inputUserSelect).toBe('text')
    expect(styles.labelUserSelect).toBe('none')
})
