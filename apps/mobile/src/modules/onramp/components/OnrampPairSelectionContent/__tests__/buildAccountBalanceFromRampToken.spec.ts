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

// @vitest-environment node

import { Decimal } from 'decimal.js'
import {
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { registerAlgorandRampAdapter } from '@test-utils/rampChainAdapter'
import { buildAccountBalanceFromRampToken } from '../buildAccountBalanceFromRampToken'

const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const

const makeToken = (overrides: Partial<RampToken> = {}): RampToken => ({
    id: 'USDC_ALGORAND',
    symbol: 'USDC',
    name: 'USD Coin',
    fractionDecimals: 6,
    logo: 'https://example.com/usdc.png',
    network: { id: 'ALGORAND', name: 'Algorand', logo: null },
    priceInUsd: new Decimal(1),
    ...overrides,
})

const assetWithTier = (
    verificationTier: PeraAssetVerificationTier,
): PeraAsset =>
    ({
        assetId: '31566704',
        peraMetadata: { verificationTier },
    }) as PeraAsset

describe('buildAccountBalanceFromRampToken', () => {
    beforeEach(() => {
        registerAlgorandRampAdapter()
    })

    it('maps ALGO to asset id 0', () => {
        const result = buildAccountBalanceFromRampToken(
            makeToken({ id: 'ALGO', symbol: 'ALGO', name: 'Algorand' }),
            null,
            MAINNET,
            null,
        )
        expect(result.assetId).toBe('0')
    })

    it("maps a token to its asset on the network, with the token's names", () => {
        const result = buildAccountBalanceFromRampToken(
            makeToken(),
            null,
            MAINNET,
            null,
        )
        expect(result.assetId).toBe('31566704')
        expect(result.asset?.name).toBe('USD Coin')
        expect(result.asset?.unitName).toBe('USDC')
        expect(result.asset?.decimals).toBe(6)
    })

    it('keeps the ramp id for a token with no asset on the network', () => {
        const result = buildAccountBalanceFromRampToken(
            makeToken({ id: 'MYSTERY', symbol: 'MYS' }),
            null,
            MAINNET,
            null,
        )
        expect(result.assetId).toBe('MYSTERY')
    })

    it("takes the verification tier from the token's asset", () => {
        const result = buildAccountBalanceFromRampToken(
            makeToken(),
            null,
            MAINNET,
            assetWithTier(PeraAssetVerificationTier.suspicious),
        )
        expect(result.asset?.peraMetadata?.verificationTier).toBe(
            PeraAssetVerificationTier.suspicious,
        )
    })

    it('verifies the native coin listed under its on-chain id', () => {
        const result = buildAccountBalanceFromRampToken(
            makeToken({ id: '0', symbol: 'ALGO', name: 'Algorand' }),
            null,
            MAINNET,
            null,
        )
        expect(result.asset?.peraMetadata?.verificationTier).toBe(
            PeraAssetVerificationTier.verified,
        )
    })

    it('falls back to the default tier until the asset loads', () => {
        const result = buildAccountBalanceFromRampToken(
            makeToken(),
            null,
            MAINNET,
            null,
        )
        expect(result.asset?.peraMetadata?.verificationTier).toBe(
            PeraAssetVerificationTier.unverified,
        )
    })

    it('uses the provided balance as the amount', () => {
        const result = buildAccountBalanceFromRampToken(
            makeToken({ id: 'ALGO', symbol: 'ALGO' }),
            new Decimal(12.5),
            MAINNET,
            null,
        )
        expect(result.amount.toString()).toBe('12.5')
    })

    it('defaults the amount to zero when balance is null', () => {
        const result = buildAccountBalanceFromRampToken(
            makeToken(),
            null,
            MAINNET,
            null,
        )
        expect(result.amount.toString()).toBe('0')
    })
})
