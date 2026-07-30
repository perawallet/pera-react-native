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
import { type ReactElement, useEffect, useMemo, useState } from 'react'
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

const PROMPT_SEQUENCE = {
    [UserPreferences._securityPinSetupPrompt]: PinSecurityPrompt,
}

type Prompt = {
    id: string
    component: (props: PromptViewProps) => ReactElement
}

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
    const [hiddenPrompts, setHiddenPrompts] = useState<Set<string>>(new Set())
    const [nextPrompt, setNextPrompt] = useState<Optional<Prompt>>(undefined)

    const prompt = useMemo(() => {
        if (!hasAccounts || isLockOverlayVisible) {
            return undefined
        }

        // Terms & Conditions take priority: legally they must be re-accepted
        // whenever the required version changes. Unlike the other prompts this is
        // version-based (not a one-time preference), so it's checked separately.
        if (
            needsTermsAcceptance &&
            !hiddenPrompts.has(TERMS_ACCEPTANCE_PROMPT_ID)
        ) {
            return {
                id: TERMS_ACCEPTANCE_PROMPT_ID,
                component: TermsAcceptancePrompt,
            } as Prompt
        }

        const prompt = Object.entries(PROMPT_SEQUENCE).find(p => {
            const pref = getPreference(p[0])
            return !pref && !hiddenPrompts.has(p[0])
        })

        if (prompt) {
            return {
                id: prompt[0],
                component: prompt[1],
            } as Prompt
        }
        return undefined
    }, [
        getPreference,
        hiddenPrompts,
        hasAccounts,
        needsTermsAcceptance,
        isLockOverlayVisible,
    ])

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
                        setHiddenPrompts(new Set(Object.keys(PROMPT_SEQUENCE)))
                    }
                    return
                }
            }

            if (cancelled) return

            //it's too jarring if the prompt appears immediately after the user opens the app
            timeoutId = setTimeout(() => {
                if (!cancelled) {
                    setNextPrompt(prompt)
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
    }, [prompt, checkPinEnabled, setPreference])

    const hidePrompt = () => {
        //we only want to show one prompt at a time so hide all prompts at this point
        setHiddenPrompts(
            new Set([
                ...Object.keys(PROMPT_SEQUENCE),
                TERMS_ACCEPTANCE_PROMPT_ID,
            ]),
        )
    }

    const dismissPrompt = (id: string) => {
        setPreference(id, true)
        hidePrompt()
    }

    return {
        hidePrompt,
        dismissPrompt,
        nextPrompt,
    }
}
