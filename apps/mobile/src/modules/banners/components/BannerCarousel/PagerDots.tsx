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
import { useStyles } from './styles'

type PagerDotsProps = {
    count: number
    activeIndex: number
    testID?: string
}

export const PagerDots = ({
    count,
    activeIndex,
    testID = 'banner_pager_dots',
}: PagerDotsProps) => {
    const styles = useStyles()
    if (count <= 1) return null
    return (
        <PWView
            style={styles.dotsContainer}
            testID={testID}
        >
            {Array.from({ length: count }).map((_, i) => (
                <PWView
                    key={i}
                    style={[styles.dot, i === activeIndex && styles.dotActive]}
                />
            ))}
        </PWView>
    )
}
