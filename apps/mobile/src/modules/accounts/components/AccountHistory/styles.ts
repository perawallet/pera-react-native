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
    headerContainer: {
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.md,
    },
    container: {
        flex: 1,
        minHeight: 0,
        backgroundColor: theme.colors.background,
    },
    rootContainer: {
        flexGrow: 1,
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.xl,
    },
    separator: {
        height: theme.borders.sm,
        backgroundColor: theme.colors.layerGrayLighter,
        // Inset to align with the title: icon width (sm = xxl) + row gap (md).
        marginLeft: theme.spacing.xxl + theme.spacing.md,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: theme.spacing['3xl'],
    },
    // Zero EmptyView's own gutter: the list content container already insets xl.
    emptyView: {
        paddingHorizontal: 0,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    loadingFooter: {
        paddingVertical: theme.spacing.lg,
        alignItems: 'center',
    },
    titleBar: {
        gap: theme.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.sm,
    },
    titleBarTitleContainer: {
        flex: 1,
        minWidth: 0,
    },
    titleBarButtonContainer: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        alignItems: 'center',
        flexShrink: 0,
    },
    transparentButton: {
        backgroundColor: 'transparent',
    },
}))
