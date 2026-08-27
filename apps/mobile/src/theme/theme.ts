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

/* eslint-disable max-lines */

import { DefaultTheme } from '@react-navigation/native'
import { createTheme } from '@rneui/themed'
import { palette } from './colors'
import { getFontFamily } from './typography'

export const getNavigationTheme = (mode: 'light' | 'dark' = 'light') => ({
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: mode === 'light' ? palette.white : palette.gray[900],
        text: mode === 'light' ? palette.gray[400] : palette.gray[500],
        primary: mode === 'light' ? palette.gray[900] : palette.gray[50],
    },
    dark: mode === 'dark',
})

export const getTheme = (mode: 'light' | 'dark' = 'light') =>
    createTheme({
        lightColors: {
            // @rneui built-ins (kept for internal use)
            primary: palette.gray[800],
            secondary: palette.purple[600],
            background: palette.white,
            black: palette.gray[900],
            white: palette.white,
            grey0: palette.gray[50],
            grey1: palette.gray[100],
            grey2: palette.gray[200],
            grey3: palette.gray[300],
            grey4: palette.gray[400],
            grey5: palette.gray[500],
            success: palette.turquoise[600],
            warning: palette.yellow[400],
            error: palette.salmon[600],
            divider: 'rgba(0,0,0,0.05)',

            // Defaults
            systemElements: palette.black,

            // Text
            textGray: palette.gray[500],
            textGrayLighter: palette.gray[400],
            textMain: palette.gray[900],
            textWhite: palette.white,

            // Layer
            layerGray: palette.gray[200],
            layerGrayLighter: palette.gray[100],
            layerGrayLightest: palette.gray[50],

            // Warning surface — gold #EDB21C tint for the attention callout
            warningSurface: 'rgba(237, 178, 28, 0.06)',

            // Link
            linkPrimary: palette.turquoise[700],
            linkIcon: palette.turquoise[600],

            // Button Primary
            buttonPrimaryBg: palette.gray[800],
            buttonPrimaryText: palette.white,
            buttonPrimaryFocusBg: palette.gray[900],
            buttonPrimaryDisabledBg: palette.gray[100],
            buttonPrimaryDisabledText: palette.gray[500],

            // Button New Primary
            buttonNewPrimaryBg: palette.purple[600],
            buttonNewPrimaryText: palette.white,
            buttonNewPrimaryFocusBg: palette.purple[700],
            buttonNewPrimaryDisabledBg: palette.gray[100],
            buttonNewPrimaryDisabledText: palette.gray[500],

            // Button Secondary
            buttonSecondaryBg: palette.gray[100],
            buttonSecondaryFocusBg: palette.gray[200],
            buttonSecondaryDisabledBg: palette.gray[100],
            buttonSecondaryText: palette.gray[900],
            buttonSecondaryDisabledText: palette.gray[500],

            // Button Ghost
            buttonGhostBg: palette.white,
            buttonGhostFocusBg: palette.gray[100],
            buttonGhostDisabledBg: palette.white,
            buttonGhostText: palette.gray[900],
            buttonGhostDisabledText: palette.gray[500],

            // Button Float
            buttonFloatBg: palette.white,
            buttonFloatFocusBg: palette.gray[100],
            buttonFloatIconMain: palette.gray[900],
            buttonFloatIconLighter: palette.white,

            // Button Helper
            buttonHelperBg: palette.gray[800],
            buttonHelperFocusBg: palette.gray[700],
            buttonHelperDisabledBg: palette.gray[100],
            buttonHelperIcon: palette.white,
            buttonHelperDisabledIcon: palette.gray[500],
            buttonHelperPeraIcon: palette.yellow[400],

            // Button Square
            buttonSquareBg: 'rgba(44, 183, 188, 0.12)',
            buttonSquareFocusBg: 'rgba(44, 183, 188, 0.28)',
            buttonSquareSecondaryBg: palette.gray[100],
            buttonSquareIcon: palette.turquoise[700],
            buttonSquareSecondaryIcon: palette.gray[500],

            // Helpers
            positive: palette.turquoise[700],
            positiveLighter: palette.turquoise[100],
            negative: palette.salmon[600],
            negativeLighter: palette.salmon[100],
            warningText: palette.yellow[600],
            successCheckmark: palette.white,
            heroBg: palette.gray[50],

            // Banner
            bannerContentBg: palette.gray[700],
            bannerBg: palette.turquoise[200],
            bannerButton: 'rgba(255, 255, 255, 0.12)',
            bannerIconBg: 'rgba(31, 142, 157, 0.2)',
            bannerText: palette.turquoise[900],

            // Alert
            alertNegative: palette.salmon[600],
            alertContent: palette.white,
            alertPositive: palette.turquoise[600],

            // Wallet
            wallet1: palette.blush[600],
            wallet1Icon: '#9B1F69',
            wallet2: palette.salmon[500],
            wallet2Icon: '#FFEAC2',
            wallet3: palette.purple[500],
            wallet3Icon: '#FFAEE3',
            wallet3IconGovernor: palette.purple[500],
            wallet4: palette.turquoise[300],
            wallet4Icon: palette.turquoise[800],
            wallet4IconGovernor: palette.turquoise[700],
            wallet5: palette.salmon[400],
            wallet5Icon: '#424F76',

            // Account Icons
            accountIconTurquoiseBg: palette.turquoise[300],
            accountIconPurpleBg: '#8755D5',
            accountIconMagentaBg: '#9B1F69',
            accountIconPinkBg: '#F5B2C6',
            accountIconPeachBg: palette.salmon[100],
            accountIconNeutralBg: palette.gray[100],
            accountIconQuantumBg: palette.turquoise[300],

            // ASA Icons
            trustedIconBg: palette.turquoise[600],
            trustedIconInline: palette.white,
            verifiedIconBg: '#CEEEFE',
            verifiedIconInline: '#0D7FFF',
            verifiedIconSolidBg: '#0D7FFF',
            verifiedIconSolidInline: palette.white,
            suspiciousIconBg: palette.salmon[500],
            suspiciousIconInline: palette.white,

            // ASA Banners
            trustedBannerContent: palette.turquoise[700],
            trustedBannerBg: 'rgba(44, 183, 188, 0.16)',
            verifiedBannerContent: '#0D7FFF',
            verifiedBannerBg: 'rgba(13, 127, 255, 0.16)',
            suspiciousBannerContent: palette.salmon[600],
            suspiciousBannerBg: 'rgba(255, 109, 95, 0.16)',

            // Staking Badges
            stakingLiquidBadge: 'rgba(255,110,92,1)',
            stakingPoolsBadge: 'rgba(31,142,157,1)',
            stakingDelegatedBadge: 'rgba(255,174,227,1)',

            // Toast
            toastBg: 'rgba(24, 24, 27, 0.9)',
            toastTitle: palette.white,
            toastDescription: 'rgba(255, 255, 255, 0.6)',

            // Testnet
            testnetBg: palette.yellow[500],
            testnetText: palette.gray[900],

            // Algo Icon
            algoIconBg: palette.black,
            algoIcon: palette.white,

            // QR Scanner
            qrScannerBg: 'rgba(0, 0, 0, 0.7)',

            // Backdrop
            backdropModalBg: 'rgba(0, 0, 0, 0.64)',

            // Keyboard
            keyboardAccessoryBg: '#D1D5DB',
            keyboardAccessoryLine: '#C7C8CC',

            // Tab Bar
            tabBarButton: palette.gray[800],
            tabBarBg: 'rgba(255, 255, 255, 0.84)',
            tabBarIconActive: palette.gray[900],
            tabBarIconNonActive: palette.gray[400],
            tabBarIconDisabled: 'rgba(161, 161, 170, 0.5)',

            // Bottom Sheet
            bottomSheetLine: '#E6E7E9',

            // Modality
            modalityBg: palette.gray[900],

            // Switches
            switchBg: palette.turquoise[600],
            switchOffBg: palette.gray[400],

            // NFT Icon
            nftIconBg: 'rgba(24, 24, 27, 0.6)',
            nftIcon: palette.white,

            // Dapp
            dappMoonpay: '#7D01FF',
            dappSardine: '#2925CB',
            dappTransak: '#2A6BE6',
            dappBidali: '#6241E2',

            // Legacy (no Figma equivalent)
            favorite: palette.yellow[500],
        },
        darkColors: {
            // @rneui built-ins (kept for internal use)
            primary: palette.yellow[400],
            secondary: palette.purple[400],
            background: palette.gray[900],
            black: palette.white,
            white: palette.gray[100],
            grey0: palette.gray[800],
            grey1: palette.gray[800],
            grey2: palette.gray[700],
            grey3: palette.gray[700],
            grey4: palette.gray[500],
            grey5: palette.gray[500],
            success: palette.yellow[400],
            warning: '#b66129',
            error: palette.salmon[500],
            divider: 'rgba(255, 255, 255, 0.05)',

            // Defaults
            systemElements: palette.white,

            // Text
            textGray: palette.gray[400],
            textGrayLighter: palette.gray[500],
            textMain: palette.gray[100],
            textWhite: palette.white,

            // Layer
            layerGray: palette.gray[700],
            layerGrayLighter: palette.gray[800],
            layerGrayLightest: palette.gray[800],

            // Warning surface — gold #EDB21C tint for the attention callout
            warningSurface: 'rgba(237, 178, 28, 0.1)',

            // Link
            linkPrimary: palette.yellow[400],
            linkIcon: palette.gray[100],

            // Button Primary
            buttonPrimaryBg: palette.yellow[400],
            buttonPrimaryText: palette.gray[900],
            buttonPrimaryFocusBg: palette.yellow[500],
            buttonPrimaryDisabledBg: palette.gray[800],
            buttonPrimaryDisabledText: palette.gray[500],

            // Button New Primary
            buttonNewPrimaryBg: palette.purple[400],
            buttonNewPrimaryText: palette.gray[900],
            buttonNewPrimaryFocusBg: palette.purple[500],
            buttonNewPrimaryDisabledBg: palette.gray[800],
            buttonNewPrimaryDisabledText: palette.gray[500],

            // Button Secondary
            buttonSecondaryBg: palette.gray[800],
            buttonSecondaryFocusBg: palette.gray[900],
            buttonSecondaryDisabledBg: palette.gray[800],
            buttonSecondaryText: palette.gray[100],
            buttonSecondaryDisabledText: palette.gray[500],

            // Button Ghost
            buttonGhostBg: palette.gray[900],
            buttonGhostFocusBg: palette.gray[800],
            buttonGhostDisabledBg: palette.gray[900],
            buttonGhostText: palette.gray[100],
            buttonGhostDisabledText: palette.gray[500],

            // Button Float
            buttonFloatBg: palette.white,
            buttonFloatFocusBg: palette.gray[100],
            buttonFloatIconMain: palette.gray[900],
            buttonFloatIconLighter: '#17171A',

            // Button Helper
            buttonHelperBg: 'rgba(255, 238, 85, 0.1)',
            buttonHelperFocusBg: 'rgba(255, 238, 85, 0.2)',
            buttonHelperDisabledBg: 'rgba(255, 238, 85, 0.05)',
            buttonHelperIcon: palette.yellow[400],
            buttonHelperDisabledIcon: 'rgba(255, 238, 85, 0.5)',
            buttonHelperPeraIcon: palette.yellow[400],

            // Button Square
            buttonSquareBg: 'rgba(44, 183, 188, 0.12)',
            buttonSquareFocusBg: 'rgba(44, 183, 188, 0.28)',
            buttonSquareSecondaryBg: palette.gray[800],
            buttonSquareIcon: palette.turquoise[600],
            buttonSquareSecondaryIcon: palette.gray[500],

            // Helpers
            positive: palette.turquoise[600],
            positiveLighter: 'rgba(44, 183, 188, 0.12)',
            negative: palette.salmon[500],
            negativeLighter: 'rgba(255, 109, 95, 0.12)',
            warningText: palette.yellow[600],
            successCheckmark: palette.gray[900],
            heroBg: '#1D1D21',

            // Banner
            bannerContentBg: palette.gray[700],
            bannerBg: palette.turquoise[200],
            bannerButton: 'rgba(255, 255, 255, 0.12)',
            bannerIconBg: 'rgba(31, 142, 157, 0.2)',
            bannerText: palette.turquoise[900],

            // Alert
            alertNegative: palette.salmon[500],
            alertContent: palette.gray[900],
            alertPositive: palette.turquoise[600],

            // Wallet
            wallet1: palette.blush[600],
            wallet1Icon: '#9B1F69',
            wallet2: palette.salmon[500],
            wallet2Icon: '#FFEAC2',
            wallet3: palette.purple[500],
            wallet3Icon: '#FFAEE3',
            wallet3IconGovernor: palette.purple[500],
            wallet4: palette.turquoise[300],
            wallet4Icon: palette.turquoise[800],
            wallet4IconGovernor: palette.turquoise[600],
            wallet5: palette.salmon[400],
            wallet5Icon: '#424F76',

            // Account Icons
            accountIconTurquoiseBg: palette.turquoise[300],
            accountIconPurpleBg: '#8755D5',
            accountIconMagentaBg: '#9B1F69',
            accountIconPinkBg: '#F5B2C6',
            accountIconPeachBg: palette.salmon[100],
            accountIconNeutralBg: palette.gray[100],
            accountIconQuantumBg: palette.turquoise[300],

            // ASA Icons
            trustedIconBg: palette.turquoise[600],
            trustedIconInline: palette.gray[900],
            verifiedIconBg: '#48A7FE',
            verifiedIconInline: palette.gray[900],
            verifiedIconSolidBg: '#48A7FE',
            verifiedIconSolidInline: palette.gray[900],
            suspiciousIconBg: palette.salmon[500],
            suspiciousIconInline: palette.gray[900],

            // ASA Banners
            trustedBannerContent: palette.turquoise[600],
            trustedBannerBg: 'rgba(44, 183, 188, 0.16)',
            verifiedBannerContent: '#48A7FE',
            verifiedBannerBg: 'rgba(13, 127, 255, 0.16)',
            suspiciousBannerContent: palette.salmon[500],
            suspiciousBannerBg: 'rgba(255, 109, 95, 0.16)',

            // Staking Badges
            stakingLiquidBadge: 'rgba(255,110,92,1)',
            stakingPoolsBadge: 'rgba(31,142,157,1)',
            stakingDelegatedBadge: 'rgba(255,174,227,1)',

            // Toast
            toastBg: 'rgba(82, 82, 91, 0.92)',
            toastTitle: palette.white,
            toastDescription: 'rgba(255, 255, 255, 0.6)',

            // Testnet
            testnetBg: palette.yellow[500],
            testnetText: palette.gray[900],

            // Algo Icon
            algoIconBg: palette.black,
            algoIcon: palette.white,

            // QR Scanner
            qrScannerBg: 'rgba(0, 0, 0, 0.7)',

            // Backdrop
            backdropModalBg: 'rgba(0, 0, 0, 0.86)',

            // Keyboard
            keyboardAccessoryBg: '#292929',
            keyboardAccessoryLine: '#393939',

            // Tab Bar
            tabBarButton: palette.gray[800],
            tabBarBg: 'rgba(24, 24, 27, 0.84)',
            tabBarIconActive: palette.gray[50],
            tabBarIconNonActive: palette.gray[500],
            tabBarIconDisabled: 'rgba(113, 113, 122, 0.5)',

            // Bottom Sheet
            bottomSheetLine: palette.gray[700],

            // Modality
            modalityBg: palette.black,

            // Switches
            switchBg: palette.yellow[500],
            switchOffBg: palette.gray[800],

            // NFT Icon
            nftIconBg: 'rgba(24, 24, 27, 0.6)',
            nftIcon: palette.white,

            // Dapp
            dappMoonpay: '#7D01FF',
            dappSardine: '#2925CB',
            dappTransak: '#2A6BE6',
            dappBidali: '#6241E2',

            // Legacy (no Figma equivalent)
            favorite: palette.yellow[500],
        },
        mode,
        spacing: {
            xxs: 2,
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
            // must exceed RNW Modal portals at 9999
            toast: 10_000,
        },
        borderRadius: {
            none: 0,
            xs: 4,
            sm: 8,
            md: 12,
            lg: 16,
            xl: 24,
            full: 999,
        },
        borders: {
            none: 0,
            sm: 1,
            md: 2,
            lg: 4,
        },
        shadows: {
            sm: {
                shadowColor: palette.black,
                shadowOffset: {
                    width: 0,
                    height: 2,
                },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
            },
            md: {
                shadowColor: palette.black,
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
        },
    })
