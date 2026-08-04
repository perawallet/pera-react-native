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

import { useMemo } from 'react'
import { RefreshControl, type RefreshControlProps } from 'react-native'
import { useTheme } from '@rneui/themed'
import { usePWRefreshControl } from './usePWRefreshControl'

export type PWRefreshControlProps = {
    isRefreshing: boolean
    onRefresh: () => void
} & Omit<RefreshControlProps, 'refreshing' | 'onRefresh'>

/**
 * Forwarding the remaining props is load-bearing on Android: ScrollView renders
 * a refresh control by *cloning* the element, passing the scroll view itself as
 * `children` plus a layout `style`. Swallow those and the whole list vanishes
 * from the tree — on a FlashList that surfaces as "LayoutManager is not
 * initialized", not an empty screen. iOS renders the control as a plain
 * sibling, so the failure is Android-only.
 */
export const PWRefreshControl = ({
    isRefreshing,
    onRefresh,
    ...rest
}: PWRefreshControlProps) => {
    const { theme } = useTheme()
    const { isRefreshing: refreshing, handleRefresh } = usePWRefreshControl({
        isRefreshing,
        onRefresh,
    })
    const colors = useMemo(() => [theme.colors.primary], [theme.colors.primary])

    return (
        <RefreshControl
            {...rest}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={colors}
            tintColor={theme.colors.primary}
            progressBackgroundColor={theme.colors.background}
        />
    )
}
