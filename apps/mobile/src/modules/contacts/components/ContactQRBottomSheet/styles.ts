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
        paddingHorizontal: theme.spacing.xl,
    },
    header: {
        height: theme.spacing['3xl'],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: theme.spacing.lg,
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    qrSection: {
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    shortAddress: {
        textAlign: 'center',
    },
    // Uses the `body` typography variant at the callsite; overrides only
    // the color + alignment.
    fullAddress: {
        color: theme.colors.textGray,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.xl,
    },
    actions: {
        gap: theme.spacing.sm,
        marginTop: theme.spacing.xl,
    },
    actionButton: {
        minHeight: theme.spacing['3xl'],
        borderRadius: theme.borderRadius.xs,
    },
}))
