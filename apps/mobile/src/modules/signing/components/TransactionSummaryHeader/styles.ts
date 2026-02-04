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
import { getFontFamily } from '@theme/theme'

export const useStyles = makeStyles(theme => ({
    container: {
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.xl,
        flexGrow: 1,
    },
    amountValue: {
        color: theme.colors.textMain,
    },
    address: {
        marginTop: theme.spacing.md / 2, //to fix weird alignment issue
        flexWrap: 'nowrap',
        gap: theme.spacing.md,
    },
    addressText: {
        fontFamily: getFontFamily(false, 700),
        fontSize: 19,
        color: theme.colors.textMain
    },
    typeText: {
        fontFamily: getFontFamily(false, 400),
        fontSize: 19,
        color: theme.colors.textGray
    },
    secondaryAmountValue: {
        color: theme.colors.textGray
    },
    amountContainer: {
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    assetIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    assetName: {
        color: theme.colors.textMain
    }
}))
