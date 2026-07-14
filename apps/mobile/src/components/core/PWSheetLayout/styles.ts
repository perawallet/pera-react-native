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

import type { HorizontalPaddingMode } from '../PWScreen'

type StyleProps = {
    horizontalPadding: HorizontalPaddingMode
    bottomInset: number
    hasFooter: boolean
    isKeyboardVisible: boolean
}

export const useStyles = makeStyles(
    (
        theme,
        {
            horizontalPadding,
            bottomInset,
            hasFooter,
            isKeyboardVisible,
        }: StyleProps,
    ) => ({
        root: {
            flex: 1,
        },
        scrollView: {
            flex: 1,
        },
        // Sticky header lives inside the scroll so the sheet measures the full
        // content; opaque background hides body content scrolling underneath.
        header: {
            backgroundColor: theme.colors.background,
        },
        // gorhom draws the sheet edge-to-edge, so with no footer the safe-area
        // inset must live inside the scroll. Dropped when the keyboard is open
        // (it already covers the home indicator).
        body: {
            paddingHorizontal:
                horizontalPadding === 'none'
                    ? 0
                    : theme.spacing[horizontalPadding],
            paddingTop: theme.spacing.xl,
            paddingBottom:
                hasFooter || isKeyboardVisible
                    ? theme.spacing.xl
                    : theme.spacing.xl + bottomInset,
        },
        // Bottom inset dropped when the keyboard is open (it already covers the
        // home indicator).
        footer: {
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.lg,
            paddingBottom: isKeyboardVisible
                ? theme.spacing.xl
                : theme.spacing.xl + bottomInset,
        },
    }),
)
