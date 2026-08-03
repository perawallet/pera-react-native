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

// WalletConnect v1 pairing: connect() -> session_request handler -> store ->
// ConnectionView -> the user picks accounts -> approveSession.
//
// Only the bottom-level `@perawallet/walletconnect` transport is replaced (via
// vitest resolve.alias, so even the real wallet-core-walletconnect hooks build
// against the stub). The store, provider, ConnectionView and network gate are
// all production code.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { createTestQueryClient, render } from '@test-utils/render'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { walletConnectClientStub } from '@test-utils/walletconnect-client-stub'
import {
    AccountSortModes,
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    AlgorandChainId,
    useWalletConnect,
    useWalletConnectStore,
    type WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { Networks, type Optional } from '@perawallet/wallet-core-shared'
import { WalletConnectProvider } from '@modules/walletconnect/providers/WalletConnectProvider'
import { BottomSheetManager } from '@modules/bottom-sheet'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SIGNING_ACCOUNT_A: WalletAccount = {
    id: 'wc-a',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'wc-a-key',
    name: 'Trading',
}
const SIGNING_ACCOUNT_B: WalletAccount = {
    id: 'wc-b',
    type: AccountTypes.algo25,
    address: HD_TEST_ADDRESS,
    keyPairId: 'wc-b-key',
    name: 'DeFi',
}

const SLOW_TEST_TIMEOUT_MS = 30_000

// `useWalletConnect` mounts the signing pipeline, which now reads from
// React-Query via `useMultisigTransportAdapters`. `renderHook` creates a
// fresh React tree separate from the one set up by `render()`, so it
// needs its own QueryClientProvider.
const hookQueryClient = createTestQueryClient()
const HookWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={hookQueryClient}>
        {children}
    </QueryClientProvider>
)

// Drive a fake dApp `session_request`. Returns the connector the
// wallet's `connect()` call instantiated, so callers can assert on
// `approveSession` / `rejectSession` afterwards. `chainId` is omitted
// from the base type and re-added as optional so callers can default
// to mainnet without supplying it.
const driveSessionRequest = async (
    request: Omit<WalletConnectSessionRequest, 'clientId' | 'chainId'> & {
        chainId?: WalletConnectSessionRequest['chainId']
    },
) => {
    // Fire the public connect API. This is what the deep-link / QR
    // scan paths call once the URI is parsed.
    const { result: wc } = renderHook(
        () => useWalletConnect(Networks.mainnet),
        { wrapper: HookWrapper },
    )
    await act(async () => {
        await wc.current.connect({
            connection: {
                bridge: 'https://relay.example.test',
                uri: `wc:${Math.random()}@1?bridge=https://relay.example.test&key=ff`,
            } as unknown as Parameters<
                typeof wc.current.connect
            >[0]['connection'],
        })
    })

    const connector = walletConnectClientStub.last()
    expect(connector).toBeTruthy()

    // Fire `session_request` the way the relay would. The wallet's
    // handler reads chainId, peerMeta, permissions from
    // `payload.params[0]` and writes a `WalletConnectSessionRequest`
    // into the store.
    act(() => {
        connector!.fire('session_request', null, {
            params: [
                {
                    peerMeta: request.peerMeta,
                    chainId: request.chainId ?? AlgorandChainId.mainnet,
                    permissions: request.permissions,
                },
            ],
        })
    })
    return connector!
}

describe('Flow: WalletConnect v1 pair → approve session', () => {
    beforeEach(() => {
        resetTestKeystore()
        walletConnectClientStub.reset()
        useAccountsStore
            .getState()
            .setAccounts([SIGNING_ACCOUNT_A, SIGNING_ACCOUNT_B])
        useAccountsStore
            .getState()
            .setSelectedAccountAddress(SIGNING_ACCOUNT_A.address)
        // The WC store survives across tests via the singleton; reset
        // it explicitly so prior runs don't bleed in.
        useWalletConnectStore.getState().setSessionRequests([])
        useWalletConnectStore.getState().setWalletConnectConnections([])
        useWalletConnectStore.getState().setConnectionError(null)
        vi.clearAllMocks()
    })

    afterEach(() => {
        useWalletConnectStore.getState().setSessionRequests([])
        useWalletConnectStore.getState().setWalletConnectConnections([])
        useWalletConnectStore.getState().setConnectionError(null)
        useAccountsStore.getState().setAccounts([])
        useAccountsStore.getState().setSortMode(AccountSortModes.manual)
    })

    it(
        'Given a dApp pairs with the wallet, when a session_request arrives on the matching network, then the wallet store records the request and ConnectionView mounts with the dApp metadata',
        async () => {
            render(
                <>
                    <WalletConnectProvider>
                        <div data-testid='child' />
                    </WalletConnectProvider>
                    <BottomSheetManager />
                </>,
            )

            await driveSessionRequest({
                peerMeta: {
                    name: 'Test dApp',
                    description: 'A test dApp',
                    url: 'https://test-dapp.example',
                    icons: [],
                },
                permissions: ['algo_signTxn'],
            })

            // The session request landed in the store — and from the
            // store, the WalletConnectProvider's
            // `useWalletConnectProvider` lifts it into `nextRequest`,
            // mounting the ConnectionView inside its bottom sheet.
            await waitFor(() => {
                expect(
                    useWalletConnectStore.getState().sessionRequests,
                ).toHaveLength(1)
            })

            // ConnectionView's primary CTA is the Connect button —
            // its presence proves the sheet rendered the request UI.
            // (No explicit testID on the buttons; match by label.)
            await waitFor(() => {
                const buttons = screen.getAllByRole('button')
                const connect = buttons.find(b =>
                    (b.textContent ?? '').includes('common.connect.label'),
                )
                expect(connect).toBeTruthy()
            })

            // Header surfaces the dApp identity. The name is fed
            // through the i18n title template
            // (`walletconnect.request.title`, with `{name}` interp),
            // which falls back to the key under the integration setup
            // — so we assert on the URL link instead, which renders
            // verbatim as the link button title.
            expect(
                screen.getAllByText('https://test-dapp.example').length,
            ).toBeGreaterThan(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a session request is showing, when the user picks one account and taps Connect, then approveSession on the underlying connector is called with that exact address list',
        async () => {
            render(
                <>
                    <WalletConnectProvider>
                        <div data-testid='child' />
                    </WalletConnectProvider>
                    <BottomSheetManager />
                </>,
            )

            const connector = await driveSessionRequest({
                peerMeta: {
                    name: 'Approve dApp',
                    description: '',
                    url: 'https://approve-dapp.example',
                    icons: [],
                },
                permissions: ['algo_signTxn'],
            })

            // Wait for the Connect button.
            const findConnectButton = (): Optional<HTMLButtonElement> =>
                screen
                    .getAllByRole('button')
                    .find(b =>
                        (b.textContent ?? '').includes('common.connect.label'),
                    ) as Optional<HTMLButtonElement>
            await waitFor(() => {
                expect(findConnectButton()).toBeTruthy()
            })

            // Connect is disabled until the user picks at least one
            // account — assert the gate explicitly.
            expect(findConnectButton()!.disabled).toBe(true)

            // Each row is a PWTouchableOpacity (mocked as <button>).
            // ConnectionView renders one per signing account; tap the
            // first row to select SIGNING_ACCOUNT_A. The row's text
            // content includes the account name from AccountDisplay,
            // so we walk the DOM by name.
            const rowFor = (name: string): HTMLButtonElement => {
                const matches = screen.getAllByText((_, node) =>
                    (node?.textContent ?? '').includes(name),
                )
                const leaf =
                    matches.find(el => el.children.length === 0) ?? matches[0]
                const button = leaf.closest('button')
                if (!button) {
                    throw new Error(`Row not found for "${name}"`)
                }
                return button as HTMLButtonElement
            }
            fireEvent.click(rowFor(SIGNING_ACCOUNT_A.name as string))

            await waitFor(() => {
                expect(findConnectButton()!.disabled).toBe(false)
            })
            fireEvent.click(findConnectButton()!)

            // The wallet's approveSession first revives the bridge socket
            // (ensureConnectorReady) and only then calls
            // `.approveSession({chainId, accounts})` on the matching
            // connector — that's the stub instance we captured.
            await waitFor(() => {
                expect(connector.approveSessionCalls).toHaveLength(1)
            })
            const call = connector.approveSessionCalls[0]
            expect(call.chainId).toBe(AlgorandChainId.mainnet)
            expect(call.accounts).toEqual([SIGNING_ACCOUNT_A.address])

            // Request gets removed from the store after approval so
            // the bottom sheet closes; assert that side-effect too.
            await waitFor(() => {
                expect(
                    useWalletConnectStore.getState().sessionRequests,
                ).toHaveLength(0)
            })
            // And the wallet's connection list now contains an entry
            // for this clientId.
            const connections =
                useWalletConnectStore.getState().walletConnectConnections
            expect(
                connections.some(c => c.clientId === connector.clientId),
            ).toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        "Given a non-default account sort order, when ConnectionView lists the signing accounts, then it honors the user's chosen order (not raw store order)",
        async () => {
            // Store order is [Trading, DeFi]; alphabetical-ascending must
            // surface DeFi before Trading. The bug (raw signing-account list)
            // kept store order, so row position proves the fix.
            useAccountsStore
                .getState()
                .setSortMode(AccountSortModes.alphabeticalAsc)

            render(
                <>
                    <WalletConnectProvider>
                        <div data-testid='child' />
                    </WalletConnectProvider>
                    <BottomSheetManager />
                </>,
            )

            await driveSessionRequest({
                peerMeta: {
                    name: 'Order dApp',
                    description: '',
                    url: 'https://order-dapp.example',
                    icons: [],
                },
                permissions: ['algo_signTxn'],
            })

            await waitFor(() => {
                expect(
                    screen.getAllByText((_, node) =>
                        (node?.textContent ?? '').includes(
                            SIGNING_ACCOUNT_B.name as string,
                        ),
                    ).length,
                ).toBeGreaterThan(0)
            })

            const body = document.body.textContent ?? ''
            const defiAt = body.indexOf(SIGNING_ACCOUNT_B.name as string)
            const tradingAt = body.indexOf(SIGNING_ACCOUNT_A.name as string)
            expect(defiAt).toBeGreaterThan(-1)
            expect(tradingAt).toBeGreaterThan(-1)
            expect(defiAt).toBeLessThan(tradingAt)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a session request is showing, when the user taps Cancel, then connector.rejectSession is called and the request is cleared from the store',
        async () => {
            render(
                <>
                    <WalletConnectProvider>
                        <div data-testid='child' />
                    </WalletConnectProvider>
                    <BottomSheetManager />
                </>,
            )

            const connector = await driveSessionRequest({
                peerMeta: {
                    name: 'Reject dApp',
                    description: '',
                    url: 'https://reject-dapp.example',
                    icons: [],
                },
                permissions: ['algo_signTxn'],
            })

            // Cancel is the secondary CTA in ConnectionView. Match by the
            // i18n key (label falls back to the key in integration setup).
            const findCancelButton = (): Optional<HTMLButtonElement> =>
                screen
                    .getAllByRole('button')
                    .find(b =>
                        (b.textContent ?? '').includes('common.cancel.label'),
                    ) as Optional<HTMLButtonElement>
            await waitFor(() => {
                expect(findCancelButton()).toBeTruthy()
            })

            fireEvent.click(findCancelButton()!)

            // ConnectionView.handleReject calls
            // `useWalletConnect.rejectSession(clientId)`, which revives the
            // socket and forwards to `connector.rejectSession()` on the
            // captured stub.
            await waitFor(() => {
                expect(connector.rejectSessionCalls).toBe(1)
            })
            expect(connector.approveSessionCalls).toHaveLength(0)

            // The pending request is removed so the bottom sheet closes.
            await waitFor(() => {
                expect(
                    useWalletConnectStore.getState().sessionRequests,
                ).toHaveLength(0)
            })
            // No connection added to the wallet's session list either.
            expect(
                useWalletConnectStore.getState().walletConnectConnections,
            ).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an established WC session, when the user disconnects via useWalletConnect.disconnect, then connector.killSession is called and the connection is removed from the store',
        async () => {
            // Render the provider so `useWalletConnect` is wired into the
            // connectors map (production path: connect → register handlers
            // → push instance into the map keyed by clientId). renderHook
            // separately so the test can call `disconnect()` directly.
            render(
                <>
                    <WalletConnectProvider>
                        <div data-testid='child' />
                    </WalletConnectProvider>
                    <BottomSheetManager />
                </>,
            )

            const connector = await driveSessionRequest({
                peerMeta: {
                    name: 'Disconnect dApp',
                    description: '',
                    url: 'https://disconnect-dapp.example',
                    icons: [],
                },
                permissions: ['algo_signTxn'],
            })

            // Drive through the approval UI so the production code adds
            // the connection to `walletConnectConnections` and the stub
            // flips `connected = true`. Without this, `disconnect` would
            // short-circuit before calling `killSession`.
            const findConnectButton = (): Optional<HTMLButtonElement> =>
                screen
                    .getAllByRole('button')
                    .find(b =>
                        (b.textContent ?? '').includes('common.connect.label'),
                    ) as Optional<HTMLButtonElement>
            await waitFor(() => {
                expect(findConnectButton()).toBeTruthy()
            })

            const rowFor = (name: string): HTMLButtonElement => {
                const matches = screen.getAllByText((_, node) =>
                    (node?.textContent ?? '').includes(name),
                )
                const leaf =
                    matches.find(el => el.children.length === 0) ?? matches[0]
                const button = leaf.closest('button')
                if (!button) {
                    throw new Error(`Row not found for "${name}"`)
                }
                return button as HTMLButtonElement
            }
            fireEvent.click(rowFor(SIGNING_ACCOUNT_A.name as string))
            await waitFor(() => {
                expect(findConnectButton()!.disabled).toBe(false)
            })
            fireEvent.click(findConnectButton()!)

            // Wait until the connection is recorded in the store before
            // attempting disconnect — otherwise `disconnect` filters an
            // empty list and `killSession` never fires.
            await waitFor(() => {
                expect(connector.connected).toBe(true)
                expect(
                    useWalletConnectStore
                        .getState()
                        .walletConnectConnections.some(
                            c => c.clientId === connector.clientId,
                        ),
                ).toBe(true)
            })

            // Now drive disconnect (`triggerDisconnect = true` matches the
            // settings-page "Disconnect" CTA, which is the user-initiated
            // path).
            const { result: wc } = renderHook(
                () => useWalletConnect(Networks.mainnet),
                { wrapper: HookWrapper },
            )
            await act(async () => {
                await wc.current.disconnect(connector.clientId, true)
            })

            // killSession was invoked with the production message — this
            // is what the relay would broadcast to the dApp.
            expect(connector.killSessionCalls).toHaveLength(1)
            expect(connector.killSessionCalls[0].message).toBe(
                'User disconnected',
            )

            // And the connection has been pruned from the wallet's session
            // list so it stops showing up in settings.
            expect(
                useWalletConnectStore
                    .getState()
                    .walletConnectConnections.find(
                        c => c.clientId === connector.clientId,
                    ),
            ).toBeUndefined()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a session_request comes in for the wrong chain (testnet while the wallet is on mainnet), when the wallet processes it, then no request reaches the user-facing store and a connection error is surfaced instead',
        async () => {
            // Wallet defaults to mainnet via the seeded store; the
            // dApp asks for testnet (416002) — production rejects
            // this without ever showing the sheet, surfacing a
            // WalletConnectInvalidNetworkError on the store.
            render(
                <>
                    <WalletConnectProvider>
                        <div data-testid='child' />
                    </WalletConnectProvider>
                    <BottomSheetManager />
                </>,
            )

            // The provider consumes `connectionError` (shows a toast, then
            // clears the store), so capture the surfaced error the moment it
            // lands rather than reading it back off the store afterwards.
            const surfaced: { error: Error | null } = { error: null }
            const unsubscribe = useWalletConnectStore.subscribe(state => {
                if (state.connectionError) {
                    surfaced.error = state.connectionError
                }
            })

            await driveSessionRequest({
                peerMeta: {
                    name: 'Wrong-chain dApp',
                    description: '',
                    url: 'https://wrong.example',
                    icons: [],
                },
                permissions: ['algo_signTxn'],
                // The `AlgorandChainId` const object isn't `as const`,
                // so its properties are typed `number` rather than the
                // narrow literal union. Cast to land in the union.
                chainId:
                    AlgorandChainId.testnet as WalletConnectSessionRequest['chainId'],
            })

            // No request lands in the user-facing requests list — the
            // dispatch was rejected at the network-validation step.
            expect(
                useWalletConnectStore.getState().sessionRequests,
            ).toHaveLength(0)
            // The error surface DID get an entry (consumed in production by
            // the provider, which shows it as a toast — routed to the QR
            // scanner's own notifier when the scanner is open — then clears
            // the store).
            await waitFor(() => {
                expect(surfaced.error).toBeTruthy()
            })
            expect(surfaced.error?.name).toBe(
                'WalletConnectInvalidNetworkError',
            )
            unsubscribe()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
