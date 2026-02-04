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
            backgroundColor: theme.colors.layerGrayLightest,
            borderWidth: 1,
            borderColor: theme.colors.layerGray,
            borderRadius: theme.spacing.lg,
            padding: theme.spacing.md,
        },
        columns: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'stretch',
        },
        leftColumn: {
            flex: 1,
            gap: theme.spacing.md,
        },
        rightColumn: {
            alignItems: 'flex-end',
            gap: theme.spacing.md,
        },
        trendTitle: {
            color: theme.colors.textGray,
        },
        trendContent: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
        },
        trendIconContainer: {
            backgroundColor: 'transparent',
            borderRadius: 100,
            width: theme.spacing.xl,
            height: theme.spacing.xl,
            justifyContent: 'center',
            alignItems: 'center',
        },
        itemUp: {
            color: theme.colors.helperPositive,
        },
        itemDown: {
            color: theme.colors.error,
        },
        trendIconUp: {
            color: theme.colors.helperPositive,
        },
        trendIconDown: {
            color: theme.colors.error,
        },
        valueTitleBar: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
        },
        valueTitle: {
            color: theme.colors.textGray,
        },
        dateDisplay: {
            color: theme.colors.textGray,
            textAlign: 'right',
        },
        divider: {
            height: 1,
            backgroundColor: theme.colors.layerGray,
            marginVertical: theme.spacing.md,
        },
        chartToggle: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xs,
        },
        chartToggleText: {
            color: theme.colors.textGray,
        },
        invertedIcon: {
            transform: [{ rotate: '180deg' }],
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
