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
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

// The switch orchestration (LSig POST + on-chain Killswitch enable/kill) is
// unit-tested in useAutoDrawSwitch.spec / useKillswitchAutoDraw.test; here we
// mock it at the hook boundary and keep the sheet → orchestration → store wire
// real. The consent gate passes through (unit-tested separately).
const { enableAutoDraw, disableAutoDraw } = vi.hoisted(() => ({
    enableAutoDraw: vi.fn(),
    disableAutoDraw: vi.fn(),
}))
vi.mock('@modules/card/hooks', async () => {
    const { passThroughAuthorizeDelegation } =
        await import('@test-utils/cardDelegation')
    return {
        ...(await vi.importActual<object>('@modules/card/hooks')),
        useAuthorizeCardDelegation: () => ({
            authorizeDelegation: passThroughAuthorizeDelegation,
        }),
        useAutoDrawSwitch: () => ({
            enableAutoDraw,
            disableAutoDraw,
            canSwitchToAuto: () => true,
            isPending: false,
        }),
    }
})

// Manual gates on PIN; skip the sheet (unit-tested in useRequirePinVerification).
vi.mock('@modules/security', async () => ({
    ...(await vi.importActual<object>('@modules/security')),
    useRequirePinVerification: () => ({
        requirePinVerification: vi.fn(async () => true),
    }),
}))

// __DEV__ is false in the test env, so the kill-switch would default off; force
// it on to exercise the Auto flow.
vi.mock('@hooks/useIsCardAutoFundingEnabled', () => ({
    useIsCardAutoFundingEnabled: () => true,
}))

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import {
    FundingType,
    useCardSessionStore,
    useCardStore,
} from '@perawallet/wallet-core-card'
import { PeraCardDetails } from '@modules/card/components/PeraCardDetails'

import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

const ACCOUNT: WalletAccount = {
    id: 'funding-account',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'funding-account-key',
    name: 'Main Account',
}

const CARD_ADDRESS = 'ESCROWCARDADDRESS1'

const activeCardStatus = http.get('*/v1/card/status', () =>
    HttpResponse.json(
        {
            id: 'card_1',
            panLast4: '4242',
            status: 'ACTIVE',
            type: 'VIRTUAL',
            orderedAt: '2026-06-23T09:39:30.771Z',
        },
        { status: 200 },
    ),
)

const openFundingTypeSheet = async () => {
    fireEvent.click(
        await screen.findByTestId('pera_card_change_funding_type_button'),
    )
    expect(
        await screen.findByTestId('card_select_funding_type_sheet'),
    ).toBeTruthy()
}

describe('Flow: Card funding type switch', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => {
        useAccountsStore.getState().setAccounts([ACCOUNT])
        useAccountsStore.getState().setSelectedAccountAddress(ACCOUNT.address)
        const store = useCardStore.getState()
        store.resetState()
        store.setConnectedFundingSourceAddress(ACCOUNT.address)
        // A card exists for the connected account on the active network.
        store.setEscrowCard({
            cardAddress: CARD_ADDRESS,
            ownerAddress: ACCOUNT.address,
            network: useNetworkStore.getState().network,
            txId: 'CARD_TX_ID',
        })
        useCardSessionStore.getState().setAuthenticated(true)
        server.use(activeCardStatus)
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('disables auto-draw and persists Manual when switching Auto → Manual', async () => {
        useCardStore.getState().setSelectedFundingType(FundingType.Auto)

        renderWithNavigation(PeraCardDetails, 'CardDetails')
        await openFundingTypeSheet()

        fireEvent.click(screen.getByTestId('card_funding_type_option_manual'))
        fireEvent.click(screen.getByTestId('card_funding_type_apply_button'))

        await waitFor(() => expect(disableAutoDraw).toHaveBeenCalled())
        await waitFor(() =>
            expect(useCardStore.getState().selectedFundingType).toBe(
                FundingType.Manual,
            ),
        )
        expect(
            (await screen.findByTestId('pera_card_funding_type_row'))
                .textContent,
        ).toContain('funding_type_manual_title')
    })

    it('enables auto-draw against the escrow card when switching Manual → Auto', async () => {
        useCardStore.getState().setSelectedFundingType(FundingType.Manual)

        renderWithNavigation(PeraCardDetails, 'CardDetails')
        await openFundingTypeSheet()

        fireEvent.click(screen.getByTestId('card_funding_type_option_auto'))
        fireEvent.click(screen.getByTestId('card_funding_type_apply_button'))

        await waitFor(() =>
            expect(enableAutoDraw).toHaveBeenCalledWith(
                expect.objectContaining({ address: ACCOUNT.address }),
                CARD_ADDRESS,
            ),
        )
        await waitFor(() =>
            expect(useCardStore.getState().selectedFundingType).toBe(
                FundingType.Auto,
            ),
        )
    })

    it('shows both funding selectors even when no funding account is linked', async () => {
        useCardStore.getState().setConnectedFundingSourceAddress(null)

        renderWithNavigation(PeraCardDetails, 'CardDetails')

        expect(
            await screen.findByTestId('pera_card_funding_type_row'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('pera_card_funding_account_row').textContent,
        ).toContain('no_funding_account')
        expect(
            screen.getByTestId('pera_card_change_funding_button').textContent,
        ).toContain('connect')
    })

    // Re-linking has no robust implementation yet, so a linked account offers
    // no way to change it. The funding TYPE selector is unaffected.
    it('offers no way to change the funding account once one is linked', async () => {
        renderWithNavigation(PeraCardDetails, 'CardDetails')

        // Awaiting the funding-type row first proves the section finished
        // rendering, so the missing Change link below is a real absence.
        expect(
            await screen.findByTestId('pera_card_change_funding_type_button'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('pera_card_funding_account_row').textContent,
        ).not.toContain('no_funding_account')
        expect(
            screen.queryByTestId('pera_card_change_funding_button'),
        ).toBeNull()
    })

    it('keeps the sheet open and skips the store write on failure', async () => {
        useCardStore.getState().setSelectedFundingType(FundingType.Manual)
        enableAutoDraw.mockRejectedValueOnce(new Error('chain down'))

        renderWithNavigation(PeraCardDetails, 'CardDetails')
        await openFundingTypeSheet()

        fireEvent.click(screen.getByTestId('card_funding_type_option_auto'))
        fireEvent.click(screen.getByTestId('card_funding_type_apply_button'))

        await waitFor(() => expect(enableAutoDraw).toHaveBeenCalled())
        // The sheet stays open for a retry and nothing was persisted.
        expect(
            screen.getByTestId('card_select_funding_type_sheet'),
        ).toBeTruthy()
        expect(useCardStore.getState().selectedFundingType).toBe(
            FundingType.Manual,
        )
    })
})
