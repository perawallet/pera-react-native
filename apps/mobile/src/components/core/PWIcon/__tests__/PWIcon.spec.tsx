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

import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { ThemeProvider, type Theme } from '@rneui/themed'
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { getTheme } from '@theme/theme'
import { PWIcon } from '../PWIcon'
import { getIconPixelSize } from '../types'

describe('PWIcon', () => {
    it('renders correctly with testID', () => {
        render(
            <PWIcon
                name='algo'
                testID='algo-icon'
            />,
        )
        expect(screen.getByTestId('algo-icon')).toBeTruthy()
    })

    it('renders the warning glyph (registered for destructive flows)', () => {
        render(
            <PWIcon
                name='warning'
                testID='warning-icon'
            />,
        )
        expect(screen.getByTestId('warning-icon')).toBeTruthy()
    })
})

// The barrel + direct-path mocks above stub out PWIcon entirely (real .svg
// assets crash under jsdom), so these tests import the real implementation
// via importActual and spy on the icon leaf to inspect the style it receives.
describe('PWIcon style merge (web rigidity)', () => {
    const theme = getTheme('light') as Theme
    let RealPWIcon: (typeof import('../PWIcon'))['PWIcon']
    let getCapturedStyle: () => StyleProp<ViewStyle> | undefined

    // Load the real component + its capturing icon leaf once — the icon
    // component reference is baked into ICON_LIBRARY on first import, so a
    // second doMock/importActual pair would be ignored by the already-cached
    // module. Both tests re-render through the one captured leaf instead.
    beforeAll(async () => {
        let capturedStyle: StyleProp<ViewStyle> | undefined
        vi.doMock('@assets/icons/algo.svg', () => ({
            default: ({ style }: { style?: StyleProp<ViewStyle> }) => {
                capturedStyle = style
                return null
            },
        }))
        const mod =
            await vi.importActual<typeof import('../PWIcon')>('../PWIcon')
        RealPWIcon = mod.PWIcon
        getCapturedStyle = () => capturedStyle
    })

    it('merges the pixel size and flexShrink: 0 into the forwarded style', () => {
        const expectedSize = getIconPixelSize(theme, 'md')

        render(
            <ThemeProvider theme={theme}>
                <RealPWIcon
                    name='algo'
                    size='md'
                />
            </ThemeProvider>,
            { bare: true },
        )

        expect(StyleSheet.flatten(getCapturedStyle())).toEqual({
            width: expectedSize,
            height: expectedSize,
            flexShrink: 0,
        })
    })

    it('lets a consumer-supplied style override win', () => {
        const expectedSize = getIconPixelSize(theme, 'md')
        const overrideStyle = { width: 99 }

        render(
            <ThemeProvider theme={theme}>
                <RealPWIcon
                    name='algo'
                    size='md'
                    style={overrideStyle}
                />
            </ThemeProvider>,
            { bare: true },
        )

        expect(StyleSheet.flatten(getCapturedStyle())).toEqual({
            width: 99,
            height: expectedSize,
            flexShrink: 0,
        })
    })
})
