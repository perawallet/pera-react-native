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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { render, screen } from '@test-utils/render'
import { nativeAssetFor, type PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { FeeSummary, type FeeSummaryProps } from '..'

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    nativeAssetFor: vi.fn(),
}))

vi.mock('@components/PreferredAmount', async () => {
    const { PWText } = await import('@components/core')
    return {
        PreferredAmount: ({ testID }: { testID?: string }) => (
            <PWText testID={testID}>fiat</PWText>
        ),
    }
})

// Echo interpolation params so a label proves which values it was given.
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key} ${JSON.stringify(params)}` : key,
    }),
}))

const SCOPE = {
    chainId: 'testchain',
    networkId: 'mainnet',
} as unknown as ChainScope

const NATIVE_ASSET = {
    assetId: 'native',
    unitName: 'TKN',
    name: 'Token',
    decimals: 6,
} as PeraAsset

const renderSummary = (props: Partial<FeeSummaryProps> = {}) =>
    render(
        <FeeSummary
            scope={SCOPE}
            maxAmount={new Decimal(3000)}
            {...props}
        />,
    )

describe('FeeSummary', () => {
    beforeEach(() => {
        vi.mocked(nativeAssetFor).mockReturnValue(NATIVE_ASSET)
    })

    it('shows the tier, the estimate and the max, each with a fiat value', () => {
        renderSummary({
            estimate: { preset: 'normal', amount: new Decimal(2000) },
        })

        expect(screen.getByText('send_funds.fee.normal')).toBeTruthy()
        expect(screen.getByTestId('fee_summary_estimate').textContent).toMatch(
            /0\.002 TKN$/,
        )
        expect(screen.getByTestId('fee_summary_estimate_fiat')).toBeTruthy()
        expect(screen.getByTestId('fee_summary_max').textContent).toMatch(
            /0\.003 TKN$/,
        )
        expect(screen.getByTestId('fee_summary_max_fiat')).toBeTruthy()
        expect(
            screen.getByText(
                'send_funds.fee.max_fee_for_preset {"preset":"send_funds.fee.normal"}',
            ),
        ).toBeTruthy()
    })

    it('shows only the max fee when the request carried no estimate', () => {
        renderSummary()

        expect(screen.queryByTestId('fee_summary_estimate')).toBeNull()
        expect(screen.getByText('send_funds.fee.max_fee')).toBeTruthy()
        expect(screen.getByTestId('fee_summary_max')).toBeTruthy()
        expect(screen.getByTestId('fee_summary_max_fiat')).toBeTruthy()
    })
})
