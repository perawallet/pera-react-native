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
import { getTypography } from '@theme/typography'

export const useStyles = makeStyles(theme => ({
    // In-flow, not absolute: the bar owns its height, so titles can't
    // collide with it. Costs ~18px, and only off MainNet.
    bar: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: theme.spacing.xxs,
        backgroundColor: theme.colors.testnetBg,
    },
    // Ambient not-MainNet signal on the remaining edges. Absolute over the
    // whole card (the in-flow bar is the top edge, so no borderTopWidth);
    // zIndex.max keeps the accents above screen content. Bottom sheets still
    // portal above them (equal z-index, later in DOM order) — while a sheet
    // is open the signal is the dimmed bar behind the backdrop.
    frame: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderLeftWidth: theme.borders.md,
        borderRightWidth: theme.borders.md,
        borderBottomWidth: theme.borders.md,
        borderColor: theme.colors.testnetBg,
        zIndex: theme.zIndex.max,
    },
    text: {
        ...getTypography(theme, 'caption'),
        color: theme.colors.testnetText,
    },
}))
