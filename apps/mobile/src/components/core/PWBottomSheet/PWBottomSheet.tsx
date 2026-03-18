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
import { StyleProp, ViewStyle } from 'react-native'
import { NotifierRoot, NotifierWrapper } from 'react-native-notifier'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const bottomSheetNotifier = createRef<NotifierRoot | null>()

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
    children,
}: PWBottomSheetProps) => {
    const bottomSheetModalRef = useRef<BottomSheetModal>(null)
    const insets = useSafeAreaInsets()
    const defaults = DEFAULT_PROPS[size]
    const styles = useStyles({ insets, isFull: size === 'full' })

    // Sync isVisible prop with modal state
    useEffect(() => {
        if (isVisible) {
            bottomSheetModalRef.current?.present()
        } else {
            bottomSheetModalRef.current?.dismiss()
        }
    }, [isVisible])

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                opacity={0.9}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                pressBehavior='close'
                style={styles.backdrop}
            />
        ),
        [styles.backdrop],
    )

    const handleDismiss = useCallback(() => {
        onBackdropPress?.()
        onDismiss?.()
    }, [onBackdropPress, onDismiss])

    // Merge background style with containerStyle for backward compatibility
    const mergedBackgroundStyle = containerStyle
        ? [styles.background, containerStyle]
        : styles.background

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            snapPoints={defaults.snapPoints}
            enableDynamicSizing={defaults.enableDynamicSizing}
            backdropComponent={renderBackdrop}
            onDismiss={handleDismiss}
            handleIndicatorStyle={
                enablePanDownToClose ? styles.handleIndicator : styles.hidden
            }
            backgroundStyle={mergedBackgroundStyle}
            bottomInset={insets.bottom}
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
                        >
                            {children}
                        </BottomSheetView>
                    ) : (
                        <PWView
                            style={[styles.innerContainer, innerContainerStyle]}
                        >
                            {children}
                        </PWView>
                    )}
                </PWView>
            </NotifierWrapper>
        </BottomSheetModal>
    )
}
