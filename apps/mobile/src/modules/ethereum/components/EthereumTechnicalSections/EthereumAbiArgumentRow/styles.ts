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

export const useEthereumAbiArgumentRowStyles = makeStyles(theme => ({
    container: {
        gap: theme.spacing.xs,
    },
    nested: {
        gap: theme.spacing.xs,
        paddingLeft: theme.spacing.md,
        borderLeftWidth: theme.borders.sm,
        borderLeftColor: theme.colors.layerGray,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: theme.spacing.xs,
    },
    type: {
        color: theme.colors.textGray,
    },
}))
