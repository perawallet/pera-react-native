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
import { useEffect, useRef, type ComponentProps } from 'react'
import { StyleSheet } from 'react-native'
import { useIsAnimationVisible } from '@hooks/useIsAnimationVisible'
import './configureLottieWasm'
import { shouldPlayOnVisible } from './shouldPlayOnVisible'

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

    // Native views start playing when autoPlay flips to true and replay on a new
    // source only while it is true, so autoPlay tracks visibility and hiding
    // just pauses.
    useEffect(() => {
        if (!isPausable) return
        if (!isVisible) {
            lottieRef.current?.pause()
        } else if (shouldPlayOnVisible) {
            lottieRef.current?.play()
        }
    }, [isPausable, isVisible])

    return (
        <LottieView
            {...rest}
            source={source}
            ref={lottieRef}
            autoPlay={isPausable ? isVisible : autoPlay}
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
