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

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { config } from '@perawallet/wallet-core-config'
import {
    getSurface,
    holdIntegrityCheckHost,
    onHostedCheckEnded,
    onIntegrityEnrolmentNeeded,
    parseIntegrityFrameMessage,
    requestIntegrityEnrolment,
    type ExtensionSurface,
    type IntegrityEnrolReason,
} from '@perawallet/wallet-extension-platform-chrome'
import { useShowOnboarding } from '@hooks/useShowOnboarding'
import { useIntegrityCheckFrameStore } from './useIntegrityCheckFrameStore.web'

// An approval window lives for one dApp request and closes itself.
const HOSTING_SURFACES: readonly ExtensionSurface[] = ['popup', 'expanded']

// Only the configured check page is ever framed, whatever the worker answers.
const isConfiguredCheckUrl = (url: string): boolean => {
    try {
        return new URL(url).origin === config.integrityCheckOrigin
    } catch {
        return false
    }
}

export type UseIntegrityCheckFrameHostResult = {
    /** The URL to frame, null while there is no frame to show. */
    url: string | null
    isExpanded: boolean
    iframeRef: RefObject<HTMLIFrameElement | null>
}

export const useIntegrityCheckFrameHost =
    (): UseIntegrityCheckFrameHostResult => {
        const isOnboarding = useShowOnboarding()
        const {
            url,
            deadlineAt,
            isExpanded,
            isFinished,
            show,
            setExpanded,
            finish,
            hide,
        } = useIntegrityCheckFrameStore()
        const iframeRef = useRef<HTMLIFrameElement | null>(null)
        const wasOnboarding = useRef(isOnboarding)
        const isOnboardingNow = useRef(isOnboarding)
        const canHost = HOSTING_SURFACES.includes(getSurface())

        const request = useCallback(
            async (reason: IntegrityEnrolReason) => {
                const decision = await requestIntegrityEnrolment(reason)
                if (decision.action !== 'host') return
                if (!isConfiguredCheckUrl(decision.url)) return
                show(decision.url, decision.deadlineAt)
            },
            [show],
        )

        // Enrolment waits for a finished onboarding, so it binds an install in use.
        useEffect(() => {
            isOnboardingNow.current = isOnboarding
            if (!canHost || isOnboarding) {
                wasOnboarding.current = wasOnboarding.current || isOnboarding
                return
            }
            void request(
                wasOnboarding.current ? 'onboarding-complete' : 'page-open',
            )
            wasOnboarding.current = false
        }, [canHost, isOnboarding, request])

        useEffect(() => {
            if (!canHost) return
            return onIntegrityEnrolmentNeeded(() => {
                if (!isOnboardingNow.current) void request('enrolment-needed')
            })
        }, [canHost, request])

        useEffect(() => {
            if (!url) return
            const frameOrigin = new URL(url).origin
            const handleMessage = (event: MessageEvent): void => {
                if (event.source !== iframeRef.current?.contentWindow) return
                if (event.origin !== frameOrigin) return
                const message = parseIntegrityFrameMessage(event.data)
                if (!message) return
                if (message.event === 'finished') finish()
                else setExpanded(message.event === 'expand')
            }
            window.addEventListener('message', handleMessage)
            return () => window.removeEventListener('message', handleMessage)
        }, [url, finish, setExpanded])

        useEffect(() => {
            if (!url) return
            return onHostedCheckEnded(url, hide)
        }, [url, hide])

        useEffect(() => {
            if (!url) return
            return holdIntegrityCheckHost(url)
        }, [url])

        useEffect(() => {
            if (deadlineAt === null) return
            const timer = setTimeout(hide, Math.max(0, deadlineAt - Date.now()))
            return () => clearTimeout(timer)
        }, [deadlineAt, hide])

        return { url: isFinished ? null : url, isExpanded, iframeRef }
    }
