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
    content: {
        flex: 1,
        paddingHorizontal: theme.spacing.xl,
    },
    title: {
        marginBottom: theme.spacing.sm,
        marginTop: theme.spacing.sm,
    },
    description: {
        marginBottom: theme.spacing.xl,
        color: theme.colors.textGray,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.layerGrayLighter,
    },
    headerCount: {
        color: theme.colors.textGray,
        fontWeight: '600',
    },
    selectAllContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectAllText: {
        color: theme.colors.linkPrimary,
        marginRight: theme.spacing.xs,
    },
    checkboxContainer: {
        padding: 0,
        margin: 0,
        marginLeft: 0,
        marginRight: 0,
        backgroundColor: 'transparent',
    },
    listContent: {
        paddingBottom: theme.spacing.xl,
    },
    itemContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.layerGrayLighter,
    },
    itemTextContainer: {
        flex: 1,
        paddingRight: theme.spacing.md,
    },
    itemTitle: {
        color: theme.colors.textMain,
        marginBottom: 2,
    },
    itemSubtitle: {
        color: theme.colors.textGray,
        fontSize: 12,
    },
    footer: {
        padding: theme.spacing.xl,
        borderTopWidth: theme.borders.sm,
        borderTopColor: theme.colors.layerGrayLighter,
        backgroundColor: theme.colors.background,
        paddingBottom: theme.spacing.xl + 20, // Extra padding for safe area logic usually handled by SafeAreaView but good to have buffer
    },
    overlayBackdrop: {
        backgroundColor: 'rgba(52, 52, 52, 0.8)',
    },
    overlay: {
        padding: theme.spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.layerGray,
        borderRadius: theme.spacing.lg,
        gap: theme.spacing.lg,
    },
}))
