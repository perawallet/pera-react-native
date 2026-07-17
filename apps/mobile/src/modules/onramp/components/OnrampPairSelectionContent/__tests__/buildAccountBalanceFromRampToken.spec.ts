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
import { PeraAssetVerificationTier } from '@perawallet/wallet-core-assets'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { buildAccountBalanceFromRampToken } from '../buildAccountBalanceFromRampToken'

const makeToken = (overrides: Partial<RampToken> = {}): RampToken => ({
    id: 'USDC_ALGORAND',
    symbol: 'USDC',
    name: 'USD Coin',
    fractionDecimals: 6,
    logo: 'https://example.com/usdc.png',
    network: { id: 'algorand', name: 'Algorand', logo: null },
    priceInUsd: new Decimal(1),
    ...overrides,
})

describe('buildAccountBalanceFromRampToken', () => {
    it('maps ALGO to asset id 0', () => {
        const result = buildAccountBalanceFromRampToken(
            makeToken({ id: 'ALGO', symbol: 'ALGO', name: 'Algorand' }),
            null,
        )
        expect(result.assetId).toBe('0')
    })

    it('maps name, unit name and decimals from the token', () => {
        const result = buildAccountBalanceFromRampToken(makeToken(), null)
        expect(result.assetId).toBe('USDC_ALGORAND')
        expect(result.asset?.name).toBe('USD Coin')
        expect(result.asset?.unitName).toBe('USDC')
        expect(result.asset?.decimals).toBe(6)
    })

    it('applies the verified tier to known tokens', () => {
        const result = buildAccountBalanceFromRampToken(makeToken(), null)
        expect(result.asset?.peraMetadata?.verificationTier).toBe(
            PeraAssetVerificationTier.verified,
        )
    })

    it('falls back to the default tier for unknown tokens', () => {
        const result = buildAccountBalanceFromRampToken(
            makeToken({ id: 'MYSTERY', symbol: 'MYS' }),
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
        )
        expect(result.amount.toString()).toBe('12.5')
    })

    it('defaults the amount to zero when balance is null', () => {
        const result = buildAccountBalanceFromRampToken(makeToken(), null)
        expect(result.amount.toString()).toBe('0')
    })
})
