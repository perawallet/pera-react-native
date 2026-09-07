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

import Animated, {
    useAnimatedStyle,
    type SharedValue,
} from 'react-native-reanimated'
import { PWText } from '../PWText'
import { PWTouchableOpacity } from '../PWTouchableOpacity'
import { PWView } from '../PWView'
import { useStyles } from '../PWTabView/tabBarStyles'

export type PWPagerTabItemProps = {
    title: string
    testID: string
    index: number
    offset: SharedValue<number>
    onPress: () => void
}

/**
 * One tab label, cross-fading between its inactive and active colours as the
 * pager moves past it.
 *
 * Two stacked layers whose opacity is animated, rather than animating the text
 * colour: opacity on a view is driven entirely on the UI thread, so the fade
 * tracks the drag and can't stall behind a re-render. Deriving it from the
 * settled index instead would make the colour snap after the gesture — which is
 * what this replaces. Mirrors PWTabBar's structure, and shares its styles, so
 * the two are indistinguishable at rest.
 *
 * A separate component because each tab needs its own animated style, and hooks
 * can't be called from inside a map.
 */
export const PWPagerTabItem = ({
    title,
    testID,
    index,
    offset,
    onPress,
}: PWPagerTabItemProps) => {
    const styles = useStyles()

    // 1 when the pager sits on this tab, 0 once a full page away.
    const activeOpacity = useAnimatedStyle(
        () => ({
            opacity: Math.min(
                Math.max(1 - Math.abs(offset.value - index), 0),
                1,
            ),
        }),
        [index],
    )

    const inactiveOpacity = useAnimatedStyle(
        () => ({
            opacity: Math.min(Math.max(Math.abs(offset.value - index), 0), 1),
        }),
        [index],
    )

    return (
        <PWTouchableOpacity
            testID={testID}
            onPress={onPress}
            style={styles.tab}
            activeOpacity={1}
        >
            <PWView style={styles.labelContainer}>
                <Animated.View
                    style={[styles.labelTextContainer, inactiveOpacity]}
                >
                    <PWText
                        variant='bodyLarge'
                        weight={500}
                        numberOfLines={2}
                        ellipsizeMode='tail'
                        style={[
                            styles.label,
                            { color: styles.inactiveTitle.color },
                        ]}
                    >
                        {title}
                    </PWText>
                </Animated.View>

                <Animated.View style={[styles.activeLayer, activeOpacity]}>
                    <PWText
                        variant='bodyLarge'
                        weight={500}
                        numberOfLines={2}
                        ellipsizeMode='tail'
                        style={[
                            styles.label,
                            { color: styles.activeTitle.color },
                        ]}
                    >
                        {title}
                    </PWText>
                </Animated.View>
            </PWView>
        </PWTouchableOpacity>
    )
}
