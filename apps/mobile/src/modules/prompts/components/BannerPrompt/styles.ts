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

// Mirrors BannersCarouselModalScreen: the carousel is full-bleed and the banner
// art covers the surface, so any padding here shows as a frame around the art.
export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    root: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    // Bottom inset only. The overlay is full-bleed and skips the container's
    // safe-area padding, so the card's "don't show again" link would otherwise
    // sit under the home indicator — PWScreen supplies that inset to the
    // carousel modal (`paddingBottom: hasFooter ? spacing.lg : bottomInset`).
    //
    // Deliberately no top inset: the banner art is meant to run under the status
    // bar. Padding here shows this container's own background as a strip across
    // the top, and since the image is `resizeMode: cover` inside a 45%-height
    // half, the shorter box also crops more of the art off. The close button
    // carries its own `insets.top`, so nothing tappable ends up under the bar.
    body: {
        flex: 1,
        paddingBottom: insets.bottom,
    },
    // Absolutely positioned so it does not steal layout space from the art.
    closeButton: {
        position: 'absolute',
        // The prompt overlay is full-bleed, so without the inset this rides up
        // under the status bar on Android — same reason as PERA-4751 on the
        // modal, where iOS starts below the bar and insets.top is 0.
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
