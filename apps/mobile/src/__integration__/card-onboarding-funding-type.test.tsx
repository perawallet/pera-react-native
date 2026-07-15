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
// crypto so the Auto path (delegate → persist) stays real down to the wire.
vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
    useProgramSigner: () => ({
        signProgram: vi.fn(),
        signDelegatedLsig: vi.fn(async () => ({
            signedProgram: new Uint8Array([1, 2, 3]),
        })),
    }),
}))

// __DEV__ is false in the test env, so the kill-switch would default off (and
// migrate the Auto default to Manual). Force it on for the Auto flow; a
// dedicated test flips it off to cover the coming-soon / migration path.
const { autoFunding } = vi.hoisted(() => ({ autoFunding: { enabled: true } }))
vi.mock('@hooks/useIsCardAutoFundingEnabled', () => ({
    useIsCardAutoFundingEnabled: () => autoFunding.enabled,
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

import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    FundingType,
    OnboardingStep,
    useCardStore,
} from '@perawallet/wallet-core-card'
import {
    mockGetDelegationProgram,
    mockGetDelegationToken,
    mockPostAlgorandDelegationApproval,
} from '@perawallet/wallet-core-card/test-handlers'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingStatusScreen } from '@modules/card/screens/CardOnboardingStatusScreen'

const FUNDING_ADDRESS =
    'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'

const FUNDING_ACCOUNT: WalletAccount = {
    id: 'funding-account',
    type: AccountTypes.algo25,
    address: FUNDING_ADDRESS,
    keyPairId: 'funding-account-key',
    name: 'Main Account',
}

// The setup checklist with a stub Home tab so the "Create Pera Card" terminus
// (navigate to TabBar → Home) resolves without a registered tab navigator.
const renderStatus = () =>
    renderWithNavigation(CardOnboardingStatusScreen, 'CardOnboardingStatus', {
        additionalScreens: [{ name: 'TabBar', component: () => null }],
    })

const mockOnboardingDetails = (verificationState: string) =>
    server.use(
        http.get('*/v1/auth/register', () =>
            HttpResponse.json(
                { id: 'mock-onboarding-id', verificationState },
                { status: 200 },
            ),
        ),
    )

describe('Flow: Card onboarding — select funding type', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => {
        const store = useCardStore.getState()
        store.resetState()
        store.setOnboardingId('mock-onboarding-id')
        // Registration done + a funding source linked → the funding-type step
        // is the active (final) one.
        store.setOnboardingStep(OnboardingStep.Completed)
        store.setConnectedFundingSourceAddress(FUNDING_ADDRESS)
        mockOnboardingDetails('VERIFIED')
        autoFunding.enabled = true
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('Given funds are connected, then both funding-type options and the Create button show', async () => {
        renderStatus()

        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-status-funding-type-auto'),
            ).toBeTruthy(),
        )
        expect(
            screen.getByTestId('card-onboarding-status-funding-type-manual'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('card-onboarding-status-create-card'),
        ).toBeTruthy()
    })

    it('Given Manual is picked, when Create Pera Card is pressed, then the choice is persisted', async () => {
        renderStatus()

        fireEvent.click(
            await screen.findByTestId(
                'card-onboarding-status-funding-type-manual',
            ),
        )
        fireEvent.click(
            screen.getByTestId('card-onboarding-status-create-card'),
        )

        await waitFor(() =>
            expect(useCardStore.getState().selectedFundingType).toBe(
                FundingType.Manual,
            ),
        )
    })

    it('Given Auto is selected, when Create Pera Card is pressed, then the delegation posts before persisting', async () => {
        useAccountsStore.getState().setAccounts([FUNDING_ACCOUNT])
        let postBody: Record<string, unknown> | null = null
        server.use(
            mockGetDelegationProgram(),
            mockGetDelegationToken(),
            mockPostAlgorandDelegationApproval({
                onRequest: body => {
                    postBody = body
                },
            }),
        )

        renderStatus()

        // Auto is the default selection — go straight to Create.
        fireEvent.click(
            await screen.findByTestId('card-onboarding-status-create-card'),
        )

        await waitFor(() => expect(postBody).not.toBeNull())
        expect(postBody).toEqual(
            expect.objectContaining({
                address: FUNDING_ADDRESS,
                network: 'algorand',
                amount: '400',
            }),
        )
        await waitFor(() =>
            expect(useCardStore.getState().selectedFundingType).toBe(
                FundingType.Auto,
            ),
        )
    })

    it('Given the delegation fails, when Create Pera Card is pressed, then nothing is persisted', async () => {
        useAccountsStore.getState().setAccounts([FUNDING_ACCOUNT])
        server.use(
            mockGetDelegationProgram(),
            mockGetDelegationToken(),
            mockPostAlgorandDelegationApproval({ status: 400 }),
        )

        renderStatus()

        fireEvent.click(
            await screen.findByTestId('card-onboarding-status-create-card'),
        )

        // The Create button is still there (no navigation) and no persistence.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-status-create-card'),
            ).toBeTruthy(),
        )
        expect(useCardStore.getState().selectedFundingType).toBeNull()
    })

    it('Given the kill-switch is off, then Auto shows the coming-soon hint and Create persists Manual', async () => {
        autoFunding.enabled = false
        useAccountsStore.getState().setAccounts([FUNDING_ACCOUNT])

        renderStatus()

        const autoOption = await screen.findByTestId(
            'card-onboarding-status-funding-type-auto',
        )
        // Integration i18n renders keys, not copy.
        expect(autoOption.textContent).toContain(
            'funding_type_auto_coming_soon_hint',
        )

        // The Auto default migrated to Manual, so Create takes the
        // no-delegation path and persists Manual.
        fireEvent.click(
            screen.getByTestId('card-onboarding-status-create-card'),
        )
        await waitFor(() =>
            expect(useCardStore.getState().selectedFundingType).toBe(
                FundingType.Manual,
            ),
        )
    })

    it('Given funds are not connected, then the funding-type row stays inactive with no Create button', async () => {
        useCardStore.getState().setConnectedFundingSourceAddress(null)

        renderStatus()

        // findBy flushes the in-flight onboarding-details poll so its state
        // update lands inside act() rather than after teardown.
        expect(
            await screen.findByTestId('card-onboarding-status-funding-type'),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('card-onboarding-status-funding-type-auto'),
        ).toBeNull()
        expect(
            screen.queryByTestId('card-onboarding-status-create-card'),
        ).toBeNull()
    })
})
