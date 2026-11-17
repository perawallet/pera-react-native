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

import { PWView } from '@components/core'
import { FavoritesFilterChip } from '../FavoritesFilterChip'
import { useFavoritesFilterBar } from './useFavoritesFilterBar'
import { useStyles } from './styles'

export type FavoritesFilterBarProps = { testID?: string }

/** The category and sort chips above a favorites list (Figma "All categories", "Recently added"). */
export const FavoritesFilterBar = ({
    testID = 'discover_favorites_filters',
}: FavoritesFilterBarProps) => {
    const styles = useStyles()
    const bar = useFavoritesFilterBar()
    return (
        <PWView
            style={styles.row}
            testID={testID}
        >
            <FavoritesFilterChip
                label={bar.categoryLabel}
                onPress={bar.openCategories}
                testID={`${testID}_category`}
            />
            <FavoritesFilterChip
                label={bar.sortLabel}
                onPress={bar.openSort}
                testID={`${testID}_sort`}
            />
        </PWView>
    )
}
