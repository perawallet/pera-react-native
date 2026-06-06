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
        // Inset on the wrapper, not contentContainerStyle: FlashList renders the
        // sticky-search overlay edge-to-edge, so it must stay inset when pinned.
        paddingHorizontal: theme.spacing.xl,
    },
    rootContainer: {
        gap: 0,
    },
    separator: {
        height: theme.borders.sm,
        backgroundColor: theme.colors.layerGrayLighter,
        // Inset to align with the asset name: icon width (lg = xxl) + row gap (lg).
        marginLeft: theme.spacing.xxl + theme.spacing.lg,
    },
    headerContainer: {
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.md,
    },
    titleBar: {
        gap: theme.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
        width: '100%',
        minWidth: 0,
    },
    titleBarTitleContainer: {
        flex: 1,
        minWidth: 0,
    },
    titleBarButtonContainer: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    manageButton: {
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        flexShrink: 0,
    },
    addAssetButton: {
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        flexShrink: 0,
    },
}))
