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
    // Absolutely positioned (like OfflineBanner) so it overlays instead of
    // reflowing the screen beneath it — no persistent banner eating into the
    // 360x600 popup viewport. `box-none` lets taps pass through to whatever
    // header content it happens to sit above.
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: theme.zIndex.max,
    },
    badge: {
        marginTop: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.testnetBg,
    },
    text: {
        ...getTypography(theme, 'caption'),
        color: theme.colors.testnetText,
    },
}))
