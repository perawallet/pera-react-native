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

import { DefaultTheme } from '@react-navigation/native'
import { createTheme } from '@rneui/themed'
import { palette } from './colors'
import { componentOverrides } from './components'
import { darkColorTokens } from './tokens/dark'
import { lightColorTokens } from './tokens/light'

export const getNavigationTheme = (mode: 'light' | 'dark' = 'light') => ({
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: mode === 'light' ? palette.white : palette.gray[900],
        text: mode === 'light' ? palette.gray[400] : palette.gray[500],
        primary: mode === 'light' ? palette.gray[900] : palette.gray[50],
    },
    dark: mode === 'dark',
})

export const getTheme = (mode: 'light' | 'dark' = 'light') =>
    createTheme({
        lightColors: lightColorTokens,
        darkColors: darkColorTokens,
        mode,
        spacing: {
            xxs: 2,
            xs: 4,
            sm: 8,
            md: 12,
            lg: 16,
            xl: 24,
            xxl: 36,
            '3xl': 48,
            '4xl': 72,
            '5xl': 96,
        },
        zIndex: {
            base: 0,
            layer1: 10,
            layer2: 20,
            overlay1: 1000,
            max: 9999,
            // must exceed RNW Modal portals at 9999
            toast: 10_000,
            // above toasts and RNW Modal portals: the check may need a click
            integrityCheck: 10_001,
        },
        borderRadius: {
            none: 0,
            xs: 4,
            sm: 8,
            md: 12,
            lg: 16,
            xl: 24,
            full: 999,
        },
        borders: {
            none: 0,
            sm: 1,
            md: 2,
            lg: 4,
        },
        shadows: {
            sm: {
                shadowColor: palette.black,
                shadowOffset: {
                    width: 0,
                    height: 2,
                },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
            },
            md: {
                shadowColor: palette.black,
                shadowOffset: {
                    width: 0,
                    height: 2,
                },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 4,
            },
        },
        components: componentOverrides,
    })
