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
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.xxl,
    },
    title: {
        textAlign: 'center',
    },
    body: {
        textAlign: 'center',
        color: theme.colors.textGray,
    },
    steps: {
        gap: theme.spacing.xl,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
    },
    bullet: {
        width: theme.spacing.xxl,
        height: theme.spacing.xxl,
        borderRadius: theme.spacing.xxl / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bulletPending: {
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.textGray,
    },
    bulletFilled: {
        backgroundColor: theme.colors.positiveLighter,
    },
    bulletNumberPending: {
        color: theme.colors.textGray,
    },
    bulletNumberActive: {
        color: theme.colors.positive,
    },
    rowLabel: {
        flex: 1,
    },
    labelPending: {
        color: theme.colors.textGray,
    },
    labelActive: {
        color: theme.colors.textMain,
    },
    proceedButton: {
        marginTop: theme.spacing.md,
    },
}))
