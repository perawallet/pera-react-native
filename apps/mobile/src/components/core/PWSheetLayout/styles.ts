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

type StyleProps = { bottomInset: number }

export const useStyles = makeStyles((theme, { bottomInset }: StyleProps) => ({
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
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xl,
    },
    // Applied after `bodyStyle` so the home-indicator inset is always cleared:
    // the sheet hugs this scroll content, so the safe area must sit inside it
    // (the host's bottom padding is outside the scroll and ignored at `auto`).
    bodyBottom: {
        paddingBottom: theme.spacing.xl,
    },
}))
