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

import { Decimal } from 'decimal.js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@test-utils/render'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import {
    ETHEREUM_FIXTURE_CONTRACT_CALL_DATA,
    ETHEREUM_FIXTURE_NFT_ID,
    ETHEREUM_FIXTURE_RECIPIENT,
    ETHEREUM_FIXTURE_SENDER,
    ETHEREUM_FIXTURE_TOKEN,
    reviewEthereumFixture,
    type EthereumDisplayFixtureKind,
} from '@test-utils/ethereum-display-fixtures'
import { TransactionDetailBody } from '@modules/signing/transactions/TransactionDetailBody'
import { TransactionPreviewRow } from '@modules/signing/transactions/TransactionPreviewRow'
import { TransactionReviewBody } from '@modules/signing/transactions/TransactionReviewBody'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<typeof import('@react-navigation/native')>()),
    useNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainCapability: vi.fn(),
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

// Balance rendering has its own spec; here the chain it is asked to read is what matters.
vi.mock('@components/AccountWithBalance', async () => {
    const { PWText } =
        await vi.importActual<typeof import('@components/core')>(
            '@components/core',
        )
    return {
        AccountWithBalance: ({
            account,
            chainId,
        }: {
            account: { name: string }
            chainId: string
        }) => <PWText>{`${account.name}:${chainId}`}</PWText>,
    }
})

vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    useSigningPipeline: () => ({
        currentRequest: null,
        allTransactions: [],
        signableAddresses: new Set<string>(),
        totalFee: new Decimal(0),
        distinctWarnings: [],
        warnings: [],
        feeAdjustments: [],
        resolved: null,
    }),
}))

const USDC = {
    assetId: ETHEREUM_FIXTURE_TOKEN,
    decimals: 6,
    unitName: 'USDC',
}

const SIGNER_NAME = 'Fixture Signer'
const SHORT_RECIPIENT = truncateAlgorandAddress(ETHEREUM_FIXTURE_RECIPIENT)
const SHORT_TOKEN = truncateAlgorandAddress(ETHEREUM_FIXTURE_TOKEN)
const COLLAPSED_CALL_DATA = `${ETHEREUM_FIXTURE_CONTRACT_CALL_DATA.slice(0, 74)}...`

const natives = {} as Record<EthereumDisplayFixtureKind, TransactionNative>

const textOf = (testID: string) => screen.getByTestId(testID).textContent ?? ''

// lanekeep-ignore-next-line pera/no-module-component-specs reason: asserts what the user sees before signing, the security boundary of the review
describe('Ethereum transaction bodies', () => {
    beforeAll(async () => {
        registerEthereumChain()
        for (const kind of [
            'transfer',
            'token-transfer',
            'nft-transfer',
            'contract-call',
            'approval',
            'contract-creation',
        ] as const) {
            natives[kind] = await reviewEthereumFixture(kind)
        }
    })

    beforeEach(() => {
        mockNavigate.mockClear()
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: USDC,
            isPending: false,
        } as unknown as ReturnType<typeof useSingleAssetDetailsQuery>)
        vi.mocked(useFindAccountByAddress).mockReturnValue(null)
        vi.mocked(useChainCapability).mockReturnValue(false)
    })

    describe('review', () => {
        it('shows a transfer as a send of 1 ETH with its max fee and no warning', () => {
            render(<TransactionReviewBody transaction={natives.transfer} />)

            expect(screen.getByText('transactions.list_item.send')).toBeTruthy()
            expect(screen.getByText(SHORT_RECIPIENT)).toBeTruthy()
            expect(textOf('ethereum_review_amount')).toMatch(/ETH.*1/)
            expect(textOf('ethereum_max_fee')).toContain('0.00042')
            expect(
                screen.queryByTestId('ethereum_contract_call_warning'),
            ).toBeNull()
        })

        it('shows a token transfer in the token, with its contract in the Asset row', () => {
            render(
                <TransactionReviewBody
                    transaction={natives['token-transfer']}
                />,
            )

            expect(textOf('ethereum_review_amount')).toMatch(/USDC.*5/)
            expect(textOf('ethereum_review_asset')).toContain('USDC')
            expect(textOf('ethereum_review_asset')).toContain(SHORT_TOKEN)
        })

        it('shows an NFT transfer as the NFT, with no fiat, contract-call details or warning', () => {
            vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
                data: {
                    assetId: ETHEREUM_FIXTURE_NFT_ID,
                    decimals: 0,
                    unitName: 'BAYC',
                    peraMetadata: {
                        collectible: { collection: { name: 'Apes' } },
                    },
                },
                isPending: false,
            } as unknown as ReturnType<typeof useSingleAssetDetailsQuery>)

            render(
                <TransactionReviewBody transaction={natives['nft-transfer']} />,
            )

            expect(screen.getByText('transactions.list_item.send')).toBeTruthy()
            expect(screen.getByText(SHORT_RECIPIENT)).toBeTruthy()
            expect(textOf('ethereum_review_amount')).toMatch(/BAYC.*1/)
            expect(textOf('ethereum_review_nft')).toContain(
                'transactions.list_item.nft_subtitle',
            )
            expect(
                screen.queryByTestId('ethereum_contract_call_warning'),
            ).toBeNull()
            expect(
                screen.queryByTestId('ethereum_contract_call_selector'),
            ).toBeNull()
        })

        it('explains nothing about an unrecognised call and shows its raw facts', () => {
            render(
                <TransactionReviewBody
                    transaction={natives['contract-call']}
                />,
            )

            expect(
                screen.getByText('transactions.list_item.contract_call'),
            ).toBeTruthy()
            expect(textOf('ethereum_contract_call_warning')).toContain(
                'transactions.contract_call.warning',
            )
            expect(textOf('ethereum_contract_call_selector')).toContain(
                '0x5ae401dc',
            )
            expect(textOf('ethereum_contract_call_to')).toContain(SHORT_TOKEN)
            expect(screen.queryByTestId('ethereum_review_amount')).toBeNull()
        })

        it('collapses long calldata and expands it on request', () => {
            render(
                <TransactionReviewBody
                    transaction={natives['contract-call']}
                />,
            )

            expect(textOf('ethereum_contract_call_data')).toContain(
                COLLAPSED_CALL_DATA,
            )
            expect(textOf('ethereum_contract_call_data')).toContain(
                'common.show_more',
            )

            fireEvent.click(screen.getByText('common.show_more'))

            expect(textOf('ethereum_contract_call_data')).toContain(
                ETHEREUM_FIXTURE_CONTRACT_CALL_DATA,
            )
            expect(textOf('ethereum_contract_call_data')).toContain(
                'common.show_less',
            )
        })

        it("shows a held signer on Ethereum's chain, and no caption without one", () => {
            vi.mocked(useFindAccountByAddress).mockImplementation(address =>
                address === ETHEREUM_FIXTURE_SENDER
                    ? ({
                          id: 'signer',
                          name: SIGNER_NAME,
                          custody: { kind: 'watch' },
                          chains: { ethereum: { address } },
                      } as ReturnType<typeof useFindAccountByAddress>)
                    : null,
            )
            const held = render(
                <TransactionReviewBody transaction={natives.transfer} />,
            )

            expect(
                screen.getByText('signing.transactions.signing_with'),
            ).toBeTruthy()
            expect(screen.getByText(`${SIGNER_NAME}:ethereum`)).toBeTruthy()

            held.unmount()
            vi.mocked(useFindAccountByAddress).mockReturnValue(null)
            render(<TransactionReviewBody transaction={natives.transfer} />)

            expect(
                screen.queryByText('signing.transactions.signing_with'),
            ).toBeNull()
        })

        it('shows the requesting dApp when a source is given', () => {
            const source: SignRequestSource = {
                name: 'Fixture dApp',
                url: 'https://dapp.test',
            }

            render(
                <TransactionReviewBody
                    transaction={natives.transfer}
                    source={source}
                />,
            )

            expect(screen.getByText('Fixture dApp')).toBeTruthy()
        })

        it('opens the transaction details from the review', () => {
            render(<TransactionReviewBody transaction={natives.transfer} />)

            fireEvent.click(screen.getByTestId('ethereum_view_details'))

            expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
                scope: expect.objectContaining({ chainId: 'ethereum' }),
                transaction: natives.transfer,
            })
        })

        it('renders nothing for an Ethereum native it cannot read', () => {
            const { container } = render(
                <TransactionReviewBody
                    transaction={{ family: 'evm', transaction: {} }}
                />,
            )

            expect(container.textContent).toBe('')
        })
    })

    describe('detail', () => {
        it('lists a transfer by sender, recipient, amount and max fee', () => {
            render(<TransactionDetailBody transaction={natives.transfer} />)

            expect(textOf('ethereum_detail_from')).toContain(
                truncateAlgorandAddress(ETHEREUM_FIXTURE_SENDER),
            )
            expect(textOf('ethereum_detail_to')).toContain(SHORT_RECIPIENT)
            expect(textOf('ethereum_detail_amount')).toMatch(/ETH.*1/)
            expect(textOf('ethereum_max_fee')).toContain('0.00042')
            expect(screen.queryByTestId('ethereum_detail_asset')).toBeNull()
        })

        it('adds the Asset row for a token transfer', () => {
            render(
                <TransactionDetailBody
                    transaction={natives['token-transfer']}
                />,
            )

            expect(textOf('ethereum_detail_asset')).toContain('USDC')
            expect(textOf('ethereum_detail_amount')).toMatch(/USDC.*5/)
        })

        it('shows an unrecognised call as its warning, selector, collapsed calldata, target and zero value', () => {
            render(
                <TransactionDetailBody
                    transaction={natives['contract-call']}
                />,
            )

            expect(
                screen.getByTestId('ethereum_contract_call_warning'),
            ).toBeTruthy()
            expect(textOf('ethereum_contract_call_selector')).toContain(
                '0x5ae401dc',
            )
            expect(textOf('ethereum_contract_call_data')).toContain(
                COLLAPSED_CALL_DATA,
            )
            expect(textOf('ethereum_contract_call_to')).toContain(SHORT_TOKEN)
            expect(textOf('ethereum_contract_call_value')).toMatch(/ETH.*0/)
        })

        it('shows a contract creation without a target and with its calldata in full', () => {
            render(
                <TransactionDetailBody
                    transaction={natives['contract-creation']}
                />,
            )

            expect(screen.queryByTestId('ethereum_contract_call_to')).toBeNull()
            expect(textOf('ethereum_contract_call_data')).toContain(
                '0x6080604052',
            )
            expect(screen.queryByText('common.show_more')).toBeNull()
        })
    })

    describe('preview row', () => {
        it('shows the title and counterparty, and forwards a press', () => {
            const onPress = vi.fn()

            render(
                <TransactionPreviewRow
                    transaction={natives.transfer}
                    onPress={onPress}
                />,
            )
            fireEvent.click(screen.getByTestId('transaction_preview_row'))

            expect(screen.getByText('transactions.list_item.send')).toBeTruthy()
            expect(screen.getByText(SHORT_RECIPIENT)).toBeTruthy()
            expect(onPress).toHaveBeenCalledTimes(1)
        })
    })

    describe("a dApp's standard token calls", () => {
        const HOLDER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

        // The approval fixture is a dApp's unlimited approve; its view
        // already carries the decoded call.
        const withCall = (
            call: Record<string, unknown>,
        ): TransactionNative => ({
            family: 'evm',
            transaction: {
                ...(natives.approval.transaction as object),
                call,
            },
        })

        it('reviews an unlimited approve as an approval with the spend warning, not as an unknown call', () => {
            render(<TransactionReviewBody transaction={natives.approval} />)

            expect(
                screen.getByText('transactions.list_item.approval'),
            ).toBeTruthy()
            expect(
                screen.getByTestId('message-signing-spend-approval-warning'),
            ).toBeTruthy()
            expect(
                screen.queryByTestId('ethereum_contract_call_warning'),
            ).toBeNull()
        })

        it('details an approval opened from a list with the spend warning and the raw call it was read from', () => {
            render(<TransactionDetailBody transaction={natives.approval} />)

            expect(
                screen.getByText('transactions.list_item.approval'),
            ).toBeTruthy()
            expect(
                screen.getByTestId('message-signing-spend-approval-warning'),
            ).toBeTruthy()
            expect(textOf('ethereum_contract_call_selector')).toContain(
                '0x095ea7b3',
            )
            expect(
                screen.queryByTestId('ethereum_contract_call_warning'),
            ).toBeNull()
        })

        it("details a dApp's token transfer by its holder, recipient, token and amount", () => {
            render(
                <TransactionDetailBody
                    transaction={withCall({
                        kind: 'transfer-from',
                        contract: ETHEREUM_FIXTURE_TOKEN,
                        from: HOLDER,
                        to: ETHEREUM_FIXTURE_RECIPIENT,
                        value: new Decimal(5_000_000),
                    })}
                />,
            )

            expect(textOf('ethereum_detail_sender')).toContain(
                truncateAlgorandAddress(HOLDER),
            )
            expect(textOf('ethereum_detail_to')).toContain(SHORT_RECIPIENT)
            expect(textOf('ethereum_detail_asset')).toContain('USDC')
            expect(textOf('ethereum_detail_amount')).toMatch(/USDC.*5/)
            expect(
                screen.queryByTestId('ethereum_contract_call_warning'),
            ).toBeNull()
        })

        it('lists every item of an NFT batch, a repeated token id included', () => {
            render(
                <TransactionReviewBody
                    transaction={withCall({
                        kind: 'erc1155-transfer',
                        contract: ETHEREUM_FIXTURE_TOKEN,
                        from: ETHEREUM_FIXTURE_SENDER,
                        to: ETHEREUM_FIXTURE_RECIPIENT,
                        items: [
                            { tokenId: '7', amount: new Decimal(3) },
                            { tokenId: '7', amount: new Decimal(1) },
                        ],
                    })}
                />,
            )

            expect(
                screen.getByTestId('ethereum_review_nft_item_0'),
            ).toBeTruthy()
            expect(
                screen.getByTestId('ethereum_review_nft_item_1'),
            ).toBeTruthy()
        })

        it('titles the preview row of an approval as one', () => {
            render(
                <TransactionPreviewRow
                    transaction={natives.approval}
                    onPress={vi.fn()}
                />,
            )

            expect(
                screen.getByText('transactions.list_item.approval'),
            ).toBeTruthy()
        })
    })
})
