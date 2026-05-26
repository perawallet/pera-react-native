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

import { useCallback, useState } from 'react'

import type { LayoutChangeEvent } from 'react-native'

type UsePWToolbarResult = {
    /**
     * Width of the widest side slot, applied as a min-width to both so they
     * resolve to the same size — which keeps the center slot on true
     * screen-center while the action buttons keep their full width.
     */
    sideMinWidth: number
    /** Attach to each side slot to feed its measured width into the max. */
    handleSideLayout: (event: LayoutChangeEvent) => void
}

export const usePWToolbar = (): UsePWToolbarResult => {
    const [sideMinWidth, setSideMinWidth] = useState(0)

    // Grows monotonically to the widest side ever measured. The first layout
    // pass measures both slots at their natural width (min-width still 0), so
    // the larger one wins; afterwards both render at that width and report it
    // back unchanged, so this settles in a single extra render without looping.
    const handleSideLayout = useCallback((event: LayoutChangeEvent) => {
        const { width } = event.nativeEvent.layout
        setSideMinWidth(current => (width > current ? width : current))
    }, [])

    return { sideMinWidth, handleSideLayout }
}
