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

// @vitest-environment node

import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import type {
    DisplayableAsset,
    PeraAssetVerificationTier,
} from '@perawallet/wallet-core-assets'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { getVerificationIcon, unvettedTierOf } from '../verification'

describe('getVerificationIcon', () => {
    it.each([
        ['verified', 'assets/verified'],
        ['trusted', 'assets/trusted'],
        ['suspicious', 'assets/suspicious'],
    ])('maps the %s tier to its icon', (tier, icon) => {
        expect(getVerificationIcon(tier)).toBe(icon)
    })

    it('returns null for the unverified tier (no icon)', () => {
        expect(getVerificationIcon('unverified')).toBeNull()
    })

    it('returns null for an unknown tier', () => {
        expect(getVerificationIcon('something-else')).toBeNull()
    })
})

describe('unvettedTierOf', () => {
    const token = (
        verificationTier: PeraAssetVerificationTier,
        overrides: Partial<DisplayableAsset> = {},
    ): DisplayableAsset => ({
        assetId: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        name: 'Token',
        peraMetadata: { verificationTier },
        ...overrides,
    })

    beforeEach(() => {
        registerEthereumChain()
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it.each(['unverified', 'suspicious'] as const)(
        'names the %s tier of a token on a chain where tokens arrive unasked',
        tier => {
            expect(unvettedTierOf(token(tier), 'ethereum')).toBe(tier)
        },
    )

    it('is null for a verified token', () => {
        expect(unvettedTierOf(token('verified'), 'ethereum')).toBeNull()
    })

    it('is null for an asset the user opted in to on Algorand', () => {
        expect(
            unvettedTierOf(token('unverified', { assetId: '123' }), 'algorand'),
        ).toBeNull()
    })

    it('is null for the native coin and for a collectible', () => {
        expect(
            unvettedTierOf(
                token('unverified', { assetId: 'native' }),
                'ethereum',
            ),
        ).toBeNull()
        expect(
            unvettedTierOf(
                token('unverified', {
                    peraMetadata: {
                        verificationTier: 'unverified',
                        type: 'collectible',
                    },
                }),
                'ethereum',
            ),
        ).toBeNull()
    })

    it('is null for an asset with no metadata yet', () => {
        expect(
            unvettedTierOf(
                token('verified', { peraMetadata: undefined }),
                'ethereum',
            ),
        ).toBeNull()
    })
})
