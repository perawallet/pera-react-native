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
            padding: theme.spacing.xl,
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
    }
})
