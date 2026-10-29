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

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ViewStyle } from 'react-native'
import {
    type AnimatedStyle,
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import {
    INTEGRITY_PENDING_GRACE_MS,
    type IntegrityAccessState,
} from '@perawallet/wallet-core-browser-runtime'
import { getSurface } from '@perawallet/wallet-extension-platform-chrome'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    OFFLINE_BANNER_COLLAPSE_MS,
    OFFLINE_BANNER_COLLAPSE_TRANSLATE,
    OFFLINE_BANNER_ENTER_MS,
    OFFLINE_BANNER_ENTER_TRANSLATE,
    OFFLINE_BANNER_EXPANDED_MS,
    OFFLINE_BANNER_REEXPANDED_MS,
    OFFLINE_RECONNECT_DISPLAY_MS,
} from '@constants/ui'
import { useIntegrityAccessState } from '@hooks/useIntegrityAccessState.web'
import { useIntegrityAccessStore } from '@hooks/useIntegrityAccessStore.web'
import { useIntegrityFeedbackStore } from '@hooks/useIntegrityFeedbackStore'
import { useLanguage } from '@hooks/useLanguage'

/** How long a pressed action shows a spinner before the pill gives it back. */
const ACTION_PENDING_MAX_MS = 10_000

type ProblemMode = 'checking' | 'service' | 'verification' | 'blocked'
export type IntegrityBannerMode = ProblemMode | 'restored'

export type UseIntegrityBannerResult = {
    isVisible: boolean
    mode: Nullable<IntegrityBannerMode>
    label: string
    description: Nullable<string>
    actionLabel: Nullable<string>
    onAction: Nullable<() => void>
    isActionPending: boolean
    isExpanded: boolean
    isExplanationRendered: boolean
    entryAnimatedStyle: AnimatedStyle<ViewStyle>
    explanationAnimatedStyle: AnimatedStyle<ViewStyle>
}

const problemModeFor = (
    state: IntegrityAccessState,
    hasOutlastedGrace: boolean,
): Nullable<ProblemMode> => {
    if (state.status === 'degraded') return state.reason
    if (state.status === 'checking' && hasOutlastedGrace) return 'checking'
    return null
}

// Distinct per state the user can act on; a change ends an in-flight action.
const stateSignature = (state: IntegrityAccessState): string =>
    state.status === 'degraded' ? `degraded:${state.reason}` : state.status

export const useIntegrityBanner = (): UseIntegrityBannerResult => {
    const { state, retry, verify } = useIntegrityAccessState()
    const { t } = useLanguage()
    const now = useIntegrityAccessStore(store => store.now)
    const checkStartedAt = useIntegrityAccessStore(
        store => store.snapshot?.attempt?.startedAt ?? null,
    )
    const emphasisNonce = useIntegrityFeedbackStore(
        store => store.emphasisNonce,
    )
    const [isRestoredVisible, setIsRestoredVisible] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [isExplanationRendered, setIsExplanationRendered] = useState(false)
    const [isActionPending, setIsActionPending] = useState(false)
    const previousProblem = useRef<Nullable<ProblemMode>>(null)
    const previousEmphasisNonce = useRef(emphasisNonce)
    const restoredTimer = useRef<Nullable<ReturnType<typeof setTimeout>>>(null)
    const collapseTimer = useRef<Nullable<ReturnType<typeof setTimeout>>>(null)
    const pendingTimer = useRef<Nullable<ReturnType<typeof setTimeout>>>(null)
    const entryProgress = useSharedValue(0)
    const expandProgress = useSharedValue(0)

    // dApp approval windows carry their own inline notice.
    const isApprovalSurface = getSurface() === 'approval'
    // A quick hidden check shows nothing; one that runs long says so.
    const hasOutlastedGrace =
        checkStartedAt !== null &&
        now - checkStartedAt >= INTEGRITY_PENDING_GRACE_MS
    const problem = isApprovalSurface
        ? null
        : problemModeFor(state, hasOutlastedGrace)
    const mode: Nullable<IntegrityBannerMode> =
        problem ?? (isRestoredVisible ? 'restored' : null)
    const isVisible = mode !== null

    const expandFor = useCallback((durationMs: number) => {
        if (collapseTimer.current) clearTimeout(collapseTimer.current)
        setIsExpanded(true)
        collapseTimer.current = setTimeout(() => {
            setIsExpanded(false)
            collapseTimer.current = null
        }, durationMs)
    }, [])

    useEffect(() => {
        const previous = previousProblem.current
        previousProblem.current = problem
        if (problem !== null) {
            if (restoredTimer.current) clearTimeout(restoredTimer.current)
            setIsRestoredVisible(false)
            if (problem !== previous && problem !== 'checking') {
                expandFor(OFFLINE_BANNER_EXPANDED_MS)
            }
            return
        }
        if (collapseTimer.current) clearTimeout(collapseTimer.current)
        setIsExpanded(false)
        // Only an outage earns a "restored"; a check that ran long was no outage.
        if (
            previous !== null &&
            previous !== 'checking' &&
            state.status === 'ready'
        ) {
            setIsRestoredVisible(true)
            restoredTimer.current = setTimeout(() => {
                setIsRestoredVisible(false)
                restoredTimer.current = null
            }, OFFLINE_RECONNECT_DISPLAY_MS)
        }
    }, [problem, state.status, expandFor])

    useEffect(() => {
        if (emphasisNonce === previousEmphasisNonce.current) return
        previousEmphasisNonce.current = emphasisNonce
        if (problem === null || problem === 'checking') return
        expandFor(OFFLINE_BANNER_REEXPANDED_MS)
    }, [emphasisNonce, problem, expandFor])

    const signature = stateSignature(state)
    useEffect(() => {
        if (pendingTimer.current) clearTimeout(pendingTimer.current)
        setIsActionPending(false)
    }, [signature])

    useEffect(() => {
        if (!isVisible) {
            entryProgress.value = 0
            return
        }
        entryProgress.value = withTiming(1, {
            duration: OFFLINE_BANNER_ENTER_MS,
            easing: Easing.out(Easing.cubic),
        })
    }, [isVisible, entryProgress])

    useEffect(() => {
        if (isExpanded) {
            setIsExplanationRendered(true)
            expandProgress.value = withTiming(1, {
                duration: OFFLINE_BANNER_COLLAPSE_MS,
            })
            return
        }
        expandProgress.value = withTiming(0, {
            duration: OFFLINE_BANNER_COLLAPSE_MS,
        })
        const unmountTimer = setTimeout(
            () => setIsExplanationRendered(false),
            OFFLINE_BANNER_COLLAPSE_MS,
        )
        return () => clearTimeout(unmountTimer)
    }, [isExpanded, expandProgress])

    useEffect(
        () => () => {
            for (const timer of [restoredTimer, collapseTimer, pendingTimer]) {
                if (timer.current) clearTimeout(timer.current)
            }
        },
        [],
    )

    const startAction = useCallback((action: () => void) => {
        action()
        setIsActionPending(true)
        if (pendingTimer.current) clearTimeout(pendingTimer.current)
        pendingTimer.current = setTimeout(() => {
            setIsActionPending(false)
            pendingTimer.current = null
        }, ACTION_PENDING_MAX_MS)
    }, [])

    const entryAnimatedStyle = useAnimatedStyle(() => ({
        opacity: entryProgress.value,
        transform: [
            {
                translateY: interpolate(
                    entryProgress.value,
                    [0, 1],
                    [-OFFLINE_BANNER_ENTER_TRANSLATE, 0],
                ),
            },
        ],
    }))

    const explanationAnimatedStyle = useAnimatedStyle(() => ({
        opacity: expandProgress.value,
        transform: [
            {
                translateY: interpolate(
                    expandProgress.value,
                    [0, 1],
                    [-OFFLINE_BANNER_COLLAPSE_TRANSLATE, 0],
                ),
            },
        ],
    }))

    const copy = (() => {
        switch (mode) {
            case 'service': {
                return {
                    label: t('integrityCheck.banner.service_label'),
                    description: t('integrityCheck.banner.service_body'),
                    actionLabel: t('integrityCheck.banner.retry'),
                    onAction: () => startAction(retry),
                }
            }
            case 'verification': {
                return {
                    label: t('integrityCheck.banner.verify_label'),
                    description: t('integrityCheck.banner.verify_body'),
                    actionLabel: t('integrityCheck.banner.verify'),
                    onAction: () => startAction(verify),
                }
            }
            case 'blocked': {
                return {
                    label: t('integrityCheck.banner.service_label'),
                    description: t('integrityCheck.banner.blocked_body'),
                    actionLabel: null,
                    onAction: null,
                }
            }
            case 'checking': {
                return {
                    label: t('integrityCheck.banner.checking_label'),
                    description: null,
                    actionLabel: null,
                    onAction: null,
                }
            }
            case 'restored': {
                return {
                    label: t('integrityCheck.banner.restored_label'),
                    description: null,
                    actionLabel: null,
                    onAction: null,
                }
            }
            default: {
                return {
                    label: '',
                    description: null,
                    actionLabel: null,
                    onAction: null,
                }
            }
        }
    })()

    return {
        isVisible,
        mode,
        ...copy,
        isActionPending,
        isExpanded: isExpanded && copy.description !== null,
        isExplanationRendered:
            isExplanationRendered && copy.description !== null,
        entryAnimatedStyle,
        explanationAnimatedStyle,
    }
}
