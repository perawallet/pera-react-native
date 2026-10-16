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

// A WalletConnect v2 session spanning Algorand and Ethereum, through the same
// provider, registry, handler and approval sheet as `connections-flow.spec.tsx`
// with only `@reown/walletkit` stubbed. Ethereum's `dappConnect` is the gate.

import React from 'react'
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@test-utils/render'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { walletKitStub, type FakeWalletKit } from '@test-utils/walletkit-stub'
import {
    makeProposal,
    makeRequest,
    MAINNET_CHAIN_ID,
    TOPIC as V2_SESSION_TOPIC,
    V2_URI,
} from '@packages/walletconnect/src/v2/__tests__/fakeWalletKit'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    resetConnectionPairingStateForTesting,
    useConnectionRegistry,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import type { ConnectionOrigin } from '@perawallet/wallet-extension-connections'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useSigningStore } from '@packages/signing/src/store'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ConnectionsProvider } from '@modules/connections/shell'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { getAllPressables, isElementDisabled } from '@test-utils/rnw'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

// The integration setup registers whichever chains config enables, and v2
// builds no client without a Reown project id.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        // A built request prices on the selected network's node, which the
        // test build has no URL for.
        chainEndpointsFor: (chainId: ChainId) =>
            chainId === 'ethereum'
                ? { mainnet: 'https://mainnet.rpc.test/' }
                : actual.chainEndpointsFor(chainId),
        config: {
            ...actual.config,
            reownProjectId: 'integration-project-id',
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

const STORED_ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const CHECKSUMMED_ETH_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const ETH_MAINNET = 'eip155:1'

const ALGORAND_ACCOUNT: WalletAccount = {
    id: 'eth-conn-algo',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'algo-key' },
    },
    name: 'Trading',
}
// A seed-derived account: a signer the pipeline accepts, which a request needs
// to reach review.
const ETHEREUM_ACCOUNT: WalletAccount = {
    id: 'eth-conn-eth',
    custody: {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, keyIndex: 0 },
    },
    chains: {
        ethereum: { address: STORED_ETH_ADDRESS, keyPairId: 'eth-key' },
    },
    name: 'Ether',
}

const ETHEREUM_METHODS = [
    'eth_sendTransaction',
    'personal_sign',
    'eth_signTypedData_v4',
    'wallet_switchEthereumChain',
    'eth_accounts',
    'eth_requestAccounts',
    'eth_chainId',
]

const IN_APP_ORIGIN: ConnectionOrigin = { source: 'in-app' }

const captured: { registry: Optional<ConnectionRegistryClient> } = {
    registry: undefined,
}
const RegistryProbe = () => {
    captured.registry = useConnectionRegistry()
    return null
}

const pendingSignRequests = () => useSigningStore.getState().pendingSignRequests

const findButton = (label: string): Optional<HTMLButtonElement> =>
    getAllPressables().find(button =>
        (button.textContent ?? '').includes(label),
    ) as Optional<HTMLButtonElement>

const mountProvider = async () => {
    render(
        <>
            <ConnectionsProvider>
                <RegistryProbe />
            </ConnectionsProvider>
            <BottomSheetManager />
        </>,
    )
    await waitFor(() => {
        expect(captured.registry).toBeTruthy()
    })
}

const waitForWalletKit = (): Promise<FakeWalletKit> =>
    waitFor(
        () => {
            const client = walletKitStub.last()
            if (!client) throw new Error('WalletKit was never initialised')
            return client
        },
        { timeout: 15_000 },
    )

const propose = async (
    namespaces: Parameters<typeof makeProposal>[0],
): Promise<FakeWalletKit> => {
    await act(async () => {
        await captured.registry!.pair(V2_URI, { origin: IN_APP_ORIGIN })
    })
    const walletKit = await waitForWalletKit()
    act(() => {
        walletKit.emit('session_proposal', makeProposal(namespaces))
    })
    return walletKit
}

const eip155Namespace = (
    type: 'requiredNamespaces' | 'optionalNamespaces',
) => ({
    [type]: {
        eip155: {
            chains: [ETH_MAINNET],
            methods: ['eth_sendTransaction'],
            events: [],
        },
    },
})

const bothRequired = () => ({
    requiredNamespaces: {
        algorand: {
            chains: [MAINNET_CHAIN_ID],
            methods: ['algo_signTxn'],
            events: [],
        },
        eip155: {
            chains: [ETH_MAINNET],
            methods: ['eth_sendTransaction'],
            events: [],
        },
    },
})

const selectRows = async (...accounts: WalletAccount[]) => {
    await waitFor(() => {
        expect(findButton('common.connect.label')).toBeTruthy()
    })
    for (const { id } of accounts) {
        const testId = `wc_account_row_${id}`
        await waitFor(() => expect(screen.getByTestId(testId)).toBeTruthy(), {
            timeout: 5000,
        })
        fireEvent.click(screen.getByTestId(testId))
    }
    await waitFor(() => {
        expect(isElementDisabled(findButton('common.connect.label')!)).toBe(
            false,
        )
    })
}

const connect = async (walletKit: FakeWalletKit) => {
    fireEvent.click(findButton('common.connect.label')!)
    await waitFor(() => {
        expect(walletKit.approveSession).toHaveBeenCalledTimes(1)
    })
    await waitFor(async () => {
        expect(
            await getProvider().connections.store.get(V2_SESSION_TOPIC),
        ).toBeTruthy()
    })
}

const approvedNamespaces = (walletKit: FakeWalletKit) =>
    (walletKit.approveSession as Mock).mock.calls[0][0].namespaces as Record<
        string,
        { chains: string[]; accounts: string[]; methods: string[] }
    >

describe('Flow: a v2 session spanning Algorand and Ethereum', () => {
    setSuiteUnhandledRequestMode('bypass')

    beforeEach(async () => {
        resetTestKeystore()
        walletKitStub.reset()
        captured.registry = undefined
        useAccountsStore
            .getState()
            .setAccounts([ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT])
        await getProvider().connections.store.clear()
        resetConnectionPairingStateForTesting()
        vi.clearAllMocks()
    })

    afterEach(async () => {
        // A module singleton with no per-test reset.
        useSigningStore.getState().resetState()
        await getProvider().connections.store.clear()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    describe('with Ethereum dappConnect on', () => {
        beforeEach(() => {
            setCapabilityOverrides({ dappConnect: true }, 'ethereum')
        })

        it('Given an eip155-only proposal, when the sheet opens, then only the Ethereum account is listed and Connect approves its checksummed address', async () => {
            await mountProvider()
            // The approved methods are the requested ones the wallet lists, so
            // the dApp asks for the whole set and the two it must never get.
            const walletKit = await propose({
                requiredNamespaces: {
                    eip155: {
                        chains: [ETH_MAINNET],
                        methods: ETHEREUM_METHODS,
                        events: [],
                    },
                },
                optionalNamespaces: {
                    eip155: {
                        chains: [ETH_MAINNET],
                        methods: [
                            'eth_signTransaction',
                            'eth_sendRawTransaction',
                        ],
                        events: [],
                    },
                },
            })

            await selectRows(ETHEREUM_ACCOUNT)
            expect(screen.queryByText('Trading')).toBeNull()
            await connect(walletKit)

            const namespaces = approvedNamespaces(walletKit)
            expect(Object.keys(namespaces)).toEqual(['eip155'])
            expect(namespaces.eip155.chains).toEqual([ETH_MAINNET])
            expect(namespaces.eip155.accounts).toEqual([
                `${ETH_MAINNET}:${CHECKSUMMED_ETH_ADDRESS}`,
            ])
            expect(namespaces.eip155.methods).toEqual(ETHEREUM_METHODS)
        })

        it('Given a proposal requiring algorand and eip155, when the user selects both accounts, then each namespace carries only its own chain’s address', async () => {
            await mountProvider()
            const walletKit = await propose(bothRequired())

            await selectRows(ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT)
            await connect(walletKit)

            const namespaces = approvedNamespaces(walletKit)
            expect(namespaces.algorand.accounts).toEqual([
                `${MAINNET_CHAIN_ID}:${ALGO25_TEST_ADDRESS}`,
            ])
            expect(namespaces.eip155.accounts).toEqual([
                `${ETH_MAINNET}:${CHECKSUMMED_ETH_ADDRESS}`,
            ])
        })

        it('Given a settled eip155 session, when the dApp calls methods the wallet does not list, then they are refused with 4200 without a review and eth_chainId is answered', async () => {
            await mountProvider()
            const walletKit = await propose(
                eip155Namespace('requiredNamespaces'),
            )
            await selectRows(ETHEREUM_ACCOUNT)
            await connect(walletKit)

            const send = (id: number, method: string) =>
                act(() => {
                    walletKit.emit(
                        'session_request',
                        makeRequest({
                            id,
                            method,
                            params: [],
                            chainId: ETH_MAINNET,
                        }),
                    )
                })
            send(1, 'wallet_addEthereumChain')
            send(2, 'eth_signTransaction')
            send(3, 'eth_chainId')
            send(4, 'eth_sendRawTransaction')
            send(5, 'wallet_sendCalls')

            await waitFor(() => {
                expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(5)
            })
            const answers = new Map(
                (walletKit.respondSessionRequest as Mock).mock.calls.map(
                    ([{ response }]) => [response.id, response],
                ),
            )
            for (const id of [1, 2, 4, 5]) {
                expect(answers.get(id)).toMatchObject({
                    error: { code: 4200 },
                })
            }
            expect(answers.get(3)).toMatchObject({ result: '0x1' })
            expect(pendingSignRequests()).toHaveLength(0)
        })

        describe('eth_sendTransaction', () => {
            const RECIPIENT = '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23'
            const HASH = `0x${'ab'.repeat(32)}`

            const settle = async () => {
                server.use(...evmRpcHandlers())
                await mountProvider()
                const walletKit = await propose(
                    eip155Namespace('requiredNamespaces'),
                )
                await selectRows(ETHEREUM_ACCOUNT)
                await connect(walletKit)
                return walletKit
            }

            const sendTransaction = (
                walletKit: FakeWalletKit,
                transaction: Record<string, unknown>,
            ) =>
                act(() => {
                    walletKit.emit(
                        'session_request',
                        makeRequest({
                            id: 7,
                            method: 'eth_sendTransaction',
                            params: [transaction],
                            chainId: ETH_MAINNET,
                        }),
                    )
                })

            const answerOf = (walletKit: FakeWalletKit) =>
                (walletKit.respondSessionRequest as Mock).mock.calls.at(-1)?.[0]
                    .response

            type QueuedRequest = {
                approve: (
                    signed: unknown[],
                    submission?: { txIds: string[] },
                ) => Promise<void>
                reject: () => Promise<void>
            }

            // The nonce comes from the submission ledger.
            beforeAll(setupTestDatabase)
            beforeEach(resetTestDatabase)
            afterAll(teardownTestDatabase)

            const queued = async (): Promise<QueuedRequest> => {
                await waitFor(() => {
                    expect(pendingSignRequests()).toHaveLength(1)
                })
                return pendingSignRequests()[0] as unknown as QueuedRequest
            }

            it('Given a valid request, when it is approved with a submitted hash, then the dApp receives that hash', async () => {
                const walletKit = await settle()

                sendTransaction(walletKit, {
                    from: CHECKSUMMED_ETH_ADDRESS,
                    to: RECIPIENT,
                    value: '0x1',
                    gasPrice: '0x3b9aca00',
                })
                const request = await queued()
                // The broadcaster leg is pinned by the chain's own spec, and
                // mobile has no Ethereum review UI to drive.
                await act(async () => {
                    await request.approve([], { txIds: [HASH] })
                })

                await waitFor(() => {
                    expect(answerOf(walletKit)).toMatchObject({
                        id: 7,
                        result: HASH,
                    })
                })
            })

            it('Given a queued request, when the user rejects it, then the dApp receives 4001', async () => {
                const walletKit = await settle()
                sendTransaction(walletKit, {
                    from: CHECKSUMMED_ETH_ADDRESS,
                    to: RECIPIENT,
                })
                const request = await queued()

                await act(async () => {
                    await request.reject()
                })

                await waitFor(() => {
                    expect(answerOf(walletKit)).toMatchObject({
                        error: { code: 4001 },
                    })
                })
            })

            it.each([
                ['a type 0x4 transaction', { type: '0x4' }, -32_602],
                ['a contract creation', { to: undefined }, -32_602],
                ['a blob transaction', { type: '0x3' }, -32_602],
                ['a from the session does not hold', { from: RECIPIENT }, 4100],
                [
                    'a chainId that is not the active chain',
                    { chainId: '0xaa36a7' },
                    -32_602,
                ],
            ])(
                'Given %s, when it arrives, then it is refused with %i and nothing is queued',
                async (_, fields, code) => {
                    const walletKit = await settle()

                    sendTransaction(walletKit, {
                        from: CHECKSUMMED_ETH_ADDRESS,
                        to: RECIPIENT,
                        ...fields,
                    })

                    await waitFor(() => {
                        expect(answerOf(walletKit)).toMatchObject({
                            error: { code },
                        })
                    })
                    expect(pendingSignRequests()).toHaveLength(0)
                },
            )
        })
    })

    describe('with Ethereum dappConnect off, its default', () => {
        it('Given a proposal requiring eip155, when it arrives, then it is rejected and no sheet opens', async () => {
            await mountProvider()
            const walletKit = await propose(
                eip155Namespace('requiredNamespaces'),
            )

            await waitFor(() => {
                expect(walletKit.rejectSession).toHaveBeenCalledTimes(1)
            })
            expect(walletKit.rejectSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: expect.objectContaining({ code: 5104 }),
                }),
            )
            expect(findButton('common.connect.label')).toBeUndefined()
        })

        it('Given algorand required and eip155 optional, when the sheet opens, then only the Algorand account is listed and the session settles algorand only', async () => {
            await mountProvider()
            const walletKit = await propose({
                requiredNamespaces: {
                    algorand: bothRequired().requiredNamespaces.algorand,
                },
                ...eip155Namespace('optionalNamespaces'),
            })

            await selectRows(ALGORAND_ACCOUNT)
            expect(screen.queryByText('Ether')).toBeNull()
            await connect(walletKit)

            expect(Object.keys(approvedNamespaces(walletKit))).toEqual([
                'algorand',
            ])
        })
    })
})
