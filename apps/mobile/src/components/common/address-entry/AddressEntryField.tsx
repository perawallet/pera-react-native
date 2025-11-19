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

import { TouchableOpacity } from 'react-native'
import PWView from '../view/PWView'
import { useStyles } from './styles'

import QRScannerView from '../qr-scanner/QRScannerView'
import { useState } from 'react'
import { Input, InputProps } from '@rneui/themed'
import PWIcon from '../icons/PWIcon'

export type AddressEntryFieldProps = {
    allowQRCode?: boolean
} & InputProps

const AddressEntryField = ({
    allowQRCode,
    ...rest
}: AddressEntryFieldProps) => {
    const styles = useStyles()
    const [scannerVisible, setScannerVisible] = useState(false)

    const addressScanned = (_: string) => {
        //TODO parse URL and extract address
        setScannerVisible(false)
    }

    const showScanner = () => {
        setScannerVisible(true)
    }

    const hideScanner = () => {
        setScannerVisible(false)
    }

    return (
        <PWView>
            <Input
                {...rest}
                rightIcon={
                    allowQRCode && (
                        <PWIcon
                            name='camera'
                            onPress={showScanner}
                        />
                    )
                }
            />
            {scannerVisible && (
                <QRScannerView
                    onSuccess={addressScanned}
                    animationType='slide'
                    title='Scan QR Code'
                    visible={scannerVisible}
                >
                    <TouchableOpacity
                        onPress={hideScanner}
                        style={styles.closeIconButton}
                    >
                        <PWIcon
                            name='cross'
                            variant='white'
                        />
                    </TouchableOpacity>
                </QRScannerView>
            )}
        </PWView>
    )
}

export default AddressEntryField
