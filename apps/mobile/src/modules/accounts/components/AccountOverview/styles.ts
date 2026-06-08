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
import { CHART_HEIGHT } from '@constants/ui'

const HEADER_HEIGHT = 412
const SKELETON_BORDER_RADIUS = 8

export const useStyles = makeStyles(theme => {
    return {
        container: {
            flex: 1,
            minHeight: 0,
        },
        valueBarContainer: {
            paddingVertical: theme.spacing.md,
        },
        valueBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: 0,
        },
        balanceSpinner: {
            marginLeft: theme.spacing.sm,
        },
        secondaryValueBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
            minWidth: 0,
            flexShrink: 1,
        },
        valueTitle: {
            color: theme.colors.textGray,
        },
        dateDisplay: {
            color: theme.colors.textGray,
            textAlign: 'right',
            flexGrow: 1,
        },
        primaryCurrency: {
            color: theme.colors.textMain,
        },
        chartContainer: {
            gap: theme.spacing.md,
            marginBottom: theme.spacing.md,
            maxWidth: '100%',
        },
        noBalanceContainer: {
            paddingVertical: theme.spacing.xl,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xl,
        },
        centeredText: {
            textAlign: 'center',
        },
        noBalanceWelcomeText: {
            color: theme.colors.textGray,
            textAlign: 'center',
        },
        headerContainerLoading: {
            height: HEADER_HEIGHT,
        },
        skeletonOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // Solid background so internal mount animations (ExpandablePanel,
            // LineChart, currency-display loading swap) running underneath
            // are fully occluded until the overlay unmounts.
            backgroundColor: theme.colors.background,
        },
        skeletonRoot: {
            flex: 1,
        },
        skeletonBlock: {
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: SKELETON_BORDER_RADIUS,
        },
        skeletonPrimaryValue: {
            height: theme.spacing.xxl,
            width: '50%',
        },
        skeletonSecondaryValue: {
            height: theme.spacing.xl,
            width: '35%',
        },
        skeletonTrend: {
            height: theme.spacing.xl,
            width: '20%',
        },
        skeletonChart: {
            width: '100%',
            height: CHART_HEIGHT,
        },
        skeletonPeriodRow: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.xs,
        },
        skeletonPeriodButton: {
            width: theme.spacing['3xl'],
            height: theme.spacing.xl,
        },
        skeletonButtonRow: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: theme.spacing.md,
            marginTop: theme.spacing.xl,
        },
        skeletonActionButton: {
            width: theme.spacing['4xl'],
            height: theme.spacing['4xl'],
            borderRadius: theme.spacing['3xl'],
        },
    }
})
