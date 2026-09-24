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

import React, { type PropsWithChildren } from 'react'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { NotifierWrapper } from 'react-native-notifier'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { Persister } from '@tanstack/react-query-persist-client'
import { QueryProvider } from './QueryProvider'

export type AppProvidersProps = PropsWithChildren<{
    persister: Persister
}>

/**
 * The provider stack both shells mount once a query persister exists. Each
 * shell places ThemeProvider, SafeAreaProvider and GestureHandlerRootView
 * above it itself, because their surrounding layout differs.
 */
export const AppProviders = ({ persister, children }: AppProvidersProps) => (
    <KeyboardProvider>
        <NotifierWrapper componentProps={{ ContainerComponent: SafeAreaView }}>
            <QueryProvider persister={persister}>{children}</QueryProvider>
        </NotifierWrapper>
    </KeyboardProvider>
)
