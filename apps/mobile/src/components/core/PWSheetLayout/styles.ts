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

import { makeStyles } from '@rneui/themed'

type StyleProps = {
    horizontalPadding: 'xl' | 'none'
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
        // Column wrapper used only when a `footer` is present, so the scroll can
        // shrink and the footer stays pinned below it.
        root: {
            flexShrink: 1,
        },
        scrollView: {
            flexShrink: 1,
        },
        // Sticky header lives inside the scroll (so the sheet measures the full
        // content and sizes to it); an opaque background keeps body content from
        // showing through as it scrolls underneath.
        header: {
            backgroundColor: theme.colors.background,
        },
        body: {
            paddingHorizontal:
                horizontalPadding === 'none' ? 0 : theme.spacing.xl,
            paddingTop: theme.spacing.xl,
        },
        // Bottom of the scroll body. With no footer the safe-area inset lives
        // here, INSIDE the scroll, so the last item clears the nav bar / home
        // indicator (gorhom draws the sheet edge-to-edge). With a footer it is
        // just a visual gap — the footer owns the inset. When the keyboard is
        // open it covers the home indicator, so the inset is dropped for a flat
        // 24 gap above the keyboard. Applied after `bodyStyle` so callers can't
        // accidentally drop it.
        bodyBottom: {
            paddingBottom:
                hasFooter || isKeyboardVisible
                    ? theme.spacing.xl
                    : theme.spacing.xl + bottomInset,
        },
        // Fixed footer pinned below the scroll. Owns the bottom safe-area inset
        // (12 visual gap + nav-bar inset) since it is the bottom-most element.
        // When the keyboard is open it covers the home indicator, so the inset
        // is dropped for a flat 24 gap above the keyboard instead.
        footer: {
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.lg,
            paddingBottom: isKeyboardVisible
                ? theme.spacing.xl
                : theme.spacing.md + bottomInset,
        },
    }),
)
