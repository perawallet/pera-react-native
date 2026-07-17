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

import { makeStyles } from '@rneui/themed'

type StyleProps = {
    maxHeight: number
    isFixed: boolean
}

export const useStyles = makeStyles(
    (theme, { maxHeight, isFixed }: StyleProps) => ({
        backdrop: {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.backdropModalBg,
        },
        // Pressable fills the Animated.View backdrop wrapper (opacity lives
        // on the wrapper so the press target isn't animated itself).
        backdropPressable: {
            flex: 1,
        },
        sheet: {
            position: 'absolute' as const,
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight,
            height: isFixed ? maxHeight : undefined,
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.spacing.xl,
            borderTopRightRadius: theme.spacing.xl,
            overflow: 'hidden' as const,
        },
        inner: {
            // Fixed sizes ('modal'/'full') give `sheet` a definite height —
            // `inner` must grow to fill it so content that needs real height
            // (e.g. a webview) gets it instead of collapsing to its
            // intrinsic size and leaving the rest of the sheet transparent.
            // 'auto' keeps the grow-then-scroll model: hug content, shrink
            // rather than overflow past maxHeight.
            flexGrow: isFixed ? 1 : 0,
            flexShrink: 1,
        },
    }),
)
