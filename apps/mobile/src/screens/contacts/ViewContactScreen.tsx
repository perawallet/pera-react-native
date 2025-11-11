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

import EmptyView from '../../components/common/empty-view/EmptyView';
import PeraView from '../../components/common/view/PeraView';
import { truncateAlgorandAddress, useAppStore } from '@perawallet/core';
import { Text, useTheme } from '@rneui/themed';
import { useStyles } from './ViewContactScreen.styles';
import ContactAvatar from '../../components/common/contact-avatar/ContactAvatar';
import CopyIcon from '../../../assets/icons/copy.svg';
import useToast from '../../hooks/toast';
import Clipboard from '@react-native-clipboard/clipboard';

const LONG_ADDRESS_FORMAT = 20;

const ViewContactScreen = () => {
  const { selectedContact } = useAppStore();
  const styles = useStyles();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const copyAddress = () => {
    Clipboard.setString(selectedContact?.address || '');
    showToast({
      title: '',
      body: 'Address copied to clipboard',
      type: 'info',
    });
  };

  if (!selectedContact) {
    return (
      <EmptyView
        title="No contact found"
        body="Something appears to have gone wrong.  Couldn't find the contact specified"
      />
    );
  }

  return (
    <PeraView style={styles.container}>
      <PeraView style={styles.avatar}>
        <ContactAvatar contact={selectedContact} size="large" />
      </PeraView>
      <PeraView>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{selectedContact.name}</Text>
      </PeraView>
      <PeraView>
        <Text style={styles.label}>Address</Text>
        <PeraView style={styles.addressValueContainer}>
          <Text style={styles.value}>
            {truncateAlgorandAddress(
              selectedContact.address,
              LONG_ADDRESS_FORMAT,
            )}
          </Text>
          <CopyIcon
            onPress={copyAddress}
            color={theme.colors.textGray}
            width={theme.spacing.lg}
            height={theme.spacing.lg}
          />
        </PeraView>
      </PeraView>
    </PeraView>
  );
};

export default ViewContactScreen;
