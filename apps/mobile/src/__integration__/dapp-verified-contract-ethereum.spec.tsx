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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type {
    EvmContractAbiResponse,
    PeraEvmContractFixtures,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import type { FakeWalletKit } from '@test-utils/walletkit-stub'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'

// The query client reads its deployments once, when the integration setup
// first loads it, so the backend this file mocks is reached only by modules
// loaded afresh below.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal, ['contracts'])
    return {
        ...withBackend,
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
const { useContactsStore } = await import('@perawallet/wallet-core-contacts')
const { usePreferences } = await import('@perawallet/wallet-core-settings')
const { useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { useConnectionRegistry, resetConnectionPairingStateForTesting } =
    await import('@perawallet/wallet-core-connections')
const { getProvider } = await import('@perawallet/wallet-extension-provider')
const {
    contractMetadataResponse,
    evmRpcHandlers,
    peraEvmHandlers,
    verifiedAbiResponse,
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
const ACCOUNT_NAME = 'Ether'
// Uniswap V2's router: verified, and not in the well-known registry.
const ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const DISTRIBUTOR = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
const IMPLEMENTATION = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const CONTACT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const CONTACT_NAME = 'Carol'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
// approve(ROUTER, max uint256)
const APPROVE_ROUTER_DATA = `0x095ea7b3000000000000000000000000${ROUTER.slice(2).toLowerCase()}${'f'.repeat(64)}`

const SWAP_EXACT_ETH_FOR_TOKENS = {
    type: 'function',
    name: 'swapExactETHForTokens',
    stateMutability: 'payable',
    inputs: [
        { name: 'amountOutMin', type: 'uint256' },
        { name: 'path', type: 'address[]' },
        { name: 'to', type: 'address' },
        { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
}

const CLAIM = {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
}

// swapExactETHForTokens(2.4e18, [WETH, DAI], SENDER, 1_800_000_000)
const SWAP_DATA =
    '0x7ff36ab5000000000000000000000000000000000000000000000000214e8348c4f000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266000000000000000000000000000000000000000000000000000000006b49d2000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000006b175474e89094c44da98b954eedeac495271d0f'
// claim(CONTACT)
const CLAIM_DATA =
    '0x1e83409a0000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc'

const FUNCTION_ROW = 'ethereum_verified_call_function'
const TRANSACTION_SLIDE = 'signing-confirm-slide'

const ETHEREUM_ACCOUNT = {
    id: 'eth-verified-call',
    custody: {
        kind: 'local' as const,
        seed: 'bip39' as const,
        hd: { account: 0, keyIndex: 0 },
    },
    chains: { ethereum: { address: SENDER, keyPairId: SIGNER_KEY_PAIR_ID } },
    name: ACCOUNT_NAME,
}

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

const review = async (
    to: string,
    data: string,
    contractAbis: Record<string, EvmContractAbiResponse> | number = {},
    value = '0x0',
    {
        contractMetadata = {},
        readyTestId = 'ethereum_contract_call_to',
    }: Pick<PeraEvmContractFixtures, 'contractMetadata'> & {
        readyTestId?: string
    } = {},
) => {
    server.use(
        ...evmRpcHandlers(),
        ...peraEvmHandlers({
            baseUrl: PERA_URL,
            contractAbis,
            contractMetadata,
        }),
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
    await waitFor(() => screen.getByTestId(readyTestId), {
        timeout: 15_000,
    })
}

const argumentRows = () =>
    screen.queryAllByTestId('ethereum_verified_call_argument')

// The label is looked up apart from the ABI, so each part is counted on its own.
const abiPathsRequested: string[] = []
const metadataPathsRequested: string[] = []
const recordRequest = ({ request }: { request: Request }) => {
    const { pathname, searchParams } = new URL(request.url)
    if (!pathname.includes('/contracts/')) return
    if (searchParams.get('include') === 'abi') abiPathsRequested.push(pathname)
    if (searchParams.get('include') === 'metadata') {
        metadataPathsRequested.push(pathname)
    }
}

describe('Flow: a dApp asks to call a contract whose source is verified', () => {
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
        abiPathsRequested.length = 0
        metadataPathsRequested.length = 0
        await getProvider().connections.store.clear()
        resetConnectionPairingStateForTesting()
        useAccountsStore.getState().setAccounts([ETHEREUM_ACCOUNT])
        useContactsStore.setState({
            contacts: [
                {
                    id: 'carol',
                    name: CONTACT_NAME,
                    addresses: { evm: CONTACT },
                },
            ],
        })
        setCapabilityOverrides(
            { dappConnect: true, contractDecoding: true },
            'ethereum',
        )
        // The review sheet looks the peer up in the projects API.
        server.use(http.get('*/v1/projects/', () => HttpResponse.json([])))
    })

    afterEach(async () => {
        useSigningStore.getState().resetState()
        useContactsStore.setState({ contacts: [] })
        await getProvider().connections.store.clear()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    it("Given a swap on a verified router, when it is reviewed, then it shows the function and its arguments from the contract's verified source, names the user's account, leaves the raw call to View details and still says the transaction wasn't checked", async () => {
        await review(
            ROUTER,
            SWAP_DATA,
            {
                [ROUTER.toLowerCase()]: verifiedAbiResponse([
                    SWAP_EXACT_ETH_FOR_TOKENS,
                ]),
            },
            '0x2386f26fc10000',
        )

        await waitFor(() => screen.getByTestId(FUNCTION_ROW), {
            timeout: 15_000,
        })
        expect(screen.getByTestId(FUNCTION_ROW).textContent).toContain(
            'swapExactETHForTokens',
        )
        expect(
            screen.getByTestId('ethereum_verified_call_source').textContent,
        ).toBe('transactions.contract_call.known_source')
        expect(
            screen.queryByTestId('ethereum_verified_call_implementation'),
        ).toBeNull()
        const recipient = argumentRows().find(row =>
            (row.textContent ?? '').startsWith('to'),
        )
        expect(recipient?.textContent).toContain(ACCOUNT_NAME)
        expect(
            argumentRows().some(row =>
                (row.textContent ?? '').includes('2400000000000000000'),
            ),
        ).toBe(true)
        // A path token the user doesn't know is shown whole, not truncated.
        expect(
            argumentRows().some(row => (row.textContent ?? '').includes(WETH)),
        ).toBe(true)
        expect(
            screen.getByTestId('ethereum_contract_call_warning'),
        ).toBeTruthy()
        expect(screen.queryByTestId('ethereum_contract_call_data')).toBeNull()
    })

    describe('a contract Pera curates that the app does not bundle', () => {
        const curated = {
            [ROUTER.toLowerCase()]: contractMetadataResponse(
                'Example V2 Router',
                'Example',
                'https://example.org',
            ),
        }

        it('Given an approval for it to spend a token, when it is reviewed, then the spender is named as Pera curates it', async () => {
            await review(USDC, APPROVE_ROUTER_DATA, {}, '0x0', {
                contractMetadata: curated,
                readyTestId: 'message-signing-spend-approval-spender',
            })

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId(
                            'message-signing-spend-approval-spender',
                        ).textContent,
                    ).toContain('Example V2 Router')
                },
                { timeout: 15_000 },
            )
        })

        it('Given the call the approval was for, when it is reviewed, then the contract is named the same way', async () => {
            await review(ROUTER, SWAP_DATA, {}, '0x2386f26fc10000', {
                contractMetadata: curated,
            })

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('ethereum_known_contract')
                            .textContent,
                    ).toContain('Example V2 Router')
                },
                { timeout: 15_000 },
            )
        })

        it('Given its project is not verified, when a call to it is reviewed, then it is not named', async () => {
            await review(ROUTER, SWAP_DATA, {}, '0x2386f26fc10000', {
                contractMetadata: {
                    [ROUTER.toLowerCase()]: contractMetadataResponse(
                        'Example V2 Router',
                        'Example',
                        'https://example.org',
                        'unverified',
                    ),
                },
            })

            await waitFor(() => {
                expect(metadataPathsRequested).toHaveLength(1)
            })
            await waitFor(() => {
                expect(
                    screen.queryByTestId('ethereum_verified_call_loading'),
                ).toBeNull()
            })
            expect(screen.queryByTestId('ethereum_known_contract')).toBeNull()
        })
    })

    it("Given a call through a verified proxy, when it is reviewed, then it shows the implementation's function, says the contract is a proxy and names a contact", async () => {
        await review(DISTRIBUTOR, CLAIM_DATA, {
            [DISTRIBUTOR.toLowerCase()]: verifiedAbiResponse(
                [CLAIM],
                IMPLEMENTATION,
            ),
        })

        await waitFor(() => screen.getByTestId(FUNCTION_ROW), {
            timeout: 15_000,
        })
        expect(screen.getByTestId(FUNCTION_ROW).textContent).toContain('claim')
        expect(
            screen.getByTestId('ethereum_verified_call_source').textContent,
        ).toBe('transactions.contract_call.known_source_proxy')
        expect(
            screen.getByTestId('ethereum_verified_call_implementation'),
        ).toBeTruthy()
        expect(argumentRows()[0].textContent).toContain(CONTACT_NAME)
    })

    it('Given a contract with no verified source, when a call to it is reviewed, then it stays an unrecognised contract call', async () => {
        await review(ROUTER, SWAP_DATA)

        await waitFor(() => expect(abiPathsRequested).toHaveLength(1))
        await waitFor(() =>
            expect(
                screen.queryByTestId('ethereum_verified_call_loading'),
            ).toBeNull(),
        )
        expect(screen.queryByTestId(FUNCTION_ROW)).toBeNull()
        expect(
            screen.queryByTestId('ethereum_verified_call_lookup_failed'),
        ).toBeNull()
        expect(
            screen.getByTestId('ethereum_contract_call_warning'),
        ).toBeTruthy()
    })

    it("Given calldata that doesn't re-encode exactly under the verified ABI, when it is reviewed, then it stays an unrecognised contract call", async () => {
        await review(ROUTER, `${SWAP_DATA}${'00'.repeat(32)}`, {
            [ROUTER.toLowerCase()]: verifiedAbiResponse([
                SWAP_EXACT_ETH_FOR_TOKENS,
            ]),
        })

        await waitFor(() => expect(abiPathsRequested).toHaveLength(1))
        await waitFor(() =>
            expect(
                screen.queryByTestId('ethereum_verified_call_loading'),
            ).toBeNull(),
        )
        expect(screen.queryByTestId(FUNCTION_ROW)).toBeNull()
        expect(
            screen.getByTestId('ethereum_contract_call_warning'),
        ).toBeTruthy()
    })

    it("Given the backend can't answer, when a call is reviewed, then it stays unrecognised, says the name couldn't be looked up, and the user can still confirm", async () => {
        await review(ROUTER, SWAP_DATA, 503)

        await waitFor(
            () => screen.getByTestId('ethereum_verified_call_lookup_failed'),
            { timeout: 15_000 },
        )
        expect(screen.queryByTestId(FUNCTION_ROW)).toBeNull()
        expect(
            screen.getByTestId('ethereum_contract_call_warning'),
        ).toBeTruthy()
        await waitFor(() =>
            expect(
                isElementDisabled(screen.getByTestId(TRANSACTION_SLIDE)),
            ).toBe(false),
        )
    })

    it('Given contractDecoding is off, when a call to a verified contract is reviewed, then nothing is looked up and the review is unchanged', async () => {
        setCapabilityOverrides(
            { dappConnect: true, contractDecoding: false },
            'ethereum',
        )

        await review(ROUTER, SWAP_DATA, {
            [ROUTER.toLowerCase()]: verifiedAbiResponse([
                SWAP_EXACT_ETH_FOR_TOKENS,
            ]),
        })

        expect(
            screen.getByTestId('ethereum_contract_call_warning'),
        ).toBeTruthy()
        expect(screen.queryByTestId(FUNCTION_ROW)).toBeNull()
        expect(
            screen.queryByTestId('ethereum_verified_call_loading'),
        ).toBeNull()
        expect(abiPathsRequested).toEqual([])
        expect(metadataPathsRequested).toEqual([])
    })
})
