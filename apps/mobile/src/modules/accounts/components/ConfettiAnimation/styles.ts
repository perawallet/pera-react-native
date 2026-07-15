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

import { makeStyles, useTheme } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: theme.zIndex.overlay1,
        // Clip flakes that sway past the screen edges.
        overflow: 'hidden',
        // Confetti is decorative — let taps pass through to the UI below
        // so buttons remain interactive while the animation plays.
        pointerEvents: 'none',
    },
    piece: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
}))

/** Vibrant on-brand palette for confetti flakes, drawn from semantic theme tokens. */
export const useConfettiColors = (): string[] => {
    const { theme } = useTheme()
    const { colors } = theme

    return [
        colors.wallet1,
        colors.wallet2,
        colors.wallet3,
        colors.wallet4,
        colors.wallet5,
        colors.success,
        colors.secondary,
        colors.warning,
    ]
}
