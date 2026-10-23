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

// Discovery of the EIP-1193 provider in a real browser: the content script
// claims `window.ethereum` only when it is free, and announces Pera through
// EIP-6963 either way.
import { expect, test, chromium, type BrowserContext } from '@playwright/test'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

const PAGE = '<!doctype html><html><body>dapp</body></html>'

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

test('a page with no other wallet finds Pera at window.ethereum and in EIP-6963', async () => {
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
