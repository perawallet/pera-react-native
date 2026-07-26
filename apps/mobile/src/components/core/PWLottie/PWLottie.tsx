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
import type { ComponentProps } from 'react'
import { StyleSheet } from 'react-native'

export type PWLottieProps = ComponentProps<typeof LottieView>

// lottie-react-native's web implementation reads a separate `webStyle` prop
// (CSSProperties) instead of `style` — every call site in this app only ever
// passes `style`, so on web the animation silently got no size at all and
// fell back to filling its container. Deriving `webStyle` from `style` here
// (rather than at every call site) fixes it once; harmless on native, whose
// codegen'd view doesn't recognize `webStyle` and drops it.
export const PWLottie = (props: PWLottieProps) => {
    const { style, webStyle, ...rest } = props
    return (
        <LottieView
            {...rest}
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
