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
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { SpendApproval } from '@perawallet/wallet-core-chain-contract'
import type { EthereumTransactionPresentation } from '../../../../hooks/useEthereumTransactionPresentation'
import { useEthereumTransactionPreview } from '../useEthereumTransactionPreview'

const mockAssets = vi.hoisted(() => ({ current: new Map() }))
vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<object>()),
    useAssetsQuery: () => ({ data: mockAssets.current }),
}))

const mockVerifiedCall = vi.hoisted(() => ({
    current: { status: 'idle' } as { status: string; call?: object },
}))
vi.mock('../../../../hooks/useEthereumVerifiedCall', () => ({
    useEthereumVerifiedCall: () => mockVerifiedCall.current,
}))

vi.mock('@perawallet/wallet-core-chain-contract', async importOriginal => ({
    ...(await importOriginal<object>()),
    addressCodecs: {
        has: () => true,
        get: () => ({ truncate: (address: string) => `short:${address}` }),
    },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: object) =>
            params ? `${key}|${JSON.stringify(params)}` : key,
    }),
}))

const ETH = { assetId: 'native', unitName: 'ETH', decimals: 18 } as PeraAsset
const USDC = { assetId: '0xusdc', unitName: 'USDC', decimals: 6 } as PeraAsset

const presentation = {
    scope: { chainId: 'ethereum', networkId: 'sepolia' },
    titleKey: 'transactions.list_item.contract_call',
    isTransfer: false,
    standardCall: null,
    contractAction: null,
    knownContract: null,
    value: { asset: ETH, value: new Decimal(0) },
    view: { kind: 'contract-call', to: '0xcontract' },
} as unknown as EthereumTransactionPresentation

const approvalOf = (amount?: Decimal): SpendApproval => ({
    spender: '0xspender',
    allowances: [
        { assetRef: { chainId: 'ethereum', assetId: '0xusdc' }, amount },
    ],
    isLongLived: true,
})

const tokenApproval = (spendApproval?: SpendApproval) =>
    ({
        titleKey: 'transactions.list_item.approval',
        standardCall: {
            kind: 'token-approval',
            contract: '0xusdc',
            spender: '0xspender',
            ...(spendApproval && { spendApproval }),
        },
    }) as unknown as Partial<EthereumTransactionPresentation>

const preview = (overrides: Partial<EthereumTransactionPresentation> = {}) =>
    renderHook(() =>
        useEthereumTransactionPreview({ ...presentation, ...overrides }),
    ).result.current

describe('useEthereumTransactionPreview', () => {
    afterEach(() => {
        mockAssets.current = new Map()
        mockVerifiedCall.current = { status: 'idle' }
    })

    it('shows what each transfer sends, so two calls to one recipient read apart', () => {
        const transfer = (wei: string) =>
            preview({
                titleKey: 'transactions.list_item.send',
                isTransfer: true,
                counterparty: '0xrecipient',
                amount: { asset: ETH, value: new Decimal(wei) },
            } as unknown as Partial<EthereumTransactionPresentation>)

        const small = transfer('0.000000000000000001')
        const large = transfer('12.5')

        expect(small.detail).toEqual({
            kind: 'amount',
            asset: ETH,
            value: new Decimal('0.000000000000000001'),
        })
        expect(large.detail).toEqual({
            kind: 'amount',
            asset: ETH,
            value: new Decimal('12.5'),
        })
    })

    it('flags an unlimited approval with the token it covers', () => {
        mockAssets.current = new Map([['0xusdc', USDC]])

        const { title, detail } = preview(tokenApproval(approvalOf()))

        expect(title).toBe('signing.review.title_approve')
        expect(detail).toEqual({
            kind: 'label',
            label: 'signing.review.permission_unlimited|{"symbol":"USDC"}',
            isWarning: true,
        })
    })

    it('shows a capped approval as its allowance in the token’s display units', () => {
        mockAssets.current = new Map([['0xusdc', USDC]])

        const { detail } = preview(
            tokenApproval(approvalOf(new Decimal(1_500_000))),
        )

        expect(detail).toMatchObject({ kind: 'amount', asset: USDC })
        expect(detail?.kind === 'amount' && detail.value.toFixed()).toBe('1.5')
    })

    it('keeps an approval in base units while the token record is unread', () => {
        const { detail } = preview(
            tokenApproval(approvalOf(new Decimal(1_500_000))),
        )

        expect(detail).toEqual({
            kind: 'amount',
            asset: null,
            value: new Decimal(1_500_000),
        })
    })

    it('flags a collection-wide approval, naming the collection by its short address', () => {
        const { detail } = preview({
            standardCall: {
                kind: 'collection-approval',
                contract: '0xnft',
                operator: '0xoperator',
                isApproved: true,
            },
        } as unknown as Partial<EthereumTransactionPresentation>)

        expect(detail).toEqual({
            kind: 'label',
            label: 'signing.review.permission_collection|{"collection":"short:0xnft"}',
            isWarning: true,
        })
    })

    it('shows nothing extra for a revoke', () => {
        expect(preview(tokenApproval()).detail).toBeNull()
    })

    it('names a single NFT transfer by its collection and token id', () => {
        const { detail } = preview({
            isTransfer: true,
            view: { kind: 'nft-transfer', nft: { contract: '0xnft' } },
            collectible: { tokenId: '7', collectionName: 'Punks' },
            amount: { asset: null, value: new Decimal(1) },
        } as unknown as Partial<EthereumTransactionPresentation>)

        expect(detail).toEqual({
            kind: 'label',
            label: 'transactions.list_item.nft_subtitle|{"collection":"Punks","tokenId":"7"}',
            isWarning: false,
        })
    })

    it('shows the ether a contract call sends with it', () => {
        const { detail } = preview({
            value: { asset: ETH, value: new Decimal('0.3') },
        })

        expect(detail).toEqual({
            kind: 'amount',
            asset: ETH,
            value: new Decimal('0.3'),
        })
    })

    it('titles a verified call by its function name and adds nothing when it sends no ether', () => {
        mockVerifiedCall.current = {
            status: 'decoded',
            call: { functionName: 'claimAllRewardsToSelf' },
        }

        const { title, detail } = preview()

        expect(title).toBe('Claim all rewards to self')
        expect(detail).toBeNull()
    })
})
