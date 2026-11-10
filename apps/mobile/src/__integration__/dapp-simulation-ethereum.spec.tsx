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
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type {
    AssetItemResponse,
    EvmSimulationResponse,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import type { FakeWalletKit } from '@test-utils/walletkit-stub'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'

// The query client reads its deployments once, when the integration setup
// first loads it, so the backend this file mocks is reached only by modules
// loaded afresh below.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal, ['contracts', 'simulations'])
    return {
        ...withBackend,
        // The chain adapters read this, not `hasPeraService`: without it a
        // token's record and price come from the chain alone, and no price.
        peraServicesFor: (scope: ChainScope) =>
            scope.chainId === 'ethereum'
                ? new Set(['assets', 'prices', 'simulations'])
                : withBackend.peraServicesFor(scope),
        chainEndpointsFor: (chainId: ChainId) =>
            chainId === 'ethereum'
                ? { mainnet: ['https://mainnet.rpc.test/'] }
                : withBackend.chainEndpointsFor(chainId),
        config: {
            ...withBackend.config,
            reownProjectId: 'integration-project-id',
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

vi.resetModules()
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { nativeAssetFor, upsertAssets } =
    await import('@perawallet/wallet-core-assets')
const { useContactsStore } = await import('@perawallet/wallet-core-contacts')
const { usePreferences } = await import('@perawallet/wallet-core-settings')
const { useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { useConnectionRegistry, resetConnectionPairingStateForTesting } =
    await import('@perawallet/wallet-core-connections')
const { getProvider } = await import('@perawallet/wallet-extension-provider')
const {
    erc20CallResponder,
    EvmRpcErrorFixture,
    evmRpcHandlers,
    peraEvmHandlers,
    simulationRevertedResponse,
    simulationSuccessResponse,
    simulationUnavailableResponse,
} = await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { PERA_URL } =
    await import('@packages/chain-ethereum/src/__tests__/pera-backend')
const { SENDER, SIGNER_KEY_PAIR_ID } =
    await import('@packages/chain-ethereum/src/__tests__/testing')
const { makeProposal, makeRequest, TOPIC, V2_URI } =
    await import('@packages/walletconnect/src/v2/__tests__/fakeWalletKit')
const { useSigningStore } = await import('@packages/signing/src/store')
const { __resetSigningActorRegistryForTests } =
    await import('@packages/signing/src/hooks/useSigningActorLifecycle')
const { walletKitStub } = await import('@test-utils/walletkit-stub')
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

const ETH_MAINNET = 'eip155:1'
const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const ACCOUNT_NAME = 'Ether'
// Uniswap V2's router: not in the well-known registry, so its swap has no name.
const ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
// 0.001 ETH
const ONE_MILLI_ETH = '0x38d7ea4c68000'
const SWAP_DATA = `0x7ff36ab5${'00'.repeat(32)}`
// approve(Permit2, max uint256)
const APPROVE_MAX_DATA = `0x095ea7b3${'00'.repeat(12)}000000000022d473030f116ddee9f6b43ac78ba3${'ff'.repeat(32)}`
// deposit()
const WRAP_DATA = '0xd0e30db0'
const V3_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
const ADD_LIQUIDITY_VALUE = '0x98cb8c528000'
// multicall([mint(USDC/WETH 0.05%, 353961 USDC, 0.000168 ETH, to the signer), refundETH()])
const ADD_LIQUIDITY_DATA =
    '0xac9650d800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000000000000000000000000000000000000000016488316456000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000001f4fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff2761a00000000000000000000000000000000000000000000000000000000000d89e600000000000000000000000000000000000000000000000000000000000566a9000000000000000000000000000000000000000000000000000098cb8c52800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266000000000000000000000000000000000000000000000000000000006b49d20000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000412210e8a00000000000000000000000000000000000000000000000000000000'

const TRANSACTION_SLIDE = 'signing-confirm-slide'
const CHANGES = 'ethereum_simulation_changes'
const UNAVAILABLE = 'ethereum_simulation_unavailable'
const FAILURE_WARNING = 'predicted_failure_warning'
const FAILURE_ACKNOWLEDGE = 'review_warnings_acknowledge'
const UNCHECKED_NOTICE = 'ethereum_contract_call_warning'

const ETHEREUM_ACCOUNT = {
    id: 'eth-simulation',
    custody: {
        kind: 'local' as const,
        seed: 'bip39' as const,
        hd: { account: 0, keyIndex: 0 },
    },
    chains: { ethereum: { address: SENDER, keyPairId: SIGNER_KEY_PAIR_ID } },
    name: ACCOUNT_NAME,
}

const assetItem = (
    overrides: Partial<AssetItemResponse> & { asset_id: string },
): AssetItemResponse => ({
    type: 'erc20',
    name: null,
    unit_name: null,
    fraction_decimals: null,
    logo: null,
    usd_value: null,
    last_24_hours_usd_price_change_percentage: null,
    is_verified: true,
    verification_tier: 'verified',
    explorer_url: null,
    ...overrides,
})

// What the backend knows of the tokens a swap touches, priced in USD.
const ASSETS: Record<string, AssetItemResponse> = {
    'eip155:1/slip44:60': assetItem({
        asset_id: 'eip155:1/slip44:60',
        type: 'native',
        name: 'Ether',
        unit_name: 'ETH',
        fraction_decimals: 18,
        usd_value: '2040.000000000000000000000000',
    }),
    [`eip155:1/erc20:${USDC.toLowerCase()}`]: assetItem({
        asset_id: `eip155:1/erc20:${USDC.toLowerCase()}`,
        name: 'USD Coin',
        unit_name: 'USDC',
        fraction_decimals: 6,
        usd_value: '1.000000000000000000000000',
    }),
}

const SWAP_SIMULATION = simulationSuccessResponse([
    {
        asset_id: 'eip155:1/slip44:60',
        standard: 'native',
        token_id: null,
        amount: '-1000000000000000',
    },
    {
        asset_id: `eip155:1/erc20:${USDC.toLowerCase()}`,
        standard: 'erc20',
        token_id: null,
        amount: '2282960',
    },
])

const captured: {
    registry?: ReturnType<typeof useConnectionRegistry>
} = {}

const RegistryProbe = () => {
    captured.registry = useConnectionRegistry()
    return null
}

// The once-per-device request FAQ is pre-acknowledged so it cannot open a
// competing sheet.
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
            <RegistryProbe />
            <SigningOverlays />
        </ConnectionsProvider>
    )
}

const findButton = (label: string) =>
    getAllPressables().find(button =>
        (button.textContent ?? '').includes(label),
    )

const connectEthereum = async (): Promise<FakeWalletKit> => {
    renderWithNavigation(ConnectionsWithSigning, 'ConnectionsWithSigning')
    await waitFor(() => expect(captured.registry).toBeTruthy())
    await act(async () => {
        await captured.registry!.pair(V2_URI, {
            origin: { source: 'in-app' },
        })
    })
    const walletKit = await waitFor(
        () => {
            const client = walletKitStub.last()
            if (!client) throw new Error('WalletKit was never initialised')
            return client
        },
        { timeout: 15_000 },
    )
    act(() => {
        walletKit.emit(
            'session_proposal',
            makeProposal({
                requiredNamespaces: {
                    eip155: {
                        chains: [ETH_MAINNET],
                        methods: ['eth_sendTransaction'],
                        events: [],
                    },
                },
            }),
        )
    })
    const row = `wc_account_row_${ETHEREUM_ACCOUNT.id}`
    await waitFor(() => expect(screen.getByTestId(row)).toBeTruthy(), {
        timeout: 5000,
    })
    fireEvent.click(screen.getByTestId(row))
    await waitFor(() =>
        expect(isElementDisabled(findButton('common.connect.label')!)).toBe(
            false,
        ),
    )
    fireEvent.click(findButton('common.connect.label')!)
    await waitFor(async () => {
        expect(await getProvider().connections.store.get(TOPIC)).toBeTruthy()
    })
    return walletKit
}

const simulationPathsRequested: string[] = []
const recordRequest = ({ request }: { request: Request }) => {
    const { pathname } = new URL(request.url)
    if (pathname.includes('/simulations/')) {
        simulationPathsRequested.push(pathname)
    }
}

const review = async (
    to: string,
    data: string,
    simulation?: EvmSimulationResponse | number,
    value = '0x0',
    estimateGas?: InstanceType<typeof EvmRpcErrorFixture>,
) => {
    server.use(
        ...evmRpcHandlers({
            responses: {
                ...(estimateGas && { eth_estimateGas: estimateGas }),
                eth_call: erc20CallResponder({
                    [USDC]: {
                        name: 'USD Coin',
                        symbol: 'USDC',
                        decimals: 6,
                        totalSupply: 0n,
                    },
                }),
            },
        }),
        ...peraEvmHandlers({ baseUrl: PERA_URL, assets: ASSETS, simulation }),
    )
    const walletKit = await connectEthereum()
    act(() => {
        walletKit.emit(
            'session_request',
            makeRequest({
                id: 7,
                method: 'eth_sendTransaction',
                params: [{ from: SENDER, to, value, data }],
                chainId: ETH_MAINNET,
            }),
        )
    })
    await waitFor(() => screen.getByTestId(TRANSACTION_SLIDE), {
        timeout: 15_000,
    })
}

const expectSlideEnabled = () =>
    waitFor(() =>
        expect(isElementDisabled(screen.getByTestId(TRANSACTION_SLIDE))).toBe(
            false,
        ),
    )

describe('Flow: a dApp asks to sign a call whose outcome the backend predicts', () => {
    setSuiteUnhandledRequestMode('bypass')

    beforeAll(async () => {
        await setupTestDatabase()
        server.events.on('request:start', recordRequest)
    })
    afterAll(async () => {
        server.events.removeListener('request:start', recordRequest)
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        __resetSigningActorRegistryForTests()
        resetTestKeystore()
        walletKitStub.reset()
        captured.registry = undefined
        simulationPathsRequested.length = 0
        await getProvider().connections.store.clear()
        resetConnectionPairingStateForTesting()
        useAccountsStore.getState().setAccounts([ETHEREUM_ACCOUNT])
        // The user holds ETH, so its record is stored; the swap's USDC is not.
        await upsertAssets({
            items: [nativeAssetFor('ethereum')],
            scope: ETH_SCOPE,
        })
        useContactsStore.setState({ contacts: [] })
        setCapabilityOverrides(
            { dappConnect: true, contractDecoding: true },
            'ethereum',
        )
        // The review sheet looks the peer up in the projects API.
        server.use(http.get('*/v1/projects/', () => HttpResponse.json([])))
    })

    afterEach(async () => {
        useSigningStore.getState().resetState()
        await getProvider().connections.store.clear()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    it('Given a swap, when it is reviewed, then the estimated change leaves and arrives with their fiat value, above the signing account, and the user can still confirm', async () => {
        await review(ROUTER, SWAP_DATA, SWAP_SIMULATION, ONE_MILLI_ETH)

        const changes = await waitFor(() => screen.getByTestId(CHANGES), {
            timeout: 15_000,
        })
        await waitFor(() => expect(changes.textContent).toContain('USDC'))
        expect(changes.textContent).toContain('ethereum.simulation.title')
        expect(changes.textContent).toContain(
            'signing.balance_impact.spend_title',
        )
        expect(changes.textContent).toContain(
            'signing.balance_impact.receive_title',
        )
        expect(changes.textContent).toContain('ETH')
        expect(changes.textContent).toContain('2.28296')
        // 0.001 ETH at $2,040 and 2.28296 USDC at $1.
        expect(changes.textContent).toContain('-0.001 ETH$ 2.04')
        expect(changes.textContent).toContain('+2.28296 USDC$ 2.28')
        expect(changes.textContent).toContain(
            'ethereum.simulation.estimate_note',
        )
        const signingWith = screen.getByText(
            'signing.transactions.signing_with',
        )
        expect(
            changes.compareDocumentPosition(signingWith) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
        expect(screen.queryByTestId(UNAVAILABLE)).toBeNull()
        expect(screen.queryByTestId(FAILURE_WARNING)).toBeNull()
        await expectSlideEnabled()
    })

    it("Given a Uniswap V3 liquidity add whose simulation spends USDC and ETH and mints an NFT Pera has no record of, when it is reviewed, then both tokens are spent and the position is received under the contract's name and token id", async () => {
        const simulation = simulationSuccessResponse([
            {
                asset_id: 'eip155:1/slip44:60',
                standard: 'native',
                token_id: null,
                amount: '-168000000000000',
            },
            {
                asset_id: `eip155:1/erc20:${USDC.toLowerCase()}`,
                standard: 'erc20',
                token_id: null,
                amount: '-353961',
            },
            {
                asset_id: `eip155:1/erc721:${V3_POSITION_MANAGER.toLowerCase()}`,
                standard: 'erc721',
                token_id: '987654',
                amount: '1',
            },
        ])

        await review(
            V3_POSITION_MANAGER,
            ADD_LIQUIDITY_DATA,
            simulation,
            ADD_LIQUIDITY_VALUE,
        )

        const changes = await waitFor(() => screen.getByTestId(CHANGES), {
            timeout: 15_000,
        })
        await waitFor(() => expect(changes.textContent).toContain('USDC'))
        expect(changes.textContent).toContain(
            'signing.balance_impact.spend_title',
        )
        expect(changes.textContent).toContain(
            'signing.balance_impact.receive_title',
        )
        expect(changes.textContent).toContain('-0.353961 USDC')
        expect(changes.textContent).toContain('-0.000168 ETH')
        expect(changes.textContent).toContain('Uniswap V3 Positions')
        expect(changes.textContent).toContain('#987654')
        expect(screen.queryByTestId(UNAVAILABLE)).toBeNull()
        await expectSlideEnabled()
    })

    it('Given a call Pera cannot decode that grants an unlimited approval to a known spender, when it is reviewed, then the change names the spender and reads as information', async () => {
        const simulation = simulationSuccessResponse(
            [],
            [
                {
                    contract: USDC.toLowerCase(),
                    spender: PERMIT2.toLowerCase(),
                    token_id: null,
                    collection_wide: false,
                    allowance: 'unlimited',
                },
            ],
        )

        await review(ROUTER, SWAP_DATA, simulation)

        const approval = await waitFor(
            () => screen.getByTestId('ethereum_simulation_approval'),
            { timeout: 15_000 },
        )
        expect(
            screen.getByTestId('ethereum_simulation_approval_spender')
                .textContent,
        ).toContain('Permit2')
        expect(approval.textContent).toContain(
            'signing.spend_approval.unlimited',
        )
        // A registry spender reads as information, as the decoded review does.
        expect(
            screen.getByTestId('ethereum_simulation_approval_note').textContent,
        ).toBe('signing.spend_approval.known_unlimited_note')
        expect(
            screen.queryByTestId('ethereum_simulation_approval_warning'),
        ).toBeNull()
        // The token is named by its contract, not only by its unit.
        expect(
            screen.getByTestId('ethereum_simulation_approval_asset')
                .textContent,
        ).toContain(USDC.slice(0, 6))
    })

    it('Given an approve Pera decodes, when it is reviewed, then the approval shows once, in the call review, and not again as an estimated change', async () => {
        const simulation = simulationSuccessResponse(
            [],
            [
                {
                    contract: USDC.toLowerCase(),
                    spender: PERMIT2.toLowerCase(),
                    token_id: null,
                    collection_wide: false,
                    allowance: 'unlimited',
                },
            ],
        )

        await review(USDC, APPROVE_MAX_DATA, simulation)

        await waitFor(() => expect(simulationPathsRequested).toHaveLength(1))
        await waitFor(() =>
            expect(
                screen.queryByTestId('ethereum_simulation_loading'),
            ).toBeNull(),
        )
        expect(
            screen.getByTestId('message-signing-spend-approval-spender'),
        ).toBeTruthy()
        expect(screen.queryByTestId('ethereum_simulation_approval')).toBeNull()
        expect(screen.queryByTestId(CHANGES)).toBeNull()
        expect(screen.queryByTestId(UNAVAILABLE)).toBeNull()
        await expectSlideEnabled()
    })

    it('Given a call whose gas estimate reverts, when the dApp sends it, then it reaches review with the predicted failure and Confirm waits on an acknowledgement', async () => {
        await review(
            ROUTER,
            SWAP_DATA,
            simulationRevertedResponse('UniswapV2Router: EXPIRED'),
            ONE_MILLI_ETH,
            new EvmRpcErrorFixture(
                3,
                'execution reverted: UniswapV2Router: EXPIRED',
            ),
        )

        await waitFor(() => screen.getByTestId(FAILURE_WARNING), {
            timeout: 15_000,
        })
        await waitFor(() =>
            expect(
                isElementDisabled(screen.getByTestId(TRANSACTION_SLIDE)),
            ).toBe(true),
        )

        fireEvent.click(screen.getByTestId(FAILURE_ACKNOWLEDGE))

        await expectSlideEnabled()
    })

    it("Given a call whose gas estimate reverts and a simulation endpoint that fails, when it is reviewed, then the node's refusal still gates Confirm", async () => {
        await review(
            ROUTER,
            SWAP_DATA,
            500,
            ONE_MILLI_ETH,
            new EvmRpcErrorFixture(
                3,
                'execution reverted: UniswapV2Router: EXPIRED',
            ),
        )

        await waitFor(() => screen.getByTestId(FAILURE_WARNING), {
            timeout: 15_000,
        })
        expect(screen.queryByTestId(UNAVAILABLE)).toBeNull()
        // The node already said it reverts, so the backend is never asked.
        expect(simulationPathsRequested).toEqual([])
        await waitFor(() =>
            expect(
                isElementDisabled(screen.getByTestId(TRANSACTION_SLIDE)),
            ).toBe(true),
        )

        fireEvent.click(screen.getByTestId(FAILURE_ACKNOWLEDGE))

        await expectSlideEnabled()
    })

    it('Given an empty-data send to a contract that rejects it, when it is reviewed, then the predicted failure gates Confirm although a plain send is never simulated', async () => {
        await review(
            ROUTER,
            '0x',
            SWAP_SIMULATION,
            ONE_MILLI_ETH,
            new EvmRpcErrorFixture(3, 'execution reverted'),
        )

        await waitFor(() => screen.getByTestId(FAILURE_WARNING), {
            timeout: 15_000,
        })
        expect(simulationPathsRequested).toEqual([])
        await waitFor(() =>
            expect(
                isElementDisabled(screen.getByTestId(TRANSACTION_SLIDE)),
            ).toBe(true),
        )

        fireEvent.click(screen.getByTestId(FAILURE_ACKNOWLEDGE))

        await expectSlideEnabled()
    })

    it('Given a call that reverts in simulation, when it is reviewed, then Confirm waits on an acknowledgement of the predicted failure', async () => {
        await review(
            ROUTER,
            SWAP_DATA,
            simulationRevertedResponse('UniswapV2Router: EXPIRED'),
            ONE_MILLI_ETH,
        )

        await waitFor(() => screen.getByTestId(FAILURE_WARNING), {
            timeout: 15_000,
        })
        expect(screen.queryByTestId(CHANGES)).toBeNull()
        await waitFor(() =>
            expect(
                isElementDisabled(screen.getByTestId(TRANSACTION_SLIDE)),
            ).toBe(true),
        )

        fireEvent.click(screen.getByTestId(FAILURE_ACKNOWLEDGE))

        await expectSlideEnabled()
    })

    it("Given a call Pera can name and a backend that can't simulate it, when it is reviewed, then it says it couldn't simulate and the user can still confirm", async () => {
        await review(WETH, WRAP_DATA, 503, ONE_MILLI_ETH)

        await waitFor(() => screen.getByTestId(UNAVAILABLE), {
            timeout: 15_000,
        })
        expect(screen.queryByTestId(CHANGES)).toBeNull()
        expect(screen.queryByTestId(UNCHECKED_NOTICE)).toBeNull()
        await expectSlideEnabled()
    })

    it("Given a call Pera can't name and a simulation that is unavailable, when it is reviewed, then only the unchecked-call notice shows", async () => {
        await review(
            ROUTER,
            SWAP_DATA,
            simulationUnavailableResponse('timeout'),
            ONE_MILLI_ETH,
        )

        await waitFor(() => expect(simulationPathsRequested).toHaveLength(1))
        await waitFor(() =>
            expect(
                screen.queryByTestId('ethereum_simulation_loading'),
            ).toBeNull(),
        )
        expect(screen.getByTestId(UNCHECKED_NOTICE)).toBeTruthy()
        expect(screen.queryByTestId(UNAVAILABLE)).toBeNull()
        expect(screen.queryByTestId(CHANGES)).toBeNull()
        await expectSlideEnabled()
    })

    it('Given contractDecoding is off, when a swap is reviewed, then nothing is simulated and the review is unchanged', async () => {
        setCapabilityOverrides(
            { dappConnect: true, contractDecoding: false },
            'ethereum',
        )

        await review(ROUTER, SWAP_DATA, SWAP_SIMULATION, ONE_MILLI_ETH)

        // A request would follow the first render within a tick or two.
        await new Promise(resolve => setTimeout(resolve, 300))
        expect(screen.getByTestId(UNCHECKED_NOTICE)).toBeTruthy()
        expect(screen.queryByTestId(CHANGES)).toBeNull()
        expect(screen.queryByTestId(UNAVAILABLE)).toBeNull()
        expect(simulationPathsRequested).toEqual([])
    })
})
