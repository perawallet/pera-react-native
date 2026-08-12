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
    contentContainer: {
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.md,
    },
    header: {
        paddingVertical: theme.spacing.md,
    },
    assetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.md,
        width: '100%',
        minWidth: 0,
    },
    headerIcons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        flexShrink: 0,
    },
    chartContainer: {
        gap: theme.spacing.md,
        marginBottom: theme.spacing.lg,
    },
    secondaryValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        minWidth: 0,
    },
    // Mirrors the account overview's dateDisplay: flexGrow claims the rest of
    // the row so the scrub date sits hard right, off the value beside it.
    dateDisplay: {
        color: theme.colors.textGray,
        textAlign: 'right',
        flexGrow: 1,
    },
    primaryValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: 0,
    },
}))
