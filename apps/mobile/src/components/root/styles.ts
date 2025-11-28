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
import { StatusBar } from 'react-native'
import { EdgeInsets } from 'react-native-safe-area-context'

export const useStyles = makeStyles((theme, insets: EdgeInsets) => {
    return {
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        testnetBar: {
            backgroundColor: theme.colors.testnetBackground,
            height: insets.top + theme.spacing.sm,
            zIndex: 1,

        },
        mainnetBar: {
            backgroundColor: theme.colors.background,
            height: insets.top + theme.spacing.sm,
            zIndex: 1,
        },
        offlineTextContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.layerGray,
            marginHorizontal: theme.spacing.lg,
            zIndex: 1,
            borderRadius: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
        },
        offlineText: {
            color: theme.colors.textGray,
        }
    }
})
