/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import React, { ReactElement } from 'react'
// Use @testing-library/react instead of @testing-library/react-native
// since we're testing with react-native-web in Vitest
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@rneui/themed'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

// Create a test theme based on RNE theme structure
const testTheme = createTheme({
    lightColors: {
        primary: '#007AFF',
        secondary: '#FF3B30',
        success: '#34C759',
        warning: '#FF9500',
        error: '#FF3B30',
        background: '#FFFFFF',
        disabled: '#C7C7CC',
    },
    darkColors: {
        primary: '#0A84FF',
        secondary: '#FF453A',
        success: '#30D158',
        warning: '#FF9F0A',
        error: '#FF453A',
        background: '#000000',
        disabled: '#48484A',
    },
})

// Extend theme with custom colors after creation
;(testTheme.lightColors as any).textMain = '#000000'
;(testTheme.lightColors as any).textGray = '#8E8E93'
;(testTheme.lightColors as any).buttonPrimaryBg = '#007AFF'
;(testTheme.lightColors as any).buttonPrimaryText = '#FFFFFF'
;(testTheme.darkColors as any).textMain = '#FFFFFF'
;(testTheme.darkColors as any).textGray = '#8E8E93'
;(testTheme.darkColors as any).buttonPrimaryBg = '#0A84FF'
;(testTheme.darkColors as any).buttonPrimaryText = '#FFFFFF'

// Create a test query client with default settings
const createTestQueryClient = () => {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
            mutations: {
                retry: false,
            },
        },
    })
}

interface TestProvidersProps {
    children: React.ReactNode
    queryClient?: QueryClient
    theme?: typeof testTheme
    navigationProps?: any
}

const TestProviders = ({
    children,
    queryClient,
    theme = testTheme,
    navigationProps = {},
}: TestProvidersProps) => {
    const client = queryClient || createTestQueryClient()

    return (
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 375, height: 812 },
                insets: { top: 44, left: 0, right: 0, bottom: 34 },
            }}
        >
            <ThemeProvider theme={theme}>
                <QueryClientProvider client={client}>
                    <NavigationContainer {...navigationProps}>
                        {children}
                    </NavigationContainer>
                </QueryClientProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    )
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    queryClient?: QueryClient
    theme?: typeof testTheme
    navigationProps?: any
}

const customRender = (
    ui: ReactElement,
    {
        queryClient,
        theme,
        navigationProps,
        ...renderOptions
    }: CustomRenderOptions = {},
): RenderResult => {
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
export { customRender as render, createTestQueryClient, testTheme }
