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

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@test-utils/render'
import { BalanceLineChart } from '../BalanceLineChart'

vi.mock('react-native-gifted-charts', () => ({
    LineChart: () => <div data-testid='line-chart'>LineChart</div>,
}))

const EMPTY_BODY = 'no balance history'

const renderChart = (props: Partial<Parameters<typeof BalanceLineChart>[0]>) =>
    render(
        <BalanceLineChart
            dataPoints={[]}
            isPending={false}
            emptyBody={EMPTY_BODY}
            getPointerProps={vi.fn()}
            {...props}
        />,
    )

describe('BalanceLineChart', () => {
    it('renders the chart when data points are present', () => {
        renderChart({ dataPoints: [{ value: 1 }, { value: 2 }] })

        expect(screen.getByTestId('line-chart')).toBeTruthy()
        expect(screen.queryByText(EMPTY_BODY)).toBeNull()
    })

    it('renders the empty body when there is no data and no error', () => {
        renderChart({ dataPoints: [] })

        expect(screen.getByText(EMPTY_BODY)).toBeTruthy()
        expect(screen.queryByTestId('line-chart')).toBeNull()
    })

    it('renders a distinct error state instead of the empty body when isError', () => {
        // The error state must not reuse the "no history" empty copy, and it
        // surfaces the provided errorBody rather than treating it as "no data".
        renderChart({ isError: true, errorBody: 'could not load chart' })

        expect(screen.getByText('could not load chart')).toBeTruthy()
        expect(screen.queryByText(EMPTY_BODY)).toBeNull()
        expect(screen.queryByTestId('line-chart')).toBeNull()
    })

    it('calls onRetry when the retry button in the error state is pressed', () => {
        const onRetry = vi.fn()
        renderChart({ isError: true, onRetry })

        fireEvent.click(screen.getByTestId('balance-chart-retry'))

        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('omits the retry button when no onRetry is provided', () => {
        renderChart({ isError: true })

        expect(screen.queryByTestId('balance-chart-retry')).toBeNull()
    })
})
