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
import {
    Keyboard,
    StyleProp,
    useWindowDimensions,
    ViewStyle,
} from 'react-native'
import { NotifierRoot, NotifierWrapper } from 'react-native-notifier'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Nullable } from '@perawallet/wallet-core-shared'

export const bottomSheetNotifier = createRef<Nullable<NotifierRoot>>()

type DefaultPropsReturn = {
    snapPoints?: string[]
    enableDynamicSizing: boolean
}

/**
 * Shared ceiling for tall sheets. Feeds BOTH `modal`'s snap point and `auto`'s
 * dynamic max height so the two land on the same visual ceiling and can't drift.
 */
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

    // `auto` sheets size to their content; cap at the shared ratio so a tall
    // `auto` sheet shares `modal`'s ceiling and its content scrolls past it.
    // `topInset` still prevents rising above the status bar; `bottomInset`
    // (passed to gorhom) keeps it above the home indicator.
    const maxDynamicContentSize =
        size === 'auto' ? Math.round(windowHeight * SHEET_MAX_RATIO) : undefined

    const styles = useStyles({
        insets,
        isFull: size === 'full',
        maxDynamicContentSize,
    })

    // Full-screen sheets (96–100% snap points) surface a header close (X)
    // instead, so the drag-handle notch is dropped to avoid a redundant
    // dismissal affordance.
    const isFullScreen = size === 'full' || size === 'modal'

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
            maxDynamicContentSize={maxDynamicContentSize}
            stackBehavior='push'
            // Never let the sheet rise above the status bar, even when its
            // dynamically-sized content
            topInset={size === 'full' ? 0 : insets.top}
            // Draw edge-to-edge: the sheet background extends under the home
            // indicator / nav bar to the screen bottom (no gorhom lift). The
            // bottom safe-area inset is owned centrally by `innerContainer`
            // (see styles) so content still clears the indicator.
            bottomInset={0}
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
            enableContentPanningGesture={enableContentPanningGesture}
            enableOverDrag={false}
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
