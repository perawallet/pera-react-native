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

const DOT_SIZE = 6

export const useStyles = makeStyles(theme => ({
    root: {
        flex: 1,
        minHeight: 0,
    },
    // The filter chips sit in a fixed row ABOVE the list (not in the list
    // header) so they stay put when toggling filters changes the list height —
    // otherwise an empty result set stretches the list and the chips bounce.
    // flexShrink:0 keeps the wrapper at its content height in the flex column.
    filterBar: {
        flexShrink: 0,
    },
    // Vertical padding here matters functionally: PWScrollView injects a
    // default bottom padding when the content style has none, which would make
    // this horizontal row tall. Setting paddingVertical suppresses that.
    filterContent: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.md,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: theme.spacing.lg,
    },
    footer: {
        paddingVertical: theme.spacing.md,
    },
    itemSeparator: {
        height: theme.borders.sm,
        backgroundColor: theme.colors.layerGrayLighter,
    },
}))

export const useItemStyles = makeStyles(theme => ({
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        gap: theme.spacing.md,
    },
    // Purple "needs attention" dot for pending orders, sitting in the left
    // gutter (outside the list's horizontal padding) so it doesn't shift the
    // row content. Vertically centered on the row.
    pendingDot: {
        position: 'absolute',
        left: -theme.spacing.md,
        top: '50%',
        marginTop: -DOT_SIZE / 2,
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.secondary,
    },
    itemBody: {
        flex: 1,
        gap: theme.spacing.xs,
    },
    itemStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xxs,
    },
    itemDate: {
        color: theme.colors.textGray,
    },
}))
