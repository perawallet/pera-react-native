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

export const useStyles = makeStyles(theme => {
    return {
        container: {
            flex: 1,
            minHeight: 500,
        },
        contentContainer: {
            flex: 1,
            padding: theme.spacing.xl,
        },
        slideContainer: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            padding: theme.spacing.xl,
            backgroundColor: theme.colors.background,
        },
        title: {
            padding: theme.spacing.lg,
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: theme.spacing.lg,
        },
        body: {
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.lg,
        },
        footer: {
            padding: theme.spacing.lg,
            borderTopWidth: theme.borders.sm,
            borderTopColor: theme.colors.layerGrayLighter,
            gap: theme.spacing.sm,
            boxShadow: '0px 14px 60px 0px #00000029',
        },
        buttonContainer: {
            flexDirection: 'row',
            gap: theme.spacing.lg,
            alignItems: 'center',
            justifyContent: 'center',
            borderTopWidth: theme.borders.sm,
            borderTopColor: theme.colors.layerGrayLightest,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.xl,
        },
        button: {
            flexGrow: 1,
        },
        feeContainer: {
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        detailsContainer: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        feeLabel: {
            color: theme.colors.textGray,
        },
        feeValue: {
            color: theme.colors.helperNegative,
        },
        feeAmount: {
            color: theme.colors.helperNegative,
        },
        detailsLabel: {
            color: theme.colors.linkPrimary,
        },
        mainAmount: {},
        secondaryAmount: {},
        backButton: {
            alignSelf: 'flex-start',
            marginBottom: theme.spacing.md,
        },
        transactionListContainer: {
            width: '100%',
            gap: theme.spacing.sm,
            marginVertical: theme.spacing.md,
        },
        transactionListHeader: {
            color: theme.colors.textGray,
            marginBottom: theme.spacing.xs,
        },
        transactionListItem: {
            width: '100%',
        },

        // Single transaction summary styles
        summaryContainer: {
            flex: 1,
            gap: theme.spacing.md,
        },
        summaryHeader: {
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.xl,
        },
        viewDetailsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: theme.spacing.md,
        },
        viewDetailsLabel: {
            color: theme.colors.linkPrimary,
        },
        feeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: theme.spacing.md,
        },

        // Group styles
        groupContainer: {
            flex: 1,
            gap: theme.spacing.md,
        },
        groupHeader: {
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.xl,
        },
        groupIdText: {
            color: theme.colors.textGray,
        },
        transactionList: {
            gap: theme.spacing.sm,
        },
        transactionListHeaderText: {
            color: theme.colors.textGray,
            marginBottom: theme.spacing.sm,
        },
        groupList: {
            gap: theme.spacing.sm,
        },

        // Group preview styles
        groupPreviewContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.layerGrayLightest,
            borderRadius: theme.spacing.lg,
            padding: theme.spacing.md,
            gap: theme.spacing.md,
        },
        groupPreviewContent: {
            flex: 1,
        },
        groupPreviewTitle: {
            fontWeight: '600',
        },
        groupPreviewSubtitle: {
            color: theme.colors.textGray,
        },

        // Transaction details view styles
        detailsViewContainer: {
            flex: 1,
        },
        backButtonRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            paddingVertical: theme.spacing.md,
        },
        backButtonText: {
            color: theme.colors.linkPrimary,
        },
    }
})
