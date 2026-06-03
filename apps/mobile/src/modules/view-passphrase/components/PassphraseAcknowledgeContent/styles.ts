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
    body: {
        alignItems: 'center',
    },
    icon: {
        marginBottom: theme.spacing.lg,
    },
    description: {
        textAlign: 'center',
        color: theme.colors.textGray,
        paddingTop: theme.spacing.sm,
    },
    rows: {
        width: '100%',
        paddingTop: theme.spacing.lg,
        paddingHorizontal: theme.spacing.xl,
        gap: theme.spacing.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    separatorBorder: {
        borderTopWidth: theme.borders.sm,
        borderTopColor: theme.colors.layerGrayLighter,
        paddingTop: theme.spacing.md,
    },
    rowText: {
        flex: 1,
    },
    actions: {
        gap: theme.spacing.sm,
    },
}))
