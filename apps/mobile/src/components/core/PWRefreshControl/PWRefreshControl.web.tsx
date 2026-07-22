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
import { RefreshControl } from 'react-native'
import { useTheme } from '@rneui/themed'
import { usePWRefreshControl } from './usePWRefreshControl'
import type { PWRefreshControlProps } from './PWRefreshControl'

/**
 * Web variant: react-native's own `RefreshControl` (react-native-web),
 * not `react-native-gesture-handler`'s. react-native-web's ScrollView
 * renders `refreshControl` via `cloneElement(refreshControl, { style },
 * scrollView)` — it hands the control the entire scrollable content as
 * `children` and expects the control to render them
 * (react-native-web/.../ScrollView/index.js). react-native-web's own
 * RefreshControl does exactly that (spreads `children` onto a plain View);
 * gesture-handler's web RefreshControl is `createNativeWrapper(View)` and
 * does not forward `children` — every list passing a refreshControl
 * (any PWFlatList, or a raw SectionList like AssetTransactionList) rendered
 * completely empty on web as a result, with no error.
 *
 * `children` isn't part of the public `PWRefreshControlProps` API — no
 * caller passes it — it only exists because `cloneElement` above injects it.
 * This wrapper must forward it through to the underlying `RefreshControl`,
 * or it swallows the scrollable content itself, one layer up from the bug
 * this file otherwise fixes.
 */
export const PWRefreshControl = ({
    isRefreshing,
    onRefresh,
    testID,
    children,
}: PWRefreshControlProps & { children?: ReactNode }) => {
    const { theme } = useTheme()
    const { handleRefresh } = usePWRefreshControl({ onRefresh })

    return (
        <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.background}
            testID={testID}
        >
            {children}
        </RefreshControl>
    )
}
