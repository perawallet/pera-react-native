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

import type { ReactNode } from 'react'
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    AccountTypes,
    useAccountsStore,
    type AccountBalances,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { mockAlgodTransactionParams } from '@perawallet/wallet-core-blockchain/test-handlers'
import { BidaliAccountSelectionScreen } from '@modules/gift-card/screens/BidaliAccountSelectionScreen'
import { useBidali } from '@modules/gift-card/hooks/useBidali'
import { useBidaliTransport } from '@modules/gift-card/hooks/useBidaliTransport'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

const ACCOUNT_A: WalletAccount = {
    id: 'gift-card-a',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'gift-card-a-key',
    name: 'Spending',
}

const ACCOUNT_B: WalletAccount = {
    id: 'gift-card-b',
    type: AccountTypes.watch,
    address: HD_TEST_ADDRESS,
    name: 'Vault',
}

const EMPTY_BALANCES: AccountBalances = new Map()

const bidaliRPC = (method: string, params?: Record<string, unknown>) => ({
    jsonrpc: '2.0' as const,
    method,
    params,
    id: `bidali-${Date.now()}`,
})

// The selection screen renders the account name inside AccountWithBalance
// wrapped in a PWTouchableOpacity (mocked as <button>) with no per-row
// testID — walk the DOM by name to find the row to tap.
const tapAccountRow = (accountName: string) => {
    const matches = screen.getAllByText((_, node) =>
        (node?.textContent ?? '').includes(accountName),
    )
    const leaf = matches.find(el => el.children.length === 0) ?? matches[0]
    const button = leaf.closest('button')
    if (!button) {
        throw new Error(`Row not found for account "${accountName}"`)
    }
    fireEvent.click(button)
}

const WebViewProbe = () => <div data-testid='bidali-webview-screen' />

// useSigningRequest / useBidaliTransport pull in useSigningActorLifecycle,
// which calls useQueryClient — a QueryClientProvider must be present.
const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>
        {children}
    </QueryClientProvider>
)

const drainSigningRequests = () => {
    const { result } = renderHook(() => useSigningRequest(), {
        wrapper: Wrapper,
    })
    for (const request of result.current.pendingSignRequests) {
        result.current.removeSignRequest(request)
    }
}

const getPendingSignRequests = () =>
    renderHook(() => useSigningRequest(), { wrapper: Wrapper }).result.current
        .pendingSignRequests

describe('Flow: Gift card (Bidali)', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        renderHook(() => useBidali()).result.current.reset()
        drainSigningRequests()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        drainSigningRequests()
    })

    it(
        'Given two accounts on the Bidali account-selection screen, when the user taps one, then it is recorded as the selected Bidali account and the flow advances to the web view',
        async () => {
            useAccountsStore.getState().setAccounts([ACCOUNT_A, ACCOUNT_B])

            renderWithNavigation(
                BidaliAccountSelectionScreen,
                'BidaliAccountSelection',
                {
                    additionalScreens: [
                        { name: 'BidaliWebView', component: WebViewProbe },
                    ],
                },
            )

            tapAccountRow(ACCOUNT_B.name as string)

            await waitFor(() => {
                expect(screen.getByTestId('bidali-webview-screen')).toBeTruthy()
            })

            const { result } = renderHook(() => useBidali())
            expect(result.current.selectedAccount?.address).toBe(
                ACCOUNT_B.address,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it('Given a selected account, when a malformed Bidali payment request arrives (bad address), then no sign request is enqueued', async () => {
        const { result } = renderHook(
            () => useBidaliTransport(ACCOUNT_A, EMPTY_BALANCES),
            { wrapper: Wrapper },
        )

        await act(async () => {
            result.current.handleMessage(
                bidaliRPC('bidaliPaymentRequest', {
                    address: 'not-a-valid-address',
                    amount: '1.5',
                    protocol: 'algorand',
                }),
            )
        })

        expect(getPendingSignRequests()).toHaveLength(0)
    })

    it('Given a selected account, when a Bidali payment request uses an unsupported protocol, then no sign request is enqueued', async () => {
        const { result } = renderHook(
            () => useBidaliTransport(ACCOUNT_A, EMPTY_BALANCES),
            { wrapper: Wrapper },
        )

        await act(async () => {
            result.current.handleMessage(
                bidaliRPC('bidaliPaymentRequest', {
                    address: HD_TEST_ADDRESS,
                    amount: '1.5',
                    protocol: 'bitcoin',
                }),
            )
        })

        expect(getPendingSignRequests()).toHaveLength(0)
    })

    it(
        'Given a selected account, when a well-formed ALGO Bidali payment request arrives, then a transactions sign request is enqueued',
        async () => {
            server.use(mockAlgodTransactionParams())

            const { result } = renderHook(
                () => useBidaliTransport(ACCOUNT_A, EMPTY_BALANCES),
                { wrapper: Wrapper },
            )

            await act(async () => {
                result.current.handleMessage(
                    bidaliRPC('bidaliPaymentRequest', {
                        address: HD_TEST_ADDRESS,
                        amount: '1.5',
                        protocol: 'algorand',
                    }),
                )
            })

            await waitFor(() => {
                const requests = getPendingSignRequests()
                expect(requests).toHaveLength(1)
                expect(requests[0].type).toBe('transactions')
                expect(requests[0].sourceType).toBe('gift-card')
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
