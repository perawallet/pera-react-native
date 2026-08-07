/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// End-to-end proof of the WebAuthn interception provider: a plain http(s) page
// speaks the real credentials API, the MAIN-world interceptor wraps it, the
// ISOLATED relay gates it on `webauthnInterceptionEnabled`, and the service
// worker routes it to the same popup-approval surface enable/sign use.
//
// CDP's WebAuthn domain supplies a virtual authenticator so the FALL-THROUGH
// path (interception off, or declined) has a real implementation to complete
// the ceremony against.
import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type CDPSession,
    type Page,
} from '@playwright/test'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clickThroughPinPrompt, dismissPinPromptIfPresent } from './pin-prompt'

declare global {
    interface Window {
        doCreate: () => Promise<void>
        doGet: () => Promise<void>
    }
}

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)
const fixtureHtml = readFileSync(
    path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'fixtures/webauthn-rp-page.html',
    ),
)

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
let page: Page // the onboarded extension tab (expanded.html)
let dappPage: Page // the plain http(s) page speaking real navigator.credentials
let pageErrors: Error[]
let dappPageErrors: Error[]
let server: http.Server
let dappOrigin: string
// Populated by test 2's create(); test 3 asserts against it and test 5 deletes
// it. Deletion is held until last precisely because test 3 needs it alive.
let createdCredentialId = ''
// Captured by locating the rendered row, NOT reconstructed from
// `createdCredentialId`: despite what models/passkey.ts documents, keystore
// `keyId` comes from the library's own `generateKey()` and does not match the
// derived credentialId sent to the page.
let createdPasskeyRowTestId = ''
const PASSWORD = 'e2e-passkey-provider-password-1'

// Without this, module-eval crashes in the bundle surface as bare selector
// timeouts with no sign of the real cause.
const trackPageErrors = (targetPage: Page): Error[] => {
    const errors: Error[] = []
    targetPage.on('pageerror', error => errors.push(error))
    return errors
}

// Automatic presence simulation resolves the ceremony with no native OS UI,
// which is what makes the fall-through path drivable headlessly at all. The
// resident-key/user-verification flags match what Touch ID / Windows Hello
// would report.
const VIRTUAL_AUTHENTICATOR_OPTIONS = {
    protocol: 'ctap2',
    transport: 'internal',
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
} as const

// Captured for test 4's WebAuthn.clearCredentials call.
let dappCdp: CDPSession
let dappAuthenticatorId: string

const attachVirtualAuthenticator = async (
    targetPage: Page,
): Promise<CDPSession> => {
    const cdp = await context.newCDPSession(targetPage)
    await cdp.send('WebAuthn.enable')
    const { authenticatorId } = await cdp.send(
        'WebAuthn.addVirtualAuthenticator',
        { options: VIRTUAL_AUTHENTICATOR_OPTIONS },
    )
    dappCdp = cdp
    dappAuthenticatorId = authenticatorId
    return cdp
}

// Passkey approvals share the pending-approval store and discovery message
// with enable/sign, so this mirrors dapp-connect/dapp-sign's helpers.
const openApprovalPopup = async (): Promise<{
    approvalPage: Page
    approvalErrors: Error[]
}> => {
    await expect
        .poll(
            () =>
                page.evaluate(
                    scope =>
                        new Promise<unknown>(resolve => {
                            const runtime = (
                                globalThis as unknown as {
                                    chrome?: {
                                        runtime?: {
                                            sendMessage?: (
                                                message: unknown,
                                                callback: (r: unknown) => void,
                                            ) => void
                                        }
                                    }
                                }
                            ).chrome?.runtime
                            if (!runtime?.sendMessage) {
                                resolve(null)
                                return
                            }
                            runtime.sendMessage(
                                { scope, kind: 'get-current-approval' },
                                resolve,
                            )
                        }),
                    'pera-dapp-approval',
                ),
            { timeout: 20_000 },
        )
        .not.toBeNull()

    const approvalPage = await context.newPage()
    // The real toolbar popup's dimensions.
    await approvalPage.setViewportSize({ width: 360, height: 600 })
    const approvalErrors = trackPageErrors(approvalPage)
    await approvalPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await approvalPage.waitForLoadState('domcontentloaded')

    // VaultGate wraps the approval surface too.
    const unlockInput = approvalPage.getByTestId('unlock-password-input')
    if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await unlockInput.fill(PASSWORD)
        await approvalPage.getByTestId('unlock-submit').click()
    }

    return { approvalPage, approvalErrors }
}

// A full reload re-runs bootstrap, and VaultGate wraps every surface.
const unlockIfLocked = async (targetPage: Page): Promise<void> => {
    const unlockInput = targetPage.getByTestId('unlock-password-input')
    if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await unlockInput.fill(PASSWORD)
        await targetPage.getByTestId('unlock-submit').click()
    }
}

const navigateToPasskeysSettings = async (): Promise<void> => {
    await dismissPinPromptIfPresent(page)
    await clickThroughPinPrompt(page, page.getByTestId('tab_menu_button'))
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(page, page.getByTestId('menu_settings_button'))
    await expect(page.getByTestId('settings_screen')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(
        page,
        page.getByTestId('settings_item_passkeys'),
    )
    await expect(page.getByTestId('settings_passkeys_screen')).toBeVisible({
        timeout: 20_000,
    })
}

// The reload is load-bearing: webauthn-relay.ts reads
// `webauthnInterceptionEnabled` once per page load, so a live flip only takes
// effect on the dapp page's next navigation.
const enableInterceptionAndReloadDapp = async (): Promise<void> => {
    await navigateToPasskeysSettings()

    const toggle = page.getByTestId('settings_passkeys_interception_toggle')
    await expect(toggle).toBeVisible({ timeout: 20_000 })
    await toggle.click()

    await dappPage.reload()
    await dappPage.waitForFunction(() => typeof window.doCreate === 'function')
}

// The keystore's reactive store is a per-tab singleton hydrated once at
// bootstrap, and App.web.tsx never re-syncs it. A key minted in the approval
// popup's tab is invisible here until a full reload re-runs hydrateKeystore().
const reloadAndReturnToPasskeysSettings = async (): Promise<void> => {
    await page.reload()
    await unlockIfLocked(page)
    await navigateToPasskeysSettings()
}

test.beforeAll(async () => {
    // Must be http(s): the content scripts declare
    // `matches: ['http://*/*', 'https://*/*']` and never match `file://`.
    server = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fixtureHtml)
    })
    await new Promise<void>(resolve => {
        server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    const port =
        address !== null && typeof address === 'object' ? address.port : 0
    // http:// is only a secure context on 127.0.0.1/localhost, and 'localhost'
    // doubles as the rp.id — resolveRpId accepts a dot-less rpId only when it
    // equals the caller's hostname.
    dappOrigin = `http://localhost:${port}`

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

    // Seed the PIN-security nudge as already dismissed so it never mounts. It
    // fires on a wall-clock delay and lands mid-flow as a full-screen backdrop
    // that the reactive dismiss helper doesn't always beat.
    await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            'kv:settings-store': JSON.stringify({
                state: { preferences: { security_pin_setup_prompt: true } },
                version: 1,
            }),
        })
    })

    // An HD-wallet account must exist for the authenticator's key derivation
    // to have anything to derive from.
    page = await context.newPage()
    pageErrors = trackPageErrors(page)
    await page.goto(`chrome-extension://${extensionId}/expanded.html`)

    await page.getByTestId('create-password-input').fill(PASSWORD)
    await page.getByTestId('create-password-confirm-input').fill(PASSWORD)
    await page.getByTestId('create-password-submit').click()

    await page
        .getByTestId('onboarding_create_wallet_button')
        .click({ timeout: 20_000 })

    await expect(page.getByTestId('terms_agree_button')).toBeVisible({
        timeout: 20_000,
    })
    await page.getByTestId('terms_agree_button').click()

    await expect(page.getByTestId('name_account_finish_button')).toBeVisible({
        timeout: 45_000,
    })
    await page.getByTestId('name_account_finish_button').click()

    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 30_000,
    })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])

    dappPage = await context.newPage()
    dappPageErrors = trackPageErrors(dappPage)
    // CDP WebAuthn state is scoped to the target, not the document, so this
    // survives the reload between tests 1 and 2.
    await attachVirtualAuthenticator(dappPage)
    await dappPage.goto(dappOrigin)
    await dappPage.waitForFunction(() => typeof window.doCreate === 'function')
})

test.afterAll(async () => {
    await context.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
})

// Toggle OFF: the wrap must be inert — no approval window, and the ceremony
// completes against the virtual authenticator as if we never injected.
test('interception off by default: create() completes natively with no Pera approval window', async () => {
    const pagesBefore = context.pages().length

    await dappPage.click('#create-button')

    await expect
        .poll(() => dappPage.locator('#create-credential-id').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')

    expect(await dappPage.locator('#create-error').textContent()).toBe('')
    expect(context.pages().length).toBe(pagesBefore)
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})

// Toggle ON: create() is intercepted, approved in the popup, and the
// credential both round-trips to the page and lands in Settings > Passkeys.
test('interception on: create() opens the Pera consent screen; approving returns a credential that appears in Settings', async () => {
    await enableInterceptionAndReloadDapp()

    await dappPage.click('#create-button')

    const { approvalPage, approvalErrors } = await openApprovalPopup()
    expect(approvalPage.url()).toContain('popup.html')

    await expect(approvalPage.getByTestId('dapp-passkey-rp-id')).toBeVisible({
        timeout: 20_000,
    })
    await expect(approvalPage.getByTestId('dapp-passkey-rp-id')).toHaveText(
        'localhost',
    )

    const approveButton = approvalPage.getByTestId('dapp-passkey-approve')
    await expect(approveButton).toBeVisible()
    await approveButton.click()

    await expect
        .poll(() => dappPage.locator('#create-credential-id').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')
    expect(await dappPage.locator('#create-error').textContent()).toBe('')

    createdCredentialId =
        (await dappPage.locator('#create-credential-id').textContent()) ?? ''
    expect(createdCredentialId.length).toBeGreaterThan(0)

    await approvalPage.close()

    // Only one passkey exists at this point, so locate the row structurally
    // rather than by testID (see createdPasskeyRowTestId).
    await reloadAndReturnToPasskeysSettings()
    const row = page.locator('[data-testid^="settings_passkeys_item_"]')
    await expect(row).toBeVisible({ timeout: 20_000 })
    await expect(row).toHaveCount(1)
    createdPasskeyRowTestId = (await row.getAttribute('data-testid')) ?? ''
    expect(createdPasskeyRowTestId.length).toBeGreaterThan(0)
    expect(approvalErrors, 'approval popup threw an uncaught error').toEqual([])
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})

// The proof isn't that get() resolves — it's the RP page's own WebCrypto
// verify() of the assertion against the public key it independently extracted
// from test 2's attestation, covering DER signature, authData and
// clientDataHash byte-correctness end to end.
test('interception on: get() asserts against the stored credential and the RP page verifies the signature', async () => {
    expect(
        createdCredentialId.length,
        'test 2 must have created a credential',
    ).toBeGreaterThan(0)

    await dappPage.click('#get-button')

    const { approvalPage, approvalErrors } = await openApprovalPopup()
    expect(approvalPage.url()).toContain('popup.html')

    await expect(approvalPage.getByTestId('dapp-passkey-rp-id')).toBeVisible({
        timeout: 20_000,
    })
    await expect(approvalPage.getByTestId('dapp-passkey-rp-id')).toHaveText(
        'localhost',
    )

    const approveButton = approvalPage.getByTestId('dapp-passkey-approve')
    await expect(approveButton).toBeVisible()
    await approveButton.click()

    await expect
        .poll(() => dappPage.locator('#get-credential-id').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')
    expect(await dappPage.locator('#get-error').textContent()).toBe('')
    expect(await dappPage.locator('#get-credential-id').textContent()).toBe(
        createdCredentialId,
    )

    // The user.id test 2 sent round-trips back as response.userHandle.
    expect(await dappPage.locator('#user-handle-match').textContent()).toBe(
        'MATCH',
    )
    // DER signature -> raw r||s, verified against the SPKI key rebuilt from
    // the create() attestation's COSE key.
    expect(await dappPage.locator('#verify-result').textContent()).toBe('PASS')

    await approvalPage.close()
    expect(approvalErrors, 'approval popup threw an uncaught error').toEqual([])
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})

// Declining must fall through to the REAL navigator.credentials.create(),
// not leave the page's promise unsettled or reject it.
//
// That real ceremony hangs forever on ~75% of Linux attempts (a Chromium/CDP
// virtual-authenticator flake specific to reaching create() through an async
// relay rather than a user gesture) — so the retry loop is load-bearing, not
// padding. 20 × 5s puts expected failure near 0.3%; the short poll is safe
// because the ceremony either resolves promptly or never.
//
// CRITICAL: each attempt must reload first. A hung create() stays pending on
// the document and every further create() on it rejects with "A request is
// already pending", collapsing the whole loop into one coin flip. The virtual
// authenticator is attached to the CDP session, so it survives the reload.
const FALLTHROUGH_MAX_ATTEMPTS = 20
const FALLTHROUGH_POLL_MS = 5000

const attemptDeclineFallThrough = async (): Promise<{
    resolved: boolean
    approvalErrors: Error[]
}> => {
    await dappPage.reload()
    await dappPage.waitForFunction(() => typeof window.doCreate === 'function')
    await dappPage.click('#create-button')

    const { approvalPage, approvalErrors } = await openApprovalPopup()
    expect(approvalPage.url()).toContain('popup.html')

    await expect(approvalPage.getByTestId('dapp-passkey-rp-id')).toBeVisible({
        timeout: 20_000,
    })

    const declineButton = approvalPage.getByTestId('dapp-passkey-decline')
    await expect(declineButton).toBeVisible()
    await declineButton.click()

    const resolved = await expect
        .poll(() => dappPage.locator('#create-credential-id').textContent(), {
            timeout: FALLTHROUGH_POLL_MS,
        })
        .not.toBe('')
        .then(() => true)
        .catch(() => false)

    await approvalPage.close()
    return { resolved, approvalErrors }
}

test('declining the consent screen falls through to the native virtual authenticator, not an unhandled rejection', async () => {
    await dappCdp.send('WebAuthn.clearCredentials', {
        authenticatorId: dappAuthenticatorId,
    })

    let resolved = false
    let approvalErrors: Error[] = []
    for (
        let attempt = 0;
        attempt < FALLTHROUGH_MAX_ATTEMPTS && !resolved;
        attempt++
    ) {
        ;({ resolved, approvalErrors } = await attemptDeclineFallThrough())
    }
    expect(
        resolved,
        `fallthrough create() never resolved after ${FALLTHROUGH_MAX_ATTEMPTS} attempts`,
    ).toBe(true)
    // A resolved credential, NOT a rejection — DECLINE collapses to the
    // fall-through path, never a fabricated error.
    expect(await dappPage.locator('#create-error').textContent()).toBe('')

    expect(approvalErrors, 'approval popup threw an uncaught error').toEqual([])
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})

// Runs last, once test 3 no longer needs the credential. Neither the trash
// icon nor the confirm sheet carries a testID in production code, so both are
// selected structurally.
test('the passkey created in test 2 is deletable from Settings', async () => {
    expect(
        createdPasskeyRowTestId.length,
        'test 2 must have captured the Settings row',
    ).toBeGreaterThan(0)
    const row = page.getByTestId(createdPasskeyRowTestId)
    await expect(row).toBeVisible({ timeout: 20_000 })

    // Two icons per row: the decorative header one, then the trash touchable.
    await clickThroughPinPrompt(page, row.locator('svg').last())

    await clickThroughPinPrompt(page, page.getByText('Remove', { exact: true }))

    await expect(row).toHaveCount(0, { timeout: 10_000 })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})
