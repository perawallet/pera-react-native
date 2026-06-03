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

export type HorizontalPaddingMode = 'xl' | 'none'

type StyleProps = {
    horizontalPadding: HorizontalPaddingMode
    bottomInset: number
    hasFooter: boolean
}

export const useStyles = makeStyles(
    (theme, { horizontalPadding, bottomInset, hasFooter }: StyleProps) => {
        const paddingHorizontal =
            horizontalPadding === 'none' ? 0 : theme.spacing[horizontalPadding]

        return {
            root: {
                flex: 1,
            },
            keyboardView: {
                flex: 1,
            },
            // Sticky header zone. Matches the body's horizontal padding so a
            // header (e.g. ScreenHeader) aligns with the scrollable content.
            header: {
                paddingHorizontal,
            },
            body: {
                flex: 1,
            },
            scrollContent: {
                flexGrow: 1,
                paddingHorizontal,
                paddingBottom: hasFooter ? theme.spacing.lg : bottomInset,
            },
            fixedBody: {
                flex: 1,
                paddingHorizontal,
                // Carry the safe-area inset here: unlike RN's FlatList, the
                // migrated FlashList no longer clears the home indicator natively.
                paddingBottom: hasFooter ? theme.spacing.lg : bottomInset,
            },
            footer: {
                // Always xl, independent of the body's horizontalPadding, so
                // footers align to the same edge across every screen.
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.md,
            },
        }
    },
)
