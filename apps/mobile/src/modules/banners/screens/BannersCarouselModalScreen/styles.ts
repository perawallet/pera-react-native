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

import { Platform } from 'react-native'
import { makeStyles } from '@rneui/themed'
import { type EdgeInsets } from 'react-native-safe-area-context'

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    root: {
        flex: 1,
        backgroundColor: theme.colors.background,
        // Bottom inset only, so the pager dots and the card's dismiss link sit
        // clear of the home indicator / nav bar. Deliberately not PWScreen:
        // this screen wants none of its zones, and its body padding is
        // `insets.bottom + spacing.lg`, which read as a gap under the dots.
        paddingBottom: insets.bottom,
    },
    // The carousel takes the full screen; banner art covers the modal. The
    // close X is absolutely positioned above the banner content so it does
    // not steal layout space.
    body: {
        flex: 1,
    },
    closeButton: {
        position: 'absolute',
        // Android renders this presentation full-screen, so y=0 lands under
        // the status bar and the X needs the inset (PERA-4751). iOS presents it
        // as a sheet that already starts below the bar, yet `insets.top` still
        // reports the window's — adding it there pushed the X far too low.
        top: (Platform.OS === 'android' ? insets.top : 0) + theme.spacing.md,
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
