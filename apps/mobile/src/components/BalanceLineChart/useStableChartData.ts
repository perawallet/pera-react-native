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

import { useMemo, useRef } from 'react'

export type ChartDatum = { index: number; value: number }

const EMPTY: ChartDatum[] = []

const haveSameValues = (a: ChartDatum[], b: ChartDatum[]): boolean =>
    a.length === b.length && a.every((point, i) => point.value === b[i]?.value)

/**
 * Maps a series to chart points, returning the *same array reference* whenever
 * the plotted numbers are unchanged.
 *
 * This is load-bearing, not an optimisation. victory-native resets its entire
 * chart-press state — killing an in-progress scrub — from a `useEffect` keyed
 * on the `data` prop's identity. Several of the history queries build their
 * results in an inline `select`, so a refetch (or merely a re-render) hands us
 * an equal-but-new array; without this the user's finger is still down and the
 * selection just vanishes (PERA-4849). Don't collapse this back to a plain
 * useMemo on `series`.
 */
export const useStableChartData = <T>(
    series: T[] | undefined,
    getValue: (item: T) => number,
): ChartDatum[] => {
    const next = useMemo(
        () =>
            series?.map((item, index) => ({
                index,
                value: getValue(item),
            })) ?? EMPTY,
        [series, getValue],
    )

    const stable = useRef<ChartDatum[]>(EMPTY)
    if (!haveSameValues(stable.current, next)) {
        stable.current = next
    }
    return stable.current
}
