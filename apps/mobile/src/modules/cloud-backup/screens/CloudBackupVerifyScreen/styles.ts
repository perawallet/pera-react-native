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
    content: {
        gap: theme.spacing.xl,
    },
    quizList: {
        gap: theme.spacing.xxl,
    },
    quizItem: {
        gap: theme.spacing.sm,
    },
    quizLabel: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
    optionGroup: {
        padding: theme.spacing.sm,
        borderRadius: theme.borderRadius.md,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        gap: theme.spacing.sm,
    },
    option: {
        height: theme.spacing['3xl'],
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.xs,
        backgroundColor: theme.colors.layerGrayLightest,
    },
    optionSelected: {
        backgroundColor: theme.colors.buttonPrimaryBg,
    },
    optionTextSelected: {
        color: theme.colors.buttonPrimaryText,
    },
}))
