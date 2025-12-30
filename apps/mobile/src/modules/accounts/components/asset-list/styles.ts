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
    headerContainer: {
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.md,
    },
    keyboardAvoidingViewContainer: {
        flexGrow: 1,
        backgroundColor: theme.colors.background,
    },
    rootContainer: {
        flexGrow: 1,
        paddingHorizontal: theme.spacing.md,
    },
    loadingContainer: {
        gap: theme.spacing.md,
    },
    title: {},
    titleBar: {
        gap: theme.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
    },
    titleBarButtonContainer: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        alignItems: 'center',
    },
    listContainer: {
        marginTop: theme.spacing.xl,
    },
    manageButtonContainer: {
        backgroundColor: theme.colors.buttonSquareBg,
        borderRadius: theme.spacing.sm,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.spacing.sm,
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.buttonSquareBg,
        height: 40,
    },
    addButtonTitle: {
        color: theme.colors.buttonSquareText,
    },
    itemContainer: {
        marginVertical: theme.spacing.md,
    },
    footer: {
        marginVertical: theme.spacing.md,
    },
}))
