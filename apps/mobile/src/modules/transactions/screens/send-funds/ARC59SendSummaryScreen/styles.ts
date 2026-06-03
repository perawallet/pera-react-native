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
    content: {
        paddingTop: theme.spacing.lg,
    },
    title: {
        textAlign: 'center',
        marginBottom: theme.spacing.md,
    },
    header: {
        alignItems: 'center',
        paddingVertical: theme.spacing['3xl'],
    },
    inboxIcon: {
        alignSelf: 'center',
        marginBottom: theme.spacing.lg,
    },
    description: {
        textAlign: 'center',
        color: theme.colors.textMain,
    },
    readMoreText: {
        color: theme.colors.positive,
    },
    details: {
        gap: theme.spacing.md,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.spacing.lg,
    },
    rowAssetContainer: {
        flexShrink: 1,
    },
    rowLabel: {
        color: theme.colors.textGray,
    },
    divider: {
        height: theme.borders.sm,
        backgroundColor: theme.colors.layerGrayLighter,
    },
    disclaimer: {
        color: theme.colors.textMain,
        marginTop: theme.spacing.md,
    },
    footer: {
        gap: theme.spacing.md,
    },
}))
