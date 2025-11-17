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

import MainScreenLayout from '../../layouts/MainScreenLayout';
import PWView from '../../components/common/view/PWView';
import { Text } from '@rneui/themed';
import { useStyles } from './styles';
import PWIcon from '../../components/common/icons/PWIcon';

import PanelButton from '../../components/common/panel-button/PanelButton';
import CardPanel from '../../components/cards/card-panel/CardPanel';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PWTouchableOpacity from '../../components/common/touchable-opacity/PWTouchableOpacity';
import QRScannerView from '../../components/common/qr-scanner/QRScannerView';
import { useState } from 'react';

const MenuScreen = () => {
  const styles = useStyles();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const [scannerVisible, setScannerVisible] = useState<boolean>(false);

  const goToSettings = () => {
    navigation.push('Settings');
  };

  const goToContacts = () => {
    navigation.push('Contacts');
  };

  const closeQRScanner = () => {
    setScannerVisible(false);
  };

  const openQRScanner = () => {
    setScannerVisible(true);
  };

  return (
    <MainScreenLayout>
      <PWView style={styles.iconBar}>
        <PWView style={styles.iconBarColumn} />
        <Text h4 style={styles.iconBarColumn}>
          Menu
        </Text>
        <PWView style={styles.iconBarColumn}>
          <PWTouchableOpacity onPress={openQRScanner}>
            <PWIcon name="camera" variant="primary" />
          </PWTouchableOpacity>
          <PWTouchableOpacity onPress={goToSettings}>
            <PWIcon name="gear" variant="primary" />
          </PWTouchableOpacity>
        </PWView>
      </PWView>

      <PWView style={styles.menuContainer}>
        <CardPanel />
        <PanelButton
          title="NFTs"
          titleWeight="h3"
          leftIcon={<PWIcon name="card-stack" />}
          rightIcon={<PWIcon name="chevron-right" />}
          onPress={() => {}}
        />
        <PanelButton
          title="Buy ALGO"
          titleWeight="h3"
          leftIcon={<PWIcon name="algo" />}
          rightIcon={<PWIcon name="chevron-right" />}
          onPress={() => {}}
        />
        <PanelButton
          title="Receive"
          titleWeight="h3"
          leftIcon={<PWIcon name="inflow" />}
          rightIcon={<PWIcon name="chevron-right" />}
          onPress={() => {}}
        />
        <PanelButton
          title="Contacts"
          titleWeight="h3"
          leftIcon={<PWIcon name="person-menu" />}
          rightIcon={<PWIcon name="chevron-right" />}
          onPress={goToContacts}
        />
      </PWView>
      <QRScannerView
        visible={scannerVisible}
        onSuccess={closeQRScanner}
        animationType="slide"
      >
        <PWTouchableOpacity
          onPress={closeQRScanner}
          style={styles.scannerClose}
        >
          <PWIcon name="cross" variant="white" />
        </PWTouchableOpacity>
      </QRScannerView>
    </MainScreenLayout>
  );
};

export default MenuScreen;
