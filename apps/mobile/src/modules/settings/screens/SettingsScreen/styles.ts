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
import { EdgeInsets } from 'react-native-safe-area-context'

export const useStyles = makeStyles((theme, insets: EdgeInsets) => {
    return {
        sectionContainer: {
            gap: theme.spacing.xxl,
            marginBottom: theme.spacing.xl,
        },
        section: {
            flexDirection: 'column',
        },
        sectionTitle: {
            color: theme.colors.textGray,
            paddingBottom: theme.spacing.lg,
        },
        sectionRow: {
            flexDirection: 'row',
            gap: theme.spacing.lg,
            paddingVertical: theme.spacing.lg,
            alignItems: 'center',
        },
        sectionRowTitle: {
            flexGrow: 1,
        },
        scrollView: {
            flex: 1,
            marginHorizontal: theme.spacing.xl,
            marginBottom: insets.bottom,
        },
        scrollViewContainer: {},
        versionText: {
            color: theme.colors.textGrayLighter,
            paddingVertical: theme.spacing.sm,
            textAlign: 'center',
            width: '100%',
            fontSize: 11,
        },
    }
})
