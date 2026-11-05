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
import {
    resolveSwapRouteAssets,
    routeAssetInIdOn,
} from '../resolveSwapRouteAssets'

const USDC_MAINNET = '31566704'
const USDC_TESTNET = '10458941'
const TOKEN = '887406851'
const algo = (assetId: string) => ({ chainId: 'algorand' as const, assetId })

// Mirrors the real getKnownAssetId: an id only on the Pera-backed networks,
// `null` everywhere else. A catch-all that handed back MainNet's id for any
// unrecognized network would route straight past the `=== null` guard under
// test. Ids are inlined rather than read from the constants below because a
// vi.mock factory is hoisted above them.
vi.mock('@perawallet/wallet-core-assets', () => ({
    nativeAssetFor: () => ({ assetId: '0' }),
    getKnownAssetId: (
        _key: string,
        { networkId: network }: { networkId: string },
    ) => ({ mainnet: '31566704', testnet: '10458941' })[network] ?? null,
}))

describe('resolveSwapRouteAssets', () => {
    it('returns null when no asset params are present', () => {
        expect(
            resolveSwapRouteAssets(undefined, {
                chainId: 'algorand',
                networkId: 'mainnet',
            }),
        ).toBeNull()
        expect(
            resolveSwapRouteAssets(
                {},
                { chainId: 'algorand', networkId: 'mainnet' },
            ),
        ).toBeNull()
    })

    it('keeps a distinct output asset (ALGO -> token)', () => {
        expect(
            resolveSwapRouteAssets(
                { assetIn: algo('0'), assetOut: algo(TOKEN) },
                { chainId: 'algorand', networkId: 'mainnet' },
            ),
        ).toEqual({ assetInId: '0', assetOutId: TOKEN })
    })

    it('falls back to USDC when the output is missing (ALGO page → ALGO/USDC)', () => {
        expect(
            resolveSwapRouteAssets(
                { assetIn: algo('0') },
                { chainId: 'algorand', networkId: 'mainnet' },
            ),
        ).toEqual({
            assetInId: '0',
            assetOutId: USDC_MAINNET,
        })
    })

    it('falls back to USDC when the output equals the input', () => {
        expect(
            resolveSwapRouteAssets(
                { assetIn: algo('0'), assetOut: algo('0') },
                { chainId: 'algorand', networkId: 'mainnet' },
            ),
        ).toEqual({ assetInId: '0', assetOutId: USDC_MAINNET })
    })

    it('uses the network-specific USDC id on testnet', () => {
        expect(
            resolveSwapRouteAssets(
                { assetIn: algo('0') },
                { chainId: 'algorand', networkId: 'testnet' },
            ),
        ).toEqual({
            assetInId: '0',
            assetOutId: USDC_TESTNET,
        })
    })

    it('returns null on a network with no known USDC to default the output to', () => {
        expect(
            resolveSwapRouteAssets(
                { assetIn: algo('0') },
                { chainId: 'algorand', networkId: 'betanet' },
            ),
        ).toBeNull()
        expect(
            resolveSwapRouteAssets(
                { assetIn: algo('0'), assetOut: algo('0') },
                { chainId: 'algorand', networkId: 'custom' },
            ),
        ).toBeNull()
    })

    it('still resolves an explicit pair on a network with no known USDC', () => {
        // Only the USDC *default* is unavailable there — a fully specified
        // route needs no known id at all.
        expect(
            resolveSwapRouteAssets(
                { assetIn: algo('0'), assetOut: algo(TOKEN) },
                { chainId: 'algorand', networkId: 'betanet' },
            ),
        ).toEqual({ assetInId: '0', assetOutId: TOKEN })
    })

    it('defaults the input to ALGO when only an output is provided', () => {
        expect(
            resolveSwapRouteAssets(
                { assetOut: algo(TOKEN) },
                { chainId: 'algorand', networkId: 'mainnet' },
            ),
        ).toEqual({ assetInId: '0', assetOutId: TOKEN })
    })

    it('treats a ref on another chain as absent', () => {
        expect(
            resolveSwapRouteAssets(
                {
                    assetIn: { chainId: 'ethereum' as const, assetId: '0xabc' },
                    assetOut: {
                        chainId: 'ethereum' as const,
                        assetId: '0xdef',
                    },
                },
                { chainId: 'algorand', networkId: 'mainnet' },
            ),
        ).toEqual({ assetInId: '0', assetOutId: USDC_MAINNET })
    })

    it('normalises an empty-string input to ALGO', () => {
        expect(
            resolveSwapRouteAssets(
                { assetIn: algo(''), assetOut: algo(TOKEN) },
                { chainId: 'algorand', networkId: 'mainnet' },
            ),
        ).toEqual({ assetInId: '0', assetOutId: TOKEN })
    })

    it('reads the route input only on its own chain', () => {
        const params = { assetIn: algo(TOKEN) }

        expect(
            routeAssetInIdOn(params, {
                chainId: 'algorand',
                networkId: 'betanet',
            }),
        ).toBe(TOKEN)
        expect(
            routeAssetInIdOn(params, {
                chainId: 'ethereum',
                networkId: 'mainnet',
            }),
        ).toBeUndefined()
    })
})
