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

import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { PWView } from '../PWView'

import { PWDRAWER_WIDTH_RATIO } from './constants'
import { PWDrawerGestureSurface } from './PWDrawerGestureSurface'
import type { PWDrawerProps } from './types'
import { usePWDrawer } from './usePWDrawer'

/**
 * Edge drawer with a finger-following drag. Hand-rolled because every drawer
 * library puts its pan in a view wrapping the content, where a pager cancels it
 * — see PWPager. Screens with a pager hand the drag over; the rest use
 * PWDrawerGestureSurface, which sits above the content instead.
 */
export const PWDrawer = ({
    isOpen,
    onOpen,
    onClose,
    renderContent,
    variant = 'back',
    progress: externalProgress,
    hasOwnOpenGesture = true,
    isSwipeEnabled = true,
    edgeWidth,
    widthRatio = PWDRAWER_WIDTH_RATIO,
    hasContentGrowIn = true,
    contentStyle,
    children,
}: PWDrawerProps) => {
    const {
        panelWidth,
        progress,
        styles,
        panelDrag,
        hasGestureSurface,
        panelAnimatedStyle,
        panelContentAnimatedStyle,
        contentAnimatedStyle,
        scrimAnimatedStyle,
    } = usePWDrawer({
        isOpen,
        onOpen,
        onClose,
        variant,
        progress: externalProgress,
        hasOwnOpenGesture,
        isSwipeEnabled,
        widthRatio,
        hasContentGrowIn,
    })

    return (
        <PWView style={styles.host}>
            <GestureDetector gesture={panelDrag}>
                <Animated.View
                    style={[styles.panel, panelAnimatedStyle]}
                    accessibilityElementsHidden={!isOpen}
                    importantForAccessibility={
                        isOpen ? 'auto' : 'no-hide-descendants'
                    }
                    testID='pw_drawer_panel'
                >
                    <Animated.View
                        style={[styles.panelContent, panelContentAnimatedStyle]}
                    >
                        {renderContent()}
                    </Animated.View>
                </Animated.View>
            </GestureDetector>

            <Animated.View
                style={[styles.content, contentStyle, contentAnimatedStyle]}
                accessibilityElementsHidden={isOpen}
                importantForAccessibility={
                    isOpen ? 'no-hide-descendants' : 'auto'
                }
                testID='pw_drawer_content'
            >
                {children}
                <Animated.View
                    style={[styles.scrim, scrimAnimatedStyle]}
                    pointerEvents='none'
                />
            </Animated.View>

            {hasGestureSurface && (
                <PWDrawerGestureSurface
                    progress={progress}
                    panelWidth={panelWidth}
                    isOpen={isOpen}
                    onOpen={onOpen}
                    onClose={onClose}
                    edgeWidth={edgeWidth}
                />
            )}
        </PWView>
    )
}
