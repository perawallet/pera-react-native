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
    iconContainer: {
        alignItems: 'center',
        marginTop: theme.spacing.xxl,
        marginBottom: theme.spacing.xl,
    },
    title: {
        textAlign: 'center',
        marginBottom: theme.spacing.sm,
    },
    description: {
        textAlign: 'center',
        color: theme.colors.textGray,
        marginBottom: theme.spacing.xxl,
    },
    instructionsList: {
        gap: theme.spacing.lg,
    },
    instructionItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.layerGrayLighter,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing.md,
    },
    stepNumber: {
        color: theme.colors.textMain,
        fontWeight: '600',
    },
    instructionText: {
        flex: 1,
        color: theme.colors.textMain,
    },
    footer: {
        padding: theme.spacing.xl,
        borderTopWidth: theme.borders.sm,
        borderTopColor: theme.colors.layerGrayLighter,
        backgroundColor: theme.colors.background,
        paddingBottom: theme.spacing.xl + 20,
    },
}))
