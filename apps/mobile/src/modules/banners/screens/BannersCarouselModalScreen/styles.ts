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

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    root: {
        backgroundColor: theme.colors.bannerContentBg,
    },
    // The carousel takes the full screen; banner art covers the modal. The
    // close X is absolutely positioned above the banner content so it does
    // not steal layout space.
    body: {
        flex: 1,
    },
    closeButton: {
        position: 'absolute',
        // PWScreen only safe-areas its footer, and this screen is presented
        // full-bleed: on Android that puts y=0 under the status bar, so without
        // the inset the X rides up into it. iOS modals already start below the
        // bar, where `insets.top` is 0 and this is a no-op (PERA-4751).
        top: insets.top + theme.spacing.md,
        right: theme.spacing.lg,
        width: theme.spacing.xxl,
        height: theme.spacing.xxl,
        borderRadius: theme.borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        // Translucent backdrop keeps the X tappable + visible over any banner
        // art color palette.
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        zIndex: theme.zIndex.layer1,
    },
}))
