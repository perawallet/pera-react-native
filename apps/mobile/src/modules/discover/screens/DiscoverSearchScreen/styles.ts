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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingTop: theme.spacing.md,
    },
    searchContainer: {
        flex: 1,
    },
    searchField: {
        borderRadius: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
    },
    filters: {
        paddingVertical: theme.spacing.md,
    },
    list: {
        flex: 1,
    },
    contentContainer: {
        flexGrow: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.md,
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
    },
    linkIcon: {
        width: theme.spacing.xxl,
        height: theme.spacing.xxl,
        borderRadius: theme.spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.layerGray,
    },
    linkInfo: {
        flex: 1,
        gap: theme.spacing.xxs,
    },
    linkSubtitle: {
        color: theme.colors.textGray,
    },
    notice: {
        marginVertical: theme.spacing.sm,
    },
    emptyText: {
        color: theme.colors.textGray,
        paddingVertical: theme.spacing.xl,
        textAlign: 'center',
    },
}))
