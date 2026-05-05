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
        flexGrow: 1,
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.sm,
    },
    headerContainer: {
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
    },
    titleBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.sm,
    },
    titleBarActions: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        alignItems: 'center',
    },
    manageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
    },
    manageText: {
        color: theme.colors.linkPrimary,
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
