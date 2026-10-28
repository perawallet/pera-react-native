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
    container: {
        flex: 1,
        justifyContent: 'space-between',
        padding: theme.spacing.xl,
        gap: theme.spacing.xl,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.lg,
    },
    title: {
        textAlign: 'center',
        color: theme.colors.textMain,
    },
    body: {
        textAlign: 'center',
        color: theme.colors.textGray,
    },
    host: {
        textAlign: 'center',
        color: theme.colors.suspiciousBannerContent,
    },
    actions: {
        gap: theme.spacing.md,
    },
    acknowledge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    acknowledgeLabel: {
        flexShrink: 1,
    },
}))
