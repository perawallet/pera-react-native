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

import { ZINDEX_ORDER } from '@constants/ui'
import { makeStyles } from '@rneui/themed'
import { EdgeInsets } from 'react-native-safe-area-context'

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    container: {
        paddingTop: insets.top + theme.spacing.xxl,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    overlayContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: ZINDEX_ORDER.max,
    }
}))
