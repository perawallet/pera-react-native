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

import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import useToast from './toast'

type LinkSource = 'qr' | 'deeplink'

export const useDeepLink = () => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { showToast } = useToast()

    const isValidDeepLink = (_: string, __: LinkSource) => {
        //TODO implement fully
        return true
    }

    const handleDeepLink = async (
        url: string,
        replaceCurrentScreen: boolean = false,
        source: LinkSource,
        onError?: () => void,
        onSuccess?: () => void,
    ) => {
        if (isValidDeepLink(url, source)) {
            //TODO implement fully
            const destination = 'TabBar'
            const params = {
                screen: 'Home',
            }

            if (replaceCurrentScreen) {
                navigation.replace(destination, params)
            } else {
                navigation.navigate(destination, params)
            }

            showToast({
                title: 'Not Implemented Yet',
                body: "Deeplinking hasn't been implemented fully yet",
                type: 'info',
            })
            onSuccess?.()
        } else {
            showToast({
                title: 'Invalid Link',
                body: 'The detected link does not appear to be valid',
                type: 'error',
            })
            onError?.()
        }
    }

    return {
        isValidDeepLink,
        handleDeepLink,
    }
}
