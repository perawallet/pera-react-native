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

const BULLET_SIZE = 6

export const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        paddingBottom: theme.spacing.xxl,
    },
    title: {
        marginBottom: theme.spacing.sm,
    },
    description: {
        color: theme.colors.textGray,
        marginBottom: theme.spacing.xxl,
    },
    sectionTitle: {
        marginTop: theme.spacing.xl,
        marginBottom: theme.spacing.md,
    },
    list: {
        gap: theme.spacing.md,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    listItemText: {
        flex: 1,
        color: theme.colors.textMain,
    },
    stepCircle: {
        width: theme.spacing.xxl,
        height: theme.spacing.xxl,
        borderRadius: theme.spacing.xxl / 2,
        backgroundColor: theme.colors.layerGrayLighter,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing.md,
    },
    bullet: {
        width: BULLET_SIZE,
        height: BULLET_SIZE,
        borderRadius: BULLET_SIZE / 2,
        backgroundColor: theme.colors.textGray,
        marginTop: theme.spacing.sm,
        marginRight: theme.spacing.md,
    },
    footer: {
        padding: theme.spacing.xl,
        borderTopWidth: theme.borders.sm,
        borderTopColor: theme.colors.layerGrayLighter,
        backgroundColor: theme.colors.background,
    },
}))
