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
    const iconSize = theme.spacing.xxl

    return {
        // List styles
        searchContainer: {
            paddingHorizontal: theme.spacing.md,
            marginBottom: theme.spacing.md,
        },
        separator: {
            height: theme.spacing.md,
        },
        listContent: {
            paddingBottom: theme.spacing.xl,
        },
        item: {
            width: '100%',
            paddingHorizontal: theme.spacing.md,
        },

        // Item view styles
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.lg,
        },
        iconContainer: {
            width: iconSize,
            height: iconSize,
            borderRadius: iconSize / 2,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
        },
        imageIcon: {
            width: iconSize,
            height: iconSize,
        },
        icon: {
            backgroundColor: theme.colors.background,
            width: iconSize,
            height: iconSize,
        },
        defaultAsset: {
            backgroundColor: theme.colors.layerGrayLighter,
            alignItems: 'center',
            justifyContent: 'center',
            width: iconSize,
            height: iconSize,
            borderRadius: iconSize / 2,
            borderWidth: theme.borders.sm,
            borderColor: theme.colors.layerGrayLighter,
        },
        initialsText: {
            color: theme.colors.textGray,
        },
        dataContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexGrow: 1,
        },
        unitContainer: {
            gap: theme.spacing.xs / 2,
            flexShrink: 1,
        },
        row: {
            flexDirection: 'row',
            gap: theme.spacing.xs,
            alignItems: 'center',
            flexShrink: 1,
        },
        primaryUnit: {
            flexShrink: 1,
        },
        secondaryUnit: {
            color: theme.colors.textGrayLighter,
        },
        amountContainer: {
            gap: theme.spacing.xs / 2,
            alignItems: 'flex-end',
        },
        primaryAmount: {
            textAlign: 'right',
        },
        secondaryAmount: {
            textAlign: 'right',
            color: theme.colors.textGray,
            alignSelf: 'flex-end',
        },
        skeletonRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.lg,
        },
        skeletonData: {
            flex: 1,
            gap: theme.spacing.xs,
        },
    }
})
