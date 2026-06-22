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
import { palette } from '@theme/colors'

// The card art is a fixed-ratio brand asset; pin a height (per the project's
// image-sizing convention — no runtime aspect-ratio derivation).
const CARD_HEIGHT = 210

export const useStyles = makeStyles(theme => ({
    content: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.lg,
        gap: theme.spacing.xl,
    },
    cardContainer: {
        width: '100%',
        height: CARD_HEIGHT,
        borderRadius: theme.spacing.lg,
        overflow: 'hidden',
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    panContainer: {
        position: 'absolute',
        left: theme.spacing.lg,
        bottom: theme.spacing.lg,
    },
    // The card is an always-yellow brand surface, so the PAN is a static dark
    // (theme-independent) — same approach as BannerCard's fixed-surface text.
    pan: {
        color: palette.gray[900],
    },
}))
