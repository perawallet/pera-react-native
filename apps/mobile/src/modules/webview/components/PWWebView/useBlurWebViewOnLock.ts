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
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useIsAppLocked } from '@hooks/useIsAppLocked'

// Keyboard.dismiss() only reaches React Native inputs; a focused field inside
// the page keeps the keyboard, and iOS restores it over the PIN pad.
export const BLUR_FOCUSED_ELEMENT_SCRIPT =
    "(function(){var e=document.activeElement;if(e&&typeof e.blur==='function'){e.blur();}})();true;"

export const useBlurWebViewOnLock = (
    webview: RefObject<Nullable<WebView>>,
): void => {
    const isAppLocked = useIsAppLocked()

    useEffect(() => {
        if (isAppLocked) {
            webview.current?.injectJavaScript(BLUR_FOCUSED_ELEMENT_SCRIPT)
        }
    }, [isAppLocked, webview])
}
