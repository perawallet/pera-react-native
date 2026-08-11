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
    container: {
        marginTop: theme.spacing.xl,
        gap: theme.spacing.md,
        width: '100%',
        minWidth: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        minWidth: 0,
    },
    title: {
        color: theme.colors.textMain,
        flex: 1,
        minWidth: 0,
    },
    // Bleeds the list to the screen edges; must mirror the SwapForm
    // formContainer's paddingHorizontal token.
    list: {
        marginHorizontal: -theme.spacing.lg,
    },
    listContent: {
        paddingHorizontal: theme.spacing.lg,
    },
    separator: {
        width: theme.spacing.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.spacing.lg,
        backgroundColor: theme.colors.layerGrayLightest,
    },
    skeleton: {
        height: theme.spacing['3xl'],
        width: theme.spacing['5xl'],
        borderRadius: theme.spacing.xl,
    },
    errorText: {
        color: theme.colors.negative,
    },
}))
