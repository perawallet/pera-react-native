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

// The escrow config is empty in the test env — mock a FULLY configured build:
// a non-empty base URL (any host; the MSW globs match any origin) so requests
// reach MSW instead of throwing CardEscrowNotConfiguredError, plus the chain
// app ids (a configured base URL with missing ids now throws by design, which
// would degrade every Auto run to Manual).
vi.mock('@perawallet/wallet-core-config', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-config')
    >('@perawallet/wallet-core-config')
    return {
        ...actual,
        getNetworkConfig: (
            network: Parameters<typeof actual.getNetworkConfig>[0],
        ) => ({
            ...actual.getNetworkConfig(network),
            cardEscrowBaseUrl: 'https://escrow.test',
            cardEscrowAuthToken: 'TEST_ESCROW_TOKEN',
            cardW3CardAppId: '111',
            cardKillswitchAppId: '222',
        }),
    }
})

// The real signers need a provisioned KMS keystore; stub just the crypto so the
// create + delegation flow stays real down to the wire. `signProgram` returns
// junk bytes, so also stub `encodeDelegatedLsigAccount` (it would otherwise
// reject the unverifiable signature).
vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
    useArbitraryDataSigner: () => ({
        signArbitraryData: vi.fn(async () => [new Uint8Array([7, 7, 7])]),
    }),
    useProgramSigner: () => ({
        signProgram: vi.fn(async () => new Uint8Array([8, 8, 8])),
        signDelegatedLsig: vi.fn(),
    }),
    encodeDelegatedLsigAccount: () => new Uint8Array([9, 9, 9]),
}))

// __DEV__ is false in the test env, so the kill-switch would default off (and
// migrate the Auto default to Manual). Force it on for the Auto flow; a
// dedicated test flips it off to cover the coming-soon / migration path.
const { autoFunding } = vi.hoisted(() => ({ autoFunding: { enabled: true } }))
vi.mock('@hooks/useIsCardAutoFundingEnabled', () => ({
    useIsCardAutoFundingEnabled: () => autoFunding.enabled,
}))

// The consent + PIN gate is unit-tested in useAuthorizeCardDelegation.spec;
// pass through here so this test stays focused on the creation wire.
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

// Manual funding gates only on PIN; skip the PIN sheet here (unit-tested in
// useRequirePinVerification.spec).
vi.mock('@modules/security', async () => ({
    ...(await vi.importActual<object>('@modules/security')),
    useRequirePinVerification: () => ({
        requirePinVerification: vi.fn(async () => true),
    }),
}))

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
    mockCreateEscrowCard,
    mockPostDelegatorLsig,
} from '@perawallet/wallet-core-card/test-handlers'
import { mockAlgodTealCompile } from '@perawallet/wallet-core-blockchain/test-handlers'

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
        useAccountsStore.getState().setAccounts([FUNDING_ACCOUNT])
        mockOnboardingDetails('VERIFIED')
        autoFunding.enabled = true
    })
    afterEach(() => {
        server.resetHandlers()
        useAccountsStore.getState().setAccounts([])
    })
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

    it('Given Manual is picked, when Create Pera Card is pressed, then the card is created and Manual persists', async () => {
        let approvalBody: Record<string, unknown> | null = null
        server.use(
            mockCreateEscrowCard({
                cardAddress: 'ESCROWCARD1',
                onRequest: body => {
                    approvalBody = body
                },
            }),
        )

        renderStatus()

        fireEvent.click(
            await screen.findByTestId(
                'card-onboarding-status-funding-type-manual',
            ),
        )
        fireEvent.click(
            screen.getByTestId('card-onboarding-status-create-card'),
        )

        await waitFor(() => expect(approvalBody).not.toBeNull())
        expect(approvalBody).toEqual(
            expect.objectContaining({
                address: FUNDING_ADDRESS,
                blockchain: 'algorand',
                amount: '0',
            }),
        )
        await waitFor(() =>
            expect(useCardStore.getState().selectedFundingType).toBe(
                FundingType.Manual,
            ),
        )
        expect(useCardStore.getState().escrowCardAddress).toBe('ESCROWCARD1')
    })

    it('Given Auto is selected, when Create Pera Card is pressed, then creation and the LSig both post', async () => {
        let approvalBody: Record<string, unknown> | null = null
        let lsigBody: Record<string, unknown> | null = null
        server.use(
            mockAlgodTealCompile(),
            mockCreateEscrowCard({
                cardAddress: 'ESCROWCARD1',
                onRequest: body => {
                    approvalBody = body
                },
            }),
            mockPostDelegatorLsig({
                onRequest: body => {
                    lsigBody = body
                },
            }),
        )

        renderStatus()

        // Auto is the default selection — go straight to Create.
        fireEvent.click(
            await screen.findByTestId('card-onboarding-status-create-card'),
        )

        await waitFor(() => expect(approvalBody).not.toBeNull())
        await waitFor(() => expect(lsigBody).not.toBeNull())
        expect(lsigBody).toEqual(
            expect.objectContaining({
                delegatorAddress: FUNDING_ADDRESS,
                cardAddress: 'ESCROWCARD1',
                token: 'usdc',
                blockchain: 'algorand',
            }),
        )
        await waitFor(() =>
            expect(useCardStore.getState().selectedFundingType).toBe(
                FundingType.Auto,
            ),
        )
    })

    it('Given card creation fails, when Create Pera Card is pressed, then nothing is persisted', async () => {
        server.use(
            mockAlgodTealCompile(),
            mockCreateEscrowCard({ status: 500 }),
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
        expect(useCardStore.getState().escrowCardAddress).toBeNull()
    })

    it('Given the LSig leg fails after creation, then the card persists and Auto degrades to Manual', async () => {
        server.use(
            mockAlgodTealCompile(),
            mockCreateEscrowCard({ cardAddress: 'ESCROWCARD1' }),
            mockPostDelegatorLsig({ status: 500 }),
        )

        renderStatus()

        fireEvent.click(
            await screen.findByTestId('card-onboarding-status-create-card'),
        )

        // Card is created (persisted) but Auto downgraded to Manual.
        await waitFor(() =>
            expect(useCardStore.getState().escrowCardAddress).toBe(
                'ESCROWCARD1',
            ),
        )
        await waitFor(() =>
            expect(useCardStore.getState().selectedFundingType).toBe(
                FundingType.Manual,
            ),
        )
    })

    it('Given the kill-switch is off, then Auto shows the coming-soon hint and Create persists Manual', async () => {
        autoFunding.enabled = false
        server.use(mockCreateEscrowCard({ cardAddress: 'ESCROWCARD1' }))

        renderStatus()

        const autoOption = await screen.findByTestId(
            'card-onboarding-status-funding-type-auto',
        )
        // Integration i18n renders keys, not copy.
        expect(autoOption.textContent).toContain(
            'funding_type_auto_coming_soon_hint',
        )

        // The Auto default migrated to Manual, so Create takes the
        // Manual (create-only) path and persists Manual.
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
