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

type StyleProps = {
    listPaddingBottom?: number
}

export const useStyles = makeStyles((theme, props: StyleProps = {}) => {
    const listPaddingBottom = props.listPaddingBottom ?? 0
    return {
        flex: {
            flex: 1,
        },
        searchWrapper: {
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.xl,
            paddingBottom: theme.spacing.sm,
        },
        listContent: {
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.xl,
            paddingBottom: listPaddingBottom,
            flexGrow: 1,
        },
        contactContainer: {
            flexDirection: 'row',
            gap: theme.spacing.lg,
            alignItems: 'center',
            paddingVertical: theme.spacing.lg,
        },
        contactTextContainer: {
            flex: 1,
            gap: theme.spacing.xxs,
        },
        contactName: {
            color: theme.colors.textMain,
        },
        // Uses the `body` typography variant at the callsite; overrides only
        // the color.
        contactAddress: {
            color: theme.colors.textGrayLighter,
        },
        noMatch: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.xl,
        },
        noMatchBody: {
            color: theme.colors.textGray,
            textAlign: 'center',
        },
        emptyState: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.xl,
        },
        emptyIconContainer: {
            width: theme.spacing['5xl'],
            height: theme.spacing['5xl'],
            borderRadius: theme.spacing['3xl'],
            backgroundColor: theme.colors.layerGrayLighter,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing.xl,
        },
        emptyTitle: {
            textAlign: 'center',
            marginBottom: theme.spacing.sm,
        },
        emptyBody: {
            color: theme.colors.textGray,
            textAlign: 'center',
            marginBottom: theme.spacing.xl,
        },
        emptyButton: {
            minHeight: theme.spacing['3xl'],
            borderRadius: theme.borderRadius.xs,
        },
    }
})
