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
        portfolioContainer: {
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
        },
        activeLabel: {
            color: theme.colors.textMain,
            fontWeight: '600',
        },
        passiveLabel: {
            color: theme.colors.textMain,
        },
        accountContainer: {
            paddingHorizontal: theme.spacing.lg,
            gap: theme.spacing.md,
        },
        activeItem: {
            flexDirection: 'row',
            gap: theme.spacing.md,
            backgroundColor: theme.colors.layerGrayLightest,
            borderRadius: theme.spacing.xs,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.sm,
            alignItems: 'center',
        },
        passiveItem: {
            flexDirection: 'row',
            gap: theme.spacing.md,
            borderRadius: theme.spacing.xs,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.sm,
            alignItems: 'center',
        },
        container: {
            padding: 0,
            margin: 0,
            flex: 1,
            overflow: 'hidden',
        },
        titleBar: {
            gap: theme.spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
        },
        titleBarButtonContainer: {
            flexDirection: 'row',
            gap: theme.spacing.md,
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
        },
        sortButton: {
            flexDirection: 'row',
            gap: theme.spacing.sm,
            alignItems: 'center',
        },
        sortButtonTitle: {
            color: theme.colors.helperPositive,
        },
        addButtonContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingEnd: theme.spacing.md,
            borderRadius: theme.spacing.sm,
            gap: theme.spacing.sm,
        },
        addButtonTitle: {
            color: theme.colors.buttonSquareText,
        },
        fullWidth: {
            width: '100%',
        },
        tabs: {
            marginTop: theme.spacing.md,
            paddingHorizontal: 0,
            paddingBottom: theme.spacing.sm,
            margin: 0,
            borderWidth: theme.borders.sm,
            borderColor: 'transparent',
        },
        activeTab: {
            padding: 0,
            margin: 0,
        },
        inactiveTab: {
            padding: 0,
            margin: 0,
        },
        activeTitle: {
            color: theme.colors.textMain,
            fontSize: 22,
        },
        inactiveTitle: {
            color: theme.colors.textGrayLighter,
            fontSize: 22,
        },
    }
})
