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

import { type ReactNode } from 'react'
import { type SharedValue } from 'react-native-reanimated'

export type PWPagerProps = {
    /** One element per page. Order defines the index. */
    children: ReactNode
    index: number
    onIndexChange: (index: number) => void
    /**
     * Live page position in page units, fractional mid-drag. Supply one to
     * drive a tab indicator from the same drag that moves the pages.
     */
    offset?: SharedValue<number>
    /**
     * A drawer's 0-1 open progress. When supplied, this pager's pan also drives
     * the drawer, so the two share one horizontal axis instead of competing for
     * it — see PWPager for the rules that decide which one a drag moves.
     */
    drawerProgress?: SharedValue<number>
    /** Travel that counts as fully open, in px. Required with `drawerProgress`. */
    drawerWidth?: number
    onDrawerOpen?: () => void
    onDrawerClose?: () => void
    /** Leading strip that reaches the drawer from a page other than the first. */
    drawerEdgeWidth?: number
    isSwipeEnabled?: boolean
}
