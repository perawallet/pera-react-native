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

// Web replacement for the @gorhom/bottom-sheet-based PWBottomSheet: worklets
// are metro web stubs, so the animated native sheet cannot run under
// react-native-web. Same PWBottomSheetProps contract, rendered as a
// bottom-anchored RN Modal. Scroll cooperation is unnecessary here, so
// PWInBottomSheetContext deliberately stays at its default (false) — PWScrollView
// et al. then render plain primitives instead of gorhom internals.
import React, { createRef, useEffect, useRef } from 'react'
import { Modal, Pressable, useWindowDimensions } from 'react-native'
import type { NotifierRoot } from 'react-native-notifier'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles.web'
import type { PWBottomSheetProps, PWBottomSheetSize } from './sheet-types'

// Same-shaped export as the native module (index.ts re-exports it); nothing
// on web renders through the notifier.
export const bottomSheetNotifier = createRef<Nullable<NotifierRoot>>()
export type { PWBottomSheetProps, PWBottomSheetSize }

// Mirrors SHEET_MAX_RATIO in the native PWBottomSheet.tsx.
const SHEET_MAX_RATIO = 0.96

export const PWBottomSheet = ({
    isVisible,
    onBackdropPress,
    onDismiss,
    innerContainerStyle,
    containerStyle,
    size = 'auto',
    testID,
    children,
    enableCloseOnBackdropPress = true,
    // snapPoints/enablePanDownToClose/enableContentPanningGesture/
    // autoCreateContainer are part of the shared props contract but
    // intentionally unused here: pan gestures don't exist on web and the
    // modal adapter always creates its own container.
}: PWBottomSheetProps): React.JSX.Element | null => {
    const { height } = useWindowDimensions()
    const styles = useStyles({
        maxHeight: Math.round(height * SHEET_MAX_RATIO),
        isFixed: size !== 'auto',
    })

    // Native gorhom flow: isVisible→false plays the dismiss animation, then
    // fires onDismiss (which removes the request from the store and resolves
    // its promise). Web has no animation, so onDismiss fires immediately —
    // but only on a true→false transition. Without the previous-value guard,
    // mounting directly with isVisible={false} looks identical to "just
    // flipped false" and fires a spurious onDismiss before the sheet was
    // ever shown.
    const wasVisible = useRef(isVisible)
    useEffect(() => {
        if (wasVisible.current && !isVisible) onDismiss?.()
        wasVisible.current = isVisible
    }, [isVisible, onDismiss])

    if (!isVisible) return null

    const handleBackdropPress = (): void => {
        if (onBackdropPress) {
            onBackdropPress()
            return
        }
        if (enableCloseOnBackdropPress) onDismiss?.()
    }

    return (
        <Modal
            transparent
            visible
            animationType='fade'
            onRequestClose={handleBackdropPress}
        >
            <Pressable
                style={styles.backdrop}
                onPress={handleBackdropPress}
                testID='pw-bottom-sheet-backdrop'
            />
            <PWView
                style={[styles.sheet, containerStyle]}
                testID={testID}
            >
                <PWView style={[styles.inner, innerContainerStyle]}>
                    {children}
                </PWView>
            </PWView>
        </Modal>
    )
}
