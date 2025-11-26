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
import { PropsWithChildren } from 'react'

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
    return {
        container: {
            flexDirection: 'row',
            gap: theme.spacing.lg,
            alignItems: 'flex-start',
        },
        messageBox: {},
        timeText: {
            color: theme.colors.textGray,
            fontSize: 11,
        },
        iconContainerNoBorder: {
            width: theme.spacing.xl * 1.65,
            height: theme.spacing.xl * 1.65,
            borderRadius: theme.spacing.xl,
            alignItems: 'center',
            justifyContent: 'center',
        },
        iconContainer: {
            width: theme.spacing.xl * 1.65,
            height: theme.spacing.xl * 1.65,
            borderRadius: theme.spacing.xl,
            borderWidth: 1,
            borderColor: theme.colors.layerGrayLighter,
            alignItems: 'center',
            justifyContent: 'center',
        },
        image: {
            aspectRatio: 1,
            width: '100%',
        },
        imageCircle: {
            aspectRatio: 1,
            width: '100%',
            borderRadius: '50%',
        },
    }
})
