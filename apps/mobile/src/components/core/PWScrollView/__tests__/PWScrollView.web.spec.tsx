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
// Import the exact web filename — vitest has no Metro platform resolution,
// so a bare '../PWScrollView' specifier would load the gorhom-based native
// module instead (as the native PWScrollView, if it had its own spec, would
// import '../PWScrollView' directly). See PWBottomSheet.web.spec.tsx for the
// same pattern.
import { PWScrollView } from '../PWScrollView.web'

describe('PWScrollView.web', () => {
    it('renders children when inBottomSheet is true, without mounting gorhom', () => {
        // This is the exact case that throws "'useBottomSheetInternal'
        // cannot be used out of the BottomSheet!" on the native component,
        // since PWBottomSheet.web.tsx has no real gorhom <BottomSheet>
        // provider. If this twin ever regressed to import
        // BottomSheetScrollView, this render would throw instead of
        // rendering children.
        render(
            <PWScrollView inBottomSheet={true}>
                <Text>Sheet content</Text>
            </PWScrollView>,
        )

        expect(screen.getByText('Sheet content')).toBeTruthy()
    })

    it('renders children outside a bottom sheet', () => {
        render(
            <PWScrollView>
                <Text>Plain content</Text>
            </PWScrollView>,
        )

        expect(screen.getByText('Plain content')).toBeTruthy()
    })
})
