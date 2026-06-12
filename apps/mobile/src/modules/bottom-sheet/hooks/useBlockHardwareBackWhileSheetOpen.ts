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

import { useEffect } from 'react'
import { BackHandler } from 'react-native'

import { useBottomSheetStore } from '../store/bottomSheetStore'

// Bottom sheets are gorhom modal portals living outside the navigator, so the
// JS-handled Android system back pops the screen behind an open sheet. Swallow
// back while any sheet is visible, then restore it on close. (Registered after
// react-navigation's handler, so it runs first; inert on iOS.)
export const useBlockHardwareBackWhileSheetOpen = (): void => {
    const isAnySheetOpen = useBottomSheetStore(s =>
        s.requests.some(r => r.isVisible),
    )

    useEffect(() => {
        if (!isAnySheetOpen) return

        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => true,
        )

        return () => subscription.remove()
    }, [isAnySheetOpen])
}
