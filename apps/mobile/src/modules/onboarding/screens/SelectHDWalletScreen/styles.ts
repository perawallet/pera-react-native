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
    const algoBalance = {
        lineHeight: theme.spacing.lg,
    }
    const fiatBalance = {
        color: theme.colors.textGray,
    }
    return {
        content: {
            flex: 1,
        },
        list: {
            flex: 1,
        },
        walletItem: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        walletIconContainer: {
            width: theme.spacing.xl + 2 * theme.spacing.sm,
            height: theme.spacing.xl + 2 * theme.spacing.sm,
            borderRadius: (theme.spacing.xl + 2 * theme.spacing.sm) / 2,
            marginRight: theme.spacing.md,
        },
        // Border lives on the content (not the row) so the divider starts at
        // the title, inset past the leading icon.
        rowContent: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: theme.spacing.md,
            borderBottomWidth: theme.borders.sm,
            borderBottomColor: theme.colors.layerGrayLighter,
        },
        walletTextContainer: {
            flex: 1,
            paddingRight: theme.spacing.md,
        },
        walletSubtitle: {
            color: theme.colors.textGray,
            marginTop: theme.spacing.xxs,
        },
        balanceContainer: {
            gap: theme.spacing.xs,
            alignItems: 'flex-end',
        },
        algoBalance,
        fiatBalance,
    }
})
