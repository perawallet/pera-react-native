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
    contentContainer: {
        paddingHorizontal: theme.spacing.xl,
    },
    // Hairline row divider for list layout, inset past the 3xl thumbnail + md
    // row gap to align with the row text, matching the accounts asset list.
    listSeparator: {
        height: theme.borders.sm,
        backgroundColor: theme.colors.layerGrayLighter,
        marginLeft: theme.spacing['3xl'] + theme.spacing.md,
    },
    // xl gap between grid rows. FlashList has no columnWrapperStyle, so all grid
    // spacing rides on the cells here rather than on the card.
    gridColumn: {
        paddingBottom: theme.spacing.xl,
    },
    // Half of the inter-column gap on each cell's inner edge -> xl gap between
    // grid columns while the outer edges stay flush with the xl content inset.
    gridColumnLeft: {
        paddingRight: theme.spacing.xl / 2,
    },
    gridColumnRight: {
        paddingLeft: theme.spacing.xl / 2,
    },
    headerContainer: {
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
    },
    titleBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        marginBottom: theme.spacing.sm,
    },
    titleBarTitleContainer: {
        flex: 1,
        minWidth: 0,
    },
    titleBarActions: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        alignItems: 'center',
        flexShrink: 0,
    },
    manageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
    },
    manageText: {
        color: theme.colors.positive,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    searchInputContainer: {
        flex: 1,
    },
    layoutToggle: {
        flexDirection: 'row',
    },
    layoutToggleButton: {
        width: theme.spacing['3xl'],
        height: theme.spacing['3xl'],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: theme.borders.md,
        borderColor: theme.colors.layerGrayLighter,
    },
    layoutToggleButtonLeft: {
        borderTopLeftRadius: theme.borderRadius.md,
        borderBottomLeftRadius: theme.borderRadius.md,
        borderRightWidth: 0,
    },
    layoutToggleButtonRight: {
        borderTopRightRadius: theme.borderRadius.md,
        borderBottomRightRadius: theme.borderRadius.md,
        borderLeftWidth: 0,
    },
    layoutToggleButtonActive: {
        backgroundColor: theme.colors.layerGrayLighter,
    },
}))
