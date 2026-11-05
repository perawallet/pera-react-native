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
import * as Clipboard from 'expo-clipboard'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createQueryClientWrapper,
    fireEvent,
    render,
    renderHook,
    screen,
} from '@test-utils/render'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import * as assets from '@perawallet/wallet-core-assets'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import {
    addressCodecs,
    type TransactionNative,
} from '@perawallet/wallet-core-chain-contract'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
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
import { EthereumTransactionDetailSection } from '../components/EthereumTransactionDetailSection'
import { useEthereumTransactionPresentation } from '../hooks/useEthereumTransactionPresentation'

const mockNavigate = vi.hoisted(() => vi.fn())
// The suffix has its own spec; here the hero's title is the row label it wraps.
vi.mock('@modules/signing/hooks/useTransactionHeroTitle', () => ({
    useTransactionHeroTitle:
        () =>
        ({ key }: { key: string }) =>
            key,
}))

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

// The notice resolves its copy through t(), which echoes the key, so the params it was handed are exposed beside it.
vi.mock('@components/ChainNotice', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@components/ChainNotice')>()
    const { PWText } =
        await vi.importActual<typeof import('@components/core')>(
            '@components/core',
        )
    return {
        ...actual,
        ChainNotice: (props: Parameters<typeof actual.ChainNotice>[0]) => (
            <>
                <actual.ChainNotice {...props} />
                <PWText testID={`${props.testID}_params`}>
                    {JSON.stringify(props.params ?? {})}
                </PWText>
            </>
        ),
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

const ETH = {
    assetId: 'native',
    decimals: 18,
    unitName: 'ETH',
    name: 'Ether',
}

const USDC = {
    assetId: ETHEREUM_FIXTURE_TOKEN,
    decimals: 6,
    unitName: 'USDC',
}

const SIGNER_NAME = 'Fixture Signer'
const COLLAPSED_CALL_DATA = `${ETHEREUM_FIXTURE_CONTRACT_CALL_DATA.slice(0, 74)}...`

// The address rows name the transaction's own chain, so its codec truncates them.
const shortOnEthereum = (address: string) =>
    addressCodecs.get('ethereum').truncate(address)

// Set once the chain's codec is registered.
let SHORT_RECIPIENT = ''
let SHORT_TOKEN = ''

const natives = {} as Record<EthereumDisplayFixtureKind, TransactionNative>

const textOf = (testID: string) => screen.getByTestId(testID).textContent ?? ''

// lanekeep-ignore-next-line pera/no-module-component-specs reason: asserts what the user sees before signing, the security boundary of the review
describe('Ethereum transaction bodies', () => {
    beforeAll(async () => {
        registerEthereumChain()
        SHORT_RECIPIENT = shortOnEthereum(ETHEREUM_FIXTURE_RECIPIENT)
        SHORT_TOKEN = shortOnEthereum(ETHEREUM_FIXTURE_TOKEN)
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
        // clearAllMocks keeps return values, so a priced case would leak into the next.
        vi.mocked(assets.useAssetPricesQuery).mockReturnValue({
            data: new Map(),
            isPending: false,
        } as unknown as ReturnType<typeof assets.useAssetPricesQuery>)
        // The global mocks give an ALGO-sized native asset and a number from toWholeUnits.
        vi.spyOn(assets, 'nativeAssetFor').mockReturnValue(
            ETH as unknown as ReturnType<typeof assets.nativeAssetFor>,
        )
        vi.spyOn(assets, 'toWholeUnits').mockImplementation((value, asset) =>
            new Decimal(value.toString()).div(
                new Decimal(10).pow(asset.decimals),
            ),
        )
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
            expect(textOf('ethereum_review_fee')).toContain('0.00042')
            expect(
                screen.queryByTestId('ethereum_contract_call_warning'),
            ).toBeNull()
        })

        it('shows the fee tier, the estimate and the max fee, each in ETH with its fiat value', () => {
            const estimated: TransactionNative = {
                family: 'evm',
                transaction: {
                    ...(natives.transfer.transaction as object),
                    feeEstimate: {
                        preset: 'fast',
                        amount: new Decimal('63000000000000'),
                    },
                },
            }

            vi.mocked(assets.useAssetPricesQuery).mockReturnValue({
                data: new Map([['native', { usdPrice: new Decimal(2000) }]]),
                isPending: false,
            } as unknown as ReturnType<typeof assets.useAssetPricesQuery>)

            render(<TransactionReviewBody transaction={estimated} />)

            expect(textOf('ethereum_review_fee')).toContain(
                'send_funds.fee.fast',
            )
            expect(textOf('fee_summary_estimate')).toContain('0.000063')
            expect(textOf('fee_summary_max')).toContain('0.00042')
            // 0.000063 ETH and 0.00042 ETH at $2000.
            expect(textOf('fee_summary_estimate_fiat')).toContain('0.126')
            expect(textOf('fee_summary_max_fiat')).toContain('0.84')
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

        it('warns about an unrecognised call, naming who asked, and keeps its target and amount in view', () => {
            render(
                <TransactionReviewBody
                    transaction={natives['contract-call']}
                    source={{ url: 'https://claimed.example' }}
                    verifiedOrigin='https://app.uniswap.org/swap'
                />,
            )

            expect(
                screen.getByText('transactions.list_item.contract_call'),
            ).toBeTruthy()
            expect(textOf('ethereum_contract_call_warning')).toBe(
                'transactions.contract_call.unchecked_warning',
            )
            expect(
                JSON.parse(textOf('ethereum_contract_call_warning_params')),
            ).toEqual({ domain: 'app.uniswap.org' })
            expect(textOf('ethereum_contract_call_to')).toContain(SHORT_TOKEN)
            expect(textOf('ethereum_contract_call_value')).toMatch(/ETH.*0/)
            expect(screen.queryByTestId('ethereum_review_amount')).toBeNull()
        })

        it('asks the user to trust the sending app when only the dApp has claimed a site', () => {
            render(
                <TransactionReviewBody
                    transaction={natives['contract-call']}
                    source={{ url: 'https://app.uniswap.org' }}
                />,
            )

            expect(textOf('ethereum_contract_call_warning')).toBe(
                'transactions.contract_call.unchecked_warning_no_source',
            )
            expect(
                JSON.parse(textOf('ethereum_contract_call_warning_params')),
            ).toEqual({})
        })

        it("leaves an unread call's selector and call data to the details screen", () => {
            render(
                <TransactionReviewBody
                    transaction={natives['contract-call']}
                />,
            )

            expect(
                screen.queryByTestId('ethereum_contract_call_selector'),
            ).toBeNull()
            expect(
                screen.queryByTestId('ethereum_contract_call_data'),
            ).toBeNull()
            expect(screen.getByTestId('ethereum_view_details')).toBeTruthy()
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

            expect(textOf('transaction_detail_from')).toContain(
                shortOnEthereum(ETHEREUM_FIXTURE_SENDER),
            )
            expect(textOf('transaction_detail_to')).toContain(
                shortOnEthereum(ETHEREUM_FIXTURE_RECIPIENT),
            )
            expect(textOf('transaction_detail_amount')).toMatch(/ETH.*1/)
            expect(textOf('ethereum_max_fee')).toContain('0.00042')
            expect(screen.queryByTestId('ethereum_review_fee')).toBeNull()
            expect(screen.queryByTestId('ethereum_detail_asset')).toBeNull()
        })

        it('adds the Asset row for a token transfer', () => {
            render(
                <TransactionDetailBody
                    transaction={natives['token-transfer']}
                />,
            )

            expect(textOf('ethereum_detail_asset')).toContain('USDC')
            expect(textOf('transaction_detail_amount')).toMatch(/USDC.*5/)
        })

        it('shows an unrecognised call as its warning, selector, collapsed calldata, target and zero value', () => {
            render(
                <TransactionDetailBody
                    transaction={natives['contract-call']}
                />,
            )

            expect(textOf('ethereum_contract_call_warning')).toBe(
                'transactions.contract_call.warning',
            )
            expect(textOf('ethereum_contract_call_selector')).toContain(
                '0x5ae401dc',
            )
            expect(textOf('ethereum_contract_call_data')).toContain(
                COLLAPSED_CALL_DATA,
            )
            expect(textOf('ethereum_contract_call_to')).toContain(SHORT_TOKEN)
            expect(textOf('ethereum_contract_call_value')).toMatch(/ETH.*0/)

            fireEvent.click(screen.getByText('common.show_more'))

            expect(textOf('ethereum_contract_call_data')).toContain(
                ETHEREUM_FIXTURE_CONTRACT_CALL_DATA,
            )
        })

        it("lists a call's nonce, gas limit and per-gas fees", () => {
            render(
                <TransactionDetailBody
                    transaction={natives['contract-call']}
                />,
            )

            expect(textOf('ethereum_nonce')).toMatch(/nonce0$/)
            expect(textOf('ethereum_gas_limit')).toMatch(/gas_limit60000$/)
            expect(textOf('ethereum_max_fee_per_gas')).toMatch(
                /gas20(\.0+)? ethereum\.pricing\.gwei$/,
            )
            expect(textOf('ethereum_max_priority_fee_per_gas')).toMatch(
                /gas1(\.0+)? ethereum\.pricing\.gwei$/,
            )
        })

        it('copies the full call data from its copy button', () => {
            render(
                <TransactionDetailBody
                    transaction={natives['contract-call']}
                />,
            )

            fireEvent.click(
                screen.getByTestId('ethereum_contract_call_data_copy'),
            )

            expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
                ETHEREUM_FIXTURE_CONTRACT_CALL_DATA,
            )
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

    describe('detail of a transaction with no signed pricing', () => {
        const PRICING = ['fee', 'nonce', 'gas', 'isPreview']
        const mined = (feePaid?: Decimal): TransactionNative => ({
            family: 'evm',
            transaction: {
                ...Object.fromEntries(
                    Object.entries(
                        natives.transfer.transaction as object,
                    ).filter(([key]) => !PRICING.includes(key)),
                ),
                isMined: true,
                ...(feePaid && { feePaid }),
            },
        })

        it('shows the fee it cost in place of a max fee', () => {
            render(
                <TransactionDetailBody
                    transaction={mined(new Decimal('21000000000000'))}
                />,
            )

            expect(textOf('transaction_detail_fee')).toContain('0.000021')
            expect(screen.queryByTestId('ethereum_max_fee')).toBeNull()
            expect(screen.queryByTestId('ethereum_nonce')).toBeNull()
        })

        it('shows no pricing, only that the fee is set once reached, for a batch call not yet priced', () => {
            const preview: TransactionNative = {
                family: 'evm',
                transaction: {
                    ...Object.fromEntries(
                        Object.entries(
                            natives.transfer.transaction as object,
                        ).filter(([key]) => !PRICING.includes(key)),
                    ),
                    isPreview: true,
                },
            }

            render(<TransactionDetailBody transaction={preview} />)

            expect(screen.queryByTestId('ethereum_nonce')).toBeNull()
            expect(textOf('ethereum_max_fee')).toContain(
                'ethereum.batch.fee_when_reached',
            )
        })

        it('shows no fee row, and no promise of one, when the history gave none', () => {
            render(<TransactionDetailBody transaction={mined()} />)

            expect(screen.queryByTestId('transaction_detail_fee')).toBeNull()
            expect(screen.queryByTestId('ethereum_max_fee')).toBeNull()
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

        it('reviews an unlimited approve titled by what it allows, with the spend warning, not as an unknown call', () => {
            render(<TransactionReviewBody transaction={natives.approval} />)

            expect(
                screen.getByText(/^signing\.spend_approval\.allow_title/),
            ).toBeTruthy()
            expect(
                screen.queryByText('transactions.list_item.approval'),
            ).toBeNull()
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

        it("keeps a dApp's token transfer an unknown call with its warning while contractDecoding is off", () => {
            render(
                <TransactionReviewBody
                    transaction={withCall({
                        kind: 'transfer',
                        contract: ETHEREUM_FIXTURE_TOKEN,
                        from: ETHEREUM_FIXTURE_SENDER,
                        to: ETHEREUM_FIXTURE_RECIPIENT,
                        value: new Decimal(5_000_000),
                    })}
                />,
            )

            expect(
                screen.getByTestId('ethereum_contract_call_warning'),
            ).toBeTruthy()
        })

        it("details a dApp's token transfer by its holder, recipient, token and amount while contractDecoding is on", () => {
            vi.mocked(useChainCapability).mockReturnValue(true)
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
                shortOnEthereum(HOLDER),
            )
            expect(textOf('transaction_detail_to')).toContain(
                shortOnEthereum(ETHEREUM_FIXTURE_RECIPIENT),
            )
            expect(textOf('ethereum_detail_asset')).toContain('USDC')
            expect(textOf('transaction_detail_amount')).toMatch(/USDC.*5/)
            expect(
                screen.queryByTestId('ethereum_contract_call_warning'),
            ).toBeNull()
        })

        describe('with the NFT shown in its own card', () => {
            const presentationOf = (from: string) => {
                vi.mocked(useChainCapability).mockReturnValue(true)
                const { result } = renderHook(
                    () =>
                        useEthereumTransactionPresentation(
                            withCall({
                                kind: 'erc721-safe-transfer',
                                contract: ETHEREUM_FIXTURE_TOKEN,
                                from,
                                to: ETHEREUM_FIXTURE_RECIPIENT,
                                tokenId: '7',
                            }),
                        ),
                    { wrapper: createQueryClientWrapper() },
                )
                return result.current!
            }

            it('keeps the holder an approved operator moved it for, and drops the asset and amount rows the card repeats', () => {
                render(
                    <EthereumTransactionDetailSection
                        presentation={presentationOf(HOLDER)}
                        isAssetInCard
                    />,
                )

                expect(textOf('ethereum_detail_sender')).toContain(
                    shortOnEthereum(HOLDER),
                )
                expect(screen.queryByTestId('ethereum_detail_nft')).toBeNull()
                expect(
                    screen.queryByTestId('ethereum_detail_amount'),
                ).toBeNull()
            })

            it('names no holder when the signer moved its own NFT', () => {
                render(
                    <EthereumTransactionDetailSection
                        presentation={presentationOf(ETHEREUM_FIXTURE_SENDER)}
                        isAssetInCard
                    />,
                )

                expect(
                    screen.queryByTestId('ethereum_detail_sender'),
                ).toBeNull()
                expect(screen.queryByTestId('ethereum_detail_nft')).toBeNull()
            })
        })

        it('lists every item of an NFT batch, a repeated token id included, while contractDecoding is on', () => {
            vi.mocked(useChainCapability).mockReturnValue(true)
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
