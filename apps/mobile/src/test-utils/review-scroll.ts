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

import { act, screen } from '@testing-library/react'
import type { LayoutChangeEvent } from 'react-native'
import type { UseReviewScrollHintResult } from '@modules/signing/components/ReviewScrollHint'

type ScrollBodyProps = {
    onLayout: (event: unknown) => void
    onContentSizeChange: (width: number, height: number) => void
    onScroll: (event: unknown) => void
}

// jsdom lays nothing out and a sheet's scroll view is stubbed to a div, so the
// body's React Native handlers are called the way the native view would.
const scrollBodyProps = (testID: string): ScrollBodyProps => {
    // The sheet scroll stub tags its div apart from `data-testid`, so exposing
    // it doesn't make other specs' sheet queries match the scroll body.
    const body = (document.querySelector(`[data-scroll-body="${testID}"]`) ??
        screen.getByTestId(testID)) as unknown as Record<
        string,
        ScrollBodyProps
    >
    const propsKey = Object.keys(body).find(key =>
        key.startsWith('__reactProps'),
    )!
    return body[propsKey]!
}

/** Reports a sheet-hosted `PWScreen` body as `viewport` tall showing `content` of content. */
export const measureScrollBody = (
    testID: string,
    viewport: number,
    content: number,
): void => {
    const { onLayout, onContentSizeChange } = scrollBodyProps(testID)
    act(() => {
        onLayout({
            nativeEvent: { layout: { x: 0, y: 0, width: 0, height: viewport } },
        })
        onContentSizeChange(0, content)
    })
}

export const scrollBodyTo = (testID: string, offset: number): void => {
    const { onScroll } = scrollBodyProps(testID)
    act(() => onScroll({ nativeEvent: { contentOffset: { x: 0, y: offset } } }))
}

/** Reports a review that fits its body, as a short request lays out on open. */
export const measureFittingReview = (
    scrollHint: UseReviewScrollHintResult,
): void => {
    act(() => {
        scrollHint.handleBodyLayout({
            nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 400 } },
        } as LayoutChangeEvent)
        scrollHint.handleContentSizeChange(0, 200)
    })
}
