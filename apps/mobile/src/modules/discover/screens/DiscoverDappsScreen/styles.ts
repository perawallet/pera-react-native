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
    list: {
        paddingHorizontal: theme.spacing.xl,
    },
    header: {
        gap: theme.spacing.md,
        paddingTop: theme.spacing.md,
    },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sortTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xxs,
    },
    sortLabel: {
        color: theme.colors.linkPrimary,
    },
    // The chip rows scroll under the screen's side padding, edge to edge.
    bleed: {
        marginHorizontal: -theme.spacing.xl,
    },
    chips: {
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.xl,
    },
    empty: {
        paddingVertical: theme.spacing.lg,
    },
    apply: {
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
        marginTop: theme.spacing.lg,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.layerGrayLighter,
    },
    applyPrompt: {
        textAlign: 'center',
    },
}))
