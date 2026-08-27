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

export const useStyles = makeStyles(theme => ({
    multiBannerRoot: {
        flex: 1,
    },
    // Measured separately from the root so a page gets the pager's own box,
    // with the dots' height already excluded.
    pagerArea: {
        flex: 1,
    },
    pager: {
        flex: 1,
    },
    singlePage: {
        flex: 1,
    },
    // Laid out below the pager rather than absolutely positioned over it, so
    // the dots reserve their own height instead of landing on the card's CTA.
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        // Top only — both hosts already pad the bottom by the safe-area inset,
        // so a symmetric padding here reads as a gap under the dots. Kept small
        // because the card already contributes its own bottom padding above.
        paddingTop: theme.spacing.xs,
        paddingBottom: theme.spacing.xs,
    },
    dot: {
        width: theme.spacing.xs,
        height: theme.spacing.xs,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.layerGray,
    },
    dotActive: {
        width: theme.spacing.lg,
        backgroundColor: theme.colors.textMain,
    },
}))

export const usePageStyles = makeStyles(
    (_theme, { width, height }: { width: number; height: number }) => ({
        page: {
            width,
            height,
        },
    }),
)
