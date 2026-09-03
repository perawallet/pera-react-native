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

import { useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import Animated, {
    useAnimatedStyle,
    type SharedValue,
} from 'react-native-reanimated'
import { PWView } from '../PWView'
import { useStyles } from '../PWTabView/tabBarStyles'
import { PWPagerTabItem } from './PWPagerTabItem'

export type PWPagerTab = {
    /** Stable identifier, also used to derive the tab's testID. */
    key: string
    title: string
}

export type PWPagerTabBarProps = {
    tabs: PWPagerTab[]
    onIndexChange: (index: number) => void
    /**
     * The pager's live position, and the only thing this bar reads. Both the
     * indicator and the label cross-fade derive from it, so they track the drag
     * instead of snapping when the page settles.
     */
    offset: SharedValue<number>
}

/**
 * Tab bar for PWPager. Shares PWTabBar's styles so the two are visually
 * identical, but reads a reanimated shared value instead of react-navigation's
 * Animated position — PWPager has no navigator behind it.
 */
export const PWPagerTabBar = ({
    tabs,
    onIndexChange,
    offset,
}: PWPagerTabBarProps) => {
    const styles = useStyles()
    const [containerWidth, setContainerWidth] = useState(0)

    const handleLayout = (event: LayoutChangeEvent) => {
        setContainerWidth(event.nativeEvent.layout.width)
    }

    const tabWidth = containerWidth / tabs.length

    const indicatorStyle = useAnimatedStyle(
        () => ({ transform: [{ translateX: offset.value * tabWidth }] }),
        [tabWidth],
    )

    return (
        <PWView style={styles.externalContainer}>
            <PWView
                style={styles.container}
                onLayout={handleLayout}
            >
                {containerWidth > 0 && (
                    <Animated.View
                        style={[
                            styles.indicatorWrapper,
                            { width: tabWidth },
                            indicatorStyle,
                        ]}
                    >
                        <PWView style={styles.indicator} />
                    </Animated.View>
                )}

                {tabs.map((tab, tabIndex) => (
                    <PWPagerTabItem
                        key={tab.key}
                        testID={`tab_${tab.key.toLowerCase()}`}
                        title={tab.title}
                        index={tabIndex}
                        offset={offset}
                        onPress={() => onIndexChange(tabIndex)}
                    />
                ))}
            </PWView>
        </PWView>
    )
}
