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
import type { EdgeInsets } from 'react-native-safe-area-context'

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    root: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: theme.spacing.xl,
    },
    hero: {
        width: '100%',
        aspectRatio: 2,
        backgroundColor: theme.colors.systemElements,
    },
    body: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        gap: theme.spacing.xl,
    },
    bodyText: {
        color: theme.colors.textGray,
    },
    learnMore: {
        color: theme.colors.linkPrimary,
    },
    expectLabel: {
        color: theme.colors.textGray,
        textTransform: 'uppercase',
    },
    listSection: {
        gap: theme.spacing.lg,
    },
    footer: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.lg,
        paddingBottom: insets.bottom + theme.spacing.xl,
    },
    cta: {
        paddingVertical: theme.spacing.lg,
    },
}))
