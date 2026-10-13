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

import { useCallback, useState } from 'react'
import { config } from '@perawallet/wallet-core-config'
import { useLanguage } from '@hooks/useLanguage'
import { withLanguageParam } from '@modules/webview'
import { useTermsAcceptance } from '../../hooks/useTermsAcceptance'
import { getEmbeddedTerms } from './embeddedTerms'

type TermsWebViewSource = { html: string; baseUrl: string } | { uri: string }

type RemoteStatus = 'loading' | 'loaded' | 'failed'

export type UseTermsAcceptanceViewResult = {
    /** Bundled HTML in the user's locale when it matches the required version,
     * or when the remote copy failed to load; otherwise the remote URL. */
    source: TermsWebViewSource
    /** Whether to show the WebView's loading state — only for the remote copy. */
    showLoading: boolean
    /** Blocks "I Agree" until the remote copy has actually rendered. */
    isAgreeDisabled: boolean
    onLoad: () => void
    onError: () => void
    onAgree: () => void
}

/**
 * Drives the Terms & Conditions view, independent of how it's presented (bottom
 * sheet on the welcome screen, or full-screen prompt for already-onboarded users
 * after a version bump). Picks the bundled copy when it matches the required
 * version (instant, no spinner) and falls back to the remote URL only when the
 * version was bumped beyond what shipped; records acceptance and then invokes
 * `onAccepted` (the presenter's close/resolve) on agree.
 */
export const useTermsAcceptanceView = (
    onAccepted: () => void,
): UseTermsAcceptanceViewResult => {
    const { acceptCurrentTerms, currentVersion } = useTermsAcceptance()
    const { currentLanguage } = useLanguage()
    const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>('loading')

    const embedded = getEmbeddedTerms(currentLanguage)
    const termsUrl = withLanguageParam(
        config.termsOfServiceUrl,
        currentLanguage,
    )
    // A failed remote load shows the older bundled copy rather than leaving
    // the user on an error page they cannot read or accept.
    const useEmbedded =
        currentVersion === embedded.version || remoteStatus === 'failed'
    const source: TermsWebViewSource = useEmbedded
        ? { html: embedded.html, baseUrl: termsUrl }
        : { uri: termsUrl }

    const onLoad = useCallback(() => {
        setRemoteStatus(status => (status === 'failed' ? status : 'loaded'))
    }, [])

    const onError = useCallback(() => {
        setRemoteStatus('failed')
    }, [])

    const onAgree = useCallback(() => {
        acceptCurrentTerms()
        onAccepted()
    }, [acceptCurrentTerms, onAccepted])

    return {
        source,
        showLoading: !useEmbedded,
        isAgreeDisabled: !useEmbedded && remoteStatus !== 'loaded',
        onLoad,
        onError,
        onAgree,
    }
}
