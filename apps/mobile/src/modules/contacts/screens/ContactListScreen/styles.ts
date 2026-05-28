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

export const useStyles = makeStyles(theme => {
    return {
        searchWrapper: {
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing.sm,
        },
        contactContainer: {
            flexDirection: 'row',
            gap: theme.spacing.lg,
            alignItems: 'center',
            paddingVertical: theme.spacing.lg,
        },
        separator: {
            height: theme.borders.sm,
            backgroundColor: theme.colors.layerGrayLighter,
            // Inset to align with the contact name past AddressDisplay's
            // leading avatar (icon width xxl + row gap md).
            marginLeft: theme.spacing.xxl + theme.spacing.md,
        },
        emptyButton: {
            minHeight: theme.spacing['3xl'],
            borderRadius: theme.borderRadius.xs,
            marginTop: theme.spacing.xl,
        },
    }
})
