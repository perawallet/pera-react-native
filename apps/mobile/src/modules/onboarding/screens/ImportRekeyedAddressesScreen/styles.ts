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
    headerContainer: {
        marginVertical: theme.spacing.xl,
        gap: theme.spacing.lg,
    },
    headerIconContainer: {
        marginBottom: theme.spacing.md,
    },
    title: {
        marginBottom: theme.spacing.sm,
    },
    description: {
        marginBottom: theme.spacing.xs,
        color: theme.colors.textGray,
    },
    checkboxContainer: {
        padding: 0,
        margin: 0,
        marginLeft: 0,
        marginRight: 0,
        backgroundColor: 'transparent',
    },
    checkboxWrapper: {
        marginRight: theme.spacing.md,
    },
    listContent: {
        paddingBottom: theme.spacing.xl,
        paddingHorizontal: theme.spacing.xl,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
        backgroundColor: theme.colors.background,
        borderRadius: theme.spacing.lg,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        ...theme.shadows.md,
    },
    itemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        marginRight: theme.spacing.md,
        justifyContent: 'center',
        alignItems: 'center',
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
    infoIconContainer: {
        marginLeft: theme.spacing.sm,
    },
    infoIcon: {
        color: theme.colors.textGray,
    },
    footer: {
        paddingTop: theme.spacing.xl,
        paddingHorizontal: theme.spacing.xl,
        borderTopWidth: theme.borders.sm,
        borderTopColor: theme.colors.layerGrayLighter,
        backgroundColor: theme.colors.background,
    },
    continueButton: {
        marginBottom: theme.spacing.md,
    },
    skipButton: {
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
    list: {
        flex: 1,
    },
}))
