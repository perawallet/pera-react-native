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

import type { ReactNode } from 'react'
import type { LayoutChangeEvent, TextLayoutEvent } from 'react-native'

// Shared by useOverflowProbe.ts and its .stub.ts twin, so the swap
// metro.config.js performs is checkable against one declaration.

export type UseOverflowProbeParams = {
    children: ReactNode
    testID?: string
    /** Already resolved by PWText (`truncate` collapses to 1). */
    numberOfLines: number | undefined
}

/** Layout handlers PWText spreads onto the underlying Text. */
export type OverflowProbe = {
    onLayout?: (event: LayoutChangeEvent) => void
    onTextLayout?: (event: TextLayoutEvent) => void
}
