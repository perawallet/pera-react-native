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
import { getFontWeightVariant } from '@theme/typography'

export const useStyles = makeStyles(theme => ({
    header: {
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        paddingBottom: theme.spacing.lg,
    },
    favicon: {
        width: theme.spacing['3xl'],
        height: theme.spacing['3xl'],
        borderRadius: theme.spacing.sm,
    },
    origin: {
        color: theme.colors.textGray,
    },
    title: {
        ...getFontWeightVariant(theme, 'h3', 600),
        color: theme.colors.textMain,
        textAlign: 'center',
    },
    description: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
    contentContainer: {
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.xl,
    },
    accountItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
    },
    buttonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.lg,
    },
    cancelButton: {
        flexGrow: 1,
        flexBasis: 0,
    },
    connectButton: {
        flexGrow: 1,
        flexBasis: 0,
    },
}))
