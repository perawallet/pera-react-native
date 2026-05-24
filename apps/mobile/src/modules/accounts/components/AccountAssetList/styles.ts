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
    rootContainer: {
        paddingHorizontal: theme.spacing.xl,
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
        alignItems: 'center',
        flexShrink: 1,
        minWidth: 0,
        maxWidth: '50%',
    },
    manageButton: {
        flexShrink: 0,
    },
    addAssetButton: {
        flex: 1,
        minWidth: 0,
        maxWidth: '100%',
        // Match the icon-only manage button's height: its sm icon (16) is 8px
        // shorter than this button's h4 label (lineHeight 24), so trim the
        // dense vertical padding from md (12) to sm (8) — both land at 40.
        paddingVertical: theme.spacing.sm,
    },
    loading: {
        justifyContent: 'flex-start',
    },
}))
