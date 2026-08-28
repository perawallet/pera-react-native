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
import { type EdgeInsets } from 'react-native-safe-area-context'

// Mirrors BannersCarouselModalScreen: same full-bleed carousel, same safe-area
// insets, so the banner looks identical whichever way the user reaches it.
export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    // The overlay is full-bleed and skips the container's safe-area padding, so
    // both insets are applied here: without them the art runs under the status
    // bar and the card's "don't show again" link under the home indicator.
    root: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
    },
    body: {
        flex: 1,
    },
    // Absolutely positioned so it does not steal layout space from the art.
    closeButton: {
        position: 'absolute',
        // Keeps its own `insets.top`: Yoga does not inset absolutely positioned
        // children by the parent's padding, so `root`'s does not apply here and
        // without this the X sits in the status bar (PERA-4751).
        top: insets.top + theme.spacing.md,
        right: theme.spacing.lg,
        width: theme.spacing.xxl,
        height: theme.spacing.xxl,
        borderRadius: theme.borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        // Translucent backdrop keeps the X tappable and visible over any banner
        // art colour palette.
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        zIndex: theme.zIndex.layer1,
    },
}))
