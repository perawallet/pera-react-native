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

import { useCallback, useEffect, useState } from 'react'
import {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    type AnimatedStyle,
} from 'react-native-reanimated'
import type { ViewStyle } from 'react-native'

// A single Y-axis flip: 0 = masked front shown, 1 = secure back shown.
const FLIP_DURATION_MS = 500
const HALF_TURN_DEG = 180
// Depth of the 3D flip; larger = flatter/subtler foreshortening.
const PERSPECTIVE = 1000
const TIMING = { duration: FLIP_DURATION_MS, easing: Easing.inOut(Easing.ease) }

type UsePeraCardVisualParams = {
    /** Secure-view URL once fetched; stays set (cached) across hide so the back
     *  face isn't remounted/re-fetched on re-reveal. `undefined` while masked. */
    secureImageUrl?: string
    /** Whether the card should be flipped open to the secure face. */
    isOpen?: boolean
    /** Forwarded when the secure image has actually rendered. */
    onSecureImageLoad?: () => void
}

type UsePeraCardVisualResult = {
    /**
     * URL mounted on the back face. Tracks `secureImageUrl` but lingers through
     * the flip-back so the card can animate closed before it unmounts.
     */
    backImageUrl: string | null
    frontAnimatedStyle: AnimatedStyle<ViewStyle>
    backAnimatedStyle: AnimatedStyle<ViewStyle>
    /** Wire to the back image's onLoad: flips the card open once it's ready. */
    onBackImageLoad: () => void
}

export const usePeraCardVisual = ({
    secureImageUrl,
    isOpen = false,
    onSecureImageLoad,
}: UsePeraCardVisualParams): UsePeraCardVisualResult => {
    const flip = useSharedValue(0)
    const [backImageUrl, setBackImageUrl] = useState<string | null>(
        secureImageUrl ?? null,
    )

    // Flip driven by the parent's open/closed state (which only turns open once
    // the image has loaded), so reveal and hide both animate, and a cached
    // re-reveal flips instantly without any re-fetch.
    useEffect(() => {
        flip.value = withTiming(isOpen ? 1 : 0, TIMING)
    }, [isOpen, flip])

    // Mount the back face as soon as a URL arrives and keep it mounted while the
    // URL is cached (so re-reveal never re-downloads). When the URL finally
    // clears (load failure / reset), unmount only after the flip-close finishes
    // — the timer mirrors the flip duration (same approach as PWPinCircles).
    useEffect(() => {
        if (secureImageUrl != null) {
            setBackImageUrl(secureImageUrl)
            return
        }
        const timeout = setTimeout(
            () => setBackImageUrl(null),
            FLIP_DURATION_MS,
        )
        return () => clearTimeout(timeout)
    }, [secureImageUrl])

    const onBackImageLoad = useCallback(() => {
        onSecureImageLoad?.()
    }, [onSecureImageLoad])

    const frontAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { perspective: PERSPECTIVE },
            { rotateY: `${flip.value * HALF_TURN_DEG}deg` },
        ],
    }))

    const backAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { perspective: PERSPECTIVE },
            { rotateY: `${flip.value * HALF_TURN_DEG + HALF_TURN_DEG}deg` },
        ],
    }))

    return {
        backImageUrl,
        frontAnimatedStyle,
        backAnimatedStyle,
        onBackImageLoad,
    }
}
