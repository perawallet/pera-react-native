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

export const useStyles = makeStyles(theme => {
    return {
        container: {
            flex: 1,
        },
        searchField: {
            borderRadius: theme.spacing.sm,
            paddingHorizontal: theme.spacing.sm,
        },
        searchContainer: {
            backgroundColor: theme.colors.background,
        },
        list: {
            flex: 1,
        },
        listSeparator: {
            height: theme.spacing.xl,
        },
        accountDisplay: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
        },
        accountDisplayInRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            flexShrink: 1,
        },
        nfdItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
        },
        foreignRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            width: '100%',
        },
        addIconButton: {
            width: theme.spacing.xxl,
            height: theme.spacing.xxl,
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.buttonSquareBg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        nfdInfo: {
            flex: 1,
        },
        nfdAddress: {
            color: theme.colors.textGray,
        },
        loadingContainer: {
            paddingVertical: theme.spacing.xl,
            alignItems: 'center',
        },
        pasteRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.lg,
            marginBottom: theme.spacing.sm,
            padding: theme.spacing.lg,
            borderRadius: theme.borderRadius.md,
            backgroundColor: theme.colors.layerGrayLightest,
            borderWidth: theme.borders.sm,
            borderColor: theme.colors.layerGrayLighter,
            ...theme.shadows.sm,
        },
        pasteRowText: {
            // The address wraps rather than truncates, so the text column has to
            // shrink instead of pushing the icon off the row.
            flex: 1,
            gap: theme.spacing.xs,
        },
        pasteRowLabel: {
            color: theme.colors.textGray,
        },
    }
})
