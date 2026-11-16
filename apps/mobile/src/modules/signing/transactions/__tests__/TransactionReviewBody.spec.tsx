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

import React, { type ComponentProps } from 'react'
import { Decimal } from 'decimal.js'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { screen } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
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
import { PWText } from '@components/core'
import { TransactionReviewBody } from '../TransactionReviewBody'

const REVIEW_ACTIONS = <PWText testID='review_actions_probe' />

// The global mock stubs the blockchain barrel; the bodies classify with the real utils.
vi.mock('@perawallet/wallet-core-chain-algorand/blockchain', async () => ({
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/utils/transactions')
    >('@packages/chain-algorand/src/blockchain/utils/transactions')),
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/models/transaction-view')
    >('@packages/chain-algorand/src/blockchain/models/transaction-view')),
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/utils/warnings')
    >('@packages/chain-algorand/src/blockchain/utils/warnings')),
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/utils/addresses')
    >('@packages/chain-algorand/src/blockchain/utils/addresses')),
}))

vi.mock('@perawallet/wallet-core-names', () => ({
    useNameForAddressQuery: () => ({ data: undefined }),
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
    allTransactions: [] as AlgorandTransactionView[],
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
    transaction: TransactionNative,
    origin: { source?: SignRequestSource; verifiedOrigin?: string } = {},
) => {
    mockPipeline.allTransactions = [
        transaction.transaction as AlgorandTransactionView,
    ]
    const Review = () => (
        <TransactionReviewBody
            actions={REVIEW_ACTIONS}
            transaction={transaction}
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
        header: ['transactions.list_item.send', FIXTURE_RECEIVER],
    },
    'asset-transfer': {
        icon: 'icon-transactions/asset-transfer',
        header: ['transactions.list_item.send', FIXTURE_RECEIVER],
    },
    'asset-config': {
        icon: 'icon-transactions/asset-config',
        header: ['transactions.list_item.asset_config'],
    },
    'asset-freeze': {
        icon: 'icon-transactions/asset-freeze',
        header: ['transactions.list_item.asset_freeze'],
    },
    'key-registration': {
        icon: 'icon-transactions/key-registration',
        header: ['transactions.list_item.key_registration'],
    },
    'app-call': {
        icon: 'icon-transactions/application-call',
        header: [
            'transactions.list_item.app_call',
            'transactions.summary.app_id',
        ],
    },
    heartbeat: {
        icon: 'icon-transactions/key-registration',
        header: ['transactions.list_item.heartbeat'],
    },
    'state-proof': {
        icon: 'icon-transactions/generic',
        header: ['transactions.list_item.state_proof'],
    },
    unknown: {
        icon: 'icon-transactions/generic',
        header: ['transactions.list_item.default'],
    },
}

// lanekeep-ignore-next-line pera/no-module-component-specs reason: asserts what the user sees before signing, the security boundary of the review
describe('TransactionReviewBody', () => {
    beforeEach(() => {
        mockPipeline.distinctWarnings = []
        mockPipeline.warnings = []
        vi.mocked(useFindAccountByAddress).mockImplementation(address =>
            address === FIXTURE_SENDER
                ? ({
                      id: 'signer',
                      name: SIGNER_NAME,
                      custody: { kind: 'watch' },
                      chains: { algorand: { address } },
                  } as ReturnType<typeof useFindAccountByAddress>)
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

        it('renders the signing account in the From row', () => {
            expect(screen.getByText('transactions.common.from')).toBeTruthy()
            expect(screen.getByText(SIGNER_NAME)).toBeTruthy()
        })

        it('renders the fee and the link to the technical details', () => {
            expect(screen.getByText('signing.review.network_fee')).toBeTruthy()
            expect(screen.getAllByText(/0\.001/).length).toBeGreaterThan(0)
            expect(
                screen.getByText('signing.review.technical_details'),
            ).toBeTruthy()
        })

        it('renders the key registration summary only for a key registration', () => {
            expect(!!screen.queryByText('transactions.key_reg.status')).toBe(
                kind === 'key-registration',
            )
        })
    })

    it.each([
        ['opt-in', 'transactions.list_item.opt_in'],
        ['opt-out', 'transactions.list_item.opt_out'],
        ['clawback', 'signing.review.title_clawback'],
    ] as const)('titles an asset %s with its own verb', (variant, title) => {
        renderReview(buildAlgorandAssetTransferFixture(variant))

        expect(screen.getByText(title)).toBeTruthy()
        expect(screen.getByText('signing.review.network_fee')).toBeTruthy()
    })

    it('renders nothing for a family with no registered body', () => {
        const { container } = renderWithNavigation(
            () => (
                <TransactionReviewBody
                    actions={REVIEW_ACTIONS}
                    transaction={
                        {
                            family: 'unregistered',
                            transaction: {},
                        } as unknown as ComponentProps<
                            typeof TransactionReviewBody
                        >['transaction']
                    }
                />
            ),
            'Review',
        )

        expect(container.textContent).toBe('')
        expect(screen.queryByTestId('review_actions_probe')).toBeNull()
    })

    it('shows the requesting site by its domain, never the name it gives itself, and the origin the platform observed', () => {
        renderReview(buildAlgorandDisplayFixture('payment'), {
            source: { name: 'Fixture dApp', url: 'https://dapp.test' },
            verifiedOrigin: 'https://elsewhere.test',
        })

        expect(screen.queryByText('Fixture dApp')).toBeNull()
        expect(screen.getByText('dapp.test')).toBeTruthy()
        expect(screen.getByText('dapp.approval.request_origin')).toBeTruthy()
    })

    it('places the warnings between the action and the From row', () => {
        const warning: TransactionWarning = {
            type: 'close-account',
            senderAddress: FIXTURE_SENDER,
            targetAddress: FIXTURE_RECEIVER,
        }
        mockPipeline.distinctWarnings = [warning]
        mockPipeline.warnings = [warning]
        renderReview(buildAlgorandDisplayFixture('payment'))

        const header = screen.getByTestId('review_action_title')
        const warnings = screen.getByText('transactions.warning.title')
        const account = screen.getByText('transactions.common.from')
        expect(
            header.compareDocumentPosition(warnings) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
        expect(
            warnings.compareDocumentPosition(account) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
    })

    it("puts the fee ahead of a key registration's summary", () => {
        renderReview(buildAlgorandDisplayFixture('key-registration'))

        expect(
            screen
                .getByText('signing.review.network_fee')
                .compareDocumentPosition(
                    screen.getByText('transactions.key_reg.status'),
                ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
    })

    it('still renders the action and fee when the signer is not in the wallet', () => {
        vi.mocked(useFindAccountByAddress).mockReturnValue(null)
        renderReview(buildAlgorandDisplayFixture('payment'))

        expect(screen.queryByText('transactions.common.from')).toBeNull()
        expect(screen.getByText('transactions.list_item.send')).toBeTruthy()
        expect(screen.getByText('signing.review.network_fee')).toBeTruthy()
    })
})
