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

import { describe, it, expect, vi } from 'vitest'
import { resolveSwapRouteAssets } from '../resolveSwapRouteAssets'

const USDC_MAINNET = '31566704'
const USDC_TESTNET = '10458941'
const TOKEN = '887406851'

vi.mock('@perawallet/wallet-core-assets', () => ({
    getKnownAssetId: (_key: string, network: string) =>
        network === 'testnet' ? '10458941' : '31566704',
}))

describe('resolveSwapRouteAssets', () => {
    it('returns null when no asset params are present', () => {
        expect(resolveSwapRouteAssets(undefined, 'mainnet')).toBeNull()
        expect(resolveSwapRouteAssets({}, 'mainnet')).toBeNull()
    })

    it('keeps a distinct output asset (ALGO -> token)', () => {
        expect(
            resolveSwapRouteAssets(
                { assetInId: '0', assetOutId: TOKEN },
                'mainnet',
            ),
        ).toEqual({ assetInId: '0', assetOutId: TOKEN })
    })

    it('falls back to USDC when the output is missing (ALGO page → ALGO/USDC)', () => {
        expect(resolveSwapRouteAssets({ assetInId: '0' }, 'mainnet')).toEqual({
            assetInId: '0',
            assetOutId: USDC_MAINNET,
        })
    })

    it('falls back to USDC when the output equals the input', () => {
        expect(
            resolveSwapRouteAssets(
                { assetInId: '0', assetOutId: '0' },
                'mainnet',
            ),
        ).toEqual({ assetInId: '0', assetOutId: USDC_MAINNET })
    })

    it('uses the network-specific USDC id on testnet', () => {
        expect(resolveSwapRouteAssets({ assetInId: '0' }, 'testnet')).toEqual({
            assetInId: '0',
            assetOutId: USDC_TESTNET,
        })
    })

    it('defaults the input to ALGO when only an output is provided', () => {
        expect(
            resolveSwapRouteAssets({ assetOutId: TOKEN }, 'mainnet'),
        ).toEqual({ assetInId: '0', assetOutId: TOKEN })
    })

    it('normalises an empty-string input to ALGO', () => {
        expect(
            resolveSwapRouteAssets(
                { assetInId: '', assetOutId: TOKEN },
                'mainnet',
            ),
        ).toEqual({ assetInId: '0', assetOutId: TOKEN })
    })
})
