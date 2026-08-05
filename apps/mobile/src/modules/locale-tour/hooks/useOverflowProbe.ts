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

import { useRef } from 'react'

import {
    isTruncated,
    isWiderThanParent,
} from '@components/core/PWText/detectOverflow'
import { recordOverflow } from '@components/core/PWText/overflowRegistry'

import type { OverflowProbe, UseOverflowProbeParams } from '../types'

/**
 * Reports text that the layout engine had to truncate or that renders wider
 * than its parent, for the locale tour to drain per step.
 *
 * `onLayout` gives the box the layout engine assigned this Text (bounded by
 * its parent); `onTextLayout` gives each rendered line's own width. See
 * detectOverflow.ts for the (separately tested) rules.
 */
export const useOverflowProbe = ({
    children,
    testID,
    numberOfLines,
}: UseOverflowProbeParams): OverflowProbe => {
    const boxWidthRef = useRef<number | null>(null)
    const maxLineWidthRef = useRef<number | null>(null)

    const overflowText = typeof children === 'string' ? children : ''
    const overflowKey = testID ?? overflowText.slice(0, 40)

    // Widths come from two independent native events that can fire in either
    // order across iOS/Android, so both handlers funnel through this check
    // rather than assuming which one lands last.
    const checkWiderThanParent = () => {
        if (isWiderThanParent(maxLineWidthRef.current, boxWidthRef.current)) {
            recordOverflow({
                key: overflowKey,
                kind: 'wider-than-parent',
                text: overflowText,
            })
        }
    }

    return {
        onLayout: event => {
            boxWidthRef.current = event.nativeEvent.layout.width
            checkWiderThanParent()
        },
        onTextLayout: event => {
            const { lines } = event.nativeEvent
            if (isTruncated(lines, numberOfLines)) {
                recordOverflow({
                    key: overflowKey,
                    kind: 'truncated',
                    text: overflowText,
                })
            }
            maxLineWidthRef.current = lines.reduce(
                (max, line) => Math.max(max, line.width),
                0,
            )
            checkWiderThanParent()
        },
    }
}
