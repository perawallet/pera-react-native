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

import { type RefObject, useEffect } from 'react'
import type WebView from 'react-native-webview'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useIsAppLocked } from '@hooks/useIsAppLocked'
import { useBottomSheetStore } from '@modules/bottom-sheet'

// Keyboard.dismiss() only reaches React Native inputs; a focused field inside
// the page keeps the keyboard, and iOS restores it over the PIN pad.
export const BLUR_FOCUSED_ELEMENT_SCRIPT =
    "(function(){var e=document.activeElement;if(e&&typeof e.blur==='function'){e.blur();}})();true;"

/**
 * Drops the page's keyboard when the app locks or another sheet opens above
 * this WebView; the web keyboard's accessory bar would otherwise cover the
 * sheet. `ownSheetId` is the sheet the WebView itself lives in, if any.
 */
export const useBlurWebViewWhenCovered = (
    webview: RefObject<Nullable<WebView>>,
    ownSheetId: Optional<string>,
): void => {
    const isAppLocked = useIsAppLocked()
    const isCoveredBySheet = useBottomSheetStore(state => {
        const ownIndex = ownSheetId
            ? state.requests.findIndex(({ id }) => id === ownSheetId)
            : -1
        return state.requests.some(
            ({ isVisible }, index) => isVisible && index > ownIndex,
        )
    })

    useEffect(() => {
        if (isAppLocked || isCoveredBySheet) {
            webview.current?.injectJavaScript(BLUR_FOCUSED_ELEMENT_SCRIPT)
        }
    }, [isAppLocked, isCoveredBySheet, webview])
}
