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
    const height = dimensions.height - 200
    return {
        container: {
            height,
            padding: theme.spacing.xl,
            paddingTop: theme.spacingspacing['3xl'],
            borderTopStartRadius: theme.spacing.sm,
            borderTopEndRadius: theme.spacing.sm,
            overflow: 'hidden',
            alignItems: 'center',
            gap: theme.spacing.lg,
        },
        bodyContainer: {
            gap: theme.spacing.lg,
            padding: theme.spacing.xl,
        },
        title: {
            textAlign: 'center',
        },
        preamble: {
            textAlign: 'center',
            paddingHorizontal: theme.spacing.lg,
        },
        postamble: {
            paddingHorizontal: theme.spacing.lg,
        },
        tipsContainer: {
            gap: theme.spacing.xl,
            marginHorizontal: theme.spacing.xl,
        },
        tip: {
            flexDirection: 'row',
            gap: theme.spacing.xl,
            alignItems: 'center',
        },
        tipNumberContainer: {
            borderRadius: theme.spacingspacing['3xl'],
            borderColor: theme.colors.layerGrayLight,
            boxShadow: '1px 1px 1px 0px #00000015',
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
            width: theme.spacingspacing['3xl'],
            height: theme.spacingspacing['3xl'],
        },
        tipNumber: {
            fontSize: theme.spacing.lg,
        },
        tipText: {
            flexWrap: 'wrap',
            flexShrink: 1,
        },
        redText: {
            color: theme.colors.error,
        },
        linkContainer: {},
        link: {
            color: theme.colors.linkPrimary,
        },
    }
})
