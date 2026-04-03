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

export const useStyles = makeStyles(theme => ({
    container: {
        width: '100%',
        aspectRatio: 1,
    },
    image: {
        margin: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    carouselItem: {
        width: '100%',
        aspectRatio: 1,
    },
    indicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        marginTop: theme.spacing.sm,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.colors.layerGrayLighter,
    },
    dotActive: {
        backgroundColor: theme.colors.textMain,
    },
}))
