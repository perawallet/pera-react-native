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

import { useCallback, useState } from 'react'

import type { LayoutChangeEvent } from 'react-native'

type UsePWToolbarResult = {
    sideMinWidth: number
    handleSideLayout: (event: LayoutChangeEvent) => void
}

export const usePWToolbar = (): UsePWToolbarResult => {
    const [sideMinWidth, setSideMinWidth] = useState(0)

    // Grows monotonically so it settles in one extra render without looping.
    // Caveat: if side content later shrinks, the stale wider width persists and
    // the center title drifts off-center.
    const handleSideLayout = useCallback((event: LayoutChangeEvent) => {
        const { width } = event.nativeEvent.layout
        setSideMinWidth(current => (width > current ? width : current))
    }, [])

    return { sideMinWidth, handleSideLayout }
}
