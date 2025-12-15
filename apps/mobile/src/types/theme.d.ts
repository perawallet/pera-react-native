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

import '@rneui/themed'

declare module '@rneui/themed' {
    export interface Colors {
        //Layer colors
        layerGray: string
        layerGrayLight: string
        layerGrayLighter: string
        layerGrayLightest: string

        //Text colors
        textGray: string
        textGrayLighter: string
        textMain: string
        textSonicSilver: string
        textWhite: string

        //Button colors
        buttonPrimaryBg: string
        buttonPrimaryText: string

        buttonHelperBg: string
        buttonHelperText: string

        buttonSquareBg: string
        buttonSquareText: string

        //Helper colors
        helperPositive: string
        helperNegative: string
        helperGray200: string

        //ASA
        asaTrustedText: string
        asaTrustedBg: string
        asaVerifiedText: string
        asaVerifiedBg: string
        asaSuspiciousText: string
        asaSuspiciousBg: string

        backdrop: string

        //Links
        linkPrimary: string

        // Tab Bar
        tabIconActive: string
        tabIconPassive: string

        //Backgrounds
        testnetBackground: string
    }
}
