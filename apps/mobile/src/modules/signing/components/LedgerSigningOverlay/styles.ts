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
        padding: theme.spacing.xl,
        alignItems: 'center' as const,
    },
    title: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: theme.colors.textMain,
        marginBottom: theme.spacing.lg,
    },
    indicator: {
        marginVertical: theme.spacing.lg,
    },
    message: {
        fontSize: 14,
        color: theme.colors.textGray,
        textAlign: 'center' as const,
        marginBottom: theme.spacing.xl,
    },
    actions: {
        width: '100%' as const,
        gap: theme.spacing.sm,
    },
    retryButton: {
        marginBottom: theme.spacing.xs,
    },
}))
