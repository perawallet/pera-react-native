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

type StyleProps = { bottomInset: number }

export const useStyles = makeStyles((theme, { bottomInset }: StyleProps) => ({
    container: {
        padding: theme.spacing.xl,
        // PWBottomSheet draws edge-to-edge, so the content owns the bottom
        // safe-area inset — without it the Retry button sits under the Android
        // nav bar.
        paddingBottom: theme.spacing.xl + bottomInset,
    },
    title: {
        ...getTypography(theme, 'h3'),
        marginBottom: theme.spacing.lg,
        textAlign: 'center',
    },
    bulletWrapper: {
        flexDirection: 'row',
        marginBottom: theme.spacing.sm,
    },
    bullet: {
        ...getTypography(theme, 'body'),
        color: theme.colors.textMain,
        marginRight: theme.spacing.sm,
    },
    tip: {
        ...getTypography(theme, 'body'),
        color: theme.colors.textMain,
        flex: 1,
    },
    closeButton: {
        marginTop: theme.spacing.xl,
    },
}))
