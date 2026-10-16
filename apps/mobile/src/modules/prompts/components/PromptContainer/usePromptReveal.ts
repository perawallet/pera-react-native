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

import { useCallback, useEffect, useState } from 'react'
import type { ViewStyle } from 'react-native'
import {
    type AnimatedStyle,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { PROMPT_REVEAL_MS, PROMPT_REVEAL_OFFSET } from '@constants/ui'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { Prompt } from './usePromptContainer'

type UsePromptRevealParams = {
    nextPrompt?: Prompt
    dismissPrompt: (id: string) => void
    hidePrompt: (id: string) => void
}

type UsePromptRevealResult = {
    displayed: Optional<Prompt>
    revealStyle: AnimatedStyle<ViewStyle>
    handleDismiss: () => void
    handleHide: () => void
}

export const usePromptReveal = ({
    nextPrompt,
    dismissPrompt,
    hidePrompt,
}: UsePromptRevealParams): UsePromptRevealResult => {
    const isReducedMotion = useReducedMotion()

    const opacity = useSharedValue(0)
    const translateY = useSharedValue(PROMPT_REVEAL_OFFSET)

    // Driven from shared values rather than a layout `entering` prop on
    // purpose: layout animations on a subtree that mounts above the navigator
    // are what produced the Android addViewAt crash, and this overlay mounts in
    // exactly that position.
    //
    // `displayed` lags `nextPrompt` by one exit animation. Swapping straight to
    // the incoming prompt made the outgoing one vanish mid-frame, which reads as
    // a jump-cut now that prompts follow each other with no gap.
    const [displayed, setDisplayed] = useState<Optional<Prompt>>(undefined)
    const promptId = nextPrompt?.id

    useEffect(() => {
        if (promptId === displayed?.id) return

        const duration = isReducedMotion ? 0 : PROMPT_REVEAL_MS

        // Nothing on screen yet, or nothing left to show: swap at once. The
        // backdrop is opaque and unanimated — only the content fades — so
        // holding the overlay up for an exit with nothing behind it leaves an
        // invisible blocker over a usable app, eating the first tap after a
        // prompt is answered.
        if (!displayed || !nextPrompt) {
            setDisplayed(nextPrompt)
            return
        }

        // Leaves upward, and the next enters from below, so a queue reads as
        // one surface moving rather than two unrelated screens.
        opacity.value = withTiming(0, { duration })
        translateY.value = withTiming(-PROMPT_REVEAL_OFFSET, { duration })

        // Swapped on a timer rather than in withTiming's completion callback:
        // the callback does not run if the animation is interrupted or skipped,
        // and a queue that stalls mid-transition strands the user on a prompt
        // they have already answered.
        const swap = setTimeout(() => setDisplayed(nextPrompt), duration)
        return () => clearTimeout(swap)
    }, [promptId, displayed, nextPrompt, isReducedMotion, opacity, translateY])

    const displayedId = displayed?.id

    useEffect(() => {
        // Reset then animate, keyed on the id: prompts follow one another with
        // no gap, so without the reset only the first of a queue would move.
        opacity.value = 0
        translateY.value = PROMPT_REVEAL_OFFSET

        if (!displayedId) return

        const duration = isReducedMotion ? 0 : PROMPT_REVEAL_MS
        opacity.value = withTiming(1, { duration })
        translateY.value = withTiming(0, { duration })
    }, [displayedId, isReducedMotion, opacity, translateY])

    const revealStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }))

    // Keyed to what is on screen, not what is next: during an exit animation
    // the two differ, and answering the visible prompt must not resolve its
    // successor.
    const handleDismiss = useCallback(
        () => dismissPrompt(displayed?.id || ''),
        [dismissPrompt, displayed?.id],
    )
    const handleHide = useCallback(
        () => hidePrompt(displayed?.id || ''),
        [hidePrompt, displayed?.id],
    )

    return { displayed, revealStyle, handleDismiss, handleHide }
}
