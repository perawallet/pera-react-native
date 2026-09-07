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
import type { EdgeInsets } from 'react-native-safe-area-context'

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    // Children stay mounted at all times so the home tree pre-loads
    // (TanStack queries warm up) behind the lock UI. When the guard is
    // active we toggle `display` rather than unmounting — the data is
    // ready the moment the user dismisses the lock screen.
    childrenContainer: {
        flex: 1,
    },
    // Hidden with opacity, NOT `display: none`. Yoga services a hidden subtree
    // via zeroOutLayoutRecursively, which does not terminate over this tree
    // (51 host levels deep) — the JS thread enters one Fabric commit, pegs a
    // core, grows native memory to ~1.6GB and dies in
    // uiManagerDidFinishTransaction. Opacity keeps the pre-warm intact while
    // staying on the ordinary layout path. Nothing leaks visually: `lockOverlay`
    // below is opaque, full-screen and above this in z-order.
    childrenHidden: {
        opacity: 0,
    },
    // Full-screen, opaque overlay for the lock UI. Rendered inline (no
    // Modal) so there's no Android Dialog enter/exit animation between
    // locked and unlocked states — the React state flip is atomic with
    // the render swap, and the children underneath never become visible
    // until the overlay unmounts.
    lockOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: theme.zIndex.max,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top + theme.spacing.xxl,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
    },
    // Positioning + stacking only; FullScreenLoadingView paints the background
    // and centers the indicator so this matches the boot loading screen exactly.
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: theme.zIndex.max,
    },
}))
