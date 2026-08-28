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

import { createContext, useContext } from 'react'
import { type PanGesture } from 'react-native-gesture-handler'
import { type Nullable } from '@perawallet/wallet-core-shared'

/**
 * The pager's pan, published so nested content can take precedence over it.
 *
 * A row that swipes horizontally — an opt-out action, say — competes directly
 * with paging: same axis, same thresholds, and the pager's pan is the ancestor.
 * Without a declared relation gesture-handler simply lets whichever activates
 * first cancel the other, and the ancestor tends to win, so the row's swipe
 * silently stops working.
 *
 * Consumers pass this to their own gesture's `block`, which makes the pager wait
 * for theirs to fail rather than competing with it.
 */
export const PWPagerGestureContext = createContext<Nullable<PanGesture>>(null)

/** `null` outside a pager, where nothing needs deferring to. */
export const usePWPagerGesture = (): Nullable<PanGesture> =>
    useContext(PWPagerGestureContext)
