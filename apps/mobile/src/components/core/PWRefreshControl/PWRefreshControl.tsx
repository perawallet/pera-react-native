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

import { RefreshControl } from 'react-native-gesture-handler'
import { useTheme } from '@rneui/themed'
import { usePWRefreshControl } from './usePWRefreshControl'

export type PWRefreshControlProps = {
    isRefreshing: boolean
    onRefresh: () => void
    testID?: string
}

/**
 * Themed pull-to-refresh control for every scrollable data surface.
 *
 * Standardizes the offline story: a pull while offline resolves promptly
 * and surfaces an explicit offline hint instead of dispatching a refetch
 * that would silently park as a paused query.
 */
export const PWRefreshControl = ({
    isRefreshing,
    onRefresh,
    testID,
}: PWRefreshControlProps) => {
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
        />
    )
}
