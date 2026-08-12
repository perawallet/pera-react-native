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

const { lineChartProps, requestSheet } = vi.hoisted(() => ({
    lineChartProps: { current: null as Record<string, unknown> | null },
    requestSheet: vi.fn().mockResolvedValue(undefined),
}))

// victory-native renders through Skia, which needs a real canvas surface —
// stub it and capture the props so these stay behavioral rather than visual.
vi.mock('victory-native', () => ({
    CartesianChart: (props: Record<string, unknown>) => {
        lineChartProps.current = props
        return <div data-testid='line-chart'>CartesianChart</div>
    },
    Area: () => null,
    Line: () => null,
    useChartPressState: () => ({
        state: {
            isActive: { value: false },
            matchedIndex: { value: -1 },
            x: { position: { value: 0 } },
            y: { value: { position: { value: 0 } } },
        },
        isActive: false,
    }),
}))

vi.mock('@shopify/react-native-skia', () => ({
    LinearGradient: () => null,
    Circle: () => null,
    DashPathEffect: () => null,
    Line: () => null,
    vec: (x: number, y: number) => ({ x, y }),
}))

// Same mock as useBalanceLineChart.spec.ts: no BottomSheetManager is mounted
// in these renders, and the real store's request() fail-loud rejection would
// escape the offline-retry test as an unhandled rejection (void-ed in the
// hook) and fail the whole vitest run.
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: requestSheet }),
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
        requestSheet.mockClear()
        useNetworkStatusStore.getState().setHasInternet(true)
    })

    it('maps the series through getValue into chart points', () => {
        renderChart({ series: [{ balance: 1 }, { balance: 2 }] })

        expect(screen.getByTestId('line-chart')).toBeTruthy()
        expect(lineChartProps.current?.data).toEqual([
            { index: 0, value: 1 },
            { index: 1, value: 2 },
        ])
        expect(screen.queryByText(EMPTY_BODY)).toBeNull()
    })

    // getChartYAxisRange reports a span above an offset (gifted-charts' idiom);
    // victory wants absolute bounds, so the top must be offset + span.
    it('converts the y-axis range into an absolute domain', () => {
        renderChart({ series: [{ balance: 100 }, { balance: 200 }] })

        const domain = lineChartProps.current!.domain as {
            y: [number, number]
        }
        const [min, max] = domain.y
        expect(min).toBeLessThan(100)
        expect(max).toBeGreaterThan(200)
    })

    // Victory applies activateAfterLongPress(100) unless an explicit pan config
    // is supplied. That hold-before-scrub is the exact lag this port removes,
    // so the config must stay explicit and must not reintroduce a delay.
    it('activates the scrub on horizontal travel rather than a long press', () => {
        renderChart({ series: [{ balance: 1 }, { balance: 2 }] })

        const pressConfig = lineChartProps.current!.chartPressConfig as {
            pan: Record<string, unknown>
        }
        const { pan } = pressConfig

        expect(pan.activateAfterLongPress).toBeUndefined()
        expect(pan.activeOffsetX).toEqual([-2, 2])
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

    it('does not dispatch a doomed request when retry is pressed while offline', () => {
        // Offline, the press opens an explanatory sheet rather than firing
        // onRetry.
        useNetworkStatusStore.getState().setHasInternet(false)
        const onRetry = vi.fn()
        renderChart({ series: undefined, isPaused: true, onRetry })

        fireEvent.click(screen.getByTestId('balance-chart-retry'))

        expect(onRetry).not.toHaveBeenCalled()
        expect(requestSheet).toHaveBeenCalledTimes(1)
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
