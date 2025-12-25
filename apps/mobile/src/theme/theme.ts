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

import { DefaultTheme } from '@react-navigation/native'
import { createTheme } from '@rneui/themed'
import { fontFamilies } from '@constants/fonts'

export const getFontFamily = (
    isMonoSpace: boolean,
    weight: 300 | 400 | 500 | 600 | 700,
) => {
    const selectedFontFamily = isMonoSpace
        ? fontFamilies.DMMONO
        : fontFamilies.DMSANS
    return selectedFontFamily[weight]
}

export const getNavigationTheme = (mode: 'light' | 'dark' = 'light') => ({
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: mode === 'light' ? '#FFFFFF' : '#18181B',
        text: mode === 'light' ? '#A1A1AA' : '#71717A',
        primary: mode === 'light' ? '#18181B' : '#FAFAFA',
    },
    dark: mode === 'dark',
})

export const getTheme = (mode: 'light' | 'dark' = 'light') =>
    createTheme({
        lightColors: {
            // Primary/secondary brand
            primary: '#27272A', // ButtonPrimary/bg (light)
            secondary: '#6B46FE', // ButtonSecondary/newText (light) - used as accent
            // Surfaces
            background: '#FFFFFF', // Defaults/bg (light)
            // Neutrals
            black: '#18181B', // Text/main (light)
            white: '#FFFFFF',
            grey0: '#FAFAFA', // Layer/grayLightest (light)
            grey1: '#F1F1F2', // Layer/grayLighter (light)
            grey2: '#E4E4E7', // Layer/grayLight (light)
            grey3: '#D4D4D8', // Layer/gray (light)
            grey4: '#A1A1AA', // Separator/grayLighter (light)
            grey5: '#71717A', // ButtonPrimary/newDisabledText

            //Layer colors
            layerGray: '#D4D4D8',
            layerGrayLight: '#D4D4D8',
            layerGrayLighter: '#F1F1F2',
            layerGrayLightest: '#FAFAFA',

            //Text colors
            textGray: '#71717A',
            textGrayLighter: '#A1A1AA',
            textMain: '#18181B',
            textSonicSilver: '#71717A',
            textWhite: '#FFFFFF',

            //Button
            buttonPrimaryBg: '#27272A',
            buttonPrimaryText: '#FFFFFF',

            buttonHelperBg: '#27272A',
            buttonHelperText: '#FFFFFF',

            buttonSquareBg: 'rgba(44, 183, 188, 0.12)',
            buttonSquareText: '#1F8E9D',

            //Helpers
            helperPositive: '#1F8E9D',
            helperNegative: '#DB4645',
            helperGray200: 'rgba(143, 143, 148, 0.2)',

            asaTrustedText: '#1F8E9D',
            asaTrustedBg: 'rgba(44, 183, 188, 0.16)',
            asaVerifiedText: '#0D7FFF',
            asaVerifiedBg: 'rgba(13, 127, 255, 0.16)',
            asaSuspiciousText: '#DB4645',
            asaSuspiciousBg: 'rgba(255, 109, 95, 0.16)',

            backdrop: 'rgba(0, 0, 0, 0.4)',

            //Links
            linkPrimary: '#1F8E9D',

            // Tab Bar
            tabIconActive: '#18181B',
            tabIconPassive: '#A1A1AA',

            testnetBackground: '#EDB21C',

            // States
            success: '#2CB7BC', // Alert/positive
            warning: '#FFEE55', // Link/primary (dark variant) used as generic warning
            error: '#DB4645', // Alert/negative (light)
            // Misc
            divider: 'rgba(0,0,0,0.05)', // Border/default (light)
        },
        darkColors: {
            // Primary/secondary brand (dark variants)
            primary: '#FFEE55', // ButtonPrimary/newBg (dark)
            secondary: '#AC8EFF', // ButtonSecondary/newText (dark)
            // Surfaces
            background: '#18181B', // Defaults/bg (dark)
            // Neutrals
            black: '#FFFFFF',
            white: '#F1F1F2', // Text/main (dark)
            grey0: '#27272A', // Layer/grayLightest (dark)
            grey1: '#27272A', // Layer/grayLighter (dark)
            grey2: '#3F3F46', // Layer/grayLight (dark)
            grey3: '#3F3F46', // Layer/gray (dark)
            grey4: '#71717A', // Separator/grayLighter (dark)
            grey5: '#71717A', // ButtonPrimary/newDisabledText

            //Layer colors
            layerGray: '#3F3F46',
            layerGrayLight: '#3F3F46',
            layerGrayLighter: '#27272A',
            layerGrayLightest: '#27272A',

            //Text colors
            textGray: '#A1A1AA',
            textGrayLighter: '#71717A',
            textMain: '#F1F1F2',
            textSonicSilver: '#A1A1AA',
            textWhite: '#FFFFFF',

            //Button
            buttonPrimaryBg: '#FFEE55',
            buttonPrimaryText: '#18181B',

            buttonHelperBg: 'rgba(255, 238, 85, 0.1)',
            buttonHelperText: '#FFEE55',

            buttonSquareBg: 'rgba(44, 183, 188, 0.12)',
            buttonSquareText: '#2CB7BC',

            //Helpers
            helperPositive: '#2CB7BC',
            helperNegative: '#DB4645',
            helperGray200: 'rgba(143, 143, 148, 0.2)',

            asaTrustedText: '#2CB7BC',
            asaTrustedBg: 'rgba(44, 183, 188, 0.16)',
            asaVerifiedText: '#48A7FE',
            asaVerifiedBg: 'rgba(13, 127, 255, 0.16)',
            asaSuspiciousText: '#FF6D5F',
            asaSuspiciousBg: 'rgba(255, 109, 95, 0.16)',

            backdrop: 'rgba(0, 0, 0, 0.4)',

            //Links
            linkPrimary: '#1F8E9D',

            // Tab Bar
            tabIconActive: '#FAFAFA',
            tabIconPassive: '#71717A',

            testnetBackground: '#EDB21C',

            // States
            success: '#2CB7BC', // Alert/positive
            warning: '#b66129', // Link/primary (dark)
            error: '#FF6D5F', // Alert/negative (dark)
            // Misc
            divider: 'rgba(255,255,255,0.05)', // Border/default (dark)
        },
        mode,
        spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
        components: {
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
                        ? theme.colors.buttonSquareText
                        : theme.colors.textMain,
                    paddingHorizontal: 0,
                    borderColor: theme.colors.helperPositive,
                    borderWidth: 2,
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
                    backgroundColor: theme.colors.backdrop,
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
                    fontFamily: getFontFamily(false, 400),
                    fontSize: 13,
                    color: theme.colors.textMain,
                    borderRadius: theme.spacing.xs,
                },
                labelStyle: {
                    fontFamily: getFontFamily(false, 400),
                    fontSize: 13,
                    color: theme.colors.textGray,
                    marginBottom: theme.spacing.xs,
                },
                inputContainerStyle: {
                    backgroundColor:
                        theme.mode === 'dark'
                            ? theme.colors.layerGrayLightest
                            : theme.colors.layerGrayLighter,
                    borderBottomWidth: 0,
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
                    backgroundColor: theme.colors.layerGrayLight,
                    borderWidth: 2,
                    borderColor: theme.colors.background,
                },
                animation: 'pulse',
            }),
            BottomSheet: (_, theme) => ({
                containerStyle: {
                    margin: 0,
                    flex: 1,
                    backgroundColor: theme.colors.backdrop,
                },
                backdropStyle: {
                    backgroundColor: theme.colors.backdrop,
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
            Text: () => ({
                //TODO: It seems to be selecting the wrong font at larger sizes - we may need additional font files
                h1Style: {
                    fontFamily: getFontFamily(false, 500),
                    fontSize: 32,
                    lineHeight: 40,
                },
                h2Style: {
                    fontFamily: getFontFamily(false, 500),
                    fontSize: 25,
                    lineHeight: 24,
                },
                h3Style: {
                    fontFamily: getFontFamily(false, 500),
                    fontSize: 19,
                    lineHeight: 24,
                },
                h4Style: {
                    fontFamily: getFontFamily(false, 500),
                    fontSize: 15,
                    lineHeight: 24,
                },
                style: {
                    fontFamily: getFontFamily(false, 400),
                    fontSize: 13,
                },
            }),
        },
    })
