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

// PWBottomSheet.web renders a plain Modal with no gorhom provider, so gorhom's
// BottomSheetView would throw "'useBottomSheetInternal' cannot be used out of
// the BottomSheet!". The web sheet sizes to its content anyway.
import { PWView } from '../PWView'
import type { PWBottomSheetViewProps } from './types'

export const PWBottomSheetView = ({
    children,
    style,
    testID,
}: PWBottomSheetViewProps) => (
    <PWView
        style={style}
        testID={testID}
    >
        {children}
    </PWView>
)
