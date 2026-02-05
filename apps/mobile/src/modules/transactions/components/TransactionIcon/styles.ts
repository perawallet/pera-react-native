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
import type { TransactionIconProps } from './TransactionIcon'

type StyleProps = Pick<TransactionIconProps, 'size'>

export const useStyles = makeStyles((theme, props: StyleProps) => {
    let size: number

    switch (props.size) {
        case 'sm':
            size = 32
            break
        case 'md':
            // As requested: about 40x40px
            size = 40
            break
        case 'lg':
            size = 56
            break
        default:
            size = 32
    }

    return {
        container: {
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: size / 2,
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
        },
    }
})
