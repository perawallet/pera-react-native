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

// Phishing lists on the device, through every route a dApp reaches the wallet:
// WalletConnect v1 and v2 (WalletConnect Verify included), a pairing started by
// the in-app browser, and the extension's connect screen for its injected
// providers. Lists are seeded from a fixture snapshot, then replaced by a real
// download through MSW, so the refresh path runs too.

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
    type MockInstance,
} from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import {
    ensurePhishingListsSeeded,
    refreshPhishingLists,
    usePhishingListStore,
    type PhishingListSnapshot,
} from '@perawallet/wallet-core-site-safety'
import { mockPhishingListSources } from '@perawallet/wallet-core-site-safety/test-handlers'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import {
    mockAlgodAccountInformation,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { encodeTransactionRaw } from '@perawallet/wallet-core-chain-algorand/blockchain'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    resetConnectionPairingStateForTesting,
    useConnectionRegistry,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import type { ConnectionOrigin } from '@perawallet/wallet-extension-connections'
import { encodeToBase64, type Optional } from '@perawallet/wallet-core-shared'
import { AlgorandWalletConnectChainId } from '@perawallet/wallet-core-walletconnect'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { render } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    buildPaymentTransaction,
    seedAlgo25Signer,
} from '@test-utils/signing-review'
import { walletConnectClientStub } from '@test-utils/walletconnect-client-stub'
import { walletKitStub, type FakeWalletKit } from '@test-utils/walletkit-stub'
import {
    closestPressable,
    getAllPressables,
    isElementDisabled,
} from '@test-utils/rnw'
import type { WalletKitVerifyContext } from '@packages/walletconnect/src/v2/client'
import {
    makeProposal,
    makeRequest,
    TOPIC as V2_SESSION_TOPIC,
    V2_URI,
} from '@packages/walletconnect/src/v2/__tests__/fakeWalletKit'
import { ConnectionsProvider } from '@modules/connections/shell'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { SigningOverlays } from '@modules/signing/shell'
import { WcConnectScreen } from '@modules/dapp/screens/WcConnectScreen'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { addressOf } from './__fixtures__/accounts'

vi.unmock('@perawallet/wallet-core-site-safety')

// Same reason as connections-flow: without a Reown project id the v2 handler
// builds no client, so the flow would pass or fail by machine.
vi.mock('@perawallet/wallet-core-config', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-config')
    >('@perawallet/wallet-core-config')
    return {
        ...actual,
        config: { ...actual.config, reownProjectId: 'integration-project-id' },
    }
})

// The extension's approval window reads its request off the approval bridge
// and arms its buttons on a timer; both are browser-runtime plumbing.
const dappRequest = vi.hoisted(() => ({
    approval: null as unknown,
    approve: vi.fn(),
    reject: vi.fn(),
}))
vi.mock('@modules/dapp/hooks/useDappRequest.web', () => ({
    useDappRequest: () => ({
        requestId: 'request-1',
        approval: dappRequest.approval,
        isLoading: false,
        approve: dappRequest.approve,
        reject: dappRequest.reject,
        deliveryError: false,
    }),
}))
vi.mock('@hooks/useApprovalArming.web', () => ({
    useApprovalArming: () => true,
}))

// The v2 fixture's dApp.
const DAPP_HOST = 'dapp.example'
const LISTED_HOST = 'listed-phish.example'

const SIGNING_ACCOUNT: WalletAccount = {
    id: 'site-a',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'site-a-key' },
    },
    name: 'Trading',
}

const SNAPSHOT: PhishingListSnapshot = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    sources: {
        metamask: { deny: LISTED_HOST, allow: '', impersonationTargets: '' },
        polkadot: {
            deny: 'bundled-dot.example',
            allow: '',
            impersonationTargets: '',
        },
    },
}

// Big enough to clear each source's truncation floor.
const hosts = (count: number, prefix: string): string[] =>
    Array.from({ length: count }, (_, i) => `${prefix}${i}.example`)

const downloadLists = async (deny: string[]): Promise<void> => {
    server.use(
        ...mockPhishingListSources({
            metamask: {
                body: {
                    blacklist: [...hosts(50_000, 'mm'), ...deny],
                    whitelist: [],
                    fuzzylist: [],
                },
            },
            polkadot: { body: { allow: [], deny: hosts(20_000, 'dot') } },
        }),
    )
    const outcomes = await refreshPhishingLists()
    expect(outcomes).toEqual({ metamask: 'updated', polkadot: 'updated' })
}

const IN_APP_ORIGIN: ConnectionOrigin = { source: 'in-app' }

const captured: { registry: Optional<ConnectionRegistryClient> } = {
    registry: undefined,
}
const RegistryProbe = () => {
    captured.registry = useConnectionRegistry()
    return null
}

const mountProvider = async () => {
    render(
        <>
            <ConnectionsProvider>
                <RegistryProbe />
            </ConnectionsProvider>
            <BottomSheetManager />
        </>,
    )
    await waitFor(() => expect(captured.registry).toBeTruthy())
}

const ConnectionsWithSigning = () => (
    <ConnectionsProvider>
        <RegistryProbe />
        <SigningOverlays />
    </ConnectionsProvider>
)

const findButton = (label: string) =>
    getAllPressables().find(button =>
        (button.textContent ?? '').includes(label),
    ) as Optional<HTMLButtonElement>

const rowFor = (name: string): HTMLButtonElement => {
    const matches = screen.getAllByText((_, node) =>
        (node?.textContent ?? '').includes(name),
    )
    const leaf = matches.find(el => el.children.length === 0) ?? matches[0]
    const button = closestPressable(leaf)
    if (!button) throw new Error(`Row not found for "${name}"`)
    return button as HTMLButtonElement
}

const approveViaUi = async (accountName: string) => {
    await waitFor(() => expect(findButton('common.connect.label')).toBeTruthy())
    fireEvent.click(rowFor(accountName))
    await waitFor(() =>
        expect(isElementDisabled(findButton('common.connect.label')!)).toBe(
            false,
        ),
    )
    fireEvent.click(findButton('common.connect.label')!)
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

const pairAndProposeV2 = async (
    options: {
        origin?: ConnectionOrigin
        url?: string
        verified?: Partial<WalletKitVerifyContext['verified']>
    } = {},
): Promise<FakeWalletKit> => {
    await act(async () => {
        await captured.registry!.pair(V2_URI, {
            origin: options.origin ?? IN_APP_ORIGIN,
        })
    })
    const walletKit = await waitForWalletKit()
    const proposal = makeProposal({}, options.verified)
    if (options.url) proposal.params.proposer.metadata.url = options.url
    act(() => {
        walletKit.emit('session_proposal', proposal)
    })
    return walletKit
}

const pairAndHandshakeV1 = async (url: string) => {
    await act(async () => {
        await captured.registry!.pair(
            `wc:${Math.random()}@1?bridge=https://relay.example.test&key=ff`,
            { origin: IN_APP_ORIGIN },
        )
    })
    const connector = walletConnectClientStub.last()
    if (!connector) throw new Error('No connector instance captured')
    act(() => {
        connector.fire('session_request', null, {
            id: 42,
            params: [
                {
                    peerMeta: {
                        name: 'Listed dApp',
                        description: '',
                        url,
                        icons: [],
                    },
                    chainId: AlgorandWalletConnectChainId.mainnet,
                    permissions: ['algo_signTxn'],
                },
            ],
        })
    })
    return connector
}

const findBlockedView = () =>
    waitFor(() => screen.getByTestId('site_blocked_view'), { timeout: 15_000 })

describe('Flow: a dApp on a phishing list or imitating a known one', () => {
    setSuiteUnhandledRequestMode('bypass')

    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        resetTestKeystore()
        walletConnectClientStub.reset()
        walletKitStub.reset()
        captured.registry = undefined
        dappRequest.approval = null
        usePhishingListStore.getState().resetState()
        await ensurePhishingListsSeeded({ loadSnapshot: async () => SNAPSHOT })
        useAccountsStore.getState().setAccounts([SIGNING_ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(SIGNING_ACCOUNT.id)
        await getProvider().connections.store.clear()
        resetConnectionPairingStateForTesting()
        server.use(http.get('*/v1/projects/', () => HttpResponse.json([])))
        vi.clearAllMocks()
    })

    afterEach(async () => {
        await getProvider().connections.store.clear()
        useAccountsStore.getState().setAccounts([])
    })

    it('Given a downloaded list naming the dApp, when it proposes over WalletConnect v2, then the full-screen block shows instead of Connect, and Reject refuses the session', async () => {
        await downloadLists([DAPP_HOST])
        await mountProvider()
        const walletKit = await pairAndProposeV2()

        await findBlockedView()
        expect(screen.getByTestId('site_blocked_host').textContent).toBe(
            DAPP_HOST,
        )
        expect(findButton('common.connect.label')).toBeUndefined()

        fireEvent.click(screen.getByTestId('site_blocked_reject'))

        await waitFor(() => expect(walletKit.rejectSession).toHaveBeenCalled())
        expect(walletKit.approveSession).not.toHaveBeenCalled()
    })

    it('Given a listed dApp over WalletConnect v1, when the user deliberately continues anyway, then the approval is reachable only after acknowledging the risk', async () => {
        await mountProvider()
        const connector = await pairAndHandshakeV1(`https://${LISTED_HOST}`)

        await findBlockedView()
        fireEvent.click(screen.getByTestId('site_blocked_continue_anyway'))
        const continueButton = () =>
            closestPressable(screen.getByTestId('site_blocked_continue'))!
        expect(isElementDisabled(continueButton())).toBe(true)
        fireEvent.click(screen.getByTestId('site_blocked_acknowledge'))
        await waitFor(() =>
            expect(isElementDisabled(continueButton())).toBe(false),
        )
        fireEvent.click(continueButton())

        await approveViaUi(SIGNING_ACCOUNT.name as string)
        await waitFor(() =>
            expect(connector.approveSessionCalls).toHaveLength(1),
        )
    })

    it('Given WalletConnect Verify reports the dApp as a scam, when it proposes, then it is blocked even though no list names it', async () => {
        await mountProvider()
        await pairAndProposeV2({ verified: { isScam: true } })

        await findBlockedView()
        expect(screen.getByText('site_safety.blocked.body_verify')).toBeTruthy()
    })

    it('Given the in-app browser is on a listed page whose dApp claims a clean url, when it pairs, then the page the webview reported is what gets blocked', async () => {
        await mountProvider()
        await pairAndProposeV2({
            origin: {
                source: 'in-app',
                requesterOrigin: `https://${LISTED_HOST}`,
            },
        })

        await findBlockedView()
        expect(screen.getByTestId('site_blocked_host').textContent).toBe(
            LISTED_HOST,
        )
    })

    it('Given a dApp on a domain imitating Uniswap, when it proposes, then the warning names Uniswap and the user must acknowledge before reaching Connect', async () => {
        await mountProvider()
        await pairAndProposeV2({ url: 'https://uniswap-app.org' })

        await waitFor(() => screen.getByTestId('site_look_alike_warning'), {
            timeout: 15_000,
        })
        expect(screen.getByTestId('site_look_alike_host').textContent).toBe(
            'uniswap-app.org',
        )
        const continueButton = () =>
            closestPressable(screen.getByTestId('site_look_alike_continue'))!
        expect(isElementDisabled(continueButton())).toBe(true)

        fireEvent.click(screen.getByTestId('site_look_alike_acknowledge'))
        await waitFor(() =>
            expect(isElementDisabled(continueButton())).toBe(false),
        )
        fireEvent.click(continueButton())

        await waitFor(() =>
            expect(findButton('common.connect.label')).toBeTruthy(),
        )
    })

    it("Given the real dApp's own domain, when it proposes, then no warning shows", async () => {
        await mountProvider()
        await pairAndProposeV2({ url: 'https://app.uniswap.org' })

        await waitFor(
            () => expect(findButton('common.connect.label')).toBeTruthy(),
            {
                timeout: 15_000,
            },
        )
        expect(screen.queryByTestId('site_look_alike_warning')).toBeNull()
        expect(screen.queryByTestId('site_blocked_view')).toBeNull()
    })

    describe('signing', () => {
        let signSpy: MockInstance

        beforeEach(async () => {
            await seedAlgoAsset('mainnet')
            useNetworkStore.getState().setMode('live')
            signSpy = vi
                .spyOn(getProvider().key.store, 'sign')
                .mockResolvedValue(new Uint8Array(64).fill(7))
            server.use(
                mockAlgodTransactionParams({
                    response: { fee: 1000, 'min-fee': 1000 },
                }),
                mockAlgodAccountInformation({
                    address: ALGO25_TEST_ADDRESS,
                    response: { amount: 5_000_000, 'min-balance': 100_000 },
                }),
                mockAlgodStatus({ response: { 'last-round': 100 } }),
                mockIndexerSearchForAccounts(),
            )
        })

        afterEach(() => {
            signSpy.mockRestore()
        })

        it('Given a session approved while the dApp was clean, when a refresh lists it and it asks to sign, then the request is blocked before review', async () => {
            const signer = await seedAlgo25Signer()
            renderWithNavigation(
                ConnectionsWithSigning,
                'ConnectionsWithSigning',
            )
            await waitFor(() => expect(captured.registry).toBeTruthy())
            const walletKit = await pairAndProposeV2()
            await approveViaUi(signer.name as string)
            await waitFor(async () => {
                expect(
                    await getProvider().connections.store.get(V2_SESSION_TOPIC),
                ).toBeTruthy()
            })

            await downloadLists([DAPP_HOST])
            const requested = buildPaymentTransaction({
                sender: addressOf(signer),
                receiver: HD_TEST_ADDRESS,
                amount: 1_000_000n,
            })
            act(() => {
                walletKit.emit(
                    'session_request',
                    makeRequest({
                        id: 9601,
                        params: [
                            [
                                {
                                    txn: encodeToBase64(
                                        encodeTransactionRaw(requested),
                                    ),
                                },
                            ],
                        ],
                    }),
                )
            })

            await findBlockedView()
            expect(screen.queryByTestId('signing-confirm-slide')).toBeNull()

            fireEvent.click(screen.getByTestId('site_blocked_reject'))
            await waitFor(() =>
                expect(walletKit.respondSessionRequest).toHaveBeenCalled(),
            )
            const [{ response }] = walletKit.respondSessionRequest.mock.calls[0]
            expect('error' in response).toBe(true)
            expect(signSpy).not.toHaveBeenCalled()
        })
    })

    describe("the extension's injected providers", () => {
        const proposalApproval = (requesterOrigin: string) => ({
            kind: 'connection-proposal',
            requestId: 'request-1',
            proposalId: 'proposal-1',
            connectionKind: 'pera-dapp',
            origin: requesterOrigin,
            peer: { name: 'Listed dApp', url: requesterOrigin },
            requesterOrigin,
            requested: {
                networks: ['mainnet'],
                chains: ['algorand'],
                methods: ['signTransactions'],
            },
            expiresAt: Date.now() + 60_000,
        })

        it('Given a listed page asks to connect through the injected provider, when the approval window opens, then it is blocked and Reject answers the page', async () => {
            dappRequest.approval = proposalApproval(`https://${LISTED_HOST}`)

            render(<WcConnectScreen />)

            await findBlockedView()
            expect(screen.queryByTestId('wc-connect-connect')).toBeNull()
            fireEvent.click(screen.getByTestId('site_blocked_reject'))
            expect(dappRequest.reject).toHaveBeenCalled()
            expect(dappRequest.approve).not.toHaveBeenCalled()
        })

        it('Given an unlisted page, when the approval window opens, then Connect is offered as before', async () => {
            dappRequest.approval = proposalApproval(
                'https://clean-dapp.example',
            )

            render(<WcConnectScreen />)

            await waitFor(() => screen.getByTestId('wc-connect-connect'), {
                timeout: 15_000,
            })
            expect(screen.queryByTestId('site_blocked_view')).toBeNull()
        })
    })
})
