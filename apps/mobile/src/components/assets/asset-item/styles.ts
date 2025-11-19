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
        },
        dataContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexGrow: 1,
        },
        unitContainer: {
            gap: theme.spacing.xs / 2,
        },
        amountContainer: {
            gap: theme.spacing.xs / 2,
        },
        primaryUnit: {},
        secondaryUnit: {
            color: theme.colors.textGrayLighter,
            fontSize: theme.spacing.md,
        },
        primaryAmount: {
            textAlign: 'right',
        },
        secondaryAmount: {
            textAlign: 'right',
            color: theme.colors.textGray,
            fontSize: theme.spacing.md,
            alignSelf: 'flex-end',
        },
        row: {
            flexDirection: 'row',
            gap: theme.spacing.xs,
            alignItems: 'center',
        },
    }
})
