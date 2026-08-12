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

const SKELETON_ROW_COUNT = 8

/**
 * Cold-start placeholder for the History tab. Traces the row layout — icon,
 * two text lines, trailing amount — so the first paint keeps the list's shape
 * instead of collapsing to a centred spinner.
 */
export const HistorySkeleton = () => {
    const styles = useStyles()

    return (
        <PWView>
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                <PWView
                    key={index}
                    style={styles.skeletonRow}
                >
                    <PWSkeleton style={styles.skeletonIcon} />
                    <PWView style={styles.skeletonText}>
                        <PWSkeleton style={styles.skeletonTitle} />
                        <PWSkeleton style={styles.skeletonSubtitle} />
                    </PWView>
                    <PWSkeleton style={styles.skeletonAmount} />
                </PWView>
            ))}
        </PWView>
    )
}
