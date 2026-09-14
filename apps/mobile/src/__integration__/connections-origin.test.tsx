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

// Where a pairing entered the wallet decides what happens after approval. The
// origin travels as `registry.pair(uri, { origin })`, the v1 handler writes it
// onto the persisted `Connection` at approval, and
// `ConnectionApprovalSuccessView` reads it back off the record — so the sheet
// survives a relaunch and the signing flow's hand-off reads the same field.
//
// Only the bottom-level `@perawallet/walletconnect` transport is stubbed; the
// provider, registry, handler, approval and success sheets are production code.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Linking } from 'react-native'

import { render } from '@test-utils/render'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { walletConnectClientStub } from '@test-utils/walletconnect-client-stub'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { AlgorandChainId } from '@perawallet/wallet-core-walletconnect'
import {
    useConnectionRegistry,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import type { ConnectionOrigin } from '@perawallet/wallet-extension-connections'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ConnectionsProvider } from '@modules/connections'
import { BottomSheetManager } from '@modules/bottom-sheet'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SIGNING_ACCOUNT: WalletAccount = {
    id: 'origin-a',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'origin-a-key',
    name: 'Trading',
}
const OTHER_ACCOUNT: WalletAccount = {
    id: 'origin-b',
    type: AccountTypes.algo25,
    address: HD_TEST_ADDRESS,
    keyPairId: 'origin-b-key',
    name: 'DeFi',
}

const SLOW_TEST_TIMEOUT_MS = 30_000
const SUCCESS_SHEET_TEST_ID = 'wc_connection_success'
const RETURN_BUTTON_TEST_ID = 'wc_connection_success_return'

// What `pair()` records when the wc: link arrived via an OS deep link with the
// iOS @perawallet/connect wrapper's browser hint.
const CHROME_ORIGIN: ConnectionOrigin = {
    source: 'external-browser',
    browserName: 'Chrome',
}

const captured: { registry: Optional<ConnectionRegistryClient> } = {
    registry: undefined,
}
const RegistryProbe = () => {
    captured.registry = useConnectionRegistry()
    return null
}

// `queryAll`: an empty sheet host is a valid "no button" answer here.
const findButton = (label: string): Optional<HTMLButtonElement> =>
    screen
        .queryAllByRole('button')
        .find(button =>
            (button.textContent ?? '').includes(label),
        ) as Optional<HTMLButtonElement>

const rowFor = (name: string): HTMLButtonElement => {
    const matches = screen.getAllByText((_, node) =>
        (node?.textContent ?? '').includes(name),
    )
    const leaf = matches.find(el => el.children.length === 0) ?? matches[0]
    const button = leaf.closest('button')
    if (!button) throw new Error(`Row not found for "${name}"`)
    return button as HTMLButtonElement
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
    await waitFor(() => {
        expect(captured.registry).toBeTruthy()
    })
}

/** Pairs with the given origin and delivers a handshake the way the relay would. */
const pairAndHandshake = async (peerName: string, origin: ConnectionOrigin) => {
    await act(async () => {
        await captured.registry!.pair(
            `wc:${Math.random()}@1?bridge=https://relay.example.test&key=ff`,
            { origin },
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
                        name: peerName,
                        description: '',
                        url: 'https://origin-dapp.example',
                        icons: [],
                    },
                    chainId: AlgorandChainId.mainnet,
                    permissions: ['algo_signTxn'],
                },
            ],
        })
    })
    return connector
}

const approveViaUi = async (accountName: string) => {
    await waitFor(() => {
        expect(findButton('common.connect.label')).toBeTruthy()
    })
    fireEvent.click(rowFor(accountName))
    await waitFor(() => {
        expect(findButton('common.connect.label')!.disabled).toBe(false)
    })
    fireEvent.click(findButton('common.connect.label')!)
}

const waitForStoredConnection = async (clientId: string) => {
    await waitFor(async () => {
        expect(await getProvider().connections.store.get(clientId)).toBeTruthy()
    })
}

describe('Flow: connection origin → return to the dApp', () => {
    beforeEach(async () => {
        resetTestKeystore()
        walletConnectClientStub.reset()
        captured.registry = undefined
        useAccountsStore
            .getState()
            .setAccounts([SIGNING_ACCOUNT, OTHER_ACCOUNT])
        useAccountsStore
            .getState()
            .setSelectedAccountAddress(SIGNING_ACCOUNT.address)
        await getProvider().connections.store.clear()
        vi.clearAllMocks()
    })

    afterEach(async () => {
        await getProvider().connections.store.clear()
        useAccountsStore.getState().setAccounts([])
    })

    it(
        'Given a browser-initiated pairing, when the user approves, then the success sheet offers Return to the dApp, tapping it focuses the browser, and the persisted connection records the origin',
        async () => {
            await mountProvider()
            const connector = await pairAndHandshake(
                'Browser dApp',
                CHROME_ORIGIN,
            )

            await approveViaUi(SIGNING_ACCOUNT.name as string)

            await waitFor(() => {
                expect(screen.getByTestId(RETURN_BUTTON_TEST_ID)).toBeTruthy()
            })
            fireEvent.click(screen.getByTestId(RETURN_BUTTON_TEST_ID))

            // iOS has no task stack to fall back on, so the bare launch scheme
            // foregrounds the browser on the tab it was showing.
            expect(Linking.openURL).toHaveBeenCalledWith('googlechrome://')
            await waitFor(() => {
                expect(screen.queryByTestId(SUCCESS_SHEET_TEST_ID)).toBeNull()
            })

            const stored = await getProvider().connections.store.get(
                connector.clientId,
            )
            expect(stored?.origin).toEqual(CHROME_ORIGIN)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a QR-initiated pairing, when the user approves, then the success sheet offers only Close and the origin is persisted as qr',
        async () => {
            await mountProvider()
            const connector = await pairAndHandshake('QR dApp', {
                source: 'qr',
            })

            await approveViaUi(SIGNING_ACCOUNT.name as string)

            await waitFor(() => {
                expect(screen.getByTestId(SUCCESS_SHEET_TEST_ID)).toBeTruthy()
            })
            expect(findButton('common.close.label')).toBeTruthy()
            expect(screen.queryByTestId(RETURN_BUTTON_TEST_ID)).toBeNull()
            expect(Linking.openURL).not.toHaveBeenCalled()

            const stored = await getProvider().connections.store.get(
                connector.clientId,
            )
            expect(stored?.origin?.source).toBe('qr')
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an in-app pairing, when the user approves, then no success sheet appears and the origin is persisted as in-app',
        async () => {
            await mountProvider()
            const connector = await pairAndHandshake('Discover dApp', {
                source: 'in-app',
            })

            await approveViaUi(SIGNING_ACCOUNT.name as string)
            await waitForStoredConnection(connector.clientId)

            // The approval sheet is gone and nothing replaced it: the dApp is
            // right behind the sheet host and shows its own connected state.
            await waitFor(() => {
                expect(findButton('common.connect.label')).toBeUndefined()
            })
            expect(screen.queryByTestId(SUCCESS_SHEET_TEST_ID)).toBeNull()

            const stored = await getProvider().connections.store.get(
                connector.clientId,
            )
            expect(stored?.origin?.source).toBe('in-app')
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a browser-initiated pairing, when the user rejects it, then nothing is persisted and no success sheet appears',
        async () => {
            await mountProvider()
            const connector = await pairAndHandshake(
                'Rejected browser dApp',
                CHROME_ORIGIN,
            )

            await waitFor(() => {
                expect(findButton('common.cancel.label')).toBeTruthy()
            })
            await act(async () => {
                fireEvent.click(findButton('common.cancel.label')!)
            })

            await waitFor(() => {
                expect(connector.rejectSessionCalls).toBe(1)
            })
            expect(connector.approveSessionCalls).toHaveLength(0)
            expect(await getProvider().connections.store.list()).toEqual([])
            expect(screen.queryByTestId(SUCCESS_SHEET_TEST_ID)).toBeNull()
            expect(Linking.openURL).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
