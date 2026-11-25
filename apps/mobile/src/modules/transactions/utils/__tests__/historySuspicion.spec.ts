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

import { describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    type BalanceChange,
    type ChainId,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    assessHistoryEntry,
    suspicionCopyOf,
    type AssessHistoryEntryParams,
} from '../historySuspicion'

vi.mock('@perawallet/wallet-core-currencies', () => ({
    imitatedTickerOf: (_ref: unknown, unitName?: string) =>
        unitName === 'USDꓚ' ? 'USDC' : null,
}))

vi.mock('@perawallet/wallet-core-assets', async () => ({
    ...(await vi.importActual<object>('@packages/assets/src/spam-text')),
    PeraAssetVerificationTier: {
        verified: 'verified',
        unverified: 'unverified',
        suspicious: 'suspicious',
    },
}))

const ME = '0xme'
const OTHER = '0xother'
const USDC = '0xusdc'

const transfer = (
    direction: TransactionSummary['direction'],
    value: number,
    symbol = 'USDC',
    chainId: ChainId = 'ethereum',
): TransactionSummary => ({
    kind: 'token-transfer',
    title: { key: i18nKey('transactions.list_item.send') },
    icon: direction === 'in' ? 'receive' : 'send',
    direction,
    amount: {
        assetRef: { chainId, assetId: USDC },
        value: new Decimal(value),
        display: { symbol, decimals: 6 },
    },
})

const assess = (overrides: Partial<AssessHistoryEntryParams>) =>
    assessHistoryEntry({
        summary: transfer('out', 5),
        signer: ME,
        isSignedElsewhere: undefined,
        accountAddress: ME,
        chainId: 'ethereum',
        isSuspectedPoisoning: false,
        storedAssets: undefined,
        ...overrides,
    })

const stored = (asset: Partial<PeraAsset>) =>
    new Map([[USDC, { assetId: USDC, ...asset } as PeraAsset]])

describe('assessHistoryEntry', () => {
    it('leaves the account’s own send alone', () => {
        const result = assess({})

        expect(result).toMatchObject({
            suspicion: null,
            titleKey: undefined,
            isApprovedSend: false,
            isMovingNothing: false,
        })
    })

    it('reads a real token another address sent from the account as an approved send', () => {
        const result = assess({ signer: OTHER })

        expect(result).toMatchObject({
            suspicion: null,
            titleKey: 'transactions.list_item.send_by_approval',
            isApprovedSend: true,
            isMovingNothing: false,
        })
    })

    it.each([
        ['signed by another address', { signer: OTHER }],
        [
            'known only from a transfer log',
            { signer: undefined, isSignedElsewhere: true },
        ],
    ])('reads a zero send %s as spoofed', (_label, overrides) => {
        const result = assess({ ...overrides, summary: transfer('out', 0) })

        expect(result).toMatchObject({
            suspicion: { kind: 'spoofed' },
            titleKey: 'transactions.list_item.spoofed_send',
            isApprovedSend: false,
            isMovingNothing: true,
        })
    })

    it('names a look-alike token another address sent as imitated, titled a spoofed send', () => {
        const result = assess({
            signer: OTHER,
            summary: transfer('out', 5, 'USDꓚ'),
        })

        expect(result).toMatchObject({
            suspicion: { kind: 'imitated', code: 'USDC' },
            titleKey: 'transactions.list_item.spoofed_send',
            isMovingNothing: true,
        })
    })

    it('never reads an Algorand send another address signed as spoofed or approved, as 0-ALGO sends are routine', () => {
        const result = assess({
            chainId: 'algorand',
            signer: OTHER,
            summary: transfer('out', 0, 'ALGO', 'algorand'),
        })

        expect(result).toMatchObject({
            suspicion: null,
            titleKey: undefined,
            isApprovedSend: false,
            isMovingNothing: false,
        })
    })

    it('puts suspected poisoning ahead of a look-alike, with no title of its own', () => {
        const result = assess({
            isSuspectedPoisoning: true,
            signer: OTHER,
            summary: transfer('out', 5, 'USDꓚ'),
        })

        expect(result).toMatchObject({
            suspicion: { kind: 'poisoning' },
            titleKey: undefined,
            isMovingNothing: true,
        })
    })

    it('flags a received token Pera marks suspicious, muting only its asset', () => {
        const result = assess({
            summary: transfer('in', 1),
            storedAssets: stored({
                peraMetadata: { verificationTier: 'suspicious' },
            } as Partial<PeraAsset>),
        })

        expect(result.suspicion).toEqual({ kind: 'flagged-token' })
        expect([...result.flaggedAssetIds]).toEqual([USDC])
        expect(result.isMovingNothing).toBe(false)
    })

    it('flags a received token whose symbol calls to claim', () => {
        const result = assess({
            summary: transfer('in', 1, 'Claim reward at x.com'),
        })

        expect(result.suspicion).toEqual({ kind: 'flagged-token' })
    })

    it('leaves a scam-named asset alone on a chain where the user opts in to each asset', () => {
        const result = assess({
            chainId: 'algorand',
            summary: transfer('in', 1, 'Claim reward', 'algorand'),
        })

        expect(result.suspicion).toBeNull()
    })

    it('judges only the visible amounts for a flagged token', () => {
        const leg = (assetId: string, symbol: string): BalanceChange => ({
            assetRef: { chainId: 'ethereum', assetId },
            value: new Decimal(1),
            display: { symbol, decimals: 0 },
        })
        const result = assess({
            summary: {
                ...transfer('none', 1),
                kind: 'contract-call',
                balanceChanges: [
                    leg('0xa', 'AAA'),
                    leg('0xb', 'BBB'),
                    leg('0xc', 'Claim now'),
                ],
            },
        })

        expect(result.suspicion).toBeNull()
    })
})

describe('suspicionCopyOf', () => {
    it.each([
        [
            { kind: 'poisoning' as const },
            'transactions.suspected_poisoning.title',
            'transactions.suspected_poisoning.body',
        ],
        [
            { kind: 'spoofed' as const },
            'transactions.suspected_fake_transfer.title',
            'transactions.suspected_fake_transfer.body',
        ],
        [
            { kind: 'flagged-token' as const },
            'asset_details.token_warning.suspicious_title',
            'asset_details.token_warning.body',
        ],
    ])('explains %o', (suspicion, title, body) => {
        expect(suspicionCopyOf(suspicion)).toEqual({
            title: { key: title },
            body: { key: body },
        })
    })

    it('names the imitated ticker in both lines', () => {
        const params = { code: 'ETH' }

        expect(suspicionCopyOf({ kind: 'imitated', code: 'ETH' })).toEqual({
            title: { key: 'asset.imitated_currency.title', params },
            body: { key: 'asset.imitated_currency.body', params },
        })
    })
})
