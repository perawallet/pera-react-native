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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import type {
    PeraAsset,
    PeraAssetVerificationTier,
} from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useAssetTitle } from '../useAssetTitle'

const ERC20 = '0x6B175474E89094C44Da98b954EedeAC495271d0F'

const make = (overrides: Partial<PeraAsset> = {}): PeraAsset =>
    ({
        assetId: '31566704',
        name: 'USDC',
        unitName: 'USDC',
        decimals: 6,
        ...overrides,
    }) as PeraAsset

const title = (
    asset: PeraAsset,
    chainId: ChainId = 'algorand',
    showId = false,
) => renderHook(() => useAssetTitle({ asset, chainId, showId })).result.current

describe('useAssetTitle', () => {
    beforeEach(() => {
        registerEthereumChain()
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it('names ALGO as trusted and hides its id even with showId', () => {
        const result = title(
            make({ assetId: '0', name: 'Algorand' }),
            'algorand',
            true,
        )

        expect(result.displayName).toBe('Algo')
        expect(result.verificationIcon).toBe('assets/trusted')
        expect(result.isIdVisible).toBe(false)
    })

    it('names ETH native as trusted and hides its id even with showId', () => {
        const result = title(
            make({ assetId: 'native', name: 'ethereum', unitName: 'ETH' }),
            'ethereum',
            true,
        )

        expect(result.displayName).toBe('Ether')
        expect(result.verificationIcon).toBe('assets/trusted')
        expect(result.isIdVisible).toBe(false)
    })

    it('shows the id of an ERC-20 token and badges it from its tier', () => {
        const verified = title(
            make({
                assetId: ERC20,
                name: 'Dai',
                peraMetadata: {
                    verificationTier: 'verified',
                    isDeleted: false,
                },
            }),
            'ethereum',
            true,
        )

        expect(verified.displayName).toBe('Dai')
        expect(verified.verificationIcon).toBe('assets/verified')
        expect(verified.isIdVisible).toBe(true)
        expect(verified.isSuspicious).toBe(false)
    })

    it('gives a trusted-tier token the trusted badge', () => {
        const result = title(
            make({
                peraMetadata: {
                    verificationTier: 'trusted' as PeraAssetVerificationTier,
                    isDeleted: false,
                },
            }),
        )

        expect(result.verificationIcon).toBe('assets/trusted')
        expect(result.isSuspicious).toBe(false)
    })

    it('marks a suspicious token and badges it', () => {
        const result = title(
            make({
                peraMetadata: {
                    verificationTier: 'suspicious',
                    isDeleted: false,
                },
            }),
        )

        expect(result.isSuspicious).toBe(true)
        expect(result.verificationIcon).toBe('assets/suspicious')
    })

    it('gives an untiered token no badge', () => {
        expect(title(make()).verificationIcon).toBeNull()
    })

    it("treats Algorand's native id on an EVM chain as a token", () => {
        const result = title(
            make({ assetId: '0', name: 'Zero' }),
            'ethereum',
            true,
        )

        expect(result.displayName).toBe('Zero')
        expect(result.verificationIcon).toBeNull()
        expect(result.isIdVisible).toBe(true)
    })

    it('hides the id of a deleted asset', () => {
        const result = title(
            make({
                peraMetadata: {
                    verificationTier: 'unverified',
                    isDeleted: true,
                },
            }),
            'algorand',
            true,
        )

        expect(result.isDeleted).toBe(true)
        expect(result.isIdVisible).toBe(false)
    })
})
