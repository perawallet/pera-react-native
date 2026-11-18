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
import { DISCOVER_ROW_LEAD_SIZE } from '../../utils/discoverLayout'

type StyleProps = { bottomInset?: number }

export const useStyles = makeStyles(
    (theme, { bottomInset = 0 }: StyleProps = {}) => ({
        container: {
            flex: 1,
        },
        listFill: {
            flex: 1,
        },
        listContent: {
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: theme.spacing.xl + bottomInset,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            backgroundColor: theme.colors.background,
        },
        info: {
            flex: 1,
        },
        subtitle: {
            color: theme.colors.textGray,
        },
        // Figma: 52 x 40 tinted squares with a 16 radius.
        square: {
            height: DISCOVER_ROW_LEAD_SIZE,
            paddingHorizontal: theme.spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.borderRadius.lg,
        },
        remove: {
            backgroundColor: theme.colors.negativeLighter,
        },
        handle: {
            backgroundColor: theme.colors.layerGrayLighter,
        },
    }),
)
