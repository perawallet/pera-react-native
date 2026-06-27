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

import { useCallback, useState } from 'react'
import type { WebViewMessageEvent } from 'react-native-webview'
import { config } from '@perawallet/wallet-core-config'
import { useTermsAcceptance } from '../../hooks/useTermsAcceptance'
import embeddedTerms from './embedded-terms.json'

/** Message the injected script posts once the terms have been scrolled to the end. */
const SCROLLED_TO_BOTTOM_MESSAGE = 'pera-terms-scrolled-to-bottom'

/**
 * Injected into the terms WebView to enable the "I Agree" button only after the
 * user reaches the bottom. Fires on scroll and once shortly after load (so terms
 * that fit without scrolling still enable the button). `true;` is required so
 * injected code returns a defined value on iOS.
 */
const SCROLL_TO_BOTTOM_JS = `
(function () {
  function atBottom() {
    return window.innerHeight + window.scrollY >= document.body.scrollHeight - 24;
  }
  function notify() {
    if (atBottom()) {
      window.ReactNativeWebView.postMessage('${SCROLLED_TO_BOTTOM_MESSAGE}');
    }
  }
  window.addEventListener('scroll', notify, { passive: true });
  setTimeout(notify, 300);
})();
true;
`

type TermsWebViewSource = { html: string; baseUrl: string } | { uri: string }

export type UseTermsAcceptanceViewResult = {
    /** Bundled HTML when the embedded copy matches the required version (no
     * spinner); otherwise the remote URL. */
    source: TermsWebViewSource
    /** Whether to show the WebView's loading state — only for the remote copy. */
    showLoading: boolean
    injectedJavaScript: string
    onMessage: (event: WebViewMessageEvent) => void
    /** True until the user has scrolled to the bottom of the terms. */
    isAgreeDisabled: boolean
    onAgree: () => void
}

/**
 * Drives the Terms & Conditions view, independent of how it's presented (bottom
 * sheet on the welcome screen, or full-screen prompt for already-onboarded users
 * after a version bump). Picks the bundled copy when it matches the required
 * version (instant, no spinner) and falls back to the remote URL only when the
 * version was bumped beyond what shipped; gates "I Agree" on scrolling to the
 * bottom; records acceptance and then invokes `onAccepted` (the presenter's
 * close/resolve) on agree.
 */
export const useTermsAcceptanceView = (
    onAccepted: () => void,
): UseTermsAcceptanceViewResult => {
    const { acceptCurrentTerms, currentVersion } = useTermsAcceptance()
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)

    const useEmbedded = currentVersion === embeddedTerms.version
    const source: TermsWebViewSource = useEmbedded
        ? { html: embeddedTerms.html, baseUrl: config.termsOfServiceUrl }
        : { uri: config.termsOfServiceUrl }

    const onMessage = useCallback((event: WebViewMessageEvent) => {
        if (event.nativeEvent.data === SCROLLED_TO_BOTTOM_MESSAGE) {
            setHasScrolledToBottom(true)
        }
    }, [])

    const onAgree = useCallback(() => {
        acceptCurrentTerms()
        onAccepted()
    }, [acceptCurrentTerms, onAccepted])

    return {
        source,
        showLoading: !useEmbedded,
        injectedJavaScript: SCROLL_TO_BOTTOM_JS,
        onMessage,
        isAgreeDisabled: !hasScrolledToBottom,
        onAgree,
    }
}
