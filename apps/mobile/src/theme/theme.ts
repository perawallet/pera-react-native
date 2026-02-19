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

/* eslint-disable max-lines */

import { DefaultTheme } from '@react-navigation/native'
import { createTheme } from '@rneui/themed'
import { fontFamilies } from '@constants/fonts'

export const getFontFamily = (weight: 300 | 400 | 500 | 600 | 700) => {
    return fontFamilies.DMSANS[weight]
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
            // @rneui built-ins (kept for internal use)
            primary: '#27272A',
            secondary: '#6B46FE',
            background: '#FFFFFF',
            black: '#18181B',
            white: '#FFFFFF',
            grey0: '#FAFAFA',
            grey1: '#F1F1F2',
            grey2: '#E4E4E7',
            grey3: '#D4D4D8',
            grey4: '#A1A1AA',
            grey5: '#71717A',
            success: '#2CB7BC',
            warning: '#FFEE55',
            error: '#DB4645',
            divider: 'rgba(0,0,0,0.05)',

            // Defaults
            systemElements: '#000000',

            // Text
            textGray: '#71717A',
            textGrayLighter: '#A1A1AA',
            textMain: '#18181B',
            textWhite: '#FFFFFF',

            // Layer
            layerGray: '#E4E4E7',
            layerGrayLighter: '#F1F1F2',
            layerGrayLightest: '#FAFAFA',

            // Link
            linkPrimary: '#1F8E9D',
            linkIcon: '#2CB7BC',

            // Button Primary
            buttonPrimaryBg: '#27272A',
            buttonPrimaryText: '#FFFFFF',
            buttonPrimaryFocusBg: '#18181B',
            buttonPrimaryDisabledBg: '#F1F1F2',
            buttonPrimaryDisabledText: '#71717A',

            // Button Secondary
            buttonSecondaryBg: '#F1F1F2',
            buttonSecondaryFocusBg: '#E4E4E7',
            buttonSecondaryDisabledBg: '#F1F1F2',
            buttonSecondaryText: '#18181B',
            buttonSecondaryDisabledText: '#71717A',

            // Button Ghost
            buttonGhostBg: '#FFFFFF',
            buttonGhostFocusBg: '#F1F1F2',
            buttonGhostDisabledBg: '#FFFFFF',
            buttonGhostText: '#18181B',
            buttonGhostDisabledText: '#71717A',

            // Button Float
            buttonFloatBg: '#FFFFFF',
            buttonFloatFocusBg: '#F1F1F2',
            buttonFloatIconMain: '#18181B',
            buttonFloatIconLighter: '#FFFFFF',

            // Button Helper
            buttonHelperBg: '#27272A',
            buttonHelperFocusBg: '#3F3F46',
            buttonHelperDisabledBg: '#F1F1F2',
            buttonHelperIcon: '#FFFFFF',
            buttonHelperDisabledIcon: '#71717A',
            buttonHelperPeraIcon: '#FFEE55',

            // Button Square
            buttonSquareBg: 'rgba(44, 183, 188, 0.12)',
            buttonSquareFocusBg: 'rgba(44, 183, 188, 0.28)',
            buttonSquareSecondaryBg: '#F1F1F2',
            buttonSquareIcon: '#1F8E9D',
            buttonSquareSecondaryIcon: '#71717A',

            // Helpers
            positive: '#1F8E9D',
            positiveLighter: '#D8FDEE',
            negative: '#DB4645',
            negativeLighter: '#FFECDF',
            successCheckmark: '#FFFFFF',
            heroBg: '#FAFAFA',

            // Banner
            bannerBg: '#2CB7BC',
            bannerButton: 'rgba(255, 255, 255, 0.12)',
            bannerIconBg: 'rgba(31, 142, 157, 0.2)',
            bannerText: '#FFFFFF',

            // Alert
            alertNegative: '#DB4645',
            alertContent: '#FFFFFF',
            alertPositive: '#2CB7BC',

            // Wallet
            wallet1: '#F5B2C6',
            wallet1Icon: '#9B1F69',
            wallet2: '#FF6E5C',
            wallet2Icon: '#FFEAC2',
            wallet3: '#8755D5',
            wallet3Icon: '#FFAEE3',
            wallet3IconGovernor: '#8755D5',
            wallet4: '#8BF4DB',
            wallet4Icon: '#136880',
            wallet4IconGovernor: '#1F8E9D',
            wallet5: '#FF9B86',
            wallet5Icon: '#424F76',

            // ASA Icons
            trustedIconBg: '#2CB7BC',
            trustedIconInline: '#FFFFFF',
            verifiedIconBg: '#CEEEFE',
            verifiedIconInline: '#0D7FFF',
            verifiedIconSolidBg: '#0D7FFF',
            verifiedIconSolidInline: '#FFFFFF',
            suspiciousIconBg: '#FF6D5F',
            suspiciousIconInline: '#FFFFFF',

            // ASA Banners
            trustedBannerContent: '#1F8E9D',
            trustedBannerBg: 'rgba(44, 183, 188, 0.16)',
            verifiedBannerContent: '#0D7FFF',
            verifiedBannerBg: 'rgba(13, 127, 255, 0.16)',
            suspiciousBannerContent: '#DB4645',
            suspiciousBannerBg: 'rgba(255, 109, 95, 0.16)',

            // Toast
            toastBg: 'rgba(24, 24, 27, 0.9)',
            toastTitle: '#FFFFFF',
            toastDescription: 'rgba(255, 255, 255, 0.6)',

            // Testnet
            testnetBg: '#EDB21C',
            testnetText: '#18181B',

            // Algo Icon
            algoIconBg: '#000000',
            algoIcon: '#FFFFFF',

            // QR Scanner
            qrScannerBg: 'rgba(0, 0, 0, 0.7)',

            // Backdrop
            backdropModalBg: 'rgba(0, 0, 0, 0.64)',

            // Keyboard
            keyboardAccessoryBg: '#D1D5DB',
            keyboardAccessoryLine: '#C7C8CC',

            // Tab Bar
            tabBarButton: '#27272A',
            tabBarBg: 'rgba(255, 255, 255, 0.84)',
            tabBarIconActive: '#18181B',
            tabBarIconNonActive: '#A1A1AA',
            tabBarIconDisabled: 'rgba(161, 161, 170, 0.5)',

            // Bottom Sheet
            bottomSheetLine: '#E6E7E9',

            // Modality
            modalityBg: '#18181B',

            // Switches
            switchBg: '#2CB7BC',
            switchOffBg: '#A1A1AA',

            // NFT Icon
            nftIconBg: 'rgba(24, 24, 27, 0.6)',
            nftIcon: '#FFFFFF',

            // Dapp
            dappMoonpay: '#7D01FF',
            dappSardine: '#2925CB',
            dappTransak: '#2A6BE6',
            dappBidali: '#6241E2',

            // Legacy (no Figma equivalent)
            favorite: '#EDB21C',
        },
        darkColors: {
            // @rneui built-ins (kept for internal use)
            primary: '#FFEE55',
            secondary: '#AC8EFF',
            background: '#18181B',
            black: '#FFFFFF',
            white: '#F1F1F2',
            grey0: '#27272A',
            grey1: '#27272A',
            grey2: '#3F3F46',
            grey3: '#3F3F46',
            grey4: '#71717A',
            grey5: '#71717A',
            success: '#FFEE55',
            warning: '#b66129',
            error: '#FF6D5F',
            divider: 'rgba(255, 255, 255, 0.05)',

            // Defaults
            systemElements: '#FFFFFF',

            // Text
            textGray: '#A1A1AA',
            textGrayLighter: '#71717A',
            textMain: '#F1F1F2',
            textWhite: '#FFFFFF',

            // Layer
            layerGray: '#3F3F46',
            layerGrayLighter: '#27272A',
            layerGrayLightest: '#27272A',

            // Link
            linkPrimary: '#FFEE55',
            linkIcon: '#F1F1F2',

            // Button Primary
            buttonPrimaryBg: '#FFEE55',
            buttonPrimaryText: '#18181B',
            buttonPrimaryFocusBg: '#EDB21C',
            buttonPrimaryDisabledBg: '#27272A',
            buttonPrimaryDisabledText: '#71717A',

            // Button Secondary
            buttonSecondaryBg: '#27272A',
            buttonSecondaryFocusBg: '#18181B',
            buttonSecondaryDisabledBg: '#27272A',
            buttonSecondaryText: '#F1F1F2',
            buttonSecondaryDisabledText: '#71717A',

            // Button Ghost
            buttonGhostBg: '#18181B',
            buttonGhostFocusBg: '#27272A',
            buttonGhostDisabledBg: '#18181B',
            buttonGhostText: '#F1F1F2',
            buttonGhostDisabledText: '#71717A',

            // Button Float
            buttonFloatBg: '#FFFFFF',
            buttonFloatFocusBg: '#F1F1F2',
            buttonFloatIconMain: '#18181B',
            buttonFloatIconLighter: '#17171A',

            // Button Helper
            buttonHelperBg: 'rgba(255, 238, 85, 0.1)',
            buttonHelperFocusBg: 'rgba(255, 238, 85, 0.2)',
            buttonHelperDisabledBg: 'rgba(255, 238, 85, 0.05)',
            buttonHelperIcon: '#FFEE55',
            buttonHelperDisabledIcon: 'rgba(255, 238, 85, 0.5)',
            buttonHelperPeraIcon: '#FFEE55',

            // Button Square
            buttonSquareBg: 'rgba(44, 183, 188, 0.12)',
            buttonSquareFocusBg: 'rgba(44, 183, 188, 0.28)',
            buttonSquareSecondaryBg: '#27272A',
            buttonSquareIcon: '#2CB7BC',
            buttonSquareSecondaryIcon: '#71717A',

            // Helpers
            positive: '#2CB7BC',
            positiveLighter: 'rgba(44, 183, 188, 0.12)',
            negative: '#FF6D5F',
            negativeLighter: 'rgba(255, 109, 95, 0.12)',
            successCheckmark: '#18181B',
            heroBg: '#1D1D21',

            // Banner
            bannerBg: '#27272A',
            bannerButton: 'rgba(24, 24, 27, 0.12)',
            bannerIconBg: 'rgba(24, 24, 27, 0.2)',
            bannerText: '#FFFFFF',

            // Alert
            alertNegative: '#FF6D5F',
            alertContent: '#18181B',
            alertPositive: '#2CB7BC',

            // Wallet
            wallet1: '#F5B2C6',
            wallet1Icon: '#9B1F69',
            wallet2: '#FF6E5C',
            wallet2Icon: '#FFEAC2',
            wallet3: '#8755D5',
            wallet3Icon: '#FFAEE3',
            wallet3IconGovernor: '#8755D5',
            wallet4: '#8BF4DB',
            wallet4Icon: '#136880',
            wallet4IconGovernor: '#2CB7BC',
            wallet5: '#FF9B86',
            wallet5Icon: '#424F76',

            // ASA Icons
            trustedIconBg: '#2CB7BC',
            trustedIconInline: '#18181B',
            verifiedIconBg: '#48A7FE',
            verifiedIconInline: '#18181B',
            verifiedIconSolidBg: '#48A7FE',
            verifiedIconSolidInline: '#18181B',
            suspiciousIconBg: '#FF6D5F',
            suspiciousIconInline: '#18181B',

            // ASA Banners
            trustedBannerContent: '#2CB7BC',
            trustedBannerBg: 'rgba(44, 183, 188, 0.16)',
            verifiedBannerContent: '#48A7FE',
            verifiedBannerBg: 'rgba(13, 127, 255, 0.16)',
            suspiciousBannerContent: '#FF6D5F',
            suspiciousBannerBg: 'rgba(255, 109, 95, 0.16)',

            // Toast
            toastBg: 'rgba(82, 82, 91, 0.92)',
            toastTitle: '#FFFFFF',
            toastDescription: 'rgba(255, 255, 255, 0.6)',

            // Testnet
            testnetBg: '#EDB21C',
            testnetText: '#18181B',

            // Algo Icon
            algoIconBg: '#000000',
            algoIcon: '#FFFFFF',

            // QR Scanner
            qrScannerBg: 'rgba(0, 0, 0, 0.7)',

            // Backdrop
            backdropModalBg: 'rgba(0, 0, 0, 0.86)',

            // Keyboard
            keyboardAccessoryBg: '#292929',
            keyboardAccessoryLine: '#393939',

            // Tab Bar
            tabBarButton: '#27272A',
            tabBarBg: 'rgba(24, 24, 27, 0.84)',
            tabBarIconActive: '#FAFAFA',
            tabBarIconNonActive: '#71717A',
            tabBarIconDisabled: 'rgba(113, 113, 122, 0.5)',

            // Bottom Sheet
            bottomSheetLine: '#3F3F46',

            // Modality
            modalityBg: '#000000',

            // Switches
            switchBg: '#EDB21C',
            switchOffBg: '#27272A',

            // NFT Icon
            nftIconBg: 'rgba(24, 24, 27, 0.6)',
            nftIcon: '#FFFFFF',

            // Dapp
            dappMoonpay: '#7D01FF',
            dappSardine: '#2925CB',
            dappTransak: '#2A6BE6',
            dappBidali: '#6241E2',

            // Legacy (no Figma equivalent)
            favorite: '#EDB21C',
        },
        mode,
        spacing: {
            xs: 4,
            sm: 8,
            md: 12,
            lg: 16,
            xl: 24,
            xxl: 36,
            '3xl': 48,
            '4xl': 72,
            '5xl': 96,
        },
        zIndex: {
            base: 0,
            layer1: 10,
            layer2: 20,
            overlay1: 1000,
            max: 9999,
        },
        borders: {
            none: 0,
            sm: 1,
            md: 2,
        },
        shadows: {
            sm: {
                shadowColor: '#000000',
                shadowOffset: {
                    width: 0,
                    height: 2,
                },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
            },
            md: {
                shadowColor: '#000000',
                shadowOffset: {
                    width: 0,
                    height: 2,
                },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 4,
            },
        },
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
            Text: () => ({
                //TODO: It seems to be selecting the wrong font at larger sizes - we may need additional font files
                h1Style: {
                    fontFamily: getFontFamily(500),
                    fontSize: 32,
                    lineHeight: 40,
                },
                h2Style: {
                    fontFamily: getFontFamily(500),
                    fontSize: 25,
                    lineHeight: 24,
                },
                h3Style: {
                    fontFamily: getFontFamily(500),
                    fontSize: 19,
                    lineHeight: 24,
                },
                h4Style: {
                    fontFamily: getFontFamily(500),
                    fontSize: 15,
                    lineHeight: 24,
                },
                style: {
                    fontFamily: getFontFamily(400),
                    fontSize: 13,
                    lineHeight: 24,
                },
            }),
        },
    })
