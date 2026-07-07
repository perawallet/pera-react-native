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

import { View } from 'react-native'
import { render, screen } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { PWImage } from '../PWImage'

// The expo-image test double never fires onLoad, so PWImage stays in its
// loading state — the placeholder overlay renders unless it is suppressed.
describe('PWImage', () => {
    it('shows the loading placeholder while loading by default', () => {
        render(
            <PWImage
                source={{ uri: 'https://example.test/a.png' }}
                PlaceholderContent={<View testID='placeholder' />}
            />,
        )

        expect(screen.queryByTestId('placeholder')).toBeTruthy()
    })

    it('suppresses the loading overlay when showLoadingIndicator is false', () => {
        render(
            <PWImage
                source={{ uri: 'https://example.test/a.png' }}
                PlaceholderContent={<View testID='placeholder' />}
                showLoadingIndicator={false}
            />,
        )

        expect(screen.queryByTestId('placeholder')).toBeNull()
    })
})
