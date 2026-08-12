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

import { PWSkeleton, PWView } from '@components/core'
import { useStyles } from './styles'

const GRID_SKELETON_COUNT = 6
const LIST_SKELETON_COUNT = 8

export type GallerySkeletonProps = {
    isGrid: boolean
}

/**
 * Cold-start placeholder for the NFT gallery. Mirrors whichever layout is
 * selected — square tiles two-up in grid mode, thumbnail-and-text rows in list
 * mode — so the placeholder doesn't reflow into a different shape the moment
 * real data lands.
 */
export const GallerySkeleton = ({ isGrid }: GallerySkeletonProps) => {
    const styles = useStyles()

    if (isGrid) {
        return (
            <PWView style={styles.skeletonGrid}>
                {Array.from({ length: GRID_SKELETON_COUNT }, (_, index) => (
                    <PWView
                        key={index}
                        style={styles.skeletonGridCell}
                    >
                        <PWSkeleton style={styles.skeletonTile} />
                        <PWSkeleton style={styles.skeletonTileCaption} />
                    </PWView>
                ))}
            </PWView>
        )
    }

    return (
        <PWView>
            {Array.from({ length: LIST_SKELETON_COUNT }, (_, index) => (
                <PWView
                    key={index}
                    style={styles.skeletonRow}
                >
                    <PWSkeleton style={styles.skeletonRowThumbnail} />
                    <PWView style={styles.skeletonRowText}>
                        <PWSkeleton style={styles.skeletonRowTitle} />
                        <PWSkeleton style={styles.skeletonRowSubtitle} />
                    </PWView>
                </PWView>
            ))}
        </PWView>
    )
}
