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
        portfolioContainer: {
            paddingTop: theme.spacing.md,
        },
        listSeparator: {
            height: theme.spacing.md,
        },
        container: {
            padding: 0,
            margin: 0,
            flex: 1,
            overflow: 'hidden',
            minWidth: 0,
        },
        mainContent: {
            flex: 1,
            minWidth: 0,
        },
        titleBar: {
            gap: theme.spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            minWidth: 0,
            // Spacing the portfolio and title bar used to get from the
            // container gap (md) + mainContent margin (xl), now that both live
            // in the scrolling list header.
            marginTop: theme.spacing.xxl,
            // No separator sits above the first account row.
            marginBottom: theme.spacing.sm,
        },
        titleBarTitleContainer: {
            flex: 1,
            minWidth: 0,
        },
        titleBarButtonContainer: {
            flexDirection: 'row',
            gap: theme.spacing.md,
            alignItems: 'center',
            flexShrink: 1,
            minWidth: 0,
        },
        activeTitle: {
            color: theme.colors.textMain,
        },
    }
})
