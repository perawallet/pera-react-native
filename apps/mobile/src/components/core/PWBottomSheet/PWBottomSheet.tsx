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
    BottomSheetScrollView,
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
import { ScrollViewProps, StyleProp, ViewStyle } from 'react-native'
import { NotifierRoot, NotifierWrapper } from 'react-native-notifier'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const bottomSheetNotifier = createRef<NotifierRoot | null>()

export type PWBottomSheetProps = {
    /** Controls whether the bottom sheet is visible */
    isVisible: boolean
    /** Called when the backdrop is pressed or sheet is dismissed */
    onBackdropPress?: () => void
    /** Custom styles for the inner content container */
    innerContainerStyle?: StyleProp<ViewStyle>
    /** Custom styles for the modal container (applied to background) */
    containerStyle?: StyleProp<ViewStyle>
    /** Whether the content is scrollable. Defaults to true */
    scrollEnabled?: boolean
    /** Props to pass to the internal scroll view when scrollEnabled is true */
    scrollViewProps?: Omit<ScrollViewProps, 'children'>
    /** Optional snap points for the bottom sheet (e.g., ['50%', '90%']) */
    snapPoints?: (string | number)[]
    /** Whether to enable dynamic sizing based on content. Defaults to true when no snapPoints provided */
    enableDynamicSizing?: boolean
} & PropsWithChildren

export const PWBottomSheet = ({
    isVisible,
    onBackdropPress,
    innerContainerStyle,
    containerStyle,
    scrollEnabled = true,
    scrollViewProps,
    snapPoints,
    enableDynamicSizing,
    children,
}: PWBottomSheetProps) => {
    const bottomSheetModalRef = useRef<BottomSheetModal>(null)
    const insets = useSafeAreaInsets()
    const styles = useStyles()

    // Determine if dynamic sizing should be used
    const shouldUseDynamicSizing = enableDynamicSizing ?? !snapPoints

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
    }, [onBackdropPress])

    // Merge background style with containerStyle for backward compatibility
    const mergedBackgroundStyle = containerStyle
        ? [styles.background, containerStyle]
        : styles.background

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            snapPoints={snapPoints}
            enableDynamicSizing={shouldUseDynamicSizing}
            backdropComponent={renderBackdrop}
            onDismiss={handleDismiss}
            handleIndicatorStyle={styles.handleIndicator}
            backgroundStyle={mergedBackgroundStyle}
            bottomInset={insets.bottom}
            detached={false}
            keyboardBehavior='interactive'
            keyboardBlurBehavior='restore'
        >
            <NotifierWrapper
                omitGlobalMethodsHookup
                ref={bottomSheetNotifier}
            >
                {scrollEnabled ? (
                    <BottomSheetScrollView
                        style={styles.contentWrapper}
                        {...scrollViewProps}
                    >
                        <PWView
                            style={[styles.innerContainer, innerContainerStyle]}
                        >
                            {children}
                        </PWView>
                    </BottomSheetScrollView>
                ) : (
                    <BottomSheetView style={styles.contentWrapper}>
                        <PWView
                            style={[styles.innerContainer, innerContainerStyle]}
                        >
                            {children}
                        </PWView>
                    </BottomSheetView>
                )}
            </NotifierWrapper>
        </BottomSheetModal>
    )
}
