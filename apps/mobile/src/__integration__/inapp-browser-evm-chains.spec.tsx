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

// An EVM dApp on a chain other than Ethereum, through the EIP-1193 handler the
// extension and the in-app browser share: after the page switches chain, the
// review, the simulation, the signature and the broadcast all stay on it.

import React, { useEffect, useRef } from 'react'
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import {
    isEvmChainId,
    type ChainId,
    type ChainScope,
    type EvmChainId,
} from '@perawallet/wallet-core-chain-contract'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'

// The integration harness has no i18next instance, so <Trans> renders nothing;
// echoing its values lets the spec read the fee's coin.
vi.mock('react-i18next', async importOriginal => ({
    ...(await importOriginal<typeof import('react-i18next')>()),
    Trans: ({
        i18nKey,
        values,
        components,
    }: {
        i18nKey?: string
        values?: object
        components?: React.ReactNode[]
    }) => (
        <>
            {i18nKey}
            {values ? JSON.stringify(values) : null}
            {components}
        </>
    ),
}))

const CHAINS = [
    { chainId: 'polygon', name: 'Polygon', symbol: 'POL', eip155: 137 },
    { chainId: 'base', name: 'Base', symbol: 'ETH', eip155: 8453 },
    {
        chainId: 'arbitrum',
        name: 'Arbitrum One',
        symbol: 'ETH',
        eip155: 42_161,
    },
    { chainId: 'optimism', name: 'Optimism', symbol: 'ETH', eip155: 10 },
    { chainId: 'bsc', name: 'BNB Chain', symbol: 'BNB', eip155: 56 },
    {
        chainId: 'avalanche',
        name: 'Avalanche C-Chain',
        symbol: 'AVAX',
        eip155: 43_114,
    },
] as const satisfies readonly {
    chainId: EvmChainId
    name: string
    symbol: string
    eip155: number
}[]

const rpcUrlOf = (chainId: ChainId) => `https://${chainId}.rpc.test/`

// The query client reads its deployments once, when the integration setup
// first loads it, so the backend this file mocks is reached only by modules
// loaded afresh below.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal, ['simulations'])
    return {
        ...withBackend,
        peraServicesFor: (scope: ChainScope) =>
            isEvmChainId(scope.chainId)
                ? new Set(['simulations'])
                : withBackend.peraServicesFor(scope),
        chainEndpointsFor: (chainId: ChainId) =>
            isEvmChainId(chainId)
                ? { mainnet: [rpcUrlOf(chainId)] }
                : withBackend.chainEndpointsFor(chainId),
        config: {
            ...withBackend.config,
            chains: {
                enabled: [
                    'algorand',
                    'ethereum',
                    ...CHAINS.map(({ chainId }) => chainId),
                ],
                capabilities: {},
            },
        },
    }
})

vi.resetModules()
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { usePreferences } = await import('@perawallet/wallet-core-settings')
const { useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { resetConnectionPairingStateForTesting } =
    await import('@perawallet/wallet-core-connections')
const { kmsCore } = await import('@perawallet/wallet-core-kms')
const { getProvider } = await import('@perawallet/wallet-extension-provider')
const {
    DEFAULT_EVM_RPC_RESPONSES,
    evmRpcHandlers,
    peraEvmHandlers,
    readRawEvmTransaction,
    simulationSuccessResponse,
} = await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { PERA_URL } =
    await import('@packages/chain-ethereum/src/__tests__/pera-backend')
const { SENDER, SIGNER_KEY_PAIR_ID } =
    await import('@packages/chain-ethereum/src/__tests__/testing')
const { signWithSenderOnChains } =
    await import('@packages/chain-ethereum/src/__tests__/dapp-chain-flow')
const { useSigningStore } = await import('@packages/signing/src/store')
const { __resetSigningActorRegistryForTests } =
    await import('@packages/signing/src/hooks/useSigningActorLifecycle')
const { setCapabilityOverrides } =
    await import('@test-utils/capability-overrides')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { resetTestKeystore } = await import('@test-utils/algorand-keystore-test')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { getAllPressables, isElementDisabled } = await import('@test-utils/rnw')
const { ConnectionsProvider } = await import('@modules/connections/shell')
const { SigningOverlays } = await import('@modules/signing/shell')
const { webViewDappTransport } = await import('@modules/webview')
const { eip1193ConnectionIdOf } = await import('@perawallet/wallet-core-dapp')

const ORIGIN = 'https://app.uniswap.org'
const ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
const SWAP_DATA = `0x7ff36ab5${'00'.repeat(32)}`
const ONE_COIN = '0xde0b6b3a7640000'
const TRANSACTION_SLIDE = 'signing-confirm-slide'

const ACCOUNT = {
    id: 'inapp-evm-chains',
    custody: {
        kind: 'local' as const,
        seed: 'bip39' as const,
        hd: { account: 0, keyIndex: 0 },
    },
    chains: Object.fromEntries(
        ['ethereum', ...CHAINS.map(({ chainId }) => chainId)].map(chainId => [
            chainId,
            { address: SENDER, keyPairId: SIGNER_KEY_PAIR_ID },
        ]),
    ),
    name: 'Ether',
}

const inject = vi.fn()
const page = { currentUrl: () => `${ORIGIN}/swap`, inject }

const ConnectionsWithSigning = () => {
    const { setPreference } = usePreferences()
    const acknowledged = useRef(false)
    useEffect(() => {
        if (acknowledged.current) return
        acknowledged.current = true
        setPreference('hasSeenTransactionRequestFAQ', true)
    }, [setPreference])

    return (
        <ConnectionsProvider>
            <SigningOverlays />
        </ConnectionsProvider>
    )
}

const findButton = (label: string) =>
    getAllPressables().find(button =>
        (button.textContent ?? '').includes(label),
    )

type Answer = {
    id: string
    result?: unknown
    error?: { code: number; message: string }
}

const answerOf = (id: string): Promise<Answer> =>
    waitFor(
        () => {
            const answer = inject.mock.calls
                .flatMap(([script]) => {
                    const match = /deliver\((\{.*\})\);/.exec(String(script))
                    return match ? [JSON.parse(match[1]) as Answer] : []
                })
                .find(candidate => candidate.id === id)
            if (!answer) throw new Error(`no answer for ${id}`)
            return answer
        },
        { timeout: 15_000 },
    )

const request = (
    id: string,
    method: string,
    params: unknown[] = [],
    hasUserActivation = true,
    icons?: string[],
) =>
    act(() => {
        webViewDappTransport.receive(
            page,
            {
                provider: 'eip1193',
                token: 'unused',
                hasUserActivation,
                request: { jsonrpc: '2.0', id, method, params },
                ...(icons ? { icons } : {}),
            },
            `${ORIGIN}/swap`,
        )
    })

const storedSite = () =>
    getProvider().connections.store.get(eip1193ConnectionIdOf(ORIGIN))

const pressWhenEnabled = async (label: string) => {
    await waitFor(
        () => {
            const button = findButton(label)
            expect(button && !isElementDisabled(button)).toBe(true)
        },
        { timeout: 15_000 },
    )
    fireEvent.click(findButton(label)!)
}

const simulationPaths: string[] = []
const broadcasts: { url: string; raw: `0x${string}` }[] = []
const recordSimulation = ({ request: sent }: { request: Request }) => {
    const { pathname } = new URL(sent.url)
    if (pathname.includes('/simulations/')) simulationPaths.push(pathname)
}

const nodeFor = (chainId: ChainId, eip155: number) =>
    evmRpcHandlers({
        rpcUrl: rpcUrlOf(chainId),
        responses: {
            eth_chainId: `0x${eip155.toString(16)}`,
            eth_sendRawTransaction: params => {
                broadcasts.push({
                    url: rpcUrlOf(chainId),
                    raw: params[0] as `0x${string}`,
                })
                const respond = DEFAULT_EVM_RPC_RESPONSES.eth_sendRawTransaction
                return typeof respond === 'function' ? respond(params) : respond
            },
        },
    })

describe('Flow: an EVM dApp on a chain other than Ethereum', () => {
    setSuiteUnhandledRequestMode('bypass')
    let detach: () => void

    beforeAll(async () => {
        await setupTestDatabase()
        server.events.on('request:start', recordSimulation)
    })
    afterAll(async () => {
        server.events.removeListener('request:start', recordSimulation)
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        __resetSigningActorRegistryForTests()
        useSigningStore.getState().resetState()
        resetTestKeystore()
        simulationPaths.length = 0
        broadcasts.length = 0
        useAccountsStore.getState().setAccounts([ACCOUNT])
        await getProvider().connections.store.clear()
        resetConnectionPairingStateForTesting()
        vi.clearAllMocks()
        for (const chainId of [
            'ethereum',
            ...CHAINS.map(chain => chain.chainId),
        ] as const) {
            setCapabilityOverrides(
                { dappConnect: true, contractDecoding: true },
                chainId,
            )
        }
        vi.spyOn(kmsCore, 'sign').mockImplementation(signWithSenderOnChains)
        server.use(
            http.get('*/v1/projects/', () => HttpResponse.json([])),
            ...nodeFor('ethereum', 1),
            ...CHAINS.flatMap(({ chainId, eip155 }) =>
                nodeFor(chainId, eip155),
            ),
            ...peraEvmHandlers({
                baseUrl: PERA_URL,
                simulation: simulationSuccessResponse([]),
            }),
        )
        detach = webViewDappTransport.attach(page)
        renderWithNavigation(ConnectionsWithSigning, 'ConnectionsWithSigning')
    })

    afterEach(async () => {
        detach()
        vi.restoreAllMocks()
        useSigningStore.getState().resetState()
        await getProvider().connections.store.clear()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    it.each(CHAINS)(
        'Given a site switched to $name, when it sends a transaction and the user confirms, then it is reviewed, simulated, signed and broadcast on $name',
        async ({ chainId, name, symbol, eip155 }) => {
            const hexChainId = `0x${eip155.toString(16)}`
            request('connect', 'eth_requestAccounts', [], true, [
                `${ORIGIN}/favicon.png`,
            ])
            await pressWhenEnabled('common.connect.label')
            expect((await answerOf('connect')).result).toEqual([SENDER])
            const connected = await storedSite()
            expect(connected?.metadata?.approvedChainIds).toContain(chainId)
            expect(connected?.peer.icons).toEqual([`${ORIGIN}/favicon.png`])

            request('switch', 'wallet_switchEthereumChain', [
                { chainId: hexChainId },
            ])
            expect((await answerOf('switch')).result).toBeNull()
            expect(
                findButton('walletconnect.switch_network.confirm'),
            ).toBeUndefined()

            request('chain', 'eth_chainId')
            expect((await answerOf('chain')).result).toBe(hexChainId)

            request('send', 'eth_sendTransaction', [
                { from: SENDER, to: ROUTER, value: ONE_COIN, data: SWAP_DATA },
            ])
            await waitFor(() => screen.getByTestId(TRANSACTION_SLIDE), {
                timeout: 15_000,
            })

            await waitFor(() =>
                expect(
                    screen.getAllByTestId('review_network')[0].textContent,
                ).toContain(name),
            )
            expect(
                screen.getAllByTestId('ethereum_review_fee')[0].textContent,
            ).toContain(`"symbol":"${symbol}"`)
            await waitFor(() =>
                expect(simulationPaths).toEqual([
                    `/api/v3/evm/${eip155}/simulations/`,
                ]),
            )

            await waitFor(() =>
                expect(
                    isElementDisabled(screen.getByTestId(TRANSACTION_SLIDE)),
                ).toBe(false),
            )
            fireEvent.click(screen.getByTestId(TRANSACTION_SLIDE))

            const answer = await answerOf('send')
            expect(broadcasts).toHaveLength(1)
            const [{ url, raw }] = broadcasts
            expect(url).toBe(rpcUrlOf(chainId))
            expect(readRawEvmTransaction(raw).chainId).toBe(eip155)
            expect(answer.result).toBeDefined()
        },
    )

    it('Given an account without Base at connect, when Base is added later, then the first switch asks once and later ones do not', async () => {
        const withoutBase = {
            ...ACCOUNT,
            chains: Object.fromEntries(
                Object.entries(ACCOUNT.chains).filter(([id]) => id !== 'base'),
            ),
        }
        useAccountsStore.getState().setAccounts([withoutBase])
        request('connect', 'eth_requestAccounts')
        await pressWhenEnabled('common.connect.label')
        expect((await answerOf('connect')).result).toEqual([SENDER])
        expect((await storedSite())?.metadata?.approvedChainIds).not.toContain(
            'base',
        )

        useAccountsStore.getState().setAccounts([ACCOUNT])
        request('switch-base', 'wallet_switchEthereumChain', [
            { chainId: '0x2105' },
        ])
        await pressWhenEnabled('walletconnect.switch_network.confirm')
        expect((await answerOf('switch-base')).result).toBeNull()

        request('switch-eth', 'wallet_switchEthereumChain', [{ chainId: '0x1' }])
        expect((await answerOf('switch-eth')).result).toBeNull()
        request('switch-back', 'wallet_switchEthereumChain', [
            { chainId: '0x2105' },
        ])
        expect((await answerOf('switch-back')).result).toBeNull()
        expect(
            findButton('walletconnect.switch_network.confirm'),
        ).toBeUndefined()
    })
})
