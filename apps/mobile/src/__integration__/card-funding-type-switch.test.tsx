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

// The real program signer needs a provisioned KMS keystore; stub just the
// crypto so the flow (sheet → mutation → Baanx wire) stays real.
vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
    useProgramSigner: () => ({
        signProgram: vi.fn(),
        signDelegatedLsig: vi.fn(async () => ({
            signedProgram: new Uint8Array([1, 2, 3]),
        })),
    }),
}))

// __DEV__ is false in the test env, so the kill-switch would default off; force
// it on to exercise the Auto flow.
vi.mock('@hooks/useIsCardAutoFundingEnabled', () => ({
    useIsCardAutoFundingEnabled: () => true,
}))

// The consent + PIN gate is unit-tested in useAuthorizeCardDelegation.spec;
// pass through here so this test stays focused on the delegation wire.
vi.mock('@modules/card/hooks', async () => {
    const { passThroughAuthorizeDelegation } =
        await import('@test-utils/cardDelegation')
    return {
        ...(await vi.importActual<object>('@modules/card/hooks')),
        useAuthorizeCardDelegation: () => ({
            authorizeDelegation: passThroughAuthorizeDelegation,
        }),
    }
})

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    FundingType,
    useCardSessionStore,
    useCardStore,
} from '@perawallet/wallet-core-card'
import {
    mockGetDelegationProgram,
    mockGetDelegationToken,
    mockPostAlgorandDelegationApproval,
} from '@perawallet/wallet-core-card/test-handlers'
import { PeraCardDetails } from '@modules/card/components/PeraCardDetails'

import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

const ACCOUNT: WalletAccount = {
    id: 'funding-account',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'funding-account-key',
    name: 'Main Account',
}

const activeCardStatus = http.get('*/v1/card/status', () =>
    HttpResponse.json(
        { id: 'card_1', panLast4: '4242', status: 'ACTIVE', type: 'VIRTUAL' },
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
        useCardSessionStore.getState().setAuthenticated(true)
        server.use(
            activeCardStatus,
            mockGetDelegationProgram(),
            mockGetDelegationToken(),
        )
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('cancels the delegation with an allowance of 0 when switching Auto → Manual', async () => {
        useCardStore.getState().setSelectedFundingType(FundingType.Auto)
        let postBody: Record<string, unknown> | null = null
        server.use(
            mockPostAlgorandDelegationApproval({
                onRequest: body => {
                    postBody = body
                },
            }),
        )

        renderWithNavigation(PeraCardDetails, 'CardDetails')
        await openFundingTypeSheet()

        fireEvent.click(screen.getByTestId('card_funding_type_option_manual'))
        fireEvent.click(screen.getByTestId('card_funding_type_apply_button'))

        await waitFor(() => expect(postBody).not.toBeNull())
        expect(postBody).toEqual(
            expect.objectContaining({
                address: ACCOUNT.address,
                network: 'algorand',
                currency: 'usdc',
                amount: '0',
            }),
        )
        // The preference is only persisted after Baanx accepts.
        await waitFor(() =>
            expect(useCardStore.getState().selectedFundingType).toBe(
                FundingType.Manual,
            ),
        )
        // The Funding Type row reflects the new mode (test i18n renders keys).
        expect(
            (await screen.findByTestId('pera_card_funding_type_row'))
                .textContent,
        ).toContain('funding_type_manual_title')
    })

    it('signs and posts a fresh delegation when switching Manual → Auto', async () => {
        useCardStore.getState().setSelectedFundingType(FundingType.Manual)
        let postBody: Record<string, unknown> | null = null
        server.use(
            mockPostAlgorandDelegationApproval({
                onRequest: body => {
                    postBody = body
                },
            }),
        )

        renderWithNavigation(PeraCardDetails, 'CardDetails')
        await openFundingTypeSheet()

        fireEvent.click(screen.getByTestId('card_funding_type_option_auto'))
        fireEvent.click(screen.getByTestId('card_funding_type_apply_button'))

        await waitFor(() => expect(postBody).not.toBeNull())
        expect(postBody).toEqual(
            expect.objectContaining({
                address: ACCOUNT.address,
                amount: '400',
                // base64 of the stubbed signed LSig bytes [1, 2, 3].
                signedProgram: 'AQID',
            }),
        )
        expect((postBody as Record<string, unknown> | null)?.token).toBeTruthy()
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
        // The account row offers Connect instead of hiding.
        expect(
            screen.getByTestId('pera_card_funding_account_row').textContent,
        ).toContain('no_funding_account')
        expect(
            screen.getByTestId('pera_card_change_funding_button').textContent,
        ).toContain('connect')
    })

    it('keeps the sheet open and skips the store write when Baanx rejects', async () => {
        useCardStore.getState().setSelectedFundingType(FundingType.Auto)
        server.use(mockPostAlgorandDelegationApproval({ status: 400 }))

        renderWithNavigation(PeraCardDetails, 'CardDetails')
        await openFundingTypeSheet()

        fireEvent.click(screen.getByTestId('card_funding_type_option_manual'))
        fireEvent.click(screen.getByTestId('card_funding_type_apply_button'))

        // The sheet stays open for a retry and nothing was persisted.
        await waitFor(() =>
            expect(
                screen.getByTestId('card_select_funding_type_sheet'),
            ).toBeTruthy(),
        )
        expect(useCardStore.getState().selectedFundingType).toBe(
            FundingType.Auto,
        )
    })
})
