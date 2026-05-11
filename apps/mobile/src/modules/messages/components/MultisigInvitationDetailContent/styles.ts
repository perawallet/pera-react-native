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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: theme.spacing.md,
        paddingBottom: theme.spacing.lg,
        gap: theme.spacing.lg,
    },
    header: {
        alignItems: 'center',
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.md,
        gap: theme.spacing.xxs,
    },
    headerTitle: {
        textAlign: 'center',
    },
    headerAddress: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
    sectionHeading: {
        color: theme.colors.textGray,
        marginTop: theme.spacing.sm,
    },
    participantRow: {
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.divider,
    },
    participantRowLast: {
        borderBottomWidth: 0,
    },
    bottomBar: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.md + insets.bottom,
    },
    bottomButton: {
        flex: 1,
    },
}))
