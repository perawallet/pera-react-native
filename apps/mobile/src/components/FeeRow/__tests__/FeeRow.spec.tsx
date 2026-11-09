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

import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { render, fireEvent, screen, within } from '@test-utils/render'
import { nativeAssetFor, type PeraAsset } from '@perawallet/wallet-core-assets'
import type {
    ChainScope,
    FeePreset,
    FeePresetEstimate,
} from '@perawallet/wallet-core-chain-contract'
import { useChainFeeModel } from '@perawallet/wallet-core-chain-shared'
import { PWText } from '@components/core'
import { PreferredAmount } from '@components/PreferredAmount'
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
}))

vi.mock('@components/PreferredAmount', () => ({
    PreferredAmount: vi.fn(() => null),
}))

vi.mock('@components/InfoButton', async () => {
    const { PWView } = await import('@components/core')
    return {
        InfoButton: ({
            testID,
            children,
        }: {
            testID?: string
            children?: ReactNode
        }) => <PWView testID={testID}>{children}</PWView>,
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

const estimate = (
    amount: number,
    maxAmount: number,
    estimatedWaitSeconds: number,
): FeePresetEstimate => ({
    amount: new Decimal(amount),
    maxAmount: new Decimal(maxAmount),
    estimatedWaitSeconds,
})

const PRESETS: Record<FeePreset, FeePresetEstimate> = {
    slow: estimate(1000, 1500, 90),
    normal: estimate(2000, 3000, 36),
    fast: estimate(5000, 8000, 12),
}

const renderRow = (props: Partial<FeeRowProps> = {}) =>
    render(
        <FeeRow
            scope={SCOPE}
            amount={new Decimal(2000)}
            isLoading={false}
            selectedPreset='normal'
            onPresetChange={vi.fn()}
            {...props}
        />,
    )

const isRadioSelected = (preset: FeePreset): boolean =>
    screen.getByTestId(`fee_preset_${preset}-radio`).childElementCount > 0

// A second press on the toggle inside 500 ms is swallowed by PWTouchableOpacity.
const openSpeeds = () =>
    fireEvent.click(screen.getByTestId('fee_preset_toggle'))

describe('FeeRow', () => {
    beforeEach(() => {
        vi.mocked(nativeAssetFor).mockReturnValue(NATIVE_ASSET)
        vi.mocked(PreferredAmount).mockReset()
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
            expect(screen.queryByTestId('fee_preset_toggle')).toBeNull()
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

        it('shows the selected speed and its fee closed, with no speed list', () => {
            renderRow({ presets: PRESETS })

            const toggle = screen.getByTestId('fee_preset_toggle')
            expect(toggle.textContent).toContain('send_funds.fee.normal')
            expect(
                screen.getByTestId('fee_preset_selected_amount').textContent,
            ).toMatch(/0\.002 TKN$/)
            expect(screen.queryByTestId('fee_preset_slow')).toBeNull()
            expect(screen.getByTestId('fee_preset_max')).toBeTruthy()
            expect(screen.getByTestId('fee_max_info')).toBeTruthy()
            expect(toggle.getAttribute('aria-expanded')).toBe('false')
        })

        it('names a speed chosen earlier when it renders closed', () => {
            renderRow({ presets: PRESETS, selectedPreset: 'fast' })

            expect(
                screen.getByTestId('fee_preset_selected_label').textContent,
            ).toBe('send_funds.fee.fast')
            expect(
                screen.getByTestId('fee_preset_selected_amount').textContent,
            ).toMatch(/0\.005/)
        })

        it('opens the list when the fee is pressed', () => {
            renderRow({ presets: PRESETS })

            openSpeeds()

            for (const preset of ['slow', 'normal', 'fast']) {
                expect(screen.getByTestId(`fee_preset_${preset}`)).toBeTruthy()
            }
            expect(
                screen
                    .getByTestId('fee_preset_toggle')
                    .getAttribute('aria-expanded'),
            ).toBe('true')
        })

        it('lists slow, normal and fast in that order with their amounts', () => {
            renderRow({ presets: PRESETS })
            openSpeeds()

            const presetIds = screen
                .getAllByTestId(/^fee_preset_(slow|normal|fast)$/)
                .map(element => element.getAttribute('data-testid'))
            expect(presetIds).toEqual([
                'fee_preset_slow',
                'fee_preset_normal',
                'fee_preset_fast',
            ])
            expect(screen.getByText('send_funds.fee.slow')).toBeTruthy()
            expect(screen.getByText('send_funds.fee.fast')).toBeTruthy()
            expect(
                screen.getByTestId('fee_preset_slow_amount').textContent,
            ).toMatch(/0\.001(?!5)/)
            expect(
                screen.getByTestId('fee_preset_fast_amount').textContent,
            ).toMatch(/0\.005/)
            expect(
                within(screen.getByTestId('fee_preset_normal')).getByText(
                    'send_funds.fee.normal',
                ),
            ).toBeTruthy()
        })

        it("shows each preset's expected wait", () => {
            renderRow({ presets: PRESETS })
            openSpeeds()

            expect(screen.getByTestId('fee_preset_slow_wait').textContent).toBe(
                'send_funds.fee.wait_minutes {"minutes":2}',
            )
            expect(
                screen.getByTestId('fee_preset_normal_wait').textContent,
            ).toBe('send_funds.fee.wait_seconds {"seconds":36}')
        })

        it('writes the unit after each amount, apart from the tier label', () => {
            renderRow({ presets: PRESETS })
            openSpeeds()

            // The shared-package stub of formatCurrency prefixes the currency
            // itself, so only the trailing unit is this component's doing.
            const amount = screen.getByTestId(
                'fee_preset_slow_amount',
            ).textContent
            expect(amount).toMatch(/0\.001 TKN$/)
            expect(amount).not.toContain('send_funds.fee.slow')
        })

        it('wraps the fee amounts instead of cutting them to one line', () => {
            renderRow({ presets: PRESETS })
            openSpeeds()

            for (const testID of [
                'fee_preset_selected_amount',
                'fee_preset_fast_amount',
                'fee_preset_max',
            ]) {
                expect(
                    screen.getByTestId(testID).getAttribute('numberoflines'),
                ).toBeNull()
            }
        })

        it('prices every preset and the maximum fee in the preferred currency', () => {
            vi.mocked(PreferredAmount).mockImplementation(
                ({ testID, ...props }) => (
                    <PWText testID={testID}>
                        {'sourceAmount' in props
                            ? props.sourceAmount?.toString()
                            : undefined}
                    </PWText>
                ),
            )
            renderRow({ presets: PRESETS, selectedPreset: 'normal' })
            openSpeeds()

            const fiat = (testID: string) =>
                screen.getByTestId(testID).textContent
            expect(fiat('fee_preset_selected_amount_fiat')).toBe('0.002')
            expect(fiat('fee_preset_slow_amount_fiat')).toBe('0.001')
            expect(fiat('fee_preset_normal_amount_fiat')).toBe('0.002')
            expect(fiat('fee_preset_fast_amount_fiat')).toBe('0.005')
            expect(fiat('fee_preset_max_fiat')).toBe('0.003')
            expect(vi.mocked(PreferredAmount).mock.calls[0][0]).toMatchObject({
                sourceAssetId: 'native',
                scope: SCOPE,
                density: 'compact',
            })
        })

        it('names the selected preset on the maximum fee and explains it', () => {
            renderRow({ presets: PRESETS, selectedPreset: 'fast' })

            expect(
                screen.getByText(
                    'send_funds.fee.max_fee_for_preset {"preset":"send_funds.fee.fast"}',
                ),
            ).toBeTruthy()
            expect(screen.getByTestId('fee_max_info')).toBeTruthy()
            expect(screen.getByText('send_funds.fee.max_fee_info')).toBeTruthy()
        })

        it('marks only the selected preset', () => {
            renderRow({ presets: PRESETS, selectedPreset: 'normal' })
            openSpeeds()

            expect(isRadioSelected('normal')).toBe(true)
            expect(isRadioSelected('slow')).toBe(false)
            expect(isRadioSelected('fast')).toBe(false)
        })

        it('reports the pressed speed and closes the list', () => {
            const onPresetChange = vi.fn()
            renderRow({ presets: PRESETS, onPresetChange })
            openSpeeds()

            fireEvent.click(screen.getByTestId('fee_preset_fast'))

            expect(onPresetChange).toHaveBeenCalledTimes(1)
            expect(onPresetChange).toHaveBeenCalledWith('fast')
            expect(screen.queryByTestId('fee_preset_slow')).toBeNull()
        })

        it('keeps the list open and re-prices it when the presets update', () => {
            const { rerender } = renderRow({ presets: PRESETS })
            openSpeeds()

            rerender(
                <FeeRow
                    scope={SCOPE}
                    amount={new Decimal(2500)}
                    presets={{ ...PRESETS, normal: estimate(2500, 3500, 36) }}
                    isLoading={false}
                    selectedPreset='normal'
                    onPresetChange={vi.fn()}
                />,
            )

            expect(screen.getByTestId('fee_preset_slow')).toBeTruthy()
            expect(
                screen.getByTestId('fee_preset_selected_amount').textContent,
            ).toMatch(/0\.0025/)
            expect(
                screen.getByTestId('fee_preset_normal_amount').textContent,
            ).toMatch(/0\.0025/)
            expect(screen.getByTestId('fee_preset_max').textContent).toMatch(
                /0\.0035/,
            )
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
                    scope={SCOPE}
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
            openSpeeds()

            expect(isRadioSelected('slow')).toBe(true)
            expect(isRadioSelected('normal')).toBe(false)

            fireEvent.click(screen.getByTestId('fee_preset_normal'))

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
