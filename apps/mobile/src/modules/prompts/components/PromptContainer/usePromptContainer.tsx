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

import { usePreferences } from '@perawallet/wallet-core-settings'
import { usePinCode } from '@perawallet/wallet-core-security'
import { useIsLockOverlayVisible } from '@modules/security'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import {
    type ReactElement,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react'
import { PinSecurityPrompt } from '../PinSecurityPrompt/PinSecurityPrompt'
import { type PromptViewProps } from '@modules/prompts/models'
import { useHasAccounts } from '@perawallet/wallet-core-accounts'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useTermsAcceptance } from '@modules/onboarding/hooks/useTermsAcceptance'
import {
    TermsAcceptancePrompt,
    TERMS_ACCEPTANCE_PROMPT_ID,
} from '@modules/onboarding/components/TermsAndConditionsSheet'
import { UserPreferences } from '@constants/user-preferences'
import { LONG_PROMPT_DISPLAY_DELAY } from '@constants/ui'
import { PromptPriority } from '@modules/prompts/constants'
import { usePromptStore } from '@modules/prompts/store'
import { useBannerPrompt } from '@modules/prompts/hooks/useBannerPrompt'
import {
    BannerPrompt,
    BANNER_PROMPT_ID,
} from '@modules/prompts/components/BannerPrompt'

export type Prompt = {
    id: string
    priority: number
    /**
     * A gate must be answered before the app is usable (terms, a forced update
     * notice); a nudge can be worked around. The distinction drives two things.
     *
     * Gates hold bottom-sheet presentation from the moment they are due and
     * render with no delay, so there is no window in which the hold is on and
     * nothing is on screen. That window has to be closed rather than tolerated:
     * a sheet painting inside it is recorded as presented and then survives the
     * hold (PERA-4743/PERA-4870), and to the user the app just swallows a tap.
     *
     * Nudges hold only while actually on screen, so a sheet the user opened
     * deliberately still presents.
     */
    isGate: boolean
    /**
     * Renders edge to edge, without the container's safe-area padding. Banner
     * art covers the whole surface, so that padding shows as a frame around it;
     * a full-bleed prompt insets whatever chrome it needs itself.
     */
    isFullBleed?: boolean
    // Nullable: a prompt's own data can empty underneath it (a banner refetch
    // dropping the banner it was showing), and rendering nothing for that frame
    // while it asks to be dismissed beats asserting it cannot happen.
    component: (props: PromptViewProps) => ReactElement | null
}

/** A registry entry plus the condition that makes it due right now. */
type PromptCandidate = Prompt & { isDue: boolean }

type UsePromptContainerResult = {
    hidePrompt: (id: string) => void
    dismissPrompt: (id: string) => void
    nextPrompt?: Prompt
}

export const usePromptContainer = (): UsePromptContainerResult => {
    const { getPreference, setPreference } = usePreferences()
    const { checkPinEnabled } = usePinCode()
    const hasAccounts = useHasAccounts()
    const { needsAcceptance: needsTermsAcceptance } = useTermsAcceptance()
    const isLockOverlayVisible = useIsLockOverlayVisible()
    const setPresentationHeld = useBottomSheetStore(
        state => state.setPresentationHeld,
    )
    const bannerPrompt = useBannerPrompt()
    const [nextPrompt, setNextPrompt] = useState<Optional<Prompt>>(undefined)
    const dismissedIds = usePromptStore(state => state.dismissedIds)
    const dismiss = usePromptStore(state => state.dismiss)
    const hasPaidEntryDelay = usePromptStore(state => state.hasPaidEntryDelay)
    const markEntryDelayPaid = usePromptStore(state => state.markEntryDelayPaid)

    // Terms is an entry here rather than a special case checked first: one
    // ordered list is the whole point, and its priority already says it wins.
    const candidates = useMemo<PromptCandidate[]>(
        () => [
            {
                id: TERMS_ACCEPTANCE_PROMPT_ID,
                priority: PromptPriority.termsAcceptance,
                isGate: true,
                component: TermsAcceptancePrompt,
                // Version-based rather than a one-time preference: a bumped
                // terms version must re-prompt everyone.
                isDue: needsTermsAcceptance,
            },
            {
                // One entry, not one per auto-open mode: `force` and `select`
                // are the same surface under different rules, so the rank and
                // the gate flag follow the data rather than splitting the
                // component in two.
                id: BANNER_PROMPT_ID,
                priority: bannerPrompt.isForced
                    ? PromptPriority.forcedBanner
                    : PromptPriority.autoOpenBanner,
                isGate: bannerPrompt.isForced,
                isFullBleed: true,
                component: BannerPrompt,
                isDue: bannerPrompt.isDue,
            },
            {
                id: UserPreferences._securityPinSetupPrompt,
                priority: PromptPriority.securityPinSetup,
                isGate: false,
                component: PinSecurityPrompt,
                isDue: !getPreference(UserPreferences._securityPinSetupPrompt),
            },
        ],
        [
            needsTermsAcceptance,
            getPreference,
            bannerPrompt.isDue,
            bannerPrompt.isForced,
        ],
    )

    const prompt = useMemo(() => {
        if (!hasAccounts || isLockOverlayVisible) {
            return undefined
        }

        return candidates
            .filter(
                candidate =>
                    candidate.isDue && !dismissedIds.includes(candidate.id),
            )
            .sort((a, b) => b.priority - a.priority)[0]
    }, [candidates, dismissedIds, hasAccounts, isLockOverlayVisible])

    // Identity-stable: `prompt` is rebuilt whenever the registry recomputes, so
    // assigning it straight into state would re-render, rebuild it again and
    // spin. Harmless while every prompt waited behind a timer; a gate sets this
    // synchronously, which turns the churn into a hot loop.
    const showPrompt = useCallback((next: Prompt) => {
        setNextPrompt(current => (current?.id === next.id ? current : next))
    }, [])

    useEffect(() => {
        if (!prompt) {
            setNextPrompt(undefined)
            return
        }

        let cancelled = false
        let timeoutId: Optional<ReturnType<typeof setTimeout>>

        const showPromptAfterChecks = async () => {
            // For the PIN security prompt, check if PIN is already enabled
            if (prompt.id === UserPreferences._securityPinSetupPrompt) {
                const pinEnabled = await checkPinEnabled()
                if (pinEnabled) {
                    // Self-heal: persist the preference so future checks are synchronous
                    setPreference(prompt.id, true)
                    if (!cancelled) {
                        dismiss(prompt.id)
                    }
                    return
                }
            }

            if (cancelled) return

            // The delay is "don't ambush someone the instant they open the
            // app", which is a property of the session, not of each prompt.
            // Paying it per prompt is what made a post-migration launch a
            // sequence of separate ambushes (PERA-4874) — the second and third
            // now follow the first immediately.
            //
            // A gate skips the delay outright: it holds sheet presentation from
            // the moment it is due, so any wait here is a window where the app
            // looks normal but silently swallows taps. It marks the delay paid
            // too — the user has now been interrupted, so the nudges queued
            // behind it should follow on rather than wait again.
            if (prompt.isGate) {
                markEntryDelayPaid()
                showPrompt(prompt)
                return
            }

            if (hasPaidEntryDelay) {
                showPrompt(prompt)
                return
            }

            timeoutId = setTimeout(() => {
                if (!cancelled) {
                    markEntryDelayPaid()
                    showPrompt(prompt)
                }
            }, LONG_PROMPT_DISPLAY_DELAY)
        }

        void showPromptAfterChecks()

        return () => {
            cancelled = true
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [
        prompt,
        checkPinEnabled,
        setPreference,
        dismiss,
        hasPaidEntryDelay,
        markEntryDelayPaid,
        showPrompt,
    ])

    // The prompt overlay is in-tree, so gorhom's portal (and the sheets every
    // signing overlay drives) paints above it — a sign-review sheet could
    // otherwise be actioned while a legally-required gate is up. Holding at
    // the manager keeps new sheets off screen until the prompt is answered.
    // Keyed to `prompt`, not `nextPrompt`: the latter lands a display delay
    // later, and a sheet that paints inside that window is already presented
    // and so survives the hold (e.g. a WC deep-link cold start).
    // A gate holds from the moment it is due; a nudge only while it is on
    // screen. Holding a nudge pre-emptively bought nothing and cost a lot: for
    // the length of the display delay the app looked idle while quietly
    // discarding every sheet the user asked for, which is both a dead tap in
    // the product and three intermittently failing browser e2e specs.
    useEffect(() => {
        setPresentationHeld(!!prompt?.isGate || !!nextPrompt, 'blocking-prompt')
    }, [prompt?.isGate, nextPrompt, setPresentationHeld])
    // Never leave the hold stuck on if the container unmounts.
    useEffect(
        () => () => setPresentationHeld(false, 'blocking-prompt'),
        [setPresentationHeld],
    )

    // Hides only the prompt that was answered. This used to hide every prompt,
    // which meant answering one silently suppressed the rest for the session —
    // and, because that state was the container's own, a remount brought them
    // all back. The queue now advances to the next by priority instead.
    const hidePrompt = (id: string) => {
        dismiss(id)
    }

    const dismissPrompt = (id: string) => {
        setPreference(id, true)
        dismiss(id)
    }

    return {
        hidePrompt,
        dismissPrompt,
        nextPrompt,
    }
}
