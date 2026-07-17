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

import React, { useCallback } from 'react'
import { ActivityIndicator, useWindowDimensions } from 'react-native'
import { WebView } from 'react-native-webview'
import { LinearGradient } from 'expo-linear-gradient'
import {
    BottomSheetBackdrop,
    type BottomSheetBackdropProps,
    BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWIcon, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'
import { useModelViewerBottomSheet } from './useModelViewerBottomSheet'

export type ModelViewerBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    modelUrl: string
}

const SNAP_POINTS = ['100%']

export const ModelViewerBottomSheet = ({
    isVisible,
    onClose,
    modelUrl,
}: ModelViewerBottomSheetProps) => {
    const dimensions = useWindowDimensions()
    const insets = useSafeAreaInsets()
    const styles = useStyles({ height: dimensions.height, insets })
    const { sheetRef, html, isLoading, gradientColors, handleMessage } =
        useModelViewerBottomSheet({ isVisible, modelUrl })

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                opacity={0.9}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                pressBehavior='close'
            />
        ),
        [],
    )

    return (
        // Note we are using BottomSheetModal directly here instead of our PWBottomSheet wrapper
        // because we need edge to edge sizing which our wrapper doesn't allow and generally doesn't want to support.
        <BottomSheetModal
            ref={sheetRef}
            snapPoints={SNAP_POINTS}
            enableDynamicSizing={false}
            backdropComponent={renderBackdrop}
            onDismiss={onClose}
            handleComponent={null}
            backgroundStyle={styles.background}
            bottomInset={0}
            topInset={0}
            detached={false}
            enablePanDownToClose={false}
            enableOverDrag={false}
            // Never disable the content pan outright: gorhom wraps content in
            // a disabled GestureDetector, which stops delivering touches on
            // Android — taps fall through to the closing backdrop
            // (PERA-4647). A never-reachable activation distance keeps the
            // viewer's own drag gestures free without that side effect.
            activeOffsetY={[-99_999, 99_999]}
        >
            <PWView style={styles.innerContainer}>
                <LinearGradient
                    colors={gradientColors}
                    locations={[0, 0.55, 1]}
                    start={{ x: 0.1, y: 0 }}
                    end={{ x: 0.9, y: 1 }}
                    style={styles.gradient}
                />

                <PWTouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    testID='model-viewer-close'
                >
                    <PWIcon
                        name='cross'
                        size='md'
                    />
                </PWTouchableOpacity>

                {html ? (
                    <WebView
                        source={{ html }}
                        style={styles.webview}
                        containerStyle={styles.webviewContainer}
                        scrollEnabled={false}
                        bounces={false}
                        // sanitizeModelUrl already hard-rejects non-https
                        // model URLs and the viewer script is https, so the
                        // bridge-less frame gets no http navigation or
                        // mixed-content allowance either.
                        originWhitelist={['https://*']}
                        javaScriptEnabled
                        allowsInlineMediaPlayback
                        androidLayerType='hardware'
                        onMessage={handleMessage}
                        testID='model-viewer-webview'
                    />
                ) : (
                    <PWView style={styles.webview} />
                )}

                {isLoading && (
                    <PWView
                        style={styles.loadingOverlay}
                        pointerEvents='none'
                        testID='model-viewer-loading'
                    >
                        <ActivityIndicator
                            size='large'
                            color='white'
                        />
                    </PWView>
                )}
            </PWView>
        </BottomSheetModal>
    )
}
