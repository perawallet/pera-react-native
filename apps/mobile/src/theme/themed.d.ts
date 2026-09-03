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

import '@rneui/themed'

declare module '@rneui/themed' {
    export interface Colors {
        // Defaults
        systemElements: string

        // Text
        textGray: string
        textGrayLighter: string
        textMain: string
        textWhite: string

        // Layer
        layerGray: string
        layerGrayLighter: string
        layerGrayLightest: string

        // Drawer overlay (alpha baked in — see the palettes for why it inverts)
        drawerScrim: string

        // Warning surface (gold attention callout)
        warningSurface: string

        // Link
        linkPrimary: string
        linkIcon: string

        // Button Primary
        buttonPrimaryBg: string
        buttonPrimaryText: string
        buttonPrimaryFocusBg: string
        buttonPrimaryDisabledBg: string
        buttonPrimaryDisabledText: string

        //Button New Primary
        buttonNewPrimaryBg: string
        buttonNewPrimaryText: string
        buttonNewPrimaryFocusBg: string
        buttonNewPrimaryDisabledBg: string
        buttonNewPrimaryDisabledText: string

        // Button Secondary
        buttonSecondaryBg: string
        buttonSecondaryFocusBg: string
        buttonSecondaryDisabledBg: string
        buttonSecondaryText: string
        buttonSecondaryDisabledText: string

        // Button Ghost
        buttonGhostBg: string
        buttonGhostFocusBg: string
        buttonGhostDisabledBg: string
        buttonGhostText: string
        buttonGhostDisabledText: string

        // Button Float
        buttonFloatBg: string
        buttonFloatFocusBg: string
        buttonFloatIconMain: string
        buttonFloatIconLighter: string

        // Button Helper
        buttonHelperBg: string
        buttonHelperFocusBg: string
        buttonHelperDisabledBg: string
        buttonHelperIcon: string
        buttonHelperDisabledIcon: string
        buttonHelperPeraIcon: string

        // Button Square
        buttonSquareBg: string
        buttonSquareFocusBg: string
        buttonSquareSecondaryBg: string
        buttonSquareIcon: string
        buttonSquareSecondaryIcon: string

        // Helpers
        positive: string
        positiveLighter: string
        negative: string
        negativeLighter: string
        successCheckmark: string
        heroBg: string

        // Banner
        bannerBg: string
        bannerButton: string
        bannerIconBg: string
        bannerText: string

        // Alert
        alertNegative: string
        alertContent: string
        alertPositive: string

        // Wallet
        wallet1: string
        wallet1Icon: string
        wallet2: string
        wallet2Icon: string
        wallet3: string
        wallet3Icon: string
        wallet3IconGovernor: string
        wallet4: string
        wallet4Icon: string
        wallet4IconGovernor: string
        wallet5: string
        wallet5Icon: string

        // Account Icons
        accountIconTurquoiseBg: string
        accountIconPurpleBg: string
        accountIconMagentaBg: string
        accountIconPinkBg: string
        accountIconPeachBg: string
        accountIconNeutralBg: string
        accountIconQuantumBg: string

        // ASA Icons
        trustedIconBg: string
        trustedIconInline: string
        verifiedIconBg: string
        verifiedIconInline: string
        verifiedIconSolidBg: string
        verifiedIconSolidInline: string
        suspiciousIconBg: string
        suspiciousIconInline: string

        // ASA Banners
        trustedBannerBg: string
        trustedBannerContent: string
        verifiedBannerBg: string
        verifiedBannerContent: string
        suspiciousBannerBg: string
        suspiciousBannerContent: string

        // Staking Badges
        stakingLiquidBadge: string
        stakingPoolsBadge: string
        stakingDelegatedBadge: string

        // Toast
        toastBg: string
        toastTitle: string
        toastDescription: string

        // Testnet
        testnetBg: string
        testnetText: string

        // Algo Icon
        algoIconBg: string
        algoIcon: string

        // QR Scanner
        qrScannerBg: string

        // Backdrop
        backdropModalBg: string

        // Keyboard
        keyboardAccessoryBg: string
        keyboardAccessoryLine: string

        // Tab Bar
        tabBarButton: string
        tabBarBg: string
        tabBarIconActive: string
        tabBarIconNonActive: string
        tabBarIconDisabled: string

        // Bottom Sheet
        bottomSheetLine: string

        // Modality
        modalityBg: string

        // Switches
        switchBg: string
        switchOffBg: string

        // NFT Icon
        nftIconBg: string
        nftIcon: string

        // Dapp
        dappMoonpay: string
        dappSardine: string
        dappTransak: string
        dappBidali: string

        // Legacy (no Figma equivalent, kept for compatibility)
        favorite: string
    }

    export interface ThemeSpacing {
        xxs: number
        xxl: number
        '3xl': number
        '4xl': number
        '5xl': number
    }

    export interface Theme {
        zIndex: {
            base: number
            layer1: number
            layer2: number
            overlay1: number
            max: number
            toast: number
        }
        borderRadius: {
            none: number
            xs: number
            sm: number
            md: number
            lg: number
            xl: number
            full: number
        }
        borders: {
            none: number
            sm: number
            md: number
            lg: number
        }
        shadows: {
            sm: {
                shadowColor: string
                shadowOffset: { width: number; height: number }
                shadowOpacity: number
                shadowRadius: number
                elevation: number
            }
            md: {
                shadowColor: string
                shadowOffset: { width: number; height: number }
                shadowOpacity: number
                shadowRadius: number
                elevation: number
            }
        }
    }
}
