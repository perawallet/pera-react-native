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

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: matches AssetIcon's lg size so an empty side lines up
const EMPTY_ICON_SIZE = 40

export const useStyles = makeStyles(theme => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    emptyIcon: {
        width: EMPTY_ICON_SIZE,
        height: EMPTY_ICON_SIZE,
        borderRadius: theme.borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.layerGray,
    },
    info: {
        flex: 1,
        minWidth: 0,
    },
    label: {
        color: theme.colors.textGray,
    },
    amount: {
        color: theme.colors.textMain,
    },
    fiat: {
        color: theme.colors.textGray,
    },
}))
