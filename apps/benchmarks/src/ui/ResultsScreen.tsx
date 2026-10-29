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

import { FlatList, Text, View } from 'react-native'
import type { Optional, Nullable } from '@perawallet/wallet-core-shared'
import { chainsForScale } from '../runner/chainCount'
import { peakGrowthMb, retainedMb } from '../runner/compare'
import { heapGrowthPerMinute } from '../runner/heapSeries'
import { BENCH_SCALES } from '../runner/scales'
import type { ComparisonRow, ScenarioRun, Verdict } from '../runner/types'
import { Button } from './Button'
import { colors, styles } from './styles'
import type { UseBenchRunnerResult } from './useBenchRunner'

const verdictColor = (verdict: Verdict): string =>
    verdict === 'worse' || verdict === 'error'
        ? colors.bad
        : verdict === 'better' || verdict === 'fixed'
          ? colors.good
          : colors.neutral

const ms = (value: Optional<number>): string =>
    value === undefined ? '-' : `${value.toFixed(1)} ms`

const mb = (value: Optional<number>): string =>
    value === undefined ? '-' : `${value.toFixed(1)} MB`

const heapPeak = (run: Nullable<ScenarioRun>): string =>
    mb(run?.heap ? peakGrowthMb(run.heap) : undefined)

const heapKept = (run: Nullable<ScenarioRun>): string =>
    mb(run?.heap ? retainedMb(run.heap) : undefined)

// What the scale covered on this build, which can be less than it asks for.
const chainNote = (
    run: ScenarioRun,
    enabledChains: readonly string[],
): string => {
    const asked = BENCH_SCALES[run.scale].chains
    const covered = chainsForScale(asked, enabledChains).length
    return `${covered} of ${asked} chains`
}

const HeapTrend = ({
    series,
}: {
    series: NonNullable<ScenarioRun['heapSeries']>
}) => {
    const slope = heapGrowthPerMinute(series)
    const first = series[0]
    const last = series[series.length - 1]
    return (
        <Text style={styles.muted}>
            heap over {Math.round(last.atMs / 60_000)} min:{' '}
            {first.usedMb.toFixed(1)} → {last.usedMb.toFixed(1)} MB (
            {series.length} readings
            {slope === null ? '' : `, ${slope.toFixed(2)} MB/min`})
        </Text>
    )
}

const RunRow = ({
    run,
    enabledChains,
}: {
    run: ScenarioRun
    enabledChains: readonly string[]
}) => (
    <View style={styles.card}>
        <Text style={styles.title}>{run.key}</Text>
        <Text style={styles.muted}>{chainNote(run, enabledChains)}</Text>
        {run.error ? (
            <Text style={[styles.body, { color: colors.bad }]}>
                {run.error}
            </Text>
        ) : (
            <Text style={styles.body}>
                median {ms(run.timing?.medianMs)} · p95 {ms(run.timing?.p95Ms)}{' '}
                ·{' '}
                {run.heap
                    ? `heap peak +${heapPeak(run)} · kept ${heapKept(run)}`
                    : 'heap n/a'}
            </Text>
        )}
        {run.heapSeries && <HeapTrend series={run.heapSeries} />}
    </View>
)

const errorOf = (row: ComparisonRow): Optional<string> =>
    row.current?.error ?? row.baseline?.error

const ComparisonRowView = ({
    row,
    enabledChains,
}: {
    row: ComparisonRow
    enabledChains: readonly string[]
}) => {
    const error = errorOf(row)
    const hasNoHeap =
        row.current !== null &&
        row.baseline !== null &&
        !error &&
        row.heapVerdict === 'missing'
    const scaled = row.current ?? row.baseline
    return (
        <View style={styles.card}>
            <Text style={styles.title}>{row.key}</Text>
            {scaled && (
                <Text style={styles.muted}>
                    {chainNote(scaled, enabledChains)}
                </Text>
            )}
            <Text style={[styles.body, { color: verdictColor(row.verdict) }]}>
                {row.verdict}
                {row.deltaPct === null ? '' : ` ${row.deltaPct.toFixed(0)}%`} (
                {ms(row.baseline?.timing?.medianMs)} →{' '}
                {ms(row.current?.timing?.medianMs)})
            </Text>
            {error && (
                <Text style={[styles.body, { color: colors.bad }]}>
                    {row.current?.error ? 'now' : 'baseline'}: {error}
                </Text>
            )}
            <Text
                style={[styles.muted, { color: verdictColor(row.heapVerdict) }]}
            >
                {hasNoHeap
                    ? 'heap n/a'
                    : `heap ${row.heapVerdict} (peak +${heapPeak(row.baseline)} → ${heapPeak(row.current)}, kept ${heapKept(row.baseline)} → ${heapKept(row.current)})`}
            </Text>
        </View>
    )
}

type Props = { runner: UseBenchRunnerResult; onBack: () => void }

export const ResultsScreen = ({ runner, onBack }: Props) => {
    const { latest, comparison, comparisonNote } = runner
    const enabledChains = latest?.meta.chains ?? []

    return (
        <View style={styles.screen}>
            <View style={styles.row}>
                <Button
                    title='Back'
                    onPress={onBack}
                />
                <Button
                    title='Save baseline'
                    onPress={runner.saveAsBaseline}
                    isDisabled={!latest}
                />
            </View>
            <View style={styles.row}>
                <Button
                    title='Export'
                    onPress={() => void runner.exportLatest()}
                    isDisabled={!latest}
                />
                <Button
                    title='Import baseline'
                    onPress={() => void runner.importBaseline()}
                />
            </View>
            {runner.error && (
                <Text style={[styles.body, { color: colors.bad, padding: 16 }]}>
                    {runner.error}
                </Text>
            )}
            {comparisonNote && (
                <Text style={[styles.muted, { padding: 16 }]}>
                    {comparisonNote}
                </Text>
            )}
            {!latest && (
                <Text style={[styles.muted, { padding: 16 }]}>No run yet.</Text>
            )}
            {comparison ? (
                <FlatList
                    data={comparison}
                    keyExtractor={row => row.key}
                    renderItem={({ item }) => (
                        <ComparisonRowView
                            row={item}
                            enabledChains={enabledChains}
                        />
                    )}
                />
            ) : (
                <FlatList
                    data={latest?.runs ?? []}
                    keyExtractor={run => run.key}
                    renderItem={({ item }) => (
                        <RunRow
                            run={item}
                            enabledChains={enabledChains}
                        />
                    )}
                />
            )}
        </View>
    )
}
