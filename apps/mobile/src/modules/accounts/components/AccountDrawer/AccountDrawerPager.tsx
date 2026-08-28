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
import { useWindowDimensions } from 'react-native'
import { type SharedValue } from 'react-native-reanimated'
import { PWPager } from '@components/core'
// From the constants module rather than the barrel: it's a plain number, and
// the barrel carries every core component with it.
import { PWDRAWER_WIDTH_RATIO } from '@components/core/PWDrawer/constants'

import { useAccountDrawerControls } from './AccountDrawerContext'

const noop = () => {}

export type AccountDrawerPagerProps = {
    children: ReactNode
    /** Omit on a single-page screen, where there is nothing to page between. */
    index?: number
    onIndexChange?: (index: number) => void
    offset?: SharedValue<number>
}

/**
 * Hands the account drawer to a pager so one pan drives both.
 *
 * Screens render the drawer themselves, which puts their own body outside its
 * provider — the controls are only readable from a child, hence this wrapper.
 * With no drawer mounted it degrades to a plain pager.
 *
 * A single-page screen still benefits: the pager contributes no paging, but its
 * pan is what makes the drawer openable from anywhere rather than the edge.
 */
export const AccountDrawerPager = ({
    children,
    index = 0,
    onIndexChange = noop,
    offset,
}: AccountDrawerPagerProps) => {
    const drawer = useAccountDrawerControls()
    const { width } = useWindowDimensions()

    return (
        <PWPager
            index={index}
            onIndexChange={onIndexChange}
            offset={offset}
            drawerProgress={drawer?.progress}
            // Mirrors PWDrawer's own panel sizing, so a drag maps 1:1 onto how
            // far the panel actually travels.
            drawerWidth={Math.round(width * PWDRAWER_WIDTH_RATIO)}
            onDrawerOpen={drawer?.openDrawer}
            onDrawerClose={drawer?.closeDrawer}
        >
            {children}
        </PWPager>
    )
}
