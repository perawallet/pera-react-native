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
import { UNAVAILABLE_CONTROL_OPACITY } from '@constants/ui'

export const useStyles = makeStyles(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.xl,
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
    },
    buttonFour: {
        flex: 1,
        minWidth: 0,
        maxWidth: '25%',
        alignItems: 'center',
    },
    buttonTwo: {
        flex: 1,
        minWidth: 0,
        maxWidth: '50%',
        alignItems: 'center',
    },
    unavailable: {
        opacity: UNAVAILABLE_CONTROL_OPACITY,
    },
}))
