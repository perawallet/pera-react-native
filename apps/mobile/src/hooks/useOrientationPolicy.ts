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

import { useEffect } from 'react'
import { Dimensions, Platform } from 'react-native'
import * as ScreenOrientation from 'expo-screen-orientation'

/** Android's own phone/tablet boundary (the `sw600dp` resource qualifier). */
const LARGE_SCREEN_MIN_WIDTH_DP = 600

/**
 * Locks phones to portrait while large screens follow the device.
 *
 * Android-only, and at runtime on purpose: the manifest cannot express a
 * per-size orientation (`withAndroidLargeScreenSupport` explains why and
 * declares no restriction there), so this is where the phone lock lives. The
 * splash screen is held until the app is ready, so the lock is in place before
 * the first real frame.
 *
 * The dimensions listener is for foldables: folding or unfolding crosses the
 * 600dp line without remounting the app, and the runtime lock a folded launch
 * applied must be released for the unfolded screen to rotate.
 *
 * iOS needs nothing here — it is per-idiom static: the top-level
 * `orientation: 'portrait'` pins iPhones, and `supportsTablet` writes an
 * all-orientations `UISupportedInterfaceOrientations~ipad` so iPads rotate.
 */
export const useOrientationPolicy = (): void => {
    useEffect(() => {
        if (Platform.OS !== 'android') return

        let lastIsLargeScreen: boolean | undefined

        const applyPolicy = () => {
            const { width, height } = Dimensions.get('screen')
            const isLargeScreen =
                Math.min(width, height) >= LARGE_SCREEN_MIN_WIDTH_DP

            if (isLargeScreen === lastIsLargeScreen) return
            lastIsLargeScreen = isLargeScreen

            // Orientation is cosmetic; a rejected request must not crash boot.
            void (
                isLargeScreen
                    ? ScreenOrientation.unlockAsync()
                    : ScreenOrientation.lockAsync(
                          ScreenOrientation.OrientationLock.PORTRAIT_UP,
                      )
            ).catch(() => undefined)
        }

        applyPolicy()
        const subscription = Dimensions.addEventListener('change', applyPolicy)
        return () => subscription.remove()
    }, [])
}
