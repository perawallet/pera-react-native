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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { SwapQuoteFailure } from '@perawallet/wallet-core-swaps'
import { useSwapQuoteError } from '../useSwapQuoteError'

const mockT = vi.fn((key: string, params?: Record<string, unknown>) =>
    params ? `${key}|${JSON.stringify(params)}` : key,
)

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: mockT, currentLanguage: 'en' }),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal =>
    importOriginal<typeof import('@perawallet/wallet-core-shared')>(),
)

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    chainDisplayNameOf: (chainId: string) =>
        chainId === 'ethereum' ? 'Ethereum' : undefined,
}))

let mockAssets: Map<string, unknown>
vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: () => ({ data: mockAssets }),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const asset = (unitName: string, decimals: number) => ({
    assetId: unitName,
    unitName,
    decimals,
})

const render = (failure: SwapQuoteFailure) =>
    renderHook(() =>
        useSwapQuoteError({
            failure,
            scope: SCOPE,
            payAssetId: 'pay',
            receiveScope: SCOPE,
            receiveAssetId: 'receive',
        }),
    ).result.current

describe('useSwapQuoteError', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAssets = new Map<string, unknown>([
            ['pay', asset('USDC', 6)],
            ['receive', asset('ETH', 18)],
        ])
    })

    it('names the minimum of a too-low amount in the pay asset', () => {
        const { message } = render({
            kind: 'amount-too-low',
            minimum: new Decimal(1_000_001),
        })

        expect(message).toBe(
            `swap.quote.amount_too_low|${JSON.stringify({
                network: 'Ethereum',
                amount: '1.000001',
                unit: 'USDC',
            })}`,
        )
    })

    it('rounds an 18-decimal minimum up to the display precision', () => {
        mockAssets.set('pay', asset('ETH', 18))

        const { message } = render({
            kind: 'amount-too-low',
            minimum: new Decimal('123456789012345'),
        })

        expect(message).toContain('"amount":"0.000124"')
    })

    it('rounds an 18-decimal maximum down to the display precision', () => {
        mockAssets.set('pay', asset('ETH', 18))

        const { message } = render({
            kind: 'amount-too-high',
            maximum: new Decimal('123456789012345'),
        })

        expect(message).toBe(
            `swap.quote.amount_too_high|${JSON.stringify({
                amount: '0.000123',
                unit: 'ETH',
            })}`,
        )
    })

    it('falls back to the copy without a limit when the router named none', () => {
        expect(render({ kind: 'amount-too-low', minimum: null }).message).toBe(
            `swap.quote.amount_too_low_unknown|${JSON.stringify({ network: 'Ethereum' })}`,
        )
        expect(render({ kind: 'amount-too-high', maximum: null }).message).toBe(
            'swap.quote.amount_too_high_unknown',
        )
    })

    it('falls back to the copy without a limit when the pay asset is unknown', () => {
        mockAssets = new Map()

        const { message } = render({
            kind: 'amount-too-low',
            minimum: new Decimal(5),
        })

        expect(message).toContain('swap.quote.amount_too_low_unknown')
    })

    it('names both assets when no route exists', () => {
        expect(render({ kind: 'no-route' }).message).toBe(
            `swap.quote.no_route|${JSON.stringify({ from: 'USDC', to: 'ETH' })}`,
        )
    })

    it.each([
        ['invalid-amount', 'swap.quote.amount_invalid'],
        ['unsupported', 'swap.quote.unsupported'],
        ['unavailable', 'swap.quote.quote_error'],
    ] as const)('shows the copy for %s', (kind, key) => {
        expect(render({ kind }).message).toBe(key)
    })

    it.each([
        [{ kind: 'amount-too-low', minimum: null }, false],
        [{ kind: 'amount-too-high', maximum: null }, false],
        [{ kind: 'invalid-amount' }, false],
        [{ kind: 'no-route' }, false],
        [{ kind: 'unsupported' }, false],
        [{ kind: 'unavailable' }, true],
    ] as const)('offers Retry for %j: %s', (failure, canRetry) => {
        expect(render(failure).canRetry).toBe(canRetry)
    })
})
