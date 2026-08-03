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
import { RefreshControl } from 'react-native'
import { useTheme } from '@rneui/themed'
import { usePWRefreshControl } from './usePWRefreshControl'

export type PWRefreshControlProps = {
    isRefreshing: boolean
    onRefresh: () => void
}

export const PWRefreshControl = ({
    isRefreshing,
    onRefresh,
}: PWRefreshControlProps) => {
    const { theme } = useTheme()
    const { isRefreshing: refreshing, handleRefresh } = usePWRefreshControl({
        isRefreshing,
        onRefresh,
    })
    const colors = useMemo(() => [theme.colors.primary], [theme.colors.primary])

    return (
        <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={colors}
            tintColor={theme.colors.primary}
            progressBackgroundColor={theme.colors.background}
        />
    )
}
