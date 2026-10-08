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

import React from 'react'
import { Decimal } from 'decimal.js'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { screen } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-contract'
import type {
    SignRequestSource,
    TransactionWarning,
} from '@perawallet/wallet-core-signing'
import {
    ALGORAND_DISPLAY_FIXTURE_KINDS,
    buildAlgorandAssetTransferFixture,
    buildAlgorandDisplayFixture,
    FIXTURE_RECEIVER,
    FIXTURE_SENDER,
    type AlgorandDisplayFixtureKind,
} from '@test-utils/algorand-display-fixtures'
import { TransactionReviewBody } from '../TransactionReviewBody'

// The global mock stubs the blockchain barrel; the bodies classify with the real utils.
vi.mock('@perawallet/wallet-core-chain-algorand/blockchain', async () => ({
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/utils/transactions')
    >('@packages/chain-algorand/src/blockchain/utils/transactions')),
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/utils/addresses')
    >('@packages/chain-algorand/src/blockchain/utils/addresses')),
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdForAddressQuery: () => ({ data: undefined }),
}))

vi.mock('@perawallet/wallet-core-projects', async () => ({
    ...(await vi.importActual<
        typeof import('@packages/projects/src/utils/verification')
    >('@packages/projects/src/utils/verification')),
    useProjectByUrlQuery: () => ({ data: null, isLoading: false }),
    useApplicationQuery: () => ({ data: null, isLoading: false }),
}))

// Balance rendering has its own spec; here the signing account's identity is what matters.
vi.mock('@components/AccountWithBalance', async () => {
    const { PWText } =
        await vi.importActual<typeof import('@components/core')>(
            '@components/core',
        )
    return {
        AccountWithBalance: ({ account }: { account: { name: string } }) => (
            <PWText>{account.name}</PWText>
        ),
    }
})

const mockPipeline = {
    currentRequest: null,
    allTransactions: [] as PeraDisplayableTransaction[],
    signableAddresses: new Set<string>(),
    totalFee: new Decimal('0.001'),
    distinctWarnings: [] as TransactionWarning[],
    warnings: [] as TransactionWarning[],
    feeAdjustments: [] as unknown[],
    resolved: null,
}
vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    useSigningPipeline: () => mockPipeline,
}))

const SIGNER_NAME = 'Fixture Signer'

// FeeDisplay navigates to the details screen, so the body mounts inside a navigator.
const renderReview = (
    transaction: PeraDisplayableTransaction,
    origin: { source?: SignRequestSource; verifiedOrigin?: string } = {},
) => {
    mockPipeline.allTransactions = [transaction]
    const Review = () => (
        <TransactionReviewBody
            transaction={{ family: 'algorand', transaction }}
            source={origin.source}
            verifiedOrigin={origin.verifiedOrigin}
        />
    )
    return renderWithNavigation(Review, 'Review')
}

type ReviewExpectation = {
    icon: string
    header: (string | RegExp)[]
}

const REVIEW_KINDS: Record<AlgorandDisplayFixtureKind, ReviewExpectation> = {
    payment: {
        icon: 'icon-transactions/payment',
        header: ['transactions.summary.payment_to', FIXTURE_RECEIVER, /2\.5/],
    },
    'asset-transfer': {
        icon: 'icon-transactions/asset-transfer',
        header: ['transactions.summary.transfer', FIXTURE_RECEIVER, /5000000/],
    },
    'asset-config': {
        icon: 'icon-transactions/asset-config',
        header: ['transactions.type.acfg'],
    },
    // No summary body has ever been wired for a freeze; the icon alone is today's header.
    'asset-freeze': { icon: 'icon-transactions/asset-freeze', header: [] },
    'key-registration': {
        icon: 'icon-transactions/key-registration',
        header: ['transactions.type.keyreg'],
    },
    'app-call': {
        icon: 'icon-transactions/application-call',
        header: ['transactions.type.appl', 'transactions.summary.app_id'],
    },
    heartbeat: {
        icon: 'icon-transactions/key-registration',
        header: ['transactions.type.hb'],
    },
    'state-proof': {
        icon: 'icon-transactions/generic',
        header: ['transactions.type.stpf'],
    },
    unknown: {
        icon: 'icon-transactions/generic',
        header: ['transactions.type.'],
    },
}

describe('TransactionReviewBody', () => {
    beforeEach(() => {
        mockPipeline.distinctWarnings = []
        mockPipeline.warnings = []
        vi.mocked(useFindAccountByAddress).mockImplementation(address =>
            address === FIXTURE_SENDER
                ? ({ address, name: SIGNER_NAME } as ReturnType<
                      typeof useFindAccountByAddress
                  >)
                : null,
        )
    })

    describe.each(ALGORAND_DISPLAY_FIXTURE_KINDS)('%s', kind => {
        const expected = REVIEW_KINDS[kind]

        beforeEach(() => {
            renderReview(buildAlgorandDisplayFixture(kind))
        })

        it('renders the summary header', () => {
            expect(screen.getByTestId(expected.icon)).toBeTruthy()
            for (const text of expected.header) {
                expect(screen.getAllByText(text).length).toBeGreaterThan(0)
            }
        })

        it('renders the signing account', () => {
            expect(
                screen.getByText('signing.transactions.signing_with'),
            ).toBeTruthy()
            expect(screen.getByText(SIGNER_NAME)).toBeTruthy()
        })

        it('renders the fee and the link to the full details', () => {
            expect(screen.getByText('transactions.common.tx_fee')).toBeTruthy()
            expect(screen.getByText(/0\.001/)).toBeTruthy()
            expect(screen.getByText('signing.view_details')).toBeTruthy()
        })

        it('renders the key registration summary only for a key registration', () => {
            expect(!!screen.queryByText('transactions.key_reg.status')).toBe(
                kind === 'key-registration',
            )
        })
    })

    it.each([
        ['opt-in', 'transactions.summary.opt_in'],
        ['opt-out', 'transactions.summary.opt_out'],
        ['clawback', 'transactions.summary.clawback'],
    ] as const)('titles an asset %s with its own summary', (variant, title) => {
        renderReview(buildAlgorandAssetTransferFixture(variant))

        expect(screen.getByText(title)).toBeTruthy()
        expect(screen.getByText('transactions.common.tx_fee')).toBeTruthy()
    })

    it('shows the requesting dApp and the origin the platform observed', () => {
        renderReview(buildAlgorandDisplayFixture('payment'), {
            source: { name: 'Fixture dApp', url: 'https://dapp.test' },
            verifiedOrigin: 'https://elsewhere.test',
        })

        expect(screen.getByText('Fixture dApp')).toBeTruthy()
        expect(screen.getByText('dapp.test')).toBeTruthy()
        expect(screen.getByText('dapp.approval.request_origin')).toBeTruthy()
    })

    it('renders no summary title for an asset freeze', () => {
        renderReview(buildAlgorandDisplayFixture('asset-freeze'))

        expect(screen.queryByText('transactions.type.afrz')).toBeNull()
    })

    it('places the warnings block between the header and the signing account', () => {
        const warning: TransactionWarning = {
            type: 'close-account',
            senderAddress: FIXTURE_SENDER,
            targetAddress: FIXTURE_RECEIVER,
        }
        mockPipeline.distinctWarnings = [warning]
        mockPipeline.warnings = [warning]
        renderReview(buildAlgorandDisplayFixture('payment'))

        const header = screen.getByText('transactions.summary.payment_to')
        const warnings = screen.getByText('transactions.warning.title')
        const account = screen.getByText('signing.transactions.signing_with')
        expect(
            header.compareDocumentPosition(warnings) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
        expect(
            warnings.compareDocumentPosition(account) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
    })

    it('still renders the header and fee when the signer is not in the wallet', () => {
        vi.mocked(useFindAccountByAddress).mockReturnValue(null)
        renderReview(buildAlgorandDisplayFixture('payment'))

        expect(
            screen.queryByText('signing.transactions.signing_with'),
        ).toBeNull()
        expect(screen.getByText('transactions.summary.payment_to')).toBeTruthy()
        expect(screen.getByText('transactions.common.tx_fee')).toBeTruthy()
    })
})
