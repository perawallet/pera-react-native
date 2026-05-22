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

import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetBackdropProps,
    BottomSheetView,
} from '@gorhom/bottom-sheet'
import { PWView } from '@components/core/PWView'
import {
    createRef,
    PropsWithChildren,
    useCallback,
    useEffect,
    useRef,
} from 'react'
import { useStyles } from './styles'
import { Keyboard, Platform, StyleProp, ViewStyle } from 'react-native'
import { NotifierRoot, NotifierWrapper } from 'react-native-notifier'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Nullable } from '@perawallet/wallet-core-shared'

export const bottomSheetNotifier = createRef<Nullable<NotifierRoot>>()

type DefaultPropsReturn = {
    snapPoints?: string[]
    enableDynamicSizing: boolean
}

const DEFAULT_PROPS: Record<PWBottomSheetSize, DefaultPropsReturn> = {
    auto: {
        enableDynamicSizing: true,
    },
    lg: {
        enableDynamicSizing: false,
        snapPoints: ['90%'],
    },
    md: {
        enableDynamicSizing: false,
        snapPoints: ['50%'],
    },
    full: {
        enableDynamicSizing: false,
        snapPoints: ['100%'],
    },
}

export type PWBottomSheetSize = 'full' | 'lg' | 'md' | 'auto'

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
    const defaults = DEFAULT_PROPS[size]
    const styles = useStyles({ insets, isFull: size === 'full' })

    // Sync isVisible prop with modal state. Dismiss the keyboard on the
    // outgoing transition so a sheet that owns a focused input doesn't leave
    // the keyboard stuck open over the rest of the app.
    useEffect(() => {
        if (isVisible) {
            bottomSheetModalRef.current?.present()
        } else {
            Keyboard.dismiss()
            bottomSheetModalRef.current?.dismiss()
        }
    }, [isVisible])

    // Gorhom's `BottomSheetModal` registers itself with the
    // `BottomSheetModalProvider` on `present()` and does NOT auto-dismiss
    // when the React component unmounts. If a controlled sheet is removed
    // from the tree while still presented, its entry stays in the provider's
    // stack and re-surfaces when the topmost sheet pops — visible as an
    // orphan, content-empty modal you can't dismiss. Explicit cleanup
    // dismisses the modal whenever the component unmounts.
    useEffect(() => {
        return () => {
            bottomSheetModalRef.current?.dismiss()
        }
    }, [])

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

    // Gorhom fires this on actual dismissal completion (animation finished
    // with status DISMISSED). `onBackdropPress` is intentionally NOT
    // invoked here — that's reserved for the genuine backdrop-press
    // gesture path. Fanning it out at dismiss caused a redundant
    // `store.dismiss(...)` cycle that tore down the underlying sheet.
    const handleDismiss = useCallback(() => {
        onDismiss?.()
    }, [onDismiss])

    // Pan-down / backdrop dismissals bypass the isVisible flow. Listen to the
    // animation transitioning toward index -1 (closed) and dismiss the
    // keyboard at the start of that animation so it doesn't linger after the
    // sheet finishes closing.
    const handleAnimate = useCallback((_from: number, toIndex: number) => {
        if (toIndex === -1) {
            Keyboard.dismiss()
        }
    }, [])

    // Merge background style with containerStyle for backward compatibility
    const mergedBackgroundStyle = containerStyle
        ? [styles.background, containerStyle]
        : styles.background

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            snapPoints={defaults.snapPoints}
            enableDynamicSizing={defaults.enableDynamicSizing}
            // Don't let gorhom touch underlying modals when a new one opens.
            // The default 'switch' calls `minimize()` on the previous top,
            // and in practice (see the WC-connect flow over a webview sheet)
            // the underlying modal gets fully DISMISSED rather than just
            // minimized — tearing the webview down. With 'push' the
            // underlying stays mounted at its current snap point, hidden
            // behind the new modal's backdrop, and naturally re-appears
            // when the topmost dismisses.
            stackBehavior='push'
            // Never let the sheet rise above the status bar, even when its
            // dynamically-sized content (e.g. an expanded HD wallet tree)
            // would otherwise push it past the configured snap point. Skip
            // for `full`-size sheets which intentionally cover everything.
            topInset={size === 'full' ? 0 : insets.top}
            backdropComponent={renderBackdrop}
            onDismiss={handleDismiss}
            onAnimate={handleAnimate}
            handleIndicatorStyle={
                enablePanDownToClose ? styles.handleIndicator : styles.hidden
            }
            backgroundStyle={mergedBackgroundStyle}
            detached={false}
            // App-wide stacking policy for every PWBottomSheet. Overrides
            // gorhom's default 'switch', which calls `minimize()` on the
            // current top sheet whenever a new modal is presented. The
            // minimize→restore cycle is unsafe when a transient sheet
            // opens and closes faster than the animation can settle: the
            // underlying modal's gorhom `onDismiss` callback fires, which
            // we wire through `handleBackdropPress` → `store.dismiss` →
            // `store.remove`, tearing down a modal nobody asked to
            // dismiss. The Ledger connection-issue troubleshooting overlay
            // (opened on `setError` and dismissed ~50ms later by the actor
            // lifecycle's `reset()`) is the path that first surfaced this,
            // but the fix is global — 'switch' is unsafe for any
            // sheet-over-sheet flow. 'push' keeps every modal mounted at
            // its full snap point; the top sheet's backdrop already blocks
            // pointer events for the sheets behind it, so we don't lose
            // the visual hierarchy.
            stackBehavior='push'
            keyboardBehavior='interactive'
            keyboardBlurBehavior='restore'
            enablePanDownToClose={enablePanDownToClose}
            enableContentPanningGesture={enableContentPanningGesture}
            enableOverDrag={false}
            bottomInset={Platform.OS === 'android' ? insets.bottom : 0}
        >
            <NotifierWrapper
                omitGlobalMethodsHookup
                ref={bottomSheetNotifier}
            >
                <PWView style={styles.contentWrapper}>
                    {autoCreateContainer ? (
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
                    )}
                </PWView>
            </NotifierWrapper>
        </BottomSheetModal>
    )
}
