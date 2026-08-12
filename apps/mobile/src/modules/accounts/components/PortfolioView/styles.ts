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

export const useStyles = makeStyles(theme => {
    return {
        container: {
            borderWidth: theme.borders.sm,
            borderColor: theme.colors.layerGray,
            borderRadius: theme.spacing.lg,
            padding: theme.spacing.md,
            width: '100%',
            minWidth: 0,
            overflow: 'hidden',
        },
        columns: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'stretch',
            width: '100%',
            minWidth: 0,
            gap: theme.spacing.md,
        },
        leftColumn: {
            flex: 1,
            minWidth: 0,
            gap: theme.spacing.md,
        },
        rightColumn: {
            alignItems: 'flex-end',
            gap: theme.spacing.md,
            flexShrink: 0,
            maxWidth: '45%',
        },
        dateTimeColumn: {
            alignItems: 'flex-end',
            flexShrink: 0,
            maxWidth: '45%',
            minWidth: 0,
        },
        trendTitle: {
            color: theme.colors.textGray,
        },
        valueTitleBar: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            minWidth: 0,
            width: '100%',
        },
        titleTextContainer: {
            flexShrink: 1,
            minWidth: 0,
        },
        infoButtonContainer: {
            flexShrink: 0,
        },
        valueTitle: {
            color: theme.colors.textGray,
        },
        dateDisplay: {
            color: theme.colors.textGray,
            textAlign: 'right',
        },
        divider: {
            height: theme.borders.sm,
            backgroundColor: theme.colors.layerGray,
            marginVertical: theme.spacing.md,
        },
        chartToggle: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xs,
            width: '100%',
            minWidth: 0,
        },
        chartToggleText: {
            color: theme.colors.textGray,
        },
        primaryCurrency: {
            color: theme.colors.textMain,
        },
        chartContainer: {
            gap: theme.spacing.md,
            marginTop: theme.spacing.md,
        },
    }
})
