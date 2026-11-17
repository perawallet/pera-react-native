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
import { DISCOVER_LOGO_STACK_SIZE } from '../../utils/discoverLayout'

export const useStyles = makeStyles(theme => ({
    stack: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    // The ring in the row's background keeps overlapped logos distinct.
    slot: {
        borderWidth: theme.borders.md,
        borderColor: theme.colors.background,
        borderRadius: theme.borderRadius.full,
    },
    stacked: {
        marginLeft: -theme.spacing.xs,
    },
    more: {
        width: DISCOVER_LOGO_STACK_SIZE,
        height: DISCOVER_LOGO_STACK_SIZE,
        borderRadius: theme.borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        backgroundColor: theme.colors.background,
    },
    moreLabel: {
        color: theme.colors.textGray,
    },
}))
