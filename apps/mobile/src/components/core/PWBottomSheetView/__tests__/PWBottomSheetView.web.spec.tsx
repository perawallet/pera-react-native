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

import { describe, it, expect } from 'vitest'
import { Text } from 'react-native'
import { render, screen } from '@test-utils/render'
// Import the exact web filename — vitest has no Metro platform resolution, so a
// bare specifier would load the gorhom-based native module instead.
import { PWBottomSheetView } from '../PWBottomSheetView.web'

describe('PWBottomSheetView.web', () => {
    it('renders its content with no gorhom sheet around it', () => {
        render(
            <PWBottomSheetView testID='sheet_view'>
                <Text>Remove this account?</Text>
            </PWBottomSheetView>,
        )

        expect(screen.getByText('Remove this account?')).toBeTruthy()
        expect(screen.getByTestId('sheet_view')).toBeTruthy()
    })
})
