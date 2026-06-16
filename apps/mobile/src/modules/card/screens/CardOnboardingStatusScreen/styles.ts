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
    content: {
        paddingTop: theme.spacing.sm,
        gap: theme.spacing.xxl,
    },
    checklist: {
        gap: theme.spacing.xl,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.lg,
    },
    rowTexts: {
        flex: 1,
        gap: theme.spacing.xs,
    },
    rowBody: {
        color: theme.colors.textGray,
    },
    pendingLabel: {
        color: theme.colors.warning,
    },
    inactiveTitle: {
        color: theme.colors.textGrayLighter,
    },
    detailsButton: {
        marginTop: theme.spacing.md,
    },
    // Header shown in the account-picker sheet (passed via AccountMenu's
    // headerContent), replacing the default portfolio summary.
    pickerHeader: {
        paddingTop: theme.spacing.md,
        gap: theme.spacing.sm,
    },
    pickerHeaderTitle: {
        color: theme.colors.textMain,
    },
    pickerHeaderSubtitle: {
        color: theme.colors.textGray,
    },
    connectedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        marginTop: theme.spacing.md,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        borderRadius: theme.spacing.lg,
        padding: theme.spacing.lg,
    },
    connectedAccountInfo: {
        flex: 1,
    },
    footer: {
        gap: theme.spacing.md,
    },
    contactText: {
        textAlign: 'center',
        color: theme.colors.textGrayLighter,
    },
}))
