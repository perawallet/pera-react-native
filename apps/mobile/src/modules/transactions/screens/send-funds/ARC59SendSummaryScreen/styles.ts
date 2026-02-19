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
        paddingHorizontal: theme.spacing.md,
    },
    content: {
        flex: 1,
        paddingTop: theme.spacing.lg,
    },
    title: {
        textAlign: 'center',
        marginBottom: theme.spacing.md,
    },
    inboxIcon: {
        alignSelf: 'center',
        marginBottom: theme.spacing.lg,
    },
    description: {
        textAlign: 'center',
        color: theme.colors.textMain,
        marginBottom: theme.spacing.xl,
    },
    readMoreText: {
        color: theme.colors.linkPrimary,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
    },
    rowLabel: {
        color: theme.colors.textGray,
    },
    rowValue: {
        textAlign: 'right',
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.layerGrayLighter,
    },
    disclaimer: {
        color: theme.colors.textMain,
        marginTop: theme.spacing.md,
    },
    footer: {
        paddingBottom: theme.spacing.xl,
        gap: theme.spacing.md,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
}))
