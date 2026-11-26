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

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
    useHeldListedTokensStore,
    useHiddenTokensStore,
    useKeptTokensStore,
} from '@perawallet/wallet-core-accounts'
import {
    toScopeKey,
    type ChainScope,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import {
    useDeviceStore,
    type DeviceAccountRegistration,
} from '@perawallet/wallet-core-device'
import { logger } from '@perawallet/wallet-core-shared'
import { BASE, POLYGON, ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import { followedTokensHandler } from '../api/msw-handlers'
import {
    FOLLOWED_TOKENS_SEND_DELAY_MS,
    followedTokenAccountsOf,
    startFollowedTokensSync,
} from '../followed-tokens'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const ADDRESS = '0x00000000000000000000000000000000000000aa'
const OTHER_ADDRESS = '0x00000000000000000000000000000000000000bb'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const USDC_CAIP19 = `eip155:1/erc20:${USDC.toLowerCase()}`
const DAI_CAIP19 = `eip155:1/erc20:${DAI.toLowerCase()}`
const MIRROR = '0x0000000000000000000000000000000000001010'
const ZERO = '0x0000000000000000000000000000000000000000'
const NFT = `${USDC}/7`

const MAINNET = evmScopeOf(ETHEREUM)

const registration = (
    address: string,
    chainId: DeviceAccountRegistration['chainId'] = 'ethereum',
): DeviceAccountRegistration => ({
    chainId,
    address,
    accountType: 'hdWallet',
    rank: 0,
    receiveNotifications: true,
})

const tokenSet = (
    scope: ChainScope,
    byAddress: Record<string, string[]>,
): Record<string, Record<string, string[]>> => ({
    [toScopeKey(scope)]: byAddress,
})

const build = (
    overrides: Partial<Parameters<typeof followedTokenAccountsOf>[0]>,
) =>
    followedTokenAccountsOf({
        registeredAccounts: [registration(ADDRESS)],
        deployment: 'live',
        keptTokens: {},
        heldListedTokens: {},
        hiddenTokens: {},
        ...overrides,
    })

const addressN = (n: number): string => `0x${n.toString(16).padStart(40, '0')}`

describe('followedTokenAccountsOf', () => {
    it('joins the kept and the held listed tokens as lowercase CAIP-19 ids', () => {
        const accounts = build({
            keptTokens: tokenSet(MAINNET, { [ADDRESS]: [USDC] }),
            heldListedTokens: tokenSet(MAINNET, { [ADDRESS]: [DAI, USDC] }),
        })

        expect(accounts).toEqual([
            {
                address: ADDRESS,
                chain: 'eip155:1',
                tokens: [USDC_CAIP19, DAI_CAIP19],
            },
        ])
    })

    it('names the testnet network on a developer deployment', () => {
        const testnet = evmScopeOf(ETHEREUM, 'testnet')

        const accounts = build({
            deployment: 'developer' satisfies WalletMode,
            keptTokens: tokenSet(testnet, { [ADDRESS]: [USDC] }),
        })

        expect(accounts).toHaveLength(1)
        expect(accounts[0]!.chain).toMatch(/^eip155:\d+$/)
        expect(accounts[0]!.chain).not.toBe('eip155:1')
        expect(accounts[0]!.tokens[0]).toMatch(
            new RegExp(`^${accounts[0]!.chain}/erc20:`),
        )
    })

    it('leaves out a token the user hid, kept or held alike', () => {
        const accounts = build({
            keptTokens: tokenSet(MAINNET, { [ADDRESS]: [USDC] }),
            heldListedTokens: tokenSet(MAINNET, { [ADDRESS]: [DAI] }),
            hiddenTokens: tokenSet(MAINNET, { [ADDRESS]: [DAI] }),
        })

        expect(accounts[0]!.tokens).toEqual([USDC_CAIP19])
    })

    it('hides a token for one address only', () => {
        const accounts = build({
            registeredAccounts: [
                registration(ADDRESS),
                registration(OTHER_ADDRESS),
            ],
            keptTokens: tokenSet(MAINNET, {
                [ADDRESS]: [USDC],
                [OTHER_ADDRESS]: [USDC],
            }),
            hiddenTokens: tokenSet(MAINNET, { [OTHER_ADDRESS]: [USDC] }),
        })

        expect(accounts.map(account => account.address)).toEqual([ADDRESS])
    })

    it('sends a held token whatever the token list says now', () => {
        const accounts = build({
            heldListedTokens: tokenSet(MAINNET, { [ADDRESS]: [DAI] }),
        })

        expect(accounts[0]!.tokens).toEqual([DAI_CAIP19])
    })

    it('leaves out an address the device did not register and a chain that is not EVM', () => {
        const accounts = build({
            registeredAccounts: [
                registration(ADDRESS),
                registration('ALGO_ADDR', 'algorand'),
            ],
            keptTokens: tokenSet(MAINNET, {
                [ADDRESS]: [USDC],
                [OTHER_ADDRESS]: [DAI],
                ALGO_ADDR: ['31566704'],
            }),
        })

        expect(accounts.map(account => account.address)).toEqual([ADDRESS])
    })

    it('drops NFTs, the native id, the zero address and the native coin mirror', () => {
        const polygon = evmScopeOf(POLYGON)

        const accounts = build({
            registeredAccounts: [registration(ADDRESS, 'polygon')],
            keptTokens: tokenSet(polygon, {
                [ADDRESS]: [NFT, 'native', ZERO, MIRROR, USDC],
            }),
        })

        expect(accounts[0]!.tokens).toEqual([
            `eip155:137/erc20:${USDC.toLowerCase()}`,
        ])
    })

    it('sends an address registered twice once', () => {
        const accounts = build({
            registeredAccounts: [
                registration(ADDRESS),
                registration(ADDRESS.toUpperCase().replace('0X', '0x')),
            ],
            keptTokens: tokenSet(MAINNET, { [ADDRESS]: [USDC] }),
        })

        expect(accounts).toHaveLength(1)
    })

    it('leaves out an account with nothing to follow', () => {
        expect(build({})).toEqual([])
    })

    it('keeps the same address on two chains apart', () => {
        const accounts = build({
            registeredAccounts: [
                registration(ADDRESS),
                registration(ADDRESS, 'base'),
            ],
            keptTokens: {
                ...tokenSet(MAINNET, { [ADDRESS]: [USDC] }),
                ...tokenSet(evmScopeOf(BASE), { [ADDRESS]: [DAI] }),
            },
        })

        expect(accounts.map(account => account.chain)).toEqual([
            'eip155:1',
            'eip155:8453',
        ])
    })

    describe('the backend caps', () => {
        let warn: MockInstance

        beforeEach(() => {
            warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        })

        afterEach(() => {
            warn.mockRestore()
        })

        const manyTokens = (count: number, offset = 0): string[] =>
            Array.from({ length: count }, (_, i) => addressN(offset + i + 1))

        it('sends 1,000 tokens per address at most', () => {
            const accounts = build({
                keptTokens: tokenSet(MAINNET, {
                    [ADDRESS]: manyTokens(1_200),
                }),
            })

            expect(accounts[0]!.tokens).toHaveLength(1_000)
            expect(warn).toHaveBeenCalledWith(expect.any(String), {
                droppedAddresses: 0,
                droppedTokens: 200,
            })
        })

        it('logs nothing while every cap holds', () => {
            build({ keptTokens: tokenSet(MAINNET, { [ADDRESS]: [USDC] }) })

            expect(warn).not.toHaveBeenCalled()
        })

        it('sends 500 addresses per chain at most', () => {
            const addresses = Array.from({ length: 600 }, (_, i) =>
                addressN(10_000 + i),
            )

            const accounts = build({
                registeredAccounts: addresses.map(a => registration(a)),
                keptTokens: tokenSet(
                    MAINNET,
                    Object.fromEntries(addresses.map(a => [a, [USDC]])),
                ),
            })

            expect(accounts).toHaveLength(500)
            expect(warn).toHaveBeenCalledWith(expect.any(String), {
                droppedAddresses: 100,
                droppedTokens: 100,
            })
            expect(JSON.stringify(warn.mock.calls)).not.toContain(addresses[0])
        })

        it('sends 5,000 tokens per request at most, trimming the account that crosses it', () => {
            const addresses = Array.from({ length: 6 }, (_, i) =>
                addressN(20_000 + i),
            )
            const sizes = [1_000, 1_000, 1_000, 1_000, 800, 1_000]

            const accounts = build({
                registeredAccounts: addresses.map(a => registration(a)),
                keptTokens: tokenSet(
                    MAINNET,
                    Object.fromEntries(
                        addresses.map((a, i) => [
                            a,
                            manyTokens(sizes[i]!, i * 2_000),
                        ]),
                    ),
                ),
            })

            expect(accounts.map(a => a.tokens.length)).toEqual([
                1_000, 1_000, 1_000, 1_000, 800, 200,
            ])
            expect(warn).toHaveBeenCalledWith(expect.any(String), {
                droppedAddresses: 0,
                droppedTokens: 800,
            })
        })
    })
})

type Put = { deviceId: string; body: { accounts: unknown[] } }

const server = setupServer()

describe('startFollowedTokensSync', () => {
    let stop: () => void
    let puts: Put[]
    let warn: MockInstance

    const record = () =>
        followedTokensHandler({
            onRequest: (deviceId, body) =>
                puts.push({ deviceId, body: body as Put['body'] }),
        })

    const register = (
        accounts: DeviceAccountRegistration[] = [registration(ADDRESS)],
    ) => useDeviceStore.getState().setRegisteredAccounts('live', accounts)

    const keep = (...assetIds: string[]) =>
        useKeptTokensStore
            .getState()
            .keepTokens({ address: ADDRESS, scope: MAINNET, assetIds })

    const afterTheDelay = async (): Promise<void> => {
        await vi.advanceTimersByTimeAsync(FOLLOWED_TOKENS_SEND_DELAY_MS)
    }

    beforeEach(() => {
        server.listen({ onUnhandledRequest: 'error' })
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        puts = []
        warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        useNetworkStore.setState({ mode: 'live' })
        useDeviceStore.getState().resetState()
        useKeptTokensStore.getState().resetState()
        useHeldListedTokensStore.getState().resetState()
        useHiddenTokensStore.getState().resetState()
        useDeviceStore.getState().setDeviceID('live', 'DEV-1')
        server.use(record())
        stop = startFollowedTokensSync()
    })

    afterEach(() => {
        stop()
        vi.useRealTimers()
        server.resetHandlers()
        server.close()
        vi.restoreAllMocks()
    })

    it('is idempotent', () => {
        expect(startFollowedTokensSync()).toBe(stop)
    })

    it('sends nothing before a registration has landed', async () => {
        keep(USDC)

        await afterTheDelay()

        expect(puts).toEqual([])
    })

    it('sends the set once a registration lands, to the device it registered as', async () => {
        keep(USDC)
        register()

        await afterTheDelay()

        await vi.waitFor(() => expect(puts).toHaveLength(1))
        expect(puts[0]).toEqual({
            deviceId: 'DEV-1',
            body: {
                accounts: [
                    {
                        address: ADDRESS,
                        chain: 'eip155:1',
                        tokens: [USDC_CAIP19],
                    },
                ],
            },
        })
    })

    it('sends a held listed token that appears with a balance', async () => {
        register()
        await afterTheDelay()
        await vi.waitFor(() => expect(puts).toHaveLength(1))
        expect(puts[0]!.body.accounts).toEqual([])

        useHeldListedTokensStore.getState().addHeldListedTokens({
            address: ADDRESS,
            scope: MAINNET,
            assetIds: [DAI],
        })
        await afterTheDelay()

        await vi.waitFor(() => expect(puts).toHaveLength(2))
        expect(puts[1]!.body.accounts).toEqual([
            { address: ADDRESS, chain: 'eip155:1', tokens: [DAI_CAIP19] },
        ])
    })

    it('sends one request for a burst of changes', async () => {
        register()
        keep(USDC)
        keep(DAI)
        useHeldListedTokensStore.getState().addHeldListedTokens({
            address: ADDRESS,
            scope: MAINNET,
            assetIds: [DAI],
        })

        await afterTheDelay()

        await vi.waitFor(() => expect(puts).toHaveLength(1))
        expect(puts[0]!.body.accounts).toEqual([
            {
                address: ADDRESS,
                chain: 'eip155:1',
                tokens: expect.arrayContaining([USDC_CAIP19, DAI_CAIP19]),
            },
        ])
    })

    it('sends nothing for a wallet with no registered EVM address', async () => {
        register([registration('ALGO_ADDR', 'algorand')])

        await afterTheDelay()

        expect(puts).toEqual([])
    })

    it('sends an empty set for a registered EVM address with nothing to follow', async () => {
        register()

        await afterTheDelay()

        await vi.waitFor(() => expect(puts).toHaveLength(1))
        expect(puts[0]!.body).toEqual({ accounts: [] })
    })

    it('sends an empty set once the last followed token is un-kept, so the backend drops it', async () => {
        keep(USDC)
        register()
        await afterTheDelay()
        await vi.waitFor(() => expect(puts).toHaveLength(1))
        expect(puts[0]!.body.accounts[0]!.tokens).toEqual([USDC_CAIP19])

        useKeptTokensStore.getState().setTokenKept({
            address: ADDRESS,
            scope: MAINNET,
            assetId: USDC,
            isKept: false,
        })
        await afterTheDelay()

        await vi.waitFor(() => expect(puts).toHaveLength(2))
        expect(puts[1]!.body).toEqual({ accounts: [] })
    })

    it('waits for a request in flight, then sends the latest set', async () => {
        let release: () => void = () => undefined
        const gate = new Promise<void>(resolve => {
            release = resolve
        })
        server.use(
            http.put(
                '*/api/v3/evm/devices/:deviceId/followed-tokens/',
                async ({ request }) => {
                    const body = (await request.json()) as Put['body']
                    puts.push({ deviceId: 'DEV-1', body })
                    if (puts.length === 1) await gate
                    return HttpResponse.json(body)
                },
            ),
        )
        register()
        keep(USDC)
        await afterTheDelay()
        await vi.waitFor(() => expect(puts).toHaveLength(1))

        keep(DAI)
        await afterTheDelay()
        await vi.advanceTimersByTimeAsync(50)

        expect(puts).toHaveLength(1)

        release()

        await vi.waitFor(() => expect(puts).toHaveLength(2))
        expect(puts[1]!.body.accounts).toEqual([
            {
                address: ADDRESS,
                chain: 'eip155:1',
                tokens: expect.arrayContaining([USDC_CAIP19, DAI_CAIP19]),
            },
        ])
    })

    it('drops a token from the set when the user hides it, and sends it again once unhidden', async () => {
        keep(USDC, DAI)
        register()
        await afterTheDelay()
        await vi.waitFor(() => expect(puts).toHaveLength(1))
        expect(puts[0]!.body.accounts[0]!.tokens).toEqual(
            expect.arrayContaining([USDC_CAIP19, DAI_CAIP19]),
        )

        useHiddenTokensStore.getState().setTokenHidden({
            address: ADDRESS,
            scope: MAINNET,
            assetId: DAI,
            isHidden: true,
        })
        await afterTheDelay()

        await vi.waitFor(() => expect(puts).toHaveLength(2))
        expect(puts[1]!.body.accounts[0]!.tokens).toEqual([USDC_CAIP19])

        useHiddenTokensStore.getState().setTokenHidden({
            address: ADDRESS,
            scope: MAINNET,
            assetId: DAI,
            isHidden: false,
        })
        await afterTheDelay()

        await vi.waitFor(() => expect(puts).toHaveLength(3))
        expect(puts[2]!.body.accounts[0]!.tokens).toEqual(
            expect.arrayContaining([USDC_CAIP19, DAI_CAIP19]),
        )
    })

    it('follows the deployment the app is on', async () => {
        useDeviceStore.getState().setDeviceID('developer', 'DEV-TEST')
        useNetworkStore.setState({ mode: 'developer' })
        useKeptTokensStore.getState().keepTokens({
            address: ADDRESS,
            scope: evmScopeOf(ETHEREUM, 'testnet'),
            assetIds: [USDC],
        })
        useDeviceStore
            .getState()
            .setRegisteredAccounts('developer', [registration(ADDRESS)])

        await afterTheDelay()

        await vi.waitFor(() => expect(puts).toHaveLength(1))
        expect(puts[0]!.deviceId).toBe('DEV-TEST')
    })

    it.each([
        [
            'the route’s 422',
            422,
            { error: 'unknown_chain', code: 'unknown_chain' },
        ],
        ['the framework’s 422', 422, { status: 422, error: 'Unprocessable' }],
        ['an unknown device', 404, { error: 'not found' }],
    ])(
        'logs %s, keeps running, and sends again on the next change',
        async (_name, status, body) => {
            let attempts = 0
            server.use(
                http.put(
                    '*/api/v3/evm/devices/:deviceId/followed-tokens/',
                    async ({ request }) => {
                        attempts += 1
                        const sent = (await request.json()) as Put['body']
                        if (attempts === 1) {
                            return HttpResponse.json(body, { status })
                        }
                        puts.push({ deviceId: 'DEV-1', body: sent })
                        return HttpResponse.json(sent)
                    },
                ),
            )
            register()
            keep(USDC)

            await afterTheDelay()
            await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1))
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining('Followed tokens not sent'),
                expect.anything(),
            )

            keep(DAI)
            await afterTheDelay()

            await vi.waitFor(() => expect(puts).toHaveLength(1))
            expect(puts[0]!.body.accounts[0]).toMatchObject({
                tokens: expect.arrayContaining([USDC_CAIP19, DAI_CAIP19]),
            })
        },
    )
})
