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

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: arrow chip between the send and receive rows
const ARROW_SIZE = 24

export const useStyles = makeStyles(theme => ({
    card: {
        gap: theme.spacing.sm,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.borderRadius.xl,
        backgroundColor: theme.colors.layerGrayLighter,
    },
    loading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingBottom: theme.spacing.md,
    },
    heading: {
        color: theme.colors.textGray,
        paddingBottom: theme.spacing.xs,
    },
    muted: {
        color: theme.colors.textGray,
    },
    arrow: {
        width: ARROW_SIZE,
        height: ARROW_SIZE,
        marginLeft: theme.spacing.sm,
        borderRadius: theme.borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
    },
    net: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: theme.spacing.xs,
        paddingTop: theme.spacing.md,
        borderTopWidth: theme.borders.sm,
        borderTopColor: theme.colors.layerGray,
    },
    note: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.xs,
        paddingTop: theme.spacing.md,
        borderTopWidth: theme.borders.sm,
        borderTopColor: theme.colors.layerGray,
    },
    // Centres the icon on the note's first line.
    noteIcon: {
        marginTop: theme.spacing.xxs,
    },
    noteText: {
        flex: 1,
        color: theme.colors.textGray,
    },
}))
