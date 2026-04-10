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
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.lg,
    },
    title: {
        marginBottom: theme.spacing.sm,
        marginTop: theme.spacing.sm,
    },
    description: {
        color: theme.colors.textGray,
        marginBottom: theme.spacing.md,
    },
    scanningRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: theme.spacing.sm,
    },
    scanningText: {
        color: theme.colors.textGray,
        marginLeft: theme.spacing.sm,
    },
    listContent: {
        flexGrow: 1,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xxl,
    },
    emptyText: {
        color: theme.colors.textGray,
        textAlign: 'center',
        marginVertical: theme.spacing.lg,
    },
}))
