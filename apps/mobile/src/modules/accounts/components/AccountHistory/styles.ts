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
        // flex (not flexGrow) so the tab scene body always fills the account
        // tab pager. With flexGrow the empty branch collapsed to zero height on
        // native, blanking the whole History tab (PERA-4676).
        flex: 1,
        minHeight: 0,
        backgroundColor: theme.colors.background,
    },
    // Wraps the loading/empty branches (which render outside the SectionList)
    // so their title aligns with the populated list's horizontal inset.
    stateContainer: {
        flex: 1,
        paddingHorizontal: theme.spacing.xl,
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
    // Fills the space under the title so the empty message centers; the
    // horizontal inset comes from stateContainer, so zero the view's own gutter.
    emptyView: {
        flex: 1,
        paddingHorizontal: 0,
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
