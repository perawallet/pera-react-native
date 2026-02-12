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
import { STAKING_TYPE_COLORS } from '../../constants'
import type { StakingType } from '../../models'

export const useStyles = makeStyles(
    (theme, { type }: { type: StakingType }) => {
        return {
            container: {
                alignItems: 'center',
                borderColor: theme.colors.layerGray,
                borderRadius: theme.spacing.sm,
                borderWidth: theme.borders.sm,
                flexDirection: 'row',
                gap: theme.spacing.xs,
                paddingHorizontal: theme.spacing.sm,
            },
            dot: {
                backgroundColor: STAKING_TYPE_COLORS[type],
                borderRadius: theme.spacing.xs,
                height: theme.spacing.sm,
                width: theme.spacing.sm,
            },
            label: {
                color: theme.colors.textGray,
                fontSize: 12,
            },
        }
    },
)
