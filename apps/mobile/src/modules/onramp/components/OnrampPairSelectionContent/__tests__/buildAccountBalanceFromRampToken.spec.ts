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
import { registerAlgorandRampAdapter } from '@test-utils/rampChainAdapter'
import {
    makeAlgoToken,
    makeRampToken,
    USDC_ROUTER_ID,
} from '@test-utils/rampFixtures'
import { buildAccountBalanceFromRampToken } from '../buildAccountBalanceFromRampToken'

const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const

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
            makeAlgoToken(),
            null,
            MAINNET,
            null,
        )
        expect(result.assetId).toBe('0')
    })

    it("maps a token to its asset on the network, with the token's names", () => {
        const result = buildAccountBalanceFromRampToken(
            makeRampToken(),
            null,
            MAINNET,
            null,
        )
        expect(result.assetId).toBe('31566704')
        expect(result.asset?.name).toBe('USD Coin')
        expect(result.asset?.unitName).toBe('USDC')
        expect(result.asset?.decimals).toBe(6)
    })

    it('keeps the router id for a token with no asset on the network', () => {
        const result = buildAccountBalanceFromRampToken(
            makeRampToken({ id: 'other:1/token:7', symbol: 'MYS' }),
            null,
            MAINNET,
            null,
        )
        expect(result.assetId).toBe('other:1/token:7')
    })

    it("takes the verification tier from the token's asset", () => {
        const result = buildAccountBalanceFromRampToken(
            makeRampToken(),
            null,
            MAINNET,
            assetWithTier(PeraAssetVerificationTier.suspicious),
        )
        expect(result.asset?.peraMetadata?.verificationTier).toBe(
            PeraAssetVerificationTier.suspicious,
        )
    })

    it('verifies the native coin', () => {
        const result = buildAccountBalanceFromRampToken(
            makeAlgoToken(),
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
            makeRampToken({ id: USDC_ROUTER_ID }),
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
            makeAlgoToken(),
            new Decimal(12.5),
            MAINNET,
            null,
        )
        expect(result.amount.toString()).toBe('12.5')
    })

    it('defaults the amount to zero when balance is null', () => {
        const result = buildAccountBalanceFromRampToken(
            makeRampToken(),
            null,
            MAINNET,
            null,
        )
        expect(result.amount.toString()).toBe('0')
    })
})
