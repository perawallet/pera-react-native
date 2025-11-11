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

import { Button, Text } from '@rneui/themed';
import MainScreenLayout from '../../layouts/MainScreenLayout';

import { StaticScreenProps } from '@react-navigation/native';
import { Network, Networks, useAppStore, useDevice } from '@perawallet/core';
import { useQueryClient } from '@tanstack/react-query';
import { useStyles } from './styles';
import PeraView from '../../components/common/view/PeraView';
import { Transaction } from '@perawallet/core/src/api/generated/indexer';

type SettingsSubPageScreenProps = StaticScreenProps<{
  title: string;
}>;

const SettingsSubPageScreen = ({ route }: SettingsSubPageScreenProps) => {
  const styles = useStyles();
  const { theme, setTheme, network, setNetwork, deviceIDs, addSignRequest } =
    useAppStore();
  const { registerDevice } = useDevice();
  const queryClient = useQueryClient();

  const toggleTheme = () => {
    if (theme === 'dark' || theme === 'system') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  const toggleNetwork = async () => {
    var newNetwork: Network = Networks.mainnet;
    if (network === Networks.mainnet) {
      newNetwork = Networks.testnet;
    }
    setNetwork(newNetwork);
    if (!deviceIDs.get(newNetwork)) {
      await registerDevice();
    }

    queryClient.invalidateQueries();
  };

  const createSignRequest = async () => {
    try {
      const tx: Transaction = {
        fee: 1000,
        'first-valid': 1000,
        'last-valid': 2000,
        sender: 'HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI',
        'tx-type': 'pay',
      };
      addSignRequest({
        txs: [[tx]],
      });
    } catch (error) {
      console.log('Error', error);
    }
  };

  return (
    <MainScreenLayout>
      <PeraView style={styles.container}>
        <Text>
          This page would hold the settings for {route.params.title}. For now we
          are going to just put some random stuff here for ease of use
        </Text>

        <Button onPress={toggleTheme} title="Toggle Theme" />

        <Button onPress={toggleNetwork} title="Toggle Network" />

        <Button onPress={createSignRequest} title="Simulate Signing Request" />
      </PeraView>
    </MainScreenLayout>
  );
};

export default SettingsSubPageScreen;
