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
    feeValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    section: {
        width: '100%',
        gap: theme.spacing.sm,
    },
    secondaryText: {
        color: theme.colors.textGray,
    },
    presetRow: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: theme.spacing.md,
    },
    presetLabel: {
        flexShrink: 1,
        gap: theme.spacing.xs,
    },
    feeAmount: {
        flexShrink: 1,
        alignItems: 'flex-end',
        gap: theme.spacing.xs,
    },
    // alignItems places the text box; a wrapped amount's lines need their own alignment.
    amountText: {
        textAlign: 'right',
    },
    maxFeeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: theme.spacing.md,
    },
    maxFeeLabel: {
        flexShrink: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
}))
