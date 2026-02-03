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

import React, { useState } from 'react'
import { Animated, LayoutChangeEvent } from 'react-native'
import { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs' // TODO: monitor for lib updates to migrate from native Animated to Reanimated, which is currently unsupported
import { useStyles } from './tabBarStyles'
import { PWView, PWTouchableOpacity } from '@components/core'

export type PWTabBarProps = MaterialTopTabBarProps

export const PWTabBar = ({
    state,
    descriptors,
    navigation,
    position,
}: PWTabBarProps) => {
    const styles = useStyles()
    // We rely on onLayout to get the actual width of the container (after padding)
    // Initializing with layout.width might be wrong if parent has padding we don't know about,
    // or if we add padding (which we do in externalContainer).
    // So better start 0 or wait for layout.
    const [containerWidth, setContainerWidth] = useState(0)

    const handleLayout = (e: LayoutChangeEvent) => {
        setContainerWidth(e.nativeEvent.layout.width)
    }

    const tabCount = state.routes.length
    const tabWidth = containerWidth / tabCount

    const inputRange = state.routes.map((_, i) => i)

    const indicatorTranslateX = position.interpolate({
        inputRange,
        outputRange: inputRange.map(i => i * tabWidth),
    })

    return (
        <PWView style={styles.externalContainer}>
            <PWView
                style={styles.container}
                onLayout={handleLayout}
            >
                {/* Animated Indicator Wrapper */}
                {/* We use translateX instead of left for Native Driver performance */}
                {containerWidth > 0 && (
                    <Animated.View
                        style={[
                            styles.indicatorWrapper,
                            {
                                width: tabWidth,
                                transform: [
                                    { translateX: indicatorTranslateX },
                                ],
                            },
                        ]}
                    >
                        <PWView style={styles.indicator} />
                    </Animated.View>
                )}

                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key]
                    const label =
                        options.tabBarLabel ?? options.title ?? route.name
                    const isFocused = state.index === index

                    // Cross-fade opacity based on position directly
                    const activeOpacity = position.interpolate({
                        inputRange,
                        outputRange: inputRange.map(i => (i === index ? 1 : 0)),
                    })

                    const inactiveOpacity = position.interpolate({
                        inputRange,
                        outputRange: inputRange.map(i => (i === index ? 0 : 1)),
                    })

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        })

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name)
                        }
                    }

                    const renderLabelContent = (
                        focused: boolean,
                        color: string,
                    ) => {
                        if (typeof label === 'function') {
                            return label({
                                focused,
                                color,
                                children: route.name,
                            })
                        }
                        return label
                    }

                    return (
                        <PWTouchableOpacity
                            key={route.key}
                            onPress={onPress}
                            style={styles.tab}
                            activeOpacity={1}
                        >
                            <PWView style={styles.labelContainer}>
                                {/* Inactive Layer */}
                                <Animated.View
                                    style={{ opacity: inactiveOpacity }}
                                >
                                    <Animated.Text
                                        style={[
                                            styles.title,
                                            {
                                                color: styles.inactiveTitle
                                                    .color,
                                            },
                                        ]}
                                    >
                                        {renderLabelContent(
                                            false,
                                            styles.inactiveTitle.color!,
                                        )}
                                    </Animated.Text>
                                </Animated.View>

                                {/* Active Layer - Absolute overlay */}
                                <Animated.View
                                    style={[
                                        styles.activeLayer,
                                        { opacity: activeOpacity },
                                    ]}
                                >
                                    <Animated.Text
                                        style={[
                                            styles.title,
                                            { color: styles.activeTitle.color },
                                        ]}
                                    >
                                        {renderLabelContent(
                                            true,
                                            styles.activeTitle.color!,
                                        )}
                                    </Animated.Text>
                                </Animated.View>
                            </PWView>
                        </PWTouchableOpacity>
                    )
                })}
            </PWView>
        </PWView>
    )
}
