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
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
    },
    // Matches the loaded asset icon (AssetIcon size 'xl').
    icon: {
        width: theme.spacing['3xl'],
    },
    textColumn: {
        flex: 1,
    },
    // Line boxes take the rendered text's line height, so the row is as tall as
    // a loaded one at any screen width.
    primaryLine: {
        height: getTypography(theme, 'h4').lineHeight,
        justifyContent: 'center',
    },
    secondaryLine: {
        height: getTypography(theme, 'body').lineHeight,
        justifyContent: 'center',
    },
    amountColumn: {
        alignItems: 'flex-end',
        marginLeft: theme.spacing.md,
    },
    amountBar: {
        height: theme.spacing.md,
        width: theme.spacing['4xl'],
    },
    fiatBar: {
        height: theme.spacing.sm,
        width: theme.spacing['3xl'],
    },
    nameBar: {
        height: theme.spacing.md,
        width: '55%',
    },
    subtitleBar: {
        height: theme.spacing.sm,
        width: '35%',
    },
}))
