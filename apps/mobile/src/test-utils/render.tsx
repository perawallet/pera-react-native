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

import React, { type ReactElement } from 'react'
// Use @testing-library/react instead of @testing-library/react-native
// since we're testing with react-native-web in Vitest
import {
    render,
    type RenderOptions,
    type RenderResult,
} from '@testing-library/react'
import { ThemeProvider, type CreateThemeOptions } from '@rneui/themed'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { PeraWalletProvider } from '@perawallet/wallet-extension-provider'
import { getTestTheme } from './test-theme'

const SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 375, height: 812 },
    insets: { top: 44, left: 0, right: 0, bottom: 34 },
}

// Mirrors `mutationDefaults` rather than importing it: specs that mock
// `@perawallet/wallet-core-shared` would fail to load this file. TanStack's
// default pauses an offline mutation, so the screen under test spins forever.
const MUTATION_POLICY = {
    throwOnError: false,
    networkMode: 'always',
} as const

const QUERY_CLIENT_DEFAULTS = {
    defaultOptions: {
        queries: { retry: false as const, gcTime: 0 },
        mutations: { ...MUTATION_POLICY, retry: false as const },
    },
}

const createTestQueryClient = () => new QueryClient(QUERY_CLIENT_DEFAULTS)

export interface TestProvidersProps {
    children: React.ReactNode
    queryClient?: QueryClient
    theme?: CreateThemeOptions
    navigationProps?: any
}

const TestProviders = ({
    children,
    queryClient,
    theme,
    navigationProps = {},
}: TestProvidersProps) => {
    const client = queryClient || createTestQueryClient()

    return (
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
            <PeraWalletProvider>
                <ThemeProvider theme={theme ?? getTestTheme()}>
                    <QueryClientProvider client={client}>
                        <NavigationContainer {...navigationProps}>
                            {children}
                        </NavigationContainer>
                    </QueryClientProvider>
                </ThemeProvider>
            </PeraWalletProvider>
        </SafeAreaProvider>
    )
}

export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    queryClient?: QueryClient
    theme?: CreateThemeOptions
    navigationProps?: any
    // Skip the full provider tree. For pure-component / pure-hook tests that
    // don't touch navigation, theme, query, or wallet context, this halves the
    // setup cost per render.
    bare?: boolean
}

const customRender = (
    ui: ReactElement,
    {
        queryClient,
        theme,
        navigationProps,
        bare,
        ...renderOptions
    }: CustomRenderOptions = {},
): RenderResult => {
    if (bare) return render(ui, renderOptions)

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestProviders
            queryClient={queryClient}
            theme={theme}
            navigationProps={navigationProps}
        >
            {children}
        </TestProviders>
    )

    return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Re-export everything from '@testing-library/react'
export * from '@testing-library/react'
export { customRender as render, createTestQueryClient, getTestTheme }
