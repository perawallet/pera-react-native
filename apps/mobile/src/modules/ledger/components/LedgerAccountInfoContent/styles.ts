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
    container: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: theme.spacing.xl,
    },
    sectionHeader: {
        marginTop: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
        color: theme.colors.textMain,
    },
    /** Account-details row — mirrors AccountWithBalance layout */
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
    },
    balanceContainer: {
        gap: theme.spacing.xs,
        alignItems: 'flex-end',
        flexShrink: 0,
    },
    fiatBalance: {
        color: theme.colors.textGray,
    },
    /** Rekey-address rows — light vertical padding so they read as a list */
    rekeyRow: {
        paddingVertical: theme.spacing.sm,
    },
    secondary: {
        color: theme.colors.textGray,
    },
    /** Unknown-decimals holding — asset info left, a dash where the balance goes */
    unknownAssetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
    },
    unknownAssetInfo: {
        flex: 1,
    },
    centerState: {
        paddingVertical: theme.spacing['4xl'],
        alignItems: 'center',
        gap: theme.spacing.md,
    },
}))
