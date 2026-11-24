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

import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    // flexShrink: 0 so a long name beside it wraps instead of squeezing the image.
    image: {
        width: theme.spacing['3xl'],
        height: theme.spacing['3xl'],
        flexShrink: 0,
        borderRadius: theme.borderRadius.sm,
    },
    placeholder: {
        width: theme.spacing['3xl'],
        height: theme.spacing['3xl'],
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.sm,
    },
}))
