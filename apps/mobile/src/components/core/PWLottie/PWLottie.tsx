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

import LottieView from 'lottie-react-native'
import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { StyleSheet } from 'react-native'
import { useIsAnimationVisible } from '@hooks/useIsAnimationVisible'
import './configureLottieWasm'

export type PWLottieProps = ComponentProps<typeof LottieView>

// lottie-react-native's web implementation reads a separate `webStyle` prop
// (CSSProperties) instead of `style` — every call site in this app only ever
// passes `style`, so on web the animation silently got no size at all and
// fell back to filling its container. Deriving `webStyle` from `style` here
// (rather than at every call site) fixes it once; harmless on native, whose
// codegen'd view doesn't recognize `webStyle` and drops it.
export const PWLottie = (props: PWLottieProps) => {
    const { style, webStyle, autoPlay, loop, source, ...rest } = props
    const lottieRef = useRef<LottieView>(null)
    const isVisible = useIsAnimationVisible()
    // Only autoplaying loops are paused: a one-shot animation ends on its own,
    // and resuming one that already finished would replay it.
    const isPausable = Boolean(autoPlay && loop)
    // Native autoplay can start after the first effect runs, so an animation
    // mounted hidden must not autoplay at all rather than be paused at once.
    const [isVisibleAtMount] = useState(isVisible)
    // resume() only continues a paused animation; one that never ran needs play().
    const hasStarted = useRef(Boolean(autoPlay && (isVisibleAtMount || !loop)))
    const isPaused = useRef(false)

    // Also re-run on a new source: loading one restarts an autoplaying view,
    // which would otherwise keep animating while hidden.
    useEffect(() => {
        if (!isPausable) return
        if (!isVisible) {
            isPaused.current = true
            lottieRef.current?.pause()
            return
        }
        if (!hasStarted.current) {
            hasStarted.current = true
            lottieRef.current?.play()
        } else if (isPaused.current) {
            lottieRef.current?.resume()
        }
        isPaused.current = false
    }, [isPausable, isVisible, source])

    return (
        <LottieView
            {...rest}
            source={source}
            ref={lottieRef}
            autoPlay={isPausable ? isVisibleAtMount : autoPlay}
            loop={loop}
            style={style}
            webStyle={
                webStyle ??
                (style
                    ? (StyleSheet.flatten(style) as PWLottieProps['webStyle'])
                    : undefined)
            }
        />
    )
}
