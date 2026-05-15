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
    root: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flex: 1,
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        gap: theme.spacing.md,
    },
    title: {
        textAlign: 'left',
    },
    description: {
        color: theme.colors.textGray,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: theme.spacing.md,
    },
    headerCount: {
        color: theme.colors.textGray,
    },
    selectAll: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    selectAllText: {
        color: theme.colors.textMain,
    },
    list: {
        paddingBottom: theme.spacing.xl,
        gap: theme.spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.layerGrayLighter,
        gap: theme.spacing.md,
    },
    rowText: {
        flex: 1,
    },
    rowTitle: {
        color: theme.colors.textMain,
    },
    rowSubtitle: {
        color: theme.colors.textGray,
    },
    footer: {
        padding: theme.spacing.xl,
    },
}))
