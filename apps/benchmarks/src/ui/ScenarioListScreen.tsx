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

import { FlatList, Pressable, Text, View } from 'react-native'
import { BENCH_SCALES } from '../runner/scales'
import type { BenchScaleName } from '../runner/types'
import { AVAILABLE_SCENARIOS } from './availableScenarios'
import { Button } from './Button'
import { colors, styles } from './styles'
import type { UseBenchRunnerResult } from './useBenchRunner'

const SCALE_NAMES = Object.keys(BENCH_SCALES) as BenchScaleName[]

type Props = { runner: UseBenchRunnerResult; onShowResults: () => void }

export const ScenarioListScreen = ({ runner, onShowResults }: Props) => {
    const { selectedScales, setSelectedScales, isRunning, progress } = runner

    const toggle = (name: BenchScaleName) =>
        setSelectedScales(
            selectedScales.includes(name)
                ? selectedScales.filter(selected => selected !== name)
                : [...selectedScales, name],
        )

    return (
        <View style={styles.screen}>
            {__DEV__ && (
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>
                        Dev build: these numbers are not meaningful. Run a
                        release build.
                    </Text>
                </View>
            )}
            <View style={styles.row}>
                {SCALE_NAMES.map(name => (
                    <Pressable
                        key={name}
                        onPress={() => toggle(name)}
                        style={[
                            styles.chip,
                            selectedScales.includes(name) && styles.chipOn,
                        ]}
                    >
                        <Text
                            style={
                                selectedScales.includes(name)
                                    ? styles.chipTextOn
                                    : styles.chipText
                            }
                        >
                            {name}
                        </Text>
                    </Pressable>
                ))}
            </View>
            <View style={styles.row}>
                <Button
                    title='Run all'
                    onPress={() => void runner.runAll()}
                    isDisabled={isRunning || selectedScales.length === 0}
                />
                <Button
                    title='Results'
                    onPress={onShowResults}
                />
            </View>
            {progress && (
                <Text style={[styles.muted, { paddingHorizontal: 16 }]}>
                    {progress.done}/{progress.total} {progress.current}
                </Text>
            )}
            {runner.error && (
                <Text style={[styles.body, { color: colors.bad, padding: 16 }]}>
                    {runner.error}
                </Text>
            )}
            <FlatList
                data={AVAILABLE_SCENARIOS}
                keyExtractor={scenario => scenario.id}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.muted}>
                            {item.id} · scales {item.scales.join(' ')}
                            {item.isLong ? ' · long run, not in Run all' : ''}
                        </Text>
                        <View style={[styles.row, { paddingHorizontal: 0 }]}>
                            <Button
                                title='Run'
                                onPress={() =>
                                    void runner.runScenarios([item.id])
                                }
                                isDisabled={
                                    isRunning ||
                                    !selectedScales.some(name =>
                                        item.scales.includes(name),
                                    )
                                }
                            />
                        </View>
                    </View>
                )}
            />
        </View>
    )
}
