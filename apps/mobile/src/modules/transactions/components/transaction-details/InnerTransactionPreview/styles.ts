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
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        backgroundColor: theme.colors.layerGrayLightest,
        borderRadius: theme.spacing.sm,
    },
    content: {
        flex: 1,
        gap: 2,
    },
    typeLabel: {
        color: theme.colors.textMain,
        fontWeight: '500',
        textTransform: 'capitalize',
        fontSize: 14,
    },
    address: {
        color: theme.colors.textGray,
        fontSize: 12,
    },
    rightContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    amount: {
        color: theme.colors.textGray,
        fontSize: 12,
    },
}))
