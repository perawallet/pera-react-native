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
    row: {
        flexDirection: 'row',
        // lanekeep-ignore-next-line pera/no-numeric-sizes reason: Figma's 6 pt chip gap, between the xs (4) and sm (8) tokens
        gap: theme.spacing.xs + theme.spacing.xxs,
    },
    // Figma: 1 pt border, 16 radius, 16 x 6 padding, 8 gap to the chevron.
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        // lanekeep-ignore-next-line pera/no-numeric-sizes reason: Figma's 6 pt chip padding, between the xs (4) and sm (8) tokens
        paddingVertical: theme.spacing.xs + theme.spacing.xxs,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        borderRadius: theme.borderRadius.lg,
        flexShrink: 1,
    },
    label: {
        color: theme.colors.textGray,
        flexShrink: 1,
    },
}))
