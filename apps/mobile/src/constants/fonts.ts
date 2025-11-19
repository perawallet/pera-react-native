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

import { isIOS } from '../platform/utils'

export const fontFamilies = {
    DMSANS: {
        300: isIOS() ? 'DMSans-Light' : 'DMSansLight',
        400: isIOS() ? 'DMSans-Regular' : 'DMSansRegular',
        500: isIOS() ? 'DMSans-Medium' : 'DMSansMedium',
        600: isIOS() ? 'DMSans-SemiBold' : 'DMSansSemiBold',
        700: isIOS() ? 'DMSans-Bold' : 'DMSansBold',
    },
    DMMONO: {
        //We duplicate some here because we only use regular and medium
        300: isIOS() ? 'DMMono-Regular' : 'DMMonoRegular',
        400: isIOS() ? 'DMMono-Regular' : 'DMMonoRegular',
        500: isIOS() ? 'DMMono-Medium' : 'DMMonoRegular',
        600: isIOS() ? 'DMMono-Medium' : 'DMMonoRegular',
        700: isIOS() ? 'DMMono-Medium' : 'DMMonoRegular',
    },
}
