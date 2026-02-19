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

export const useStyles = makeStyles((theme, props: { insets: EdgeInsets }) => {
    return {
        container: {
            padding: theme.spacing.xl,
            paddingBottom: props.insets.bottom,
            paddingTop: theme.spacing.xxl,
            borderTopStartRadius: theme.spacing.sm,
            borderTopEndRadius: theme.spacing.sm,
            alignItems: 'center',
        },
        bodyContainer: {
            paddingHorizontal: theme.spacing.xl,
        },
        title: {
            marginTop: theme.spacing.lg,
            textAlign: 'center',
        },
        preamble: {
            textAlign: 'center',
            color: theme.colors.textGray,
            marginVertical: theme.spacing.xl,
        },
        postamble: {
            lineHeight: theme.spacing.lg,
            marginVertical: theme.spacing.lg,
        },
        tipsContainer: {
            gap: theme.spacing.xl,
        },
        tip: {
            flexDirection: 'row',
            gap: theme.spacing.lg,
            alignItems: 'center',
        },
        tipNumberContainer: {
            borderRadius: theme.spacing.xxl,
            borderColor: theme.colors.layerGrayLightest,
            borderWidth: theme.borders.sm,
            alignItems: 'center',
            justifyContent: 'center',
            width: theme.spacing.xxl,
            height: theme.spacing.xxl,
        },
        tipNumber: {
            fontSize: theme.spacing.lg,
            color: theme.colors.textGray,
        },
        tipText: {
            flexWrap: 'wrap',
            flexShrink: 1,
        },
        redText: {
            color: theme.colors.error,
        },
        link: {
            marginLeft: theme.spacing.xs,
        },
    }
})
