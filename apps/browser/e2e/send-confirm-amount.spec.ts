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

// The send Confirm screen in the real popup: react-native-web can't shrink
// text to fit, so a long amount must wrap rather than end in an ellipsis.
import { expect, test, chromium, type BrowserContext } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settlePinPrompt } from './pin-prompt'
import { skipPasskeyUnlockStep } from './passkey-unlock-step'
import {
    E2E_EVM_RPC_PORT,
    createFakeEvmNode,
    serveFakeEvmNode,
} from './fixtures/fake-evm-node.mjs'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

const PASSWORD = 'e2e-send-confirm-amount-password-1'
const RECEIVER = '0x1111111111111111111111111111111111111111'
// Under 1e-6 ETH keeps its significant digits ("0.000000000012"), which is
// wider than the popup's value column.
const TINY_AMOUNT = '0.000000000012345678'

let context: BrowserContext
let nodeServer: Awaited<ReturnType<typeof serveFakeEvmNode>> | undefined

test.beforeAll(async () => {
    nodeServer = await serveFakeEvmNode(createFakeEvmNode(), {
        port: E2E_EVM_RPC_PORT,
    })
    context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${dist}`,
            `--load-extension=${dist}`,
        ],
    })
})

test.afterAll(async () => {
    await context?.close()
    await nodeServer?.close()
})

test('a long amount on the send Confirm screen wraps instead of being cut off', async () => {
    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker')
    }
    const extensionId = new URL(serviceWorker.url()).host
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/expanded.html`)
    await page.getByTestId('create-password-input').fill(PASSWORD)
    await page.getByTestId('create-password-confirm-input').fill(PASSWORD)
    await page.getByTestId('create-password-submit').click()
    await skipPasskeyUnlockStep(page)
    await page
        .getByTestId('onboarding_create_wallet_button')
        .click({ timeout: 20_000 })
    await page.getByTestId('terms_agree_button').click({ timeout: 20_000 })
    await page
        .getByTestId('name_account_finish_button')
        .click({ timeout: 45_000 })
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 30_000,
    })
    await settlePinPrompt(page)
    await page.setViewportSize({ width: 360, height: 600 })

    await page.getByTestId('send_button').click()
    await page
        .getByText('Ethereum', { exact: true })
        .locator('visible=true')
        .last()
        .click()
    await page
        .getByText('ETH', { exact: true })
        .locator('visible=true')
        .last()
        .click()
    const understand = page
        .getByText('I Understand', { exact: true })
        .locator('visible=true')
    await understand.click({ timeout: 5000 }).catch(() => {})
    await page.keyboard.type(TINY_AMOUNT)
    await page
        .getByTestId('send_input_next_button')
        .locator('visible=true')
        .click()
    // The amount screen stays mounted under the sheet and keeps its keyboard
    // listener, so type into the field directly rather than through the keys.
    await page
        .getByPlaceholder('0x address, ENS name, or account name')
        .last()
        .fill(RECEIVER, { force: true })
    await page
        .getByText(/0x1111/)
        .locator('visible=true')
        .last()
        .click()

    const amount = page.getByTestId('send_confirm_amount')
    await expect(amount).toHaveText('0.000000000012', { timeout: 30_000 })
    const layout = await amount.evaluate(element => ({
        isClipped: element.scrollWidth > element.clientWidth,
        textOverflow: getComputedStyle(element).textOverflow,
    }))
    expect(layout).toEqual({ isClipped: false, textOverflow: 'clip' })
})
