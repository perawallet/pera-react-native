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

export const useStyles = makeStyles(theme => ({
    list: {
        gap: theme.spacing.lg,
    },
    item: {
        paddingVertical: theme.spacing.sm,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        minWidth: 0,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        flex: 1,
        minWidth: 0,
    },
    logo: {
        width: theme.spacing.xl,
        height: theme.spacing.xl,
        borderRadius: theme.borderRadius.full,
        overflow: 'hidden',
    },
    itemLabel: {
        color: theme.colors.textMain,
    },
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        flexShrink: 0,
    },
    rightTextColumn: {
        alignItems: 'flex-end',
    },
    amountText: {
        color: theme.colors.textMain,
    },
    fiatText: {
        color: theme.colors.textGray,
    },
    autoDescription: {
        color: theme.colors.textGray,
    },
}))
