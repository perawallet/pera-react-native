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
import { render, fireEvent, screen } from '@test-utils/render'
// Ensure i18n is initialised so t() resolves real strings in this test's module graph.
import '../../../i18n'
import { useNetworkStatusStore } from '@modules/network'
import { BalanceLineChart } from '../BalanceLineChart'

const { lineChartProps } = vi.hoisted(() => ({
    lineChartProps: { current: null as Record<string, unknown> | null },
}))

vi.mock('react-native-gifted-charts', () => ({
    LineChart: (props: Record<string, unknown>) => {
        lineChartProps.current = props
        return <div data-testid='line-chart'>LineChart</div>
    },
}))

const EMPTY_BODY = 'no balance history'

type SeriesItem = { balance: number }

const renderChart = (
    props: Partial<Parameters<typeof BalanceLineChart<SeriesItem>>[0]> = {},
) =>
    render(
        <BalanceLineChart<SeriesItem>
            series={[]}
            getValue={item => item.balance}
            onSelectionChanged={vi.fn()}
            isPending={false}
            emptyBody={EMPTY_BODY}
            {...props}
        />,
    )

describe('BalanceLineChart', () => {
    beforeEach(() => {
        lineChartProps.current = null
        useNetworkStatusStore.getState().setHasInternet(true)
    })

    it('maps the series through getValue into chart points', () => {
        renderChart({ series: [{ balance: 1 }, { balance: 2 }] })

        expect(screen.getByTestId('line-chart')).toBeTruthy()
        expect(lineChartProps.current?.data).toEqual([
            { value: 1 },
            { value: 2 },
        ])
        expect(screen.queryByText(EMPTY_BODY)).toBeNull()
    })

    it('reports the focused series item through onSelectionChanged', () => {
        // The pointer-focus handler debounces from mount time — step the
        // clock past the debounce window before firing the event.
        vi.useFakeTimers()
        try {
            const onSelectionChanged = vi.fn()
            renderChart({
                series: [{ balance: 1 }, { balance: 2 }],
                onSelectionChanged,
            })

            vi.advanceTimersByTime(10_000)
            const getPointerProps = lineChartProps.current?.getPointerProps as (
                e: unknown,
            ) => void
            getPointerProps({ pointerIndex: 1, pointerX: 10 })

            expect(onSelectionChanged).toHaveBeenCalledWith({ balance: 2 })
        } finally {
            vi.useRealTimers()
        }
    })

    it('renders the empty body when the series is empty and no error', () => {
        renderChart({ series: [] })

        expect(screen.getByText(EMPTY_BODY)).toBeTruthy()
        expect(screen.queryByTestId('line-chart')).toBeNull()
    })

    it('renders the empty body while the series is still undefined', () => {
        renderChart({ series: undefined })

        expect(screen.getByText(EMPTY_BODY)).toBeTruthy()
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

    it('renders the offline state instead of the spinner when paused with no data', () => {
        renderChart({ series: undefined, isPending: true, isPaused: true })

        expect(screen.getByText('Offline Mode')).toBeTruthy()
        expect(
            screen.getByText(
                "You're offline — this will refresh automatically once you're back online.",
            ),
        ).toBeTruthy()
        expect(screen.queryByText(EMPTY_BODY)).toBeNull()
        expect(screen.queryByTestId('line-chart')).toBeNull()
    })

    it('keeps rendering the last-known chart when paused with stale data', () => {
        renderChart({
            series: [{ balance: 1 }, { balance: 2 }],
            isPaused: true,
        })

        expect(screen.getByTestId('line-chart')).toBeTruthy()
        expect(screen.queryByText('Offline Mode')).toBeNull()
    })

    it('keeps rendering the last-known chart when a background refetch errors', () => {
        renderChart({ series: [{ balance: 1 }, { balance: 2 }], isError: true })

        expect(screen.getByTestId('line-chart')).toBeTruthy()
    })

    it('shows a reachable retry in the offline state', () => {
        const onRetry = vi.fn()
        renderChart({ series: undefined, isPaused: true, onRetry })

        expect(screen.getByTestId('balance-chart-retry')).toBeTruthy()
    })

    it('short-circuits retry while the device is offline', () => {
        useNetworkStatusStore.getState().setHasInternet(false)
        const onRetry = vi.fn()
        renderChart({ series: undefined, isPaused: true, onRetry })

        fireEvent.click(screen.getByTestId('balance-chart-retry'))

        expect(onRetry).not.toHaveBeenCalled()
    })

    it('shows the offline state for an errored query while the device is offline', () => {
        useNetworkStatusStore.getState().setHasInternet(false)
        renderChart({ isError: true, errorBody: 'could not load chart' })

        expect(screen.getByText('Offline Mode')).toBeTruthy()
        expect(screen.queryByText('could not load chart')).toBeNull()
    })

    it('renders the loading spinner during a first online fetch', () => {
        renderChart({ series: undefined, isPending: true })

        expect(screen.queryByText(EMPTY_BODY)).toBeNull()
        expect(screen.queryByTestId('line-chart')).toBeNull()
        expect(screen.queryByText('Offline Mode')).toBeNull()
    })
})
