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

type StyleProps = { horizontalPadding: 'xl' | 'none' }

export const useStyles = makeStyles((theme, { horizontalPadding }: StyleProps) => ({
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
    // Visual gap below the last item. The bottom safe-area inset is owned
    // centrally by PWBottomSheet's innerContainer, so it is not added here.
    // Applied after `bodyStyle` so callers can't accidentally drop the gap.
    bodyBottom: {
        paddingBottom: theme.spacing.xl,
    },
    // Fixed footer pinned below the scroll (e.g. a CTA). Horizontal + visual
    // gap only; the safe-area inset comes from the host's innerContainer.
    footer: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xl,
    },
}))
