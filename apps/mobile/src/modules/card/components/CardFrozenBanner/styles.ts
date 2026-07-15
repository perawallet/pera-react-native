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

export const useStyles = makeStyles(theme => ({
    banner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.lg,
        backgroundColor: theme.colors.warningSurface,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.testnetBg,
        borderRadius: theme.borderRadius.md,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
    },
    // The text + button column fills the space beside the glyph.
    content: {
        flex: 1,
        gap: theme.spacing.lg,
    },
    textColumn: {
        gap: theme.spacing.sm,
    },
    body: {
        color: theme.colors.textGray,
    },
}))
