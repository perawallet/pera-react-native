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
    // Reserves the safe-area inset from first paint so the layout below it
    // doesn't shift when the banner reveals. The wrapper paints `bannerBg`;
    // the `insetOverlay` masks the inset region with the screen background
    // until the reveal completes.
    wrapper: {
        paddingTop: insets.top,
        overflow: 'hidden',
        backgroundColor: theme.colors.bannerBg,
    },
    // Sits over the inset region only. Opacity animates 1 → 0 in lockstep
    // with the banner height reveal so the inset visually transitions from
    // the screen background to `bannerBg`.
    insetOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: insets.top,
        backgroundColor: theme.colors.background,
    },
    inner: {
        overflow: 'hidden',
    },
    measurer: {
        position: 'absolute',
        left: 0,
        right: 0,
        opacity: 0,
    },
}))
