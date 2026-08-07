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

const trackPageErrors = (page: Page): Error[] => {
    const errors: Error[] = []
    page.on('pageerror', error => errors.push(error))
    return errors
}

// Regression guard for the font-shipping gap: expo's web export bakes
// `fontFamily: "DMSansRegular"` etc. into the JS but emits no font files, so
// without dist/fonts.css these families silently fall back to a system font.
// document.fonts.check only returns true for a family that actually
// resolved a network-loaded (or preloaded) face under that exact name, so a
// 404'd file or a family-name mismatch between fonts.css and
// constants/fonts.ts fails this assertion instead of passing silently.
test('DM Sans loads and backs the rendered UI', async () => {
    const page = await context.newPage()
    const pageErrors = trackPageErrors(page)

    // Resource Timing is empty for chrome-extension:// documents (Chrome
    // doesn't buffer it there), so prove same-origin loading by watching
    // the actual network requests instead — every .ttf request must resolve
    // under this extension's own chrome-extension://<id>/fonts/ path, never
    // a remote origin.
    const fontRequestUrls: string[] = []
    page.on('request', request => {
        if (request.url().endsWith('.ttf')) {
            fontRequestUrls.push(request.url())
        }
    })

    await page.goto(`chrome-extension://${extensionId}/expanded.html`)

    expect(pageErrors, 'page threw an uncaught error').toEqual([])

    // Any text is enough — the create-password screen renders first.
    await expect(page.getByTestId('create-password-input')).toBeVisible({
        timeout: 20_000,
    })

    const loaded = await page.evaluate(async () => {
        await Promise.all([
            document.fonts.load("13px 'DMSansRegular'"),
            document.fonts.load("13px 'DMSansMedium'"),
            document.fonts.load("13px 'DMSansBold'"),
        ])
        await document.fonts.ready
        return {
            regular: document.fonts.check("13px 'DMSansRegular'"),
            medium: document.fonts.check("13px 'DMSansMedium'"),
            bold: document.fonts.check("13px 'DMSansBold'"),
        }
    })
    expect(loaded).toEqual({ regular: true, medium: true, bold: true })

    expect(fontRequestUrls.length).toBeGreaterThan(0)
    for (const url of fontRequestUrls) {
        expect(url.startsWith(`chrome-extension://${extensionId}/fonts/`)).toBe(
            true,
        )
    }

    await page.close()
})
