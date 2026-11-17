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

import { useCallback, useContext, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { PWSheetSizeContext } from '../PWBottomSheet/sheetSizeContext'

export type UsePWSheetLayoutFooterResult = {
    /** The footer is pinned over the bottom of the sheet instead of stacked. */
    overlaysFooter: boolean
    /** Extra bottom padding the body needs so its end clears the footer. */
    footerInset: number
    onFooterLayout: (event: LayoutChangeEvent) => void
}

/**
 * An `auto` sheet sizes itself from the scroll content alone, so a footer
 * stacked under the scroll would take its height out of the body. There the
 * footer is pinned over the bottom instead, and the body is padded by the
 * footer's measured height: the measured content then includes the footer.
 */
export const usePWSheetLayoutFooter = (
    hasFooter: boolean,
): UsePWSheetLayoutFooterResult => {
    const sheetSize = useContext(PWSheetSizeContext)
    const overlaysFooter = hasFooter && sheetSize === 'auto'
    const [footerHeight, setFooterHeight] = useState(0)
    const onFooterLayout = useCallback((event: LayoutChangeEvent) => {
        setFooterHeight(event.nativeEvent.layout.height)
    }, [])
    return {
        overlaysFooter,
        footerInset: overlaysFooter ? footerHeight : 0,
        onFooterLayout,
    }
}
