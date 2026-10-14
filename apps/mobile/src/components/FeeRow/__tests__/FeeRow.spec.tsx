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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { render, fireEvent, screen } from '@test-utils/render'
import { nativeAssetFor, type PeraAsset } from '@perawallet/wallet-core-assets'
import type {
    ChainId,
    FeePreset,
    FeePresetEstimate,
} from '@perawallet/wallet-core-chain-contract'
import { useChainFeeModel } from '@perawallet/wallet-core-chain-shared'
import { PWText } from '@components/core'
import { FeeRow, FEE_ROW_TEST_ID, type FeeRowProps } from '..'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainFeeModel: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    nativeAssetFor: vi.fn(),
    // CurrencyAmount asks whether the amount is the native asset of the
    // legacy network, which needs a registered assets adapter.
    useIsNativeAssetId: () => () => false,
}))

const CHAIN_ID = 'testchain' as ChainId

const NATIVE_ASSET = {
    assetId: 'native',
    unitName: 'TKN',
    name: 'Token',
    decimals: 6,
} as PeraAsset

const estimate = (amount: number, maxAmount: number): FeePresetEstimate => ({
    amount: new Decimal(amount),
    maxAmount: new Decimal(maxAmount),
})

const PRESETS: Record<FeePreset, FeePresetEstimate> = {
    slow: estimate(1000, 1500),
    normal: estimate(2000, 3000),
    fast: estimate(5000, 8000),
}

const renderRow = (props: Partial<FeeRowProps> = {}) =>
    render(
        <FeeRow
            chainId={CHAIN_ID}
            amount={new Decimal(2000)}
            isLoading={false}
            selectedPreset='normal'
            onPresetChange={vi.fn()}
            {...props}
        />,
    )

const isRadioSelected = (preset: FeePreset): boolean =>
    screen.getByTestId(`fee_preset_${preset}-radio`).childElementCount > 0

describe('FeeRow', () => {
    beforeEach(() => {
        vi.mocked(nativeAssetFor).mockReturnValue(NATIVE_ASSET)
    })

    describe('on a flat-fee chain', () => {
        beforeEach(() => {
            vi.mocked(useChainFeeModel).mockReturnValue('flat')
        })

        it('shows the fee in display units with no preset choice', () => {
            renderRow({ amount: new Decimal(1000), presets: PRESETS })

            expect(screen.getByTestId(FEE_ROW_TEST_ID)).toBeTruthy()
            expect(screen.getByText(/0\.001/)).toBeTruthy()
            expect(screen.queryByTestId(/^fee_preset_/)).toBeNull()
        })

        it('shows the accessory beside the fee', () => {
            renderRow({ accessory: <PWText>extra</PWText> })

            expect(screen.getByText('extra')).toBeTruthy()
        })

        it('hides the amount while the fee loads', () => {
            renderRow({ amount: new Decimal(1000), isLoading: true })

            expect(screen.getByTestId(FEE_ROW_TEST_ID)).toBeTruthy()
            expect(screen.queryByText(/0\.001/)).toBeNull()
        })
    })

    describe('on a gas-priced chain', () => {
        beforeEach(() => {
            vi.mocked(useChainFeeModel).mockReturnValue('gas')
        })

        it('lists slow, normal and fast in that order with their amounts', () => {
            renderRow({ presets: PRESETS })

            const presetIds = screen
                .getAllByTestId(/^fee_preset_(slow|normal|fast)$/)
                .map(element => element.getAttribute('data-testid'))
            expect(presetIds).toEqual([
                'fee_preset_slow',
                'fee_preset_normal',
                'fee_preset_fast',
            ])
            expect(screen.getByText('send_funds.fee.slow')).toBeTruthy()
            expect(screen.getByText('send_funds.fee.normal')).toBeTruthy()
            expect(screen.getByText('send_funds.fee.fast')).toBeTruthy()
            expect(screen.getByText(/0\.001(?!5)/)).toBeTruthy()
            expect(screen.getByText(/0\.005/)).toBeTruthy()
        })

        it('marks only the selected preset', () => {
            renderRow({ presets: PRESETS, selectedPreset: 'normal' })

            expect(isRadioSelected('normal')).toBe(true)
            expect(isRadioSelected('slow')).toBe(false)
            expect(isRadioSelected('fast')).toBe(false)
        })

        it('reports the preset the user presses', () => {
            const onPresetChange = vi.fn()
            renderRow({ presets: PRESETS, onPresetChange })

            fireEvent.click(screen.getByTestId('fee_preset_fast'))

            expect(onPresetChange).toHaveBeenCalledTimes(1)
            expect(onPresetChange).toHaveBeenCalledWith('fast')
        })

        it("shows the selected preset's maximum fee", () => {
            const { rerender } = renderRow({
                presets: PRESETS,
                selectedPreset: 'normal',
            })
            expect(screen.getByTestId('fee_preset_max').textContent).toMatch(
                /0\.003/,
            )

            rerender(
                <FeeRow
                    chainId={CHAIN_ID}
                    amount={new Decimal(5000)}
                    presets={PRESETS}
                    isLoading={false}
                    selectedPreset='fast'
                    onPresetChange={vi.fn()}
                />,
            )

            expect(screen.getByTestId('fee_preset_max').textContent).toMatch(
                /0\.008/,
            )
        })

        it('keeps presets with equal amounts individually selectable', () => {
            const onPresetChange = vi.fn()
            renderRow({
                presets: { ...PRESETS, slow: PRESETS.normal },
                selectedPreset: 'slow',
                onPresetChange,
            })

            fireEvent.click(screen.getByTestId('fee_preset_normal'))

            expect(isRadioSelected('slow')).toBe(true)
            expect(isRadioSelected('normal')).toBe(false)
            expect(onPresetChange).toHaveBeenCalledWith('normal')
        })

        it('falls back to the single fee when the estimate has no presets', () => {
            renderRow({ amount: new Decimal(1000), presets: undefined })

            expect(screen.getByText(/0\.001/)).toBeTruthy()
            expect(screen.queryByTestId(/^fee_preset_/)).toBeNull()
        })
    })

    it('shows the single fee on a size-rate chain', () => {
        vi.mocked(useChainFeeModel).mockReturnValue('rate')

        renderRow({ amount: new Decimal(1000), presets: PRESETS })

        expect(screen.getByText(/0\.001/)).toBeTruthy()
        expect(screen.queryByTestId(/^fee_preset_/)).toBeNull()
    })
})
