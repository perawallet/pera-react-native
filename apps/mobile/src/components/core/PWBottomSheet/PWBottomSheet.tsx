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
import {
    createRef,
    type PropsWithChildren,
    useCallback,
    useEffect,
    useRef,
} from 'react'
import { useStyles } from './styles'
import {
    Keyboard,
    Platform,
    type StyleProp,
    useWindowDimensions,
    View,
    type ViewStyle,
} from 'react-native'
import { type NotifierRoot, NotifierWrapper } from 'react-native-notifier'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWInBottomSheetContext } from './inSheetContext'
import type { Nullable } from '@perawallet/wallet-core-shared'

export const bottomSheetNotifier = createRef<Nullable<NotifierRoot>>()

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

export type PWBottomSheetSize = 'full' | 'modal' | 'auto'

export type PWBottomSheetProps = {
    isVisible: boolean
    onBackdropPress?: () => void
    onDismiss?: () => void
    innerContainerStyle?: StyleProp<ViewStyle>
    containerStyle?: StyleProp<ViewStyle>
    snapPoints?: (string | number)[]
    enablePanDownToClose?: boolean
    enableContentPanningGesture?: boolean
    size?: PWBottomSheetSize
    autoCreateContainer?: boolean
    testID?: string
    enableCloseOnBackdropPress?: boolean
} & PropsWithChildren

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
}: PWBottomSheetProps) => {
    const bottomSheetModalRef = useRef<BottomSheetModal>(null)
    const insets = useSafeAreaInsets()
    const { height: windowHeight } = useWindowDimensions()
    const defaults = DEFAULT_PROPS[size]

    const maxDynamicContentSize =
        size === 'auto' ? Math.round(windowHeight * SHEET_MAX_RATIO) : undefined

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

    const sheetContent = autoCreateContainer ? (
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
            handleIndicatorStyle={
                enablePanDownToClose && !isFullScreen
                    ? styles.handleIndicator
                    : styles.hidden
            }
            backgroundStyle={mergedBackgroundStyle}
            detached={false}
            keyboardBehavior='interactive'
            keyboardBlurBehavior='restore'
            enablePanDownToClose={enablePanDownToClose}
            // Never derive this to false: gorhom wraps content in a disabled
            // GestureDetector, which stops delivering touches on Android —
            // taps fall through to the closing backdrop and dismiss the
            // sheet (PERA-4647). Tap-swallowing by the enabled gesture
            // (PERA-4437) is instead solved by activeOffsetY below.
            enableContentPanningGesture={enableContentPanningGesture}
            // The content pan claims a touch only after ~10px of vertical
            // travel, so taps reach the touchables underneath — gorhom's
            // documented remedy for Android tap-swallowing.
            activeOffsetY={[-10, 10]}
            enableOverDrag={false}
        >
            <NotifierWrapper
                omitGlobalMethodsHookup
                ref={bottomSheetNotifier}
                componentProps={{ ContainerComponent: SafeAreaView }}
            >
                <PWInBottomSheetContext.Provider value={true}>
                    <PWView style={styles.contentWrapper}>
                        {isFullScreen ? (
                            // Fixed-height sheets shrink to the space above the
                            // keyboard via keyboard-controller — the app's single
                            // keyboard owner (KeyboardProvider). gorhom's own
                            // keyboardBehavior is inert while it's active. Skipped
                            // for `auto` (content-sized) sheets, where a
                            // height-based avoider would collapse to zero.
                            <KeyboardAvoidingView
                                behavior={
                                    Platform.OS === 'ios' ? 'padding' : 'height'
                                }
                                keyboardVerticalOffset={
                                    Platform.OS === 'ios' ? insets.bottom : 0
                                }
                                style={styles.keyboardAvoider}
                            >
                                {sheetContent}
                            </KeyboardAvoidingView>
                        ) : (
                            sheetContent
                        )}
                    </PWView>
                </PWInBottomSheetContext.Provider>
            </NotifierWrapper>
        </BottomSheetModal>
    )
}
