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
import {
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import { http, HttpResponse } from 'msw'

// The escrow config is empty in the test env — mock a FULLY configured build:
// a non-empty base URL (any host; the MSW globs match any origin) so requests
// reach MSW instead of throwing CardEscrowNotConfiguredError, plus the chain
// app ids (a configured base URL with missing ids now throws by design, which
// would degrade every Auto run to Manual). `cardKillswitchAppId: '0'` is the
// documented dev-mock placeholder — satisfies the "all ids present" config
// check while `isKillswitchConfigured` treats it as NOT configured, so
// `enableAutoDraw` only registers the LSig (the leg this test covers) and
// skips the real on-chain Killswitch enable, which has no MSW mocks here.
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
            cardKillswitchAppId: '0',
        }),
    }
})

// The ARC-60 ownership-proof signer (Step 1) is left REAL and driven through
// the actual interactive review overlay — `useLocalKeyArc60Signer` is
// imported by a relative path inside packages/signing's own actor lifecycle,
// so a `@perawallet/wallet-core-signing` barrel mock never reaches it; it
// needs a genuinely KMS-backed key (seeded below via seedFundingSigner),
// exactly like sign-arc60.test.tsx. The LSig delegation signer (Step 3,
// `useProgramSigner`) IS consumed via the barrel by `useAutoDrawSwitch`
// directly, so stubbing it here is both valid and necessary — its junk
// bytes would otherwise fail `encodeDelegatedLsigAccount`'s signature check,
// so that's stubbed too.
vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
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
    mockCreateCard,
    mockApproveEscrowCard,
    mockPostDelegatorLsig,
} from '@perawallet/wallet-core-card/test-handlers'
import { mockAlgodTealCompile } from '@perawallet/wallet-core-blockchain/test-handlers'
import { useAppIntegrityStore } from '@perawallet/wallet-core-app-integrity'
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { CardOnboardingStatusScreen } from '@modules/card/screens/CardOnboardingStatusScreen'
import { CardCreateSigningScreen } from '@modules/card/screens/CardCreateSigningScreen'
import { CardAutoFundingSigningScreen } from '@modules/card/screens/CardAutoFundingSigningScreen'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'
import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
} from './__fixtures__/onboarding'

const FUNDING_ADDRESS = ALGO25_TEST_ADDRESS

let FUNDING_ACCOUNT: WalletAccount = {
    id: 'funding-account',
    type: AccountTypes.algo25,
    address: FUNDING_ADDRESS,
    keyPairId: '',
    name: 'Main Account',
}

// The ARC-60 ownership proof (Step 1) is signed for real through the
// interactive review overlay, so the account needs a KMS-backed key —
// mints one from the pinned test mnemonic, mirroring sign-arc60.test.tsx.
const seedFundingSigner = async (): Promise<void> => {
    resetTestKeystore()
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: Algo25KeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createAlgo25Key({
            mnemonic: ALGO25_TEST_MNEMONIC,
        })
        expect(keyResult).not.toBeNull()
    })
    FUNDING_ACCOUNT = {
        ...FUNDING_ACCOUNT,
        keyPairId: keyResult!.seedKey.id ?? '',
    }
}

// The setup checklist, plus the real downstream signing screens the create
// sequence now runs on (CardOnboardingSigning → CardCreateSigningScreen, and
// for Auto, CardOnboardingAutoFundingSigning → CardAutoFundingSigningScreen),
// and a stub Home tab so the terminal `finish()` (navigate to TabBar → Home)
// resolves without a registered tab navigator.
//
// `signOwnership`'s ARC-60 request is an INTERACTIVE_SOURCES source, so it
// only resolves once `SigningOverlays` (mounted here in a second, sibling
// render tree sharing the same global signing store — the established
// pattern, e.g. wc-sign-quantum-fee.test.tsx) renders the review sheet and
// its slide-to-confirm is tapped.
const renderStatus = () => {
    renderWithNavigation(() => <SigningOverlays />, 'CardSigningOverlaysHost')
    return renderWithNavigation(
        CardOnboardingStatusScreen,
        'CardOnboardingStatus',
        {
            additionalScreens: [
                { name: 'TabBar', component: () => null },
                {
                    name: 'CardOnboardingSigning',
                    component: CardCreateSigningScreen,
                },
                {
                    name: 'CardOnboardingAutoFundingSigning',
                    component: CardAutoFundingSigningScreen,
                },
            ],
        },
    )
}

const confirmArc60Signing = async () => {
    fireEvent.click(await screen.findByTestId('arc60-confirm-slide'))
}

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
    beforeEach(async () => {
        await seedFundingSigner()
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
        useAppIntegrityStore.getState().setRegistration({
            integrityToken: 'TEST_INTEGRITY_TOKEN',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            keyId: 'key',
            deviceId: 'device',
        })
    })
    afterEach(() => {
        server.resetHandlers()
        useAccountsStore.getState().setAccounts([])
        useAppIntegrityStore.getState().resetState()
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

    it('Given Manual is picked, when Create Pera Card is pressed, then the card is created, approved, and Manual persists', async () => {
        let createBody: Record<string, unknown> | null = null
        let approvalBody: Record<string, unknown> | null = null
        server.use(
            mockCreateCard({
                cardAddress: 'ESCROWCARD1',
                txId: 'TX1',
                onRequest: body => {
                    createBody = body
                },
            }),
            mockApproveEscrowCard({
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
        fireEvent.click(
            await screen.findByTestId('card-create-signing-proceed'),
        )
        await confirmArc60Signing()

        await waitFor(() => expect(approvalBody).not.toBeNull())
        expect(createBody).toEqual(
            expect.objectContaining({
                address: FUNDING_ADDRESS,
                currency: 'usdc',
            }),
        )
        expect(approvalBody).toEqual(
            expect.objectContaining({
                address: FUNDING_ADDRESS,
                blockchain: 'algorand',
                amount: '0',
                txId: 'TX1',
            }),
        )
        // The same ARC-60 proof is reused for both calls.
        expect(approvalBody).toEqual(
            expect.objectContaining({
                signData: (createBody as unknown as Record<string, unknown>)
                    .signData,
                signature: (createBody as unknown as Record<string, unknown>)
                    .signature,
            }),
        )
        await waitFor(() =>
            expect(useCardStore.getState().selectedFundingType).toBe(
                FundingType.Manual,
            ),
        )
        expect(useCardStore.getState().escrowCardAddress).toBe('ESCROWCARD1')
        expect(useCardStore.getState().escrowCardTxId).toBe('TX1')
        expect(useCardStore.getState().escrowCardApproved).toBe(true)
    })

    it('Given Auto is selected, when Create Pera Card is pressed, then creation, approval, and the LSig all post', async () => {
        let approvalBody: Record<string, unknown> | null = null
        let lsigBody: Record<string, unknown> | null = null
        server.use(
            mockAlgodTealCompile(),
            mockCreateCard({ cardAddress: 'ESCROWCARD1', txId: 'TX1' }),
            mockApproveEscrowCard({
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
        fireEvent.click(
            await screen.findByTestId('card-create-signing-proceed'),
        )
        await confirmArc60Signing()

        // Sign + create + approve land on the 'authorize' step; a second
        // Proceed tap navigates to the LSig approval screen.
        await waitFor(() => expect(approvalBody).not.toBeNull())
        await waitFor(() => {
            fireEvent.click(screen.getByTestId('card-create-signing-proceed'))
            expect(
                screen.queryByTestId('card-auto-funding-signing-confirm'),
            ).toBeTruthy()
        })
        fireEvent.click(screen.getByTestId('card-auto-funding-signing-confirm'))

        await waitFor(() => expect(lsigBody).not.toBeNull())
        expect(approvalBody).toEqual(expect.objectContaining({ txId: 'TX1' }))
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
        server.use(mockAlgodTealCompile(), mockCreateCard({ status: 500 }))

        renderStatus()

        fireEvent.click(
            await screen.findByTestId('card-onboarding-status-create-card'),
        )
        fireEvent.click(
            await screen.findByTestId('card-create-signing-proceed'),
        )
        await confirmArc60Signing()

        // The error is shown and the flow stays on the same step so Proceed
        // can retry — no navigation past it, no persistence.
        await waitFor(() =>
            expect(screen.getByTestId('card-create-signing')).toBeTruthy(),
        )
        expect(useCardStore.getState().selectedFundingType).toBeNull()
        expect(useCardStore.getState().escrowCardAddress).toBeNull()
    })

    it('Given the approval call fails after creation, then the card persists unapproved and no funding type is set', async () => {
        server.use(
            mockAlgodTealCompile(),
            mockCreateCard({ cardAddress: 'ESCROWCARD1', txId: 'TX1' }),
            mockApproveEscrowCard({ status: 500 }),
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
        fireEvent.click(
            await screen.findByTestId('card-create-signing-proceed'),
        )
        await confirmArc60Signing()

        // The card was created (on-chain, via the backend) and persisted
        // even though the AB approval call failed.
        await waitFor(() =>
            expect(useCardStore.getState().escrowCardAddress).toBe(
                'ESCROWCARD1',
            ),
        )
        expect(useCardStore.getState().escrowCardApproved).toBe(false)
        expect(useCardStore.getState().selectedFundingType).toBeNull()
    })

    it('Given the LSig leg fails after creation, when the user cancels, then the card persists approved and Auto degrades to Manual', async () => {
        server.use(
            mockAlgodTealCompile(),
            mockCreateCard({ cardAddress: 'ESCROWCARD1', txId: 'TX1' }),
            mockApproveEscrowCard({ cardAddress: 'ESCROWCARD1' }),
            mockPostDelegatorLsig({ status: 500 }),
        )

        renderStatus()

        fireEvent.click(
            await screen.findByTestId('card-onboarding-status-create-card'),
        )
        fireEvent.click(
            await screen.findByTestId('card-create-signing-proceed'),
        )
        await confirmArc60Signing()

        // Card is created + approved (persisted) before the authorize step.
        await waitFor(() =>
            expect(useCardStore.getState().escrowCardAddress).toBe(
                'ESCROWCARD1',
            ),
        )
        expect(useCardStore.getState().escrowCardApproved).toBe(true)

        await waitFor(() => {
            fireEvent.click(screen.getByTestId('card-create-signing-proceed'))
            expect(
                screen.queryByTestId('card-auto-funding-signing-confirm'),
            ).toBeTruthy()
        })
        fireEvent.click(screen.getByTestId('card-auto-funding-signing-confirm'))

        // The LSig POST fails; the screen surfaces the error and lets the
        // user retry rather than auto-degrading — Manual only persists once
        // the user explicitly cancels.
        await waitFor(() =>
            expect(
                (
                    screen.getByTestId(
                        'card-auto-funding-signing-cancel',
                    ) as HTMLButtonElement
                ).disabled,
            ).toBe(false),
        )
        expect(useCardStore.getState().selectedFundingType).toBeNull()

        fireEvent.click(screen.getByTestId('card-auto-funding-signing-cancel'))
        await waitFor(() =>
            expect(useCardStore.getState().selectedFundingType).toBe(
                FundingType.Manual,
            ),
        )
    })

    it('Given the kill-switch is off, then Auto shows the coming-soon hint and Create persists Manual', async () => {
        autoFunding.enabled = false
        server.use(
            mockCreateCard({ cardAddress: 'ESCROWCARD1', txId: 'TX1' }),
            mockApproveEscrowCard({ cardAddress: 'ESCROWCARD1' }),
        )

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
        fireEvent.click(
            await screen.findByTestId('card-create-signing-proceed'),
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
