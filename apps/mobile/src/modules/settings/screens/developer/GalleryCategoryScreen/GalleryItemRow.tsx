/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    PWIcon,
    PWSwitch,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useGalleryReviewStore } from '../gallery-catalog/useGalleryReviewStore'
import { useStyles } from './styles'

import type { GalleryEntry } from '../gallery-catalog'

type GalleryItemRowProps = {
    item: GalleryEntry
    onPress: (item: GalleryEntry) => void
}

/** Gallery list row with review tracking. See {@link useGalleryReviewStore}. */
export const GalleryItemRow = ({ item, onPress }: GalleryItemRowProps) => {
    const styles = useStyles()
    const visited = useGalleryReviewStore(state => !!state.visited[item.id])
    const isGood = useGalleryReviewStore(state => state.good[item.id] ?? false)
    const markVisited = useGalleryReviewStore(state => state.markVisited)
    const setGood = useGalleryReviewStore(state => state.setGood)

    const handlePress = () => {
        markVisited(item.id)
        onPress(item)
    }

    return (
        <PWView
            style={[
                styles.row,
                visited && (isGood ? styles.rowGood : styles.rowBroken),
            ]}
        >
            <PWTouchableOpacity
                style={styles.labelArea}
                onPress={handlePress}
                testID={`gallery_item_${item.id}`}
            >
                <PWIcon name='globe' />
                <PWText
                    style={styles.title}
                    numberOfLines={1}
                >
                    {item.label}
                </PWText>
            </PWTouchableOpacity>
            <PWView style={styles.switchWrap}>
                <PWSwitch
                    value={isGood}
                    onValueChange={value => setGood(item.id, value)}
                    testID={`gallery_item_${item.id}_status`}
                />
            </PWView>
        </PWView>
    )
}
