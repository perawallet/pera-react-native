/*
 Copyright 2022-2025 Pera Wallet, LDA
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
        backgroundColor: theme.colors.background,
    },
    content: {
        flex: 1,
        paddingHorizontal: theme.spacing.xl,
    },
    title: {
        marginBottom: theme.spacing.sm,
        marginTop: theme.spacing.sm,
    },
    description: {
        marginBottom: theme.spacing.xl,
        color: theme.colors.textGray,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: theme.spacing.xl,
    },
    walletItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.lg,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.layerGrayLighter,
    },
    walletIconContainer: {
        width: theme.spacing.xl + 2 * theme.spacing.sm,
        height: theme.spacing.xl + 2 * theme.spacing.sm,
        borderRadius: (theme.spacing.xl + 2 * theme.spacing.sm) / 2,
        marginRight: theme.spacing.md,
    },
    walletTextContainer: {
        flex: 1,
        paddingRight: theme.spacing.md,
    },
    walletSubtitle: {
        color: theme.colors.textGray,
        marginTop: 2,
    },
    balanceContainer: {
        gap: theme.spacing.xs,
        alignItems: 'flex-end',
    },
    algoBalance: {
        lineHeight: theme.spacing.lg,
    },
    fiatBalance: {
        color: theme.colors.textGray,
        lineHeight: theme.spacing.md,
    },
    footer: {
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.xl,
        paddingTop: theme.spacing.md,
    },
}))
