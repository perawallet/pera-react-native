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
import type { AssetSecurityTagVariant } from './AssetSecurityTag'

type StyleProps = { variant: AssetSecurityTagVariant }

export const useStyles = makeStyles((theme, { variant }: StyleProps) => ({
    container: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.spacing.md,
        backgroundColor:
            variant === 'warning'
                ? theme.colors.negativeLighter
                : theme.colors.layerGrayLighter,
    },
    label: {
        color:
            variant === 'warning'
                ? theme.colors.negative
                : theme.colors.textMain,
    },
}))
