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

export const useStyles = makeStyles(theme => ({
    // Positioning context for the transparent overlay input.
    cellsWrap: {
        position: 'relative',
    },
    cellsRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    cell: {
        flex: 1,
        height: theme.spacing['3xl'],
        borderWidth: theme.borders.md,
        borderRadius: theme.borderRadius.md,
        borderColor: theme.colors.layerGray,
        backgroundColor: theme.colors.layerGrayLighter,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Filled digit or the active (next-to-fill) cell.
    cellFilled: {
        borderColor: theme.colors.textMain,
    },
    cellError: {
        borderColor: theme.colors.alertNegative,
    },
    cellText: {
        color: theme.colors.textMain,
    },
    // Transparent but focusable + autofill-eligible; covers the whole cell row
    // so a tap anywhere focuses the input.
    hiddenInput: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0,
    },
    // Constant-height slot so showing/clearing the error never shifts layout.
    errorSlot: {
        minHeight: theme.spacing.lg,
        marginTop: theme.spacing.xs,
    },
    errorText: {
        color: theme.colors.alertNegative,
    },
}))
