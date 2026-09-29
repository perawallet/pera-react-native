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

import { Children, useEffect } from 'react'
import { withSpring } from 'react-native-reanimated'
import { PWView } from '../PWView'

import { PWPAGER_SPRING_CONFIG } from './constants'
import type { PWPagerProps } from './types'
import { useStyles } from './styles'

/**
 * Renders the active page only. Swiping between pages isn't a gesture the
 * extension popup offers — its tabs are driven by the header controls — so the
 * pager degrades to a plain container rather than shipping the drag to web.
 */
export const PWPager = ({ children, index, offset }: PWPagerProps) => {
    const pages = Children.toArray(children)
    const styles = useStyles({ pageWidth: 0, pageCount: pages.length })

    // With no drag to drive it, `offset` must follow `index` here, or a tab bar
    // reading it stays on the first tab.
    useEffect(() => {
        if (offset) offset.value = withSpring(index, PWPAGER_SPRING_CONFIG)
    }, [index, offset])

    return (
        <PWView
            style={styles.viewport}
            testID='pw_pager'
        >
            {pages[index]}
        </PWView>
    )
}
