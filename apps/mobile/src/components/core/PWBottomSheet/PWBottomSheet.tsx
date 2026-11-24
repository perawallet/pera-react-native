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

import {
    BottomSheetModal,
    BottomSheetBackdrop,
    type BottomSheetBackdropProps,
    type BottomSheetBackgroundProps,
    BottomSheetView,
} from '@gorhom/bottom-sheet'
import { PWView } from '@components/core/PWView'
import { useCallback, useEffect, useRef } from 'react'
import { isIOS } from '@utils/platform'
import {
    HiddenContainerProvider,
    useIsAnimationVisible,
} from '@hooks/useIsAnimationVisible'
import { useStyles } from './styles'
import { Keyboard, useWindowDimensions, View } from 'react-native'
import { NotifierWrapper } from 'react-native-notifier'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWInBottomSheetContext } from './inSheetContext'
import { PWSheetSizeContext } from './sheetSizeContext'
import { useSheetNotifierRef } from './sheetNotifier'
import type { PWBottomSheetProps, PWBottomSheetSize } from './sheet-types'

export { bottomSheetNotifier } from './sheetNotifier'
export type { PWBottomSheetProps, PWBottomSheetSize } from './sheet-types'

type DefaultPropsReturn = {
    snapPoints?: string[]
    enableDynamicSizing: boolean
}

// Feeds both `modal`'s snap point and `auto`'s dynamic max height so the two
// share one ceiling and can't drift apart.
const SHEET_MAX_RATIO = 0.96

const DEFAULT_PROPS: Record<PWBottomSheetSize, DefaultPropsReturn> = {
    auto: {
        enableDynamicSizing: true,
    },
    modal: {
        enableDynamicSizing: false,
        snapPoints: [`${SHEET_MAX_RATIO * 100}%`],
    },
    full: {
        enableDynamicSizing: false,
        snapPoints: ['100%'],
    },
}

export const PWBottomSheet = ({
    isVisible,
    onBackdropPress,
    onDismiss,
    innerContainerStyle,
    containerStyle,
    enablePanDownToClose = false,
    enableContentPanningGesture,
    size = 'auto',
    autoCreateContainer = true,
    testID,
    children,
    enableCloseOnBackdropPress = true,
    avoidKeyboard = true,
    handleOverlaysContent = false,
}: PWBottomSheetProps) => {
    const bottomSheetModalRef = useRef<BottomSheetModal>(null)
    const notifierRef = useSheetNotifierRef()
    const insets = useSafeAreaInsets()
    const { height: windowHeight } = useWindowDimensions()
    const defaults = DEFAULT_PROPS[size]
    // Read here, above the portal: inside the sheet the owner's screen focus
    // and lock state are out of reach.
    const isOwnerVisible = useIsAnimationVisible()

    // Against the container `topInset` has already shortened, the basis of
    // `modal`'s percentage snap point too: a whole-window ratio leaves a tall
    // sheet no room below the notch, so it runs to the edge and loses its radius.
    const maxDynamicContentSize =
        size === 'auto'
            ? Math.round((windowHeight - insets.top) * SHEET_MAX_RATIO)
            : undefined

    const styles = useStyles({
        insets,
        isFull: size === 'full',
        maxDynamicContentSize,
    })

    const isFullScreen = size === 'full' || size === 'modal'

    useEffect(() => {
        if (isVisible) {
            bottomSheetModalRef.current?.present()
        } else {
            Keyboard.dismiss()
            bottomSheetModalRef.current?.dismiss()
        }
    }, [isVisible])

    // Gorhom keeps presented modals in the provider stack after unmount — dismiss on cleanup.
    useEffect(() => {
        return () => {
            // Must read .current at cleanup time (unmount) to dismiss whatever
            // modal instance is live; capturing at mount would be null/stale.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            bottomSheetModalRef.current?.dismiss()
        }
    }, [])

    const renderBackground = useCallback(
        ({ style, pointerEvents }: BottomSheetBackgroundProps) => (
            <View
                accessible={false}
                pointerEvents={pointerEvents}
                style={style}
            />
        ),
        [],
    )

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                opacity={0.9}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                pressBehavior={enableCloseOnBackdropPress ? 'close' : 'none'}
                onPress={onBackdropPress}
                style={styles.backdrop}
            />
        ),
        [styles.backdrop, enableCloseOnBackdropPress, onBackdropPress],
    )

    const handleDismiss = useCallback(() => {
        onDismiss?.()
    }, [onDismiss])

    const handleAnimate = useCallback((_from: number, toIndex: number) => {
        if (toIndex === -1) {
            Keyboard.dismiss()
        }
    }, [])

    const mergedBackgroundStyle = containerStyle
        ? [styles.background, containerStyle]
        : styles.background

    // BottomSheetView is absolute and content-sized: it only serves `auto`'s
    // measurement. In a fixed-height sheet it lets a scroll body overrun the
    // sheet's bottom edge, clipping the last rows.
    const sheetContent =
        autoCreateContainer && size === 'auto' ? (
            <BottomSheetView
                style={[styles.innerContainer, innerContainerStyle]}
                testID={testID}
            >
                {children}
            </BottomSheetView>
        ) : (
            <PWView
                style={[styles.innerContainer, innerContainerStyle]}
                testID={testID}
            >
                {children}
            </PWView>
        )

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            snapPoints={defaults.snapPoints}
            enableDynamicSizing={defaults.enableDynamicSizing}
            maxDynamicContentSize={maxDynamicContentSize}
            stackBehavior='push'
            topInset={size === 'full' ? 0 : insets.top}
            bottomInset={0}
            accessible={false}
            backgroundComponent={renderBackground}
            backdropComponent={renderBackdrop}
            onDismiss={handleDismiss}
            onAnimate={handleAnimate}
            handleStyle={
                handleOverlaysContent ? styles.handleOverlay : undefined
            }
            handleIndicatorStyle={
                enablePanDownToClose && !isFullScreen
                    ? styles.handleIndicator
                    : styles.hidden
            }
            backgroundStyle={mergedBackgroundStyle}
            detached={false}
            // gorhom is an avoider in its own right: `interactive` moves the
            // sheet to `highestDetent - keyboardHeight`. Inert while the
            // KeyboardAvoidingView below is mounted, but `avoidKeyboard: false`
            // skips that view — leaving gorhom to shift a WebView that already
            // insets itself, which is the double avoidance is about.
            // `extend` holds the sheet at its highest detent instead.
            keyboardBehavior={avoidKeyboard ? 'interactive' : 'extend'}
            keyboardBlurBehavior='restore'
            enablePanDownToClose={enablePanDownToClose}
            // Never derive this to false: gorhom wraps content in a disabled
            // GestureDetector, which stops delivering touches on Android —
            // taps fall through to the closing backdrop and dismiss the
            // sheet. Tap-swallowing by the enabled gesture
            // is instead solved by activeOffsetY below.
            enableContentPanningGesture={enableContentPanningGesture}
            // The content pan claims a touch only after ~10px of vertical
            // travel, so taps reach the touchables underneath — gorhom's
            // documented remedy for Android tap-swallowing.
            activeOffsetY={[-10, 10]}
            // A mostly sideways drag belongs to a horizontal scroller inside
            // (filter chips), which gorhom doesn't coordinate with.
            failOffsetX={[-10, 10]}
            enableOverDrag={false}
        >
            <NotifierWrapper
                omitGlobalMethodsHookup
                ref={notifierRef}
                componentProps={{ ContainerComponent: SafeAreaView }}
            >
                <PWInBottomSheetContext.Provider value={true}>
                    <HiddenContainerProvider value={!isOwnerVisible}>
                        <PWSheetSizeContext.Provider value={size}>
                            <PWView style={styles.contentWrapper}>
                                {isFullScreen && avoidKeyboard ? (
                                    // Fixed-height sheets shrink to the space above the
                                    // keyboard via keyboard-controller — the app's single
                                    // keyboard owner (KeyboardProvider). gorhom's own
                                    // keyboardBehavior is inert while it's active (and is
                                    // switched to `extend` above when it is not). Skipped
                                    // for `auto` (content-sized) sheets, where a
                                    // height-based avoider would collapse to zero.
                                    <KeyboardAvoidingView
                                        behavior={
                                            isIOS() ? 'padding' : 'height'
                                        }
                                        keyboardVerticalOffset={
                                            isIOS() ? insets.bottom : 0
                                        }
                                        style={styles.keyboardAvoider}
                                    >
                                        {sheetContent}
                                    </KeyboardAvoidingView>
                                ) : (
                                    sheetContent
                                )}
                            </PWView>
                        </PWSheetSizeContext.Provider>
                    </HiddenContainerProvider>
                </PWInBottomSheetContext.Provider>
            </NotifierWrapper>
        </BottomSheetModal>
    )
}
