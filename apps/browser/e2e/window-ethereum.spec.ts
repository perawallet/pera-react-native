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

// Discovery of the EIP-1193 provider in a real browser: a build that serves an
// EVM chain claims `window.ethereum` only when it is free and announces Pera
// through EIP-6963 either way; a build that serves none offers EVM dApps nothing.
// Then signing from a connected site, end to end, against a faked node.
import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type Page,
} from '@playwright/test'
import http from 'node:http'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    openApprovalSurface,
    expectApprovalSurfaceUrl,
    selectAccountAndArmConnect,
    standInForToolbarPopup,
    tapToConfirm,
    trackPageErrors,
} from './approval-surface'
import { settlePinPrompt } from './pin-prompt'
import {
    E2E_EVM_RPC_PORT,
    E2E_EVM_RPC_URL,
    createFakeEvmNode,
    evmTxHashOf,
    serveFakeEvmNode,
    type FakeEvmNode,
} from './fixtures/fake-evm-node.mjs'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

const PAGE = '<!doctype html><html><body>dapp</body></html>'

// Which side of the build flag this dist was bundled on; the provider's
// announce event name survives minification only when it is built in.
const servesEvm = readFileSync(
    path.join(dist, 'content-inject-main.js'),
    'utf8',
).includes('eip6963:announceProvider')

// Every EVM RPC URL the bundle baked, from the esbuild surfaces and the
// exported UI chunks alike (the offscreen document runs the latter).
const bakedEvmRpcUrls = (): string[] =>
    readdirSync(dist, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
        .flatMap(entry =>
            [
                ...readFileSync(
                    path.join(entry.parentPath, entry.name),
                    'utf8',
                ).matchAll(/\b\w+RpcUrl\s*:\s*["']([^"']*)["']/g),
            ].map(([, url]) => url),
        )

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let server: http.Server
let dappOrigin: string

type Announcement = {
    info: { uuid: string; name: string; icon: string; rdns: string }
    isPera: boolean
}

test.beforeAll(async () => {
    server = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(PAGE)
    })
    await new Promise<void>(resolve => {
        server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    const port =
        address !== null && typeof address === 'object' ? address.port : 0
    // http:// is a secure context only on localhost, where the content
    // scripts are declared.
    dappOrigin = `http://localhost:${port}`

    const realNodes = [...new Set(bakedEvmRpcUrls())].filter(
        url => url !== E2E_EVM_RPC_URL,
    )
    if (realNodes.length > 0) {
        throw new Error(
            `dist bakes EVM RPC URLs other than the e2e fake node: ${realNodes.join(', ')}. ` +
                'Playwright cannot route the offscreen document, so a real node would be reached. ' +
                'Rebuild with: pnpm --filter browser bundle:e2e',
        )
    }

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
    await new Promise<void>(resolve => server.close(() => resolve()))
})

const announcementsOn = (page: import('@playwright/test').Page) =>
    page.evaluate(
        () =>
            new Promise<Announcement[]>(resolve => {
                const seen: Announcement[] = []
                window.addEventListener('eip6963:announceProvider', e => {
                    const { info, provider } = (
                        e as CustomEvent<{
                            info: Announcement['info']
                            provider: { isPera?: boolean }
                        }>
                    ).detail
                    seen.push({ info, isPera: provider.isPera === true })
                })
                window.dispatchEvent(new Event('eip6963:requestProvider'))
                setTimeout(() => resolve(seen), 100)
            }),
    )

test('a build without EVM chains offers EVM dApps nothing and keeps window.pera', async () => {
    test.skip(servesEvm, 'this dist serves an EVM chain')
    const page = await context.newPage()
    await page.goto(dappOrigin)
    await expect
        .poll(() => page.evaluate(() => typeof window.pera?.connect))
        .toBe('function')

    expect(await page.evaluate(() => 'ethereum' in (window as object))).toBe(
        false,
    )
    expect(await announcementsOn(page)).toEqual([])
    await page.close()
})

test('a page with no other wallet finds Pera at window.ethereum and in EIP-6963', async () => {
    test.skip(!servesEvm, 'this dist serves no EVM chain')
    const page = await context.newPage()
    await page.goto(dappOrigin)

    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    (window as { ethereum?: { isPera?: boolean } }).ethereum
                        ?.isPera === true,
            ),
        )
        .toBe(true)
    const announced = await announcementsOn(page)
    expect(announced).toHaveLength(1)
    expect(announced[0]).toMatchObject({
        isPera: true,
        info: { name: 'Pera Wallet', rdns: 'app.perawallet' },
    })
    expect(announced[0].info.icon).toMatch(/^data:image\/svg\+xml;base64,/)
    // window.pera is untouched by the second provider.
    expect(await page.evaluate(() => typeof window.pera?.connect)).toBe(
        'function',
    )
    await page.close()
})

test('a wallet that injects after Pera takes window.ethereum, and Pera stays listed', async () => {
    test.skip(!servesEvm, 'this dist serves no EVM chain')
    const page = await context.newPage()
    await page.goto(dappOrigin)
    await expect
        .poll(() => page.evaluate(() => 'ethereum' in (window as object)))
        .toBe(true)

    // What a later-loading wallet does: assign its own provider.
    const isOtherWallet = await page.evaluate(() => {
        ;(window as { ethereum?: unknown }).ethereum = { isMetaMask: true }
        return (
            (window as { ethereum?: { isMetaMask?: boolean } }).ethereum
                ?.isMetaMask === true
        )
    })
    expect(isOtherWallet).toBe(true)
    const announced = await announcementsOn(page)
    expect(announced.map(({ info }) => info.rdns)).toEqual(['app.perawallet'])
    await page.close()
})

test('the provider answers EIP-1193 requests with no connection yet', async () => {
    test.skip(!servesEvm, 'this dist serves no EVM chain')
    const page = await context.newPage()
    await page.goto(dappOrigin)
    await expect
        .poll(() => page.evaluate(() => 'ethereum' in (window as object)))
        .toBe(true)

    const accounts = await page.evaluate(() =>
        (
            window as {
                ethereum?: {
                    request(args: { method: string }): Promise<unknown>
                }
            }
        ).ethereum?.request({ method: 'eth_accounts' }),
    )
    expect(accounts).toEqual([])
    const refusal = await page.evaluate(() =>
        (
            window as {
                ethereum?: {
                    request(args: {
                        method: string
                        params?: unknown
                    }): Promise<unknown>
                }
            }
        ).ethereum
            ?.request({
                method: 'wallet_addEthereumChain',
                params: [{ chainId: '0x539' }],
            })
            .then(
                () => null,
                (error: { code?: number }) => error.code,
            ),
    )
    expect(refusal).toBe(4200)
    await page.close()
})

// Signing from a connected site, through the real approval surface. The
// bundle bakes one EVM RPC URL, the localhost server in
// fixtures/fake-evm-node.mjs, so nothing signed here leaves the machine, from
// whichever extension page makes the call.
test.describe('signing from a connected dApp', () => {
    const PASSWORD = 'e2e-window-ethereum-password-1'
    // The same wait walletconnect.spec.ts gives a wrongly-surfaced approval.
    const NO_APPROVAL_WAIT_MS = 3000
    // OFFSCREEN_POLL_INTERVAL_MS in src/offscreen/runOffscreenApp.ts, which is
    // not exported: importing it would pull the offscreen runtime into the spec.
    const OFFSCREEN_POLL_INTERVAL_MS = 30_000
    const OFFSCREEN_SLACK_MS = 5000

    let extensionId: string
    let walletPage: Page
    let dappPage: Page
    let node: FakeEvmNode
    let nodeServer: Awaited<ReturnType<typeof serveFakeEvmNode>> | undefined
    let address: string
    let hexChainId: string

    type Outcome = { result?: unknown; code?: number; message?: string }

    // Started in the page and read back by key: a request that waits on an
    // approval can't be awaited inside one evaluate while the test drives it.
    const startRequest = (
        key: string,
        args: { method: string; params?: unknown },
    ): Promise<void> =>
        dappPage.evaluate(
            ({ key, args }) => {
                const w = window as unknown as {
                    __outcomes?: Record<string, Outcome>
                    ethereum: {
                        request(a: typeof args): Promise<unknown>
                    }
                }
                const outcomes = (w.__outcomes ??= {})
                void w.ethereum.request(args).then(
                    result => {
                        outcomes[key] = { result }
                    },
                    (error: { code?: number; message?: string }) => {
                        outcomes[key] = {
                            code: error.code,
                            message: error.message,
                        }
                    },
                )
            },
            { key, args },
        )

    const outcomeOf = async (key: string): Promise<Outcome> => {
        let outcome: Outcome | null = null
        await expect
            .poll(
                async () => {
                    outcome = await dappPage.evaluate(
                        k =>
                            (
                                window as unknown as {
                                    __outcomes?: Record<string, Outcome>
                                }
                            ).__outcomes?.[k] ?? null,
                        key,
                    )
                    return outcome
                },
                { timeout: 30_000 },
            )
            .not.toBeNull()
        return outcome as unknown as Outcome
    }

    // VaultGate is outermost, so it wraps the approval surface too.
    const unlockIfNeeded = async (approvalPage: Page): Promise<void> => {
        const unlockInput = approvalPage.getByTestId('unlock-password-input')
        if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await unlockInput.fill(PASSWORD)
            await approvalPage.getByTestId('unlock-submit').click()
        }
    }

    const openApproval = async () => {
        const opened = await openApprovalSurface({
            context,
            page: walletPage,
            extensionId,
        })
        expectApprovalSurfaceUrl(opened.approvalPage)
        await unlockIfNeeded(opened.approvalPage)
        return opened
    }

    test.beforeAll(async () => {
        test.skip(!servesEvm, 'this dist serves no EVM chain')
        node = createFakeEvmNode()
        nodeServer = await serveFakeEvmNode(node, { port: E2E_EVM_RPC_PORT })

        let [serviceWorker] = context.serviceWorkers()
        if (!serviceWorker) {
            serviceWorker = await context.waitForEvent('serviceworker')
        }
        extensionId = new URL(serviceWorker.url()).host
        await standInForToolbarPopup(context)

        walletPage = await context.newPage()
        const walletErrors = trackPageErrors(walletPage)
        await walletPage.goto(`chrome-extension://${extensionId}/expanded.html`)
        await walletPage.getByTestId('create-password-input').fill(PASSWORD)
        await walletPage
            .getByTestId('create-password-confirm-input')
            .fill(PASSWORD)
        await walletPage.getByTestId('create-password-submit').click()
        await walletPage
            .getByTestId('onboarding_create_wallet_button')
            .click({ timeout: 20_000 })
        await expect(walletPage.getByTestId('terms_agree_button')).toBeVisible({
            timeout: 20_000,
        })
        await walletPage.getByTestId('terms_agree_button').click()
        await expect(
            walletPage.getByTestId('name_account_finish_button'),
        ).toBeVisible({ timeout: 45_000 })
        await walletPage.getByTestId('name_account_finish_button').click()
        await expect(walletPage.getByTestId('account_screen')).toBeVisible({
            timeout: 30_000,
        })
        expect(walletErrors, 'wallet page threw an uncaught error').toEqual([])
        await settlePinPrompt(walletPage)

        dappPage = await context.newPage()
        await dappPage.goto(dappOrigin)
        await expect
            .poll(() =>
                dappPage.evaluate(() => 'ethereum' in (window as object)),
            )
            .toBe(true)

        // page.evaluate carries a user gesture, which eth_requestAccounts needs.
        await startRequest('connect', { method: 'eth_requestAccounts' })
        const { approvalPage } = await openApproval()
        const connectButton = approvalPage.getByTestId('wc-connect-connect')
        await selectAccountAndArmConnect(approvalPage, connectButton)
        await connectButton.click()
        const connected = await outcomeOf('connect')
        expect(connected.code, connected.message).toBeUndefined()
        const accounts = connected.result as string[]
        expect(accounts).toHaveLength(1)
        address = accounts[0]
        await approvalPage.close().catch(() => {})

        await startRequest('chainId', { method: 'eth_chainId' })
        hexChainId = (await outcomeOf('chainId')).result as string
        node.setChainId(Number(BigInt(hexChainId)))
    })

    test.afterAll(async () => {
        await nodeServer?.close()
    })

    test('a connected dApp sends a transaction and gets the hash back', async () => {
        await startRequest('send', {
            method: 'eth_sendTransaction',
            params: [
                {
                    from: address,
                    to: '0x000000000000000000000000000000000000dEaD',
                    value: '0x1',
                },
            ],
        })
        const { approvalPage, approvalErrors } = await openApproval()
        await expect(
            approvalPage.getByTestId('signing_transaction_review'),
        ).toBeVisible({ timeout: 20_000 })
        await expect(approvalPage.getByTestId('ethereum_max_fee')).toBeVisible()
        const confirm = approvalPage.getByTestId('signing-confirm-slide')
        await expect(confirm).toBeVisible({ timeout: 20_000 })
        await tapToConfirm(approvalPage, confirm)

        const sent = await outcomeOf('send')
        expect(sent.code, sent.message).toBeUndefined()
        expect(node.rawTransactions).toHaveLength(1)
        expect(sent.result).toBe(evmTxHashOf(node.rawTransactions[0]))
        expect(node.unansweredMethods).toEqual([])
        await approvalPage.close().catch(() => {})
        expect(approvalErrors, 'approval threw an uncaught error').toEqual([])
    })

    test('a connected dApp signs typed data', async () => {
        const typedData = {
            types: {
                EIP712Domain: [
                    { name: 'name', type: 'string' },
                    { name: 'version', type: 'string' },
                    { name: 'chainId', type: 'uint256' },
                    { name: 'verifyingContract', type: 'address' },
                ],
                Permit: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' },
                ],
            },
            primaryType: 'Permit',
            domain: {
                name: 'USD Coin',
                version: '2',
                chainId: Number(BigInt(hexChainId)),
                verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            },
            message: {
                owner: address,
                spender: '0x1111111254EEB25477B68fb85Ed929f73A960582',
                value: '1000000',
                nonce: '0',
                deadline: String(Math.floor(Date.now() / 1000) + 3600),
            },
        }
        await startRequest('typed', {
            method: 'eth_signTypedData_v4',
            params: [address, JSON.stringify(typedData)],
        })
        const { approvalPage, approvalErrors } = await openApproval()
        await expect(
            approvalPage.getByTestId('message-signing-spend-approval-warning'),
        ).toBeVisible({ timeout: 20_000 })
        await tapToConfirm(
            approvalPage,
            approvalPage.getByTestId('message-signing-confirm-slide'),
        )

        const signed = await outcomeOf('typed')
        expect(signed.code, signed.message).toBeUndefined()
        expect(signed.result).toMatch(/^0x[0-9a-f]{130}$/)
        await approvalPage.close().catch(() => {})
        expect(approvalErrors, 'approval threw an uncaught error').toEqual([])
    })

    // The broadcast belongs to the offscreen document once the window hands
    // the signed send over, so closing the window mid-send changes nothing.
    test('closing the approval after Approve still answers the hash and keeps the site queue', async () => {
        const message = `0x${Buffer.from('Sign in to the e2e dApp').toString('hex')}`
        const broadcastsBefore = node.rawTransactions.length
        await startRequest('held-send', {
            method: 'eth_sendTransaction',
            params: [
                {
                    from: address,
                    to: '0x000000000000000000000000000000000000dEaD',
                    value: '0x1',
                },
            ],
        })
        await startRequest('after-held-send', {
            method: 'personal_sign',
            params: [message, address],
        })
        const release = node.holdBroadcasts()
        const { approvalPage } = await openApproval()
        const confirm = approvalPage.getByTestId('signing-confirm-slide')
        await expect(confirm).toBeVisible({ timeout: 20_000 })
        await tapToConfirm(approvalPage, confirm)
        await expect
            .poll(() => node.rawTransactions.length, { timeout: 20_000 })
            .toBe(broadcastsBefore + 1)

        await approvalPage.close()
        release()

        const sent = await outcomeOf('held-send')
        expect(sent.code, sent.message).toBeUndefined()
        expect(sent.result).toBe(
            evmTxHashOf(node.rawTransactions[broadcastsBefore]),
        )
        const { approvalPage: next } = await openApproval()
        await expect(
            next.getByTestId('message-signing-confirm-slide'),
        ).toBeVisible({ timeout: 20_000 })
        await next.close()
        expect((await outcomeOf('after-held-send')).code).toBe(4001)
    })

    test('closing the approval rejects the request and the queued ones with 4001', async () => {
        const message = `0x${Buffer.from('Sign in to the e2e dApp').toString('hex')}`
        await startRequest('first', {
            method: 'personal_sign',
            params: [message, address],
        })
        await startRequest('second', {
            method: 'personal_sign',
            params: [message, address],
        })
        const { approvalPage } = await openApproval()
        await expect(
            approvalPage.getByTestId('message-signing-confirm-slide'),
        ).toBeVisible({ timeout: 20_000 })
        await approvalPage.close()

        expect((await outcomeOf('first')).code).toBe(4001)
        expect((await outcomeOf('second')).code).toBe(4001)
    })

    test('eth_sign is refused without opening an approval', async () => {
        const pagesBefore = context.pages().length
        await startRequest('ethSign', {
            method: 'eth_sign',
            params: [address, `0x${'00'.repeat(32)}`],
        })
        expect((await outcomeOf('ethSign')).code).toBe(4200)

        await dappPage.waitForTimeout(NO_APPROVAL_WAIT_MS)
        expect(context.pages()).toHaveLength(pagesBefore)
        expect(
            context
                .pages()
                .some(candidate => candidate.url().includes('approval.html')),
        ).toBe(false)
    })

    // Last, because it closes the wallet tab the earlier tests drive. The
    // service worker makes no EVM RPC, so with only the dApp page open the
    // offscreen document's sync is the one caller left.
    test("the offscreen document's RPC reaches the fake node", async () => {
        for (const page of context.pages()) {
            if (page !== dappPage) {
                await page.close().catch(() => {})
            }
        }
        node.methods.length = 0

        await expect
            .poll(() => node.methods.length, {
                timeout: OFFSCREEN_POLL_INTERVAL_MS + OFFSCREEN_SLACK_MS,
            })
            .toBeGreaterThan(0)
    })
})
