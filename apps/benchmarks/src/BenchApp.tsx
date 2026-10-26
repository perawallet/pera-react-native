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

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Text, View } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PeraWalletProvider } from '@perawallet/wallet-extension-provider'
import {
    startFixtureNetwork,
    type FixtureNetwork,
} from './network/fixtureNetwork'
import { ResultsScreen } from './ui/ResultsScreen'
import { ScenarioListScreen } from './ui/ScenarioListScreen'
import { colors, styles } from './ui/styles'
import { useBenchRunner } from './ui/useBenchRunner'
import { useBenchBootstrap } from './useBenchBootstrap'
import type { ScenarioContext } from './runner/types'
import { useScenarioContext } from './useScenarioContext'

/**
 * Holds the scenario context's hooks, which subscribe to production stores the
 * scenarios write to. Kept in a component of its own that renders nothing and
 * hands the context over through a ref, so a store write during a timed run
 * re-renders this stub, never the lists beside it.
 */
const ScenarioContextBridge = ({
    network,
    contextRef,
}: {
    network: FixtureNetwork
    contextRef: RefObject<ScenarioContext | null>
}) => {
    contextRef.current = useScenarioContext(network)
    return null
}

const BenchRunner = ({
    contextRef,
}: {
    contextRef: RefObject<ScenarioContext | null>
}) => {
    const getContext = useCallback((): ScenarioContext => {
        if (!contextRef.current) {
            throw new Error('The scenario context has not been built yet')
        }
        return contextRef.current
    }, [contextRef])
    const runner = useBenchRunner(getContext)
    const [isShowingResults, setIsShowingResults] = useState(false)

    return isShowingResults ? (
        <ResultsScreen
            runner={runner}
            onBack={() => setIsShowingResults(false)}
        />
    ) : (
        <ScenarioListScreen
            runner={runner}
            onShowResults={() => setIsShowingResults(true)}
        />
    )
}

const BenchContent = () => {
    const { isReady, error } = useBenchBootstrap()
    const [network] = useState(startFixtureNetwork)
    const contextRef = useRef<ScenarioContext | null>(null)

    useEffect(() => {
        void SplashScreen.hideAsync()
    }, [])

    if (error) {
        return (
            <View style={styles.screen}>
                <Text style={[styles.body, { color: colors.bad, padding: 16 }]}>
                    Bootstrap failed: {error}
                </Text>
            </View>
        )
    }
    if (!isReady) {
        return (
            <View style={styles.screen}>
                <Text style={[styles.muted, { padding: 16 }]}>Starting…</Text>
            </View>
        )
    }
    return (
        <>
            <ScenarioContextBridge
                network={network}
                contextRef={contextRef}
            />
            <BenchRunner contextRef={contextRef} />
        </>
    )
}

export const BenchApp = () => {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <PeraWalletProvider>
            <QueryClientProvider client={queryClient}>
                <BenchContent />
            </QueryClientProvider>
        </PeraWalletProvider>
    )
}
