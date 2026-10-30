/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { useCallback, useRef, type RefObject } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { type CameraRef } from 'react-native-vision-camera'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { isAndroid } from '@utils/platform'

export type UseQRCameraScannerResult = {
    cameraRef: RefObject<Nullable<CameraRef>>
    handleLayout: (event: LayoutChangeEvent) => void
    focusCenter: () => void
}

export const useQRCameraScanner = (): UseQRCameraScannerResult => {
    const cameraRef = useRef<CameraRef>(null)
    // Latest measured preview size, used to derive the centre view point for
    // focusTo. Kept in a ref (not state) so measuring the layout doesn't
    // re-render the camera.
    const previewSizeRef =
        useRef<Nullable<{ width: number; height: number }>>(null)

    // Record the preview size so focusCenter can target the view's centre.
    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout
        previewSizeRef.current = { width, height }
    }, [])

    // Android-only: the v5 pipeline doesn't reliably continuous-autofocus a QR
    // held close to the lens, so codes stay blurry. iOS's native AF handles it,
    // hence the scoping. Focus the reticle's centre (focusTo takes screen
    // coordinates); 'continuous' keeps re-adapting and autoResetAfter:null
    // stops it reverting to whole-scene AF.
    //
    // No-ops before layout is measured and rejects without focus metering —
    // both fall back to native AF plus tap-to-focus. See.
    const focusCenter = useCallback(() => {
        if (!isAndroid()) {
            return
        }

        const previewSize = previewSizeRef.current
        if (
            !previewSize ||
            previewSize.width === 0 ||
            previewSize.height === 0
        ) {
            return
        }

        cameraRef.current
            ?.focusTo(
                { x: previewSize.width / 2, y: previewSize.height / 2 },
                {
                    adaptiveness: 'continuous',
                    autoResetAfter: null,
                },
            )
            ?.catch((error: unknown) => {
                logger.debug('QRCameraScanner: centre auto-focus unavailable', {
                    error,
                })
            })
    }, [])

    return {cameraRef, handleLayout, focusCenter}
}
