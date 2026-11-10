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

import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import type {
    EvmContractAction,
    EvmContractLabel,
    EvmStandardCall,
} from '@perawallet/wallet-core-chain-ethereum'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import {
    ETHEREUM_FIXTURE_NFT_ID,
    ETHEREUM_FIXTURE_RECIPIENT,
    ETHEREUM_FIXTURE_SENDER,
    ETHEREUM_FIXTURE_TOKEN,
    reviewEthereumFixture,
    type EthereumDisplayFixtureKind,
} from '@test-utils/ethereum-display-fixtures'
import { useEthereumTransactionPresentation } from '../useEthereumTransactionPresentation'

// The curated lookup is its own hook's to test; here only the bundled entry names a contract.
vi.mock('../useEthereumContractLabel', () => ({
    useEthereumContractLabel: (
        _scope: unknown,
        _address: unknown,
        bundled: unknown,
        isEnabled = true,
    ) => (isEnabled ? (bundled ?? null) : null),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainCapability: vi.fn(),
}))

const USDC = { assetId: ETHEREUM_FIXTURE_TOKEN, decimals: 6, unitName: 'USDC' }

type AssetQuery = ReturnType<typeof useSingleAssetDetailsQuery>

const mockAssetQuery = (query: { data?: unknown; isPending: boolean }) =>
    vi
        .mocked(useSingleAssetDetailsQuery)
        .mockReturnValue(query as unknown as AssetQuery)

const natives = {} as Record<EthereumDisplayFixtureKind, TransactionNative>

describe('useEthereumTransactionPresentation', () => {
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
        mockAssetQuery({ data: null, isPending: false })
        vi.mocked(useFindAccountByAddress).mockReturnValue(null)
        vi.mocked(useChainCapability).mockReturnValue(false)
    })

    it('presents a transfer as a send of the recipient and the ether moved', () => {
        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives.transfer),
        )

        expect(result.current?.titleKey).toBe('transactions.list_item.send')
        expect(result.current?.iconName).toBe('transactions/send')
        expect(result.current?.counterparty).toBe(ETHEREUM_FIXTURE_RECIPIENT)
        expect(result.current?.amount?.value).toEqual(new Decimal(1))
        expect(result.current?.value.value).toEqual(new Decimal(1))
        expect(result.current?.maxFee?.value).toEqual(new Decimal('0.00042'))
        expect(result.current?.isAmountLoading).toBe(false)
    })

    it("carries the max fee in wei and the view's fee estimate for the review", () => {
        const estimate = { preset: 'fast', amount: new Decimal('63000') }
        const estimated = {
            ...natives.transfer,
            transaction: {
                ...(natives.transfer.transaction as object),
                feeEstimate: estimate,
            },
        } as TransactionNative

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(estimated),
        )

        expect(result.current?.reviewFee).toEqual({
            maxAmount: new Decimal('420000000000000'),
            estimate,
        })
    })

    it('has no estimate in the review fee when the view carries none', () => {
        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives.transfer),
        )

        expect(result.current?.reviewFee).toEqual({
            maxAmount: new Decimal('420000000000000'),
        })
        expect(result.current?.reviewFee).not.toHaveProperty('estimate')
    })

    it('flags a high fee only on a request flagged as paying far more than the wallet would', () => {
        const flagged = {
            ...natives.transfer,
            transaction: {
                ...(natives.transfer.transaction as object),
                hasHighFee: true,
            },
        } as TransactionNative

        const { result: unflagged } = renderHook(() =>
            useEthereumTransactionPresentation(natives.transfer),
        )
        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(flagged),
        )

        expect(unflagged.current?.hasHighFee).toBe(false)
        expect(result.current?.hasHighFee).toBe(true)
    })

    it("shows a token transfer's recipient, not the contract, and the amount in the token's units", () => {
        mockAssetQuery({ data: USDC, isPending: false })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['token-transfer']),
        )

        expect(result.current?.counterparty).toBe(ETHEREUM_FIXTURE_RECIPIENT)
        expect(result.current?.amount?.asset).toBe(USDC)
        expect(result.current?.amount?.value).toEqual(new Decimal(5))
        expect(useSingleAssetDetailsQuery).toHaveBeenCalledWith(
            ETHEREUM_FIXTURE_TOKEN,
            expect.objectContaining({ chainId: 'ethereum' }),
        )
    })

    it("shows an NFT transfer's recipient, quantity, collection and token id", () => {
        const nft = {
            assetId: ETHEREUM_FIXTURE_NFT_ID,
            decimals: 0,
            unitName: 'BAYC',
            peraMetadata: { collectible: { collection: { name: 'Apes' } } },
        }
        mockAssetQuery({ data: nft, isPending: false })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['nft-transfer']),
        )

        expect(result.current?.titleKey).toBe('transactions.list_item.send')
        expect(result.current?.iconName).toBe('transactions/send')
        expect(result.current?.counterparty).toBe(ETHEREUM_FIXTURE_RECIPIENT)
        expect(result.current?.amount).toEqual({
            asset: nft,
            value: new Decimal(1),
        })
        expect(result.current?.collectible).toEqual({
            tokenId: '7',
            collectionName: 'Apes',
        })
        expect(useSingleAssetDetailsQuery).toHaveBeenCalledWith(
            ETHEREUM_FIXTURE_NFT_ID,
            expect.objectContaining({ chainId: 'ethereum' }),
        )
    })

    it("waits on an NFT's record before showing its quantity", () => {
        mockAssetQuery({ data: undefined, isPending: true })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['nft-transfer']),
        )

        expect(result.current?.isAmountLoading).toBe(true)
    })

    it('sets no collectible on a token transfer', () => {
        mockAssetQuery({ data: USDC, isPending: false })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['token-transfer']),
        )

        expect(result.current?.collectible).toBeUndefined()
    })

    it("waits on a token's record before showing its amount", () => {
        mockAssetQuery({ data: undefined, isPending: true })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['token-transfer']),
        )

        expect(result.current?.amount).toBeUndefined()
        expect(result.current?.isAmountLoading).toBe(true)
    })

    it('falls back to the raw base units when the token record cannot be read', () => {
        mockAssetQuery({ data: undefined, isPending: false })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['token-transfer']),
        )

        expect(result.current?.amount).toEqual({
            asset: null,
            value: new Decimal(5_000_000),
        })
        expect(result.current?.isAmountLoading).toBe(false)
    })

    it('presents an unrecognised call by its target, with no amount', () => {
        // A disabled query reports pending, which must not read as a loading amount.
        mockAssetQuery({ data: undefined, isPending: true })

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['contract-call']),
        )

        expect(result.current?.titleKey).toBe(
            'transactions.list_item.contract_call',
        )
        expect(result.current?.iconName).toBe('transactions/application-call')
        expect(result.current?.counterparty).toBe(ETHEREUM_FIXTURE_TOKEN)
        expect(result.current?.amount).toBeUndefined()
        expect(result.current?.isAmountLoading).toBe(false)
    })

    it('has no fee yet for a batch call not reached, which is priced once it is', () => {
        const {
            nonce: _nonce,
            gas: _gas,
            fee: _fee,
            ...unpriced
        } = natives['contract-call'].transaction as Record<string, unknown>
        const preview: TransactionNative = {
            family: 'evm',
            transaction: { ...unpriced, isPreview: true },
        }

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(preview),
        )

        expect(result.current?.maxFee).toBeNull()
        expect(result.current?.reviewFee).toBeNull()
        expect(result.current?.counterparty).toBe(ETHEREUM_FIXTURE_TOKEN)
    })

    it('has no counterparty for a contract creation', () => {
        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives['contract-creation']),
        )

        expect(result.current?.counterparty).toBeUndefined()
    })

    it('returns the held account that sends the transaction', () => {
        const account = { id: 'signer' } as ReturnType<
            typeof useFindAccountByAddress
        >
        vi.mocked(useFindAccountByAddress).mockImplementation(address =>
            address === ETHEREUM_FIXTURE_SENDER ? account : null,
        )

        const { result } = renderHook(() =>
            useEthereumTransactionPresentation(natives.transfer),
        )

        expect(result.current?.signingAccount).toBe(account)
    })

    it('returns null for a native it cannot read', () => {
        const algorand = renderHook(() =>
            useEthereumTransactionPresentation({
                family: 'algorand',
                transaction: {},
            }),
        )
        const malformed = renderHook(() =>
            useEthereumTransactionPresentation({
                family: 'evm',
                transaction: {},
            }),
        )

        expect(algorand.result.current).toBeNull()
        expect(malformed.result.current).toBeNull()
    })

    describe('a decoded standard call', () => {
        const HOLDER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

        // The approval fixture is a dApp approve, so its view already
        // carries the decoded call; these swap in other calls on the same target.
        const callNative = (call?: EvmStandardCall): TransactionNative => {
            const native = natives.approval
            const transaction = native.transaction as Record<string, unknown>
            return call
                ? { ...native, transaction: { ...transaction, call } }
                : native
        }

        beforeEach(() => {
            vi.mocked(useChainCapability).mockReturnValue(true)
        })

        it('presents an approve as an approval to its spender, not a transfer', () => {
            mockAssetQuery({ data: USDC, isPending: false })

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(callNative()),
            )

            expect(result.current?.titleKey).toBe(
                'transactions.list_item.approval',
            )
            expect(result.current?.iconName).toBe(
                'transactions/application-call',
            )
            expect(result.current?.isTransfer).toBe(false)
            expect(result.current?.standardCall?.kind).toBe('token-approval')
            expect(result.current?.counterparty).toBe(
                result.current?.standardCall?.kind === 'token-approval'
                    ? result.current.standardCall.spender
                    : undefined,
            )
            expect(result.current?.amount).toBeUndefined()
        })

        it('titles a revocation as one', () => {
            mockAssetQuery({ data: USDC, isPending: false })

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    callNative({
                        kind: 'set-approval-for-all',
                        contract: ETHEREUM_FIXTURE_TOKEN,
                        operator: ETHEREUM_FIXTURE_RECIPIENT,
                        isApproved: false,
                    }),
                ),
            )

            expect(result.current?.titleKey).toBe(
                'transactions.list_item.revoke_approval',
            )
            expect(result.current?.counterparty).toBe(
                ETHEREUM_FIXTURE_RECIPIENT,
            )
        })

        it("presents a dApp's token transfer as a send to its recipient, with the holder when it isn't the signer", () => {
            mockAssetQuery({ data: USDC, isPending: false })

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    callNative({
                        kind: 'transfer-from',
                        contract: ETHEREUM_FIXTURE_TOKEN,
                        from: HOLDER,
                        to: ETHEREUM_FIXTURE_RECIPIENT,
                        value: new Decimal(5_000_000),
                    }),
                ),
            )

            expect(result.current?.titleKey).toBe('transactions.list_item.send')
            expect(result.current?.iconName).toBe('transactions/send')
            expect(result.current?.isTransfer).toBe(true)
            expect(result.current?.counterparty).toBe(
                ETHEREUM_FIXTURE_RECIPIENT,
            )
            expect(result.current?.sender).toBe(HOLDER)
            expect(result.current?.amount).toEqual({
                asset: USDC,
                value: new Decimal(5),
            })
        })

        it('names no separate holder when the signer sends its own tokens', () => {
            mockAssetQuery({ data: USDC, isPending: false })

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    callNative({
                        kind: 'transfer',
                        contract: ETHEREUM_FIXTURE_TOKEN,
                        from: ETHEREUM_FIXTURE_SENDER,
                        to: ETHEREUM_FIXTURE_RECIPIENT,
                        value: new Decimal(5_000_000),
                    }),
                ),
            )

            expect(result.current?.sender).toBeUndefined()
        })

        it('lists the items of an NFT batch and shows no single amount', () => {
            const items = [
                { tokenId: '7', amount: new Decimal(3) },
                { tokenId: '8', amount: new Decimal(1) },
            ]

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    callNative({
                        kind: 'erc1155-transfer',
                        contract: ETHEREUM_FIXTURE_TOKEN,
                        from: ETHEREUM_FIXTURE_SENDER,
                        to: ETHEREUM_FIXTURE_RECIPIENT,
                        items,
                    }),
                ),
            )

            expect(result.current?.isTransfer).toBe(true)
            expect(result.current?.nftItems).toEqual(items)
            expect(result.current?.amount).toBeUndefined()
            expect(result.current?.isAmountLoading).toBe(false)
        })

        it("keeps a dApp's token transfer an unrecognised contract call while contractDecoding is off", () => {
            vi.mocked(useChainCapability).mockReturnValue(false)
            mockAssetQuery({ data: USDC, isPending: false })

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    callNative({
                        kind: 'transfer',
                        contract: ETHEREUM_FIXTURE_TOKEN,
                        from: ETHEREUM_FIXTURE_SENDER,
                        to: ETHEREUM_FIXTURE_RECIPIENT,
                        value: new Decimal(5_000_000),
                    }),
                ),
            )

            expect(result.current?.titleKey).toBe(
                'transactions.list_item.contract_call',
            )
            expect(result.current?.standardCall).toBeNull()
            expect(result.current?.isTransfer).toBe(false)
        })

        it('still presents an approve as an approval while contractDecoding is off', () => {
            vi.mocked(useChainCapability).mockReturnValue(false)
            mockAssetQuery({ data: USDC, isPending: false })

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(callNative()),
            )

            expect(result.current?.titleKey).toBe(
                'transactions.list_item.approval',
            )
            expect(result.current?.standardCall?.kind).toBe('token-approval')
        })
    })

    describe('a transaction already on chain', () => {
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

        it('shows the fee it cost, in ether, and no max fee', () => {
            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    mined(new Decimal('21000000000000')),
                ),
            )

            expect(result.current?.maxFee).toBeNull()
            expect(result.current?.reviewFee).toBeNull()
            expect(result.current?.feePaid?.value).toEqual(
                new Decimal('0.000021'),
            )
        })

        it('shows no fee when the history gave none', () => {
            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(mined()),
            )

            expect(result.current?.maxFee).toBeNull()
            expect(result.current?.feePaid).toBeNull()
        })

        it("reads the capability and the token on the scope it is given, and shows that chain's coin", () => {
            vi.mocked(useChainCapability).mockReturnValue(true)
            const scope = { chainId: 'base', networkId: 'mainnet' } as const

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    mined(new Decimal('21000000000000')),
                    scope,
                ),
            )

            expect(result.current?.scope).toEqual(scope)
            expect(useChainCapability).toHaveBeenCalledWith(
                'base',
                'contractDecoding',
            )
            expect(result.current?.feePaid?.asset?.assetId).toBe(
                result.current?.value.asset?.assetId,
            )
        })
    })

    describe('a call to a known contract', () => {
        const ROUTER = '0x23617e59A5925b2A4Bf75d73ff6711cD0b29De85'
        const ROUTER_LABEL: EvmContractLabel = {
            kind: 'uniswap-universal-router',
            name: 'Uniswap Universal Router',
            projectDomain: 'uniswap.org',
        }
        const SWAP: EvmContractAction = {
            kind: 'swap',
            input: {
                asset: { kind: 'native' },
                amount: new Decimal(10n ** 18n),
                bound: 'exact',
            },
            output: {
                asset: { kind: 'token', contract: ETHEREUM_FIXTURE_TOKEN },
                amount: new Decimal(1_500_000),
                bound: 'at-least',
            },
            fees: [],
        }

        // The contract-call fixture is an unrecognised call; these give it a
        // label and an action, as the reviewer does for a known target.
        const knownNative = (
            fields: Record<string, unknown>,
        ): TransactionNative => ({
            ...natives['contract-call'],
            transaction: {
                ...(natives['contract-call'].transaction as object),
                to: ROUTER,
                ...fields,
            },
        })

        beforeEach(() => {
            vi.mocked(useChainCapability).mockReturnValue(true)
            mockAssetQuery({ data: USDC, isPending: false })
        })

        it('titles a swap as one, with the swap icon, and carries the label and both legs', () => {
            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    knownNative({
                        knownContract: ROUTER_LABEL,
                        action: SWAP,
                    }),
                ),
            )

            expect(result.current?.titleKey).toBe('transactions.list_item.swap')
            expect(result.current?.iconName).toBe('transactions/swap')
            expect(result.current?.knownContract).toEqual(ROUTER_LABEL)
            expect(result.current?.contractAction).toMatchObject({
                kind: 'swap',
                input: { bound: 'exact', value: new Decimal(1) },
                output: {
                    asset: USDC,
                    bound: 'at-least',
                    value: new Decimal(1.5),
                },
            })
            expect(result.current?.isTransfer).toBe(false)
        })

        it.each([
            ['wrap', { kind: 'wrap', amount: new Decimal(10n ** 18n) }, 'wrap'],
            [
                'unwrap',
                { kind: 'unwrap', amount: new Decimal(10n ** 18n) },
                'unwrap',
            ],
            [
                'supply',
                {
                    kind: 'supply',
                    asset: ETHEREUM_FIXTURE_TOKEN,
                    amount: new Decimal(1_000_000),
                    isEntireBalance: false,
                },
                'supply',
            ],
        ])('titles a %s from its action', (_name, action, key) => {
            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    knownNative({ knownContract: ROUTER_LABEL, action }),
                ),
            )

            expect(result.current?.titleKey).toBe(
                `transactions.list_item.${key}`,
            )
            expect(result.current?.iconName).toBe(
                'transactions/application-call',
            )
        })

        it('keeps the contract call title for a label without an action', () => {
            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    knownNative({ knownContract: ROUTER_LABEL }),
                ),
            )

            expect(result.current?.titleKey).toBe(
                'transactions.list_item.contract_call',
            )
            expect(result.current?.knownContract).toEqual(ROUTER_LABEL)
            expect(result.current?.contractAction).toBeNull()
        })

        it('lets a standard call win over an action', () => {
            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    knownNative({
                        knownContract: ROUTER_LABEL,
                        action: SWAP,
                        call: {
                            kind: 'approve',
                            contract: ETHEREUM_FIXTURE_TOKEN,
                            spender: ETHEREUM_FIXTURE_RECIPIENT,
                            value: new Decimal(5),
                        },
                    }),
                ),
            )

            expect(result.current?.titleKey).toBe(
                'transactions.list_item.approval',
            )
            expect(result.current?.contractAction).toBeNull()
            expect(result.current?.knownContract).toBeNull()
        })

        it('presents an unlisted contract call as before', () => {
            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(natives['contract-call']),
            )

            expect(result.current?.titleKey).toBe(
                'transactions.list_item.contract_call',
            )
            expect(result.current?.knownContract).toBeNull()
            expect(result.current?.contractAction).toBeNull()
        })

        it('presents it as before while contractDecoding is off', () => {
            vi.mocked(useChainCapability).mockReturnValue(false)

            const { result } = renderHook(() =>
                useEthereumTransactionPresentation(
                    knownNative({
                        knownContract: ROUTER_LABEL,
                        action: SWAP,
                    }),
                ),
            )

            expect(result.current?.titleKey).toBe(
                'transactions.list_item.contract_call',
            )
            expect(result.current?.iconName).toBe(
                'transactions/application-call',
            )
            expect(result.current?.knownContract).toBeNull()
            expect(result.current?.contractAction).toBeNull()
            expect(result.current?.isContractActionLoading).toBe(false)
        })
    })
})
