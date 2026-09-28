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

import type { CreateThemeOptions } from '@rneui/themed'
import { getFontFamily } from './typography'

export const componentOverrides: CreateThemeOptions['components'] = {
    Button: (_, theme) => ({
        containerStyle: {
            backgroundColor: theme.colors.primary,
            color: theme.colors.textMain,
            borderRadius: theme.spacing.xs,
        },
        disabledStyle: {
            backgroundColor: theme.colors.textGray,
        },
        disabledTitleStyle: {
            color: theme.colors.textGrayLighter,
        },
    }),
    CheckBox: (props, theme) => ({
        containerStyle: {
            backgroundColor: props?.checked
                ? theme.colors.buttonSquareBg
                : theme.colors.background,
            color: props?.checked
                ? theme.colors.buttonSquareIcon
                : theme.colors.textMain,
            paddingHorizontal: 0,
            borderColor: theme.colors.positive,
            borderWidth: theme.borders.md,
            borderRadius: theme.spacing.xs,
            height: theme.spacing.xl,
            width: theme.spacing.xl,
            alignItems: 'center',
            justifyContent: 'center',
        },
    }),
    Dialog: (_, theme) => ({
        overlayStyle: {
            backgroundColor: theme.colors.layerGrayLightest,
        },
        backdropStyle: {
            backgroundColor: theme.colors.backdropModalBg,
        },
    }),
    DialogTitle: (_, theme) => ({
        titleStyle: {
            color: theme.colors.textMain,
        },
    }),
    DialogButton: (_, theme) => ({
        titleStyle: {
            color: theme.colors.textMain,
        },
    }),
    Input: (_, theme) => ({
        containerStyle: {
            backgroundColor: theme.colors.background,
            paddingHorizontal: 0,
        },
        inputStyle: {
            fontFamily: getFontFamily(400),
            fontSize: 13,
            color: theme.colors.textMain,
            borderRadius: theme.spacing.xs,
        },
        labelStyle: {
            fontFamily: getFontFamily(400),
            fontSize: 13,
            color: theme.colors.textGray,
            marginBottom: theme.spacing.xs,
        },
        inputContainerStyle: {
            backgroundColor:
                theme.mode === 'dark'
                    ? theme.colors.layerGrayLightest
                    : theme.colors.layerGrayLighter,
            borderBottomWidth: theme.borders.none,
        },
        rightIconContainerStyle: {
            marginVertical: 0,
        },
        cursorColor:
            theme.mode === 'dark'
                ? theme.colors.textGray
                : theme.colors.textMain,
        placeholderTextColor:
            theme.mode === 'dark'
                ? theme.colors.textGrayLighter
                : theme.colors.textGray,
        renderErrorMessage: false,
    }),
    Skeleton: (_, theme) => ({
        skeletonStyle: {
            backgroundColor: theme.colors.layerGrayLighter,
        },
        style: {
            backgroundColor: theme.colors.layerGray,
            borderWidth: theme.borders.md,
            borderColor: theme.colors.background,
        },
        animation: 'pulse',
    }),
    BottomSheet: (_, theme) => ({
        containerStyle: {
            margin: 0,
            flex: 1,
            backgroundColor: theme.colors.backdropModalBg,
        },
        backdropStyle: {
            backgroundColor: theme.colors.backdropModalBg,
        },
        scrollViewProps: {
            contentContainerStyle: {
                borderTopStartRadius: theme.spacing.xl,
                borderTopEndRadius: theme.spacing.xl,
            },
        },
        modalProps: {
            presentationStyle: 'overFullScreen',
        },
    }),
    Switch: (_, theme) => ({
        trackColor: {
            false: theme.colors.switchOffBg,
            true: theme.colors.switchBg,
        },
        thumbColor: theme.colors.textWhite,
    }),
}
