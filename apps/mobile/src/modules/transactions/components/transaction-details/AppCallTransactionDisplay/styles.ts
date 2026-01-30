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
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing.lg,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        overflow: 'hidden',
        flexWrap: 'nowrap',
        flexShrink: 1,
    },
    detailContainer: {
        gap: theme.spacing.lg,
        paddingHorizontal: theme.spacing.sm,
        width: '100%',
    },
    divider: {
        marginTop: theme.spacing.xs,
        width: '100%',
    },
    expandablePanel: {
        marginTop: theme.spacing.md,
        marginLeft: theme.spacing.md,
        gap: theme.spacing.sm,
        flexShrink: 1,
        flexWrap: 'nowrap',
        overflow: 'hidden',
    },
    detailText: {
        marginLeft: theme.spacing.xl,
    },
}))
