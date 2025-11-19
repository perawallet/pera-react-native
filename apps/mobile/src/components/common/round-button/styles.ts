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
import { RoundButtonProps } from './RoundButton'

export const useStyles = makeStyles((theme, _: RoundButtonProps) => ({
    buttonStyle: {
        backgroundColor: theme.colors.layerGrayLighter,
        color: theme.colors.textMain,
        marginBottom: theme.spacing.sm,
        width: 64,
        height: 64,
        alignContent: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 32,
    },
    titleStyle: {
        color: theme.colors.textMain,
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
    },
}))
