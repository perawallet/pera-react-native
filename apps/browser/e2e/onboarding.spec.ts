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

// One persistent context carries state across all three phases (onboard →
// lock → unlock). Serial mode ensures ordering.
test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
const PASSWORD = 'e2e-test-password-1'

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

// Phase 1: Onboard — password creation → "Create wallet" → name account →
// account home. Proves the full first-run happy path in the expanded tab.
test('onboards in the expanded tab: password → create wallet → home', async () => {
    const page = await context.newPage()
    const pageErrors = trackPageErrors(page)
    await page.goto(`chrome-extension://${extensionId}/expanded.html`)

    // --- Vault: create password ---
    await page.getByTestId('create-password-input').fill(PASSWORD)
    await page.getByTestId('create-password-confirm-input').fill(PASSWORD)
    await page.getByTestId('create-password-submit').click()

    // --- Onboarding: tap "Create wallet" button ---
    // testID from OnboardingScreen.tsx: 'onboarding_create_wallet_button'
    await page
        .getByTestId('onboarding_create_wallet_button')
        .click({ timeout: 20_000 })

    // Fail fast on a module-eval crash instead of waiting out the full
    // selector timeout below.
    expect(pageErrors, 'page threw an uncaught error').toEqual([])

    // Terms gate (M3): the sheet must appear, and accepting must record
    // consent — assert both; a missing sheet or missing record is a failure.
    await expect(page.getByTestId('terms_agree_button')).toBeVisible({
        timeout: 20_000,
    })

    // consent must not exist before the Agree tap — the M2 auto-acceptor regression class
    const [serviceWorkerPreTap] = context.serviceWorkers()
    const settingsRawPreTap = await serviceWorkerPreTap.evaluate(async () => {
        const stored = await chrome.storage.local.get('kv:settings-store')
        return stored['kv:settings-store'] as string | undefined
    })
    if (settingsRawPreTap) {
        expect(
            JSON.parse(settingsRawPreTap).state.preferences,
        ).not.toHaveProperty('acceptedTermsVersion')
    }

    await page.getByTestId('terms_agree_button').click()

    // --- Name account: accept default name and finish ---
    // BIP39 + HD derivation takes a couple of seconds before navigation lands
    // on NameAccount. Wait for visible first, then click.
    // testID from NameAccountForm.tsx: 'name_account_finish_button'
    await expect(page.getByTestId('name_account_finish_button')).toBeVisible({
        timeout: 45_000,
    })
    await page.getByTestId('name_account_finish_button').click()

    // --- Home: real portfolio screen must appear ---
    // testID from AccountScreen.tsx:67
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 30_000,
    })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])

    // Regression guard (M3 home-crash): the home screen's corner-radius
    // reveal animation (useAccountScreenAnimation) assigns a shared value a
    // couple hundred ms after mount. On web that goes through reanimated's
    // valueSetter, which previously threw `_getAnimationTimestamp is not a
    // function` because the web-shims/react-native-worklets.js stub never set
    // that global — an uncaught error with no error boundary in the web tree,
    // which unmounts React's entire root and blanks the screen. Wait past
    // that window and assert the screen is still there with no new errors.
    await page.waitForTimeout(2000)
    await expect(page.getByTestId('account_screen')).toBeVisible()
    expect(pageErrors, 'page threw an uncaught error').toEqual([])

    // Terminal-state assertion: the real consent record, not just UI
    // progress. STORE_NAME = 'settings-store' (packages/settings/src/store/
    // store.ts) + KV_PREFIX = 'kv:' (ChromeKeyValueStorageService) ->
    // 'kv:settings-store'.
    const [serviceWorker] = context.serviceWorkers()
    const settingsRaw = await serviceWorker.evaluate(async () => {
        const stored = await chrome.storage.local.get('kv:settings-store')
        return stored['kv:settings-store'] as string | undefined
    })
    expect(settingsRaw).toBeTruthy()
    // Persisted zustand JSON: { state: { preferences: { acceptedTermsVersion: '1' } } … }
    expect(JSON.parse(settingsRaw ?? '{}').state.preferences).toHaveProperty(
        'acceptedTermsVersion',
    )

    await page.close()
})

// Phase 2 & 3: Lock → unlock. Proves that force-locking via the service
// worker shows the unlock screen, wrong password surfaces the error element,
// and the correct password restores home.
test('locked popup shows unlock; wrong password errors; right password unlocks', async () => {
    // Force-lock by clearing the session master key from the service worker.
    // SESSION_MASTER_KEY = 'vault:master-key'
    // (see extensions/keystore-chrome/src/vault/session.ts)
    const [serviceWorker] = context.serviceWorkers()
    await serviceWorker.evaluate(async () => {
        await chrome.storage.session.remove('vault:master-key')
    })

    const page = await context.newPage()
    const pageErrors = trackPageErrors(page)
    await page.goto(`chrome-extension://${extensionId}/popup.html`)

    // Fail fast on a module-eval crash instead of waiting out the full
    // selector timeout below.
    expect(pageErrors, 'page threw an uncaught error').toEqual([])

    // Unlock screen must appear after the session key is cleared.
    // testID from UnlockScreen.tsx: 'unlock-password-input'
    await expect(page.getByTestId('unlock-password-input')).toBeVisible({
        timeout: 20_000,
    })

    // Wrong password → error element must appear.
    // testID from UnlockScreen.tsx: 'unlock-error'
    await page.getByTestId('unlock-password-input').fill('wrong-password')
    await page.getByTestId('unlock-submit').click()
    await expect(page.getByTestId('unlock-error')).toBeVisible()

    // Correct password → back to account home.
    // Retry filling and submitting until home appears: this drains React's
    // input-clear cycle and the 500ms double-press guard in PWTouchableOpacity
    // without a fixed sleep.
    await expect(async () => {
        await page.getByTestId('unlock-password-input').fill(PASSWORD)
        await page.getByTestId('unlock-submit').click()
        await expect(page.getByTestId('account_screen')).toBeVisible({
            timeout: 1000,
        })
    }).toPass({ timeout: 15_000 })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
    await page.close()
})

// Phase 4: Corrupted vault blob. MUST be the LAST test in this file — it
// overwrites the real wrapped-master-key blob with an unrecoverable one, so
// no later test in this serial suite can unlock the vault again.
// Key literals cross-reference extensions/keystore-chrome/src/storage-keys.ts:
// SESSION_MASTER_KEY = 'vault:master-key', VAULT_STORAGE_KEY = 'vault:wrapped-master-key'.
test('corrupted vault blob surfaces the corrupted error, not wrong-password', async () => {
    const [serviceWorker] = context.serviceWorkers()
    await serviceWorker.evaluate(async () => {
        await chrome.storage.session.remove('vault:master-key')
        const stored = await chrome.storage.local.get(
            'vault:wrapped-master-key',
        )
        const blob = JSON.parse(stored['vault:wrapped-master-key'] as string)
        blob.salt = 'AAAA' // decodes to 3 bytes — fails the length validation
        await chrome.storage.local.set({
            'vault:wrapped-master-key': JSON.stringify(blob),
        })
    })
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.getByTestId('unlock-password-input').fill(PASSWORD)
    await page.getByTestId('unlock-submit').click()
    await expect(page.getByTestId('unlock-corrupted-error')).toBeVisible()
    await page.close()
})
