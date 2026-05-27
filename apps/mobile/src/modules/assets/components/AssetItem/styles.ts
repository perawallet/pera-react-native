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
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.lg,
            width: '100%',
            minWidth: 0,
        },
        dataContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
        },
        unitContainer: {
            flex: 1,
            minWidth: 0,
        },
        // The amount wins the row's width tug-of-war: it sizes to its content
        // and does not shrink, so the full value shows; the name column
        // (`unitContainer`, flex: 1) truncates instead. Capped so a very long
        // amount can't swallow the name entirely.
        amountContainer: {
            alignItems: 'flex-end',
            flexShrink: 0,
            maxWidth: '60%',
        },
        suspiciousName: {
            color: theme.colors.error,
            flexShrink: 1,
        },
        deletedLabel: {
            color: theme.colors.negative,
        },
        primaryUnit: {
            flexShrink: 1,
            minWidth: 0,
        },
        secondaryUnit: {
            color: theme.colors.textGrayLighter,
            flexShrink: 1,
        },
        primaryAmount: {
            textAlign: 'right',
            flexShrink: 1,
            minWidth: 0,
        },
        secondaryAmount: {
            textAlign: 'right',
            color: theme.colors.textGray,
            alignSelf: 'flex-end',
            flexShrink: 1,
            minWidth: 0,
        },
        row: {
            flexDirection: 'row',
            gap: theme.spacing.xs,
            alignItems: 'center',
            flexShrink: 1,
            minWidth: 0,
        },
    }
})
