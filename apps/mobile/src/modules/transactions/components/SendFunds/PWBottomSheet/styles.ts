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
import { ScaledSize } from 'react-native'

export const useStyles = makeStyles((theme, dimensions: ScaledSize) => {
    const height = dimensions.height - 100
    return {
        container: {
            height,
            paddingVertical: theme.spacing.md,
            borderTopStartRadius: theme.spacing.sm,
            borderTopEndRadius: theme.spacing.sm,
            overflow: 'hidden',
        },
        titleContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            width: '100%',
            alignItems: 'center',
            height: theme.spacing['3xl'],
            marginBottom: theme.spacing.xl,
        },
        titleButtonContainer: {
            width: theme.spacing.xxl,
            alignItems: 'center',
            justifyContent: 'center',
        },
        accountTitleContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xs / 2,
        },
        assetTitleContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
        },
        accountDisplay: {
            flexDirection: 'row',
            gap: theme.spacing.xs,
            alignItems: 'center',
        },
        accountDisplaySubHeading: {
            fontSize: theme.spacing.md,
        },
        tabItem: {
            width: '100%',
            paddingHorizontal: theme.spacing.lg,
        },
    }
})
