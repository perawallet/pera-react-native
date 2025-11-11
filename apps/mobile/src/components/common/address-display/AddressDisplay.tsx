import { Text, TextProps, useTheme } from '@rneui/themed';
import PWView, { PWViewProps } from '../view/PWView';
import { useStyles } from './styles';
import { truncateAlgorandAddress, useContacts } from '@perawallet/core';
import useToast from '../../../hooks/toast';
import Clipboard from '@react-native-clipboard/clipboard';

import CopyIcon from '../../../../assets/icons/copy.svg';
import { SvgProps } from 'react-native-svg';
import { useMemo } from 'react';
import ContactAvatar from '../contact-avatar/ContactAvatar';

type AddressDisplayProps = {
  address: string;
  addressFormat?: 'short' | 'long' | 'full';
  rawDisplay?: boolean;
  showCopy?: boolean;
  textProps?: TextProps;
  iconProps?: SvgProps;
} & PWViewProps;

const LONG_ADDRESS_FORMAT = 20;

//TODO add support for NFDs
const AddressDisplay = ({
  address,
  addressFormat = 'short',
  rawDisplay,
  showCopy = true,
  textProps,
  iconProps,
  ...rest
}: AddressDisplayProps) => {
  const styles = useStyles();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const copyAddress = () => {
    Clipboard.setString(address);
    showToast({
      title: '',
      body: 'Address copied to clipboard',
      type: 'info',
    });
  };

  const { findContacts } = useContacts();

  const contact = useMemo(() => {
    if (rawDisplay) {
      return null;
    }
    return findContacts({
      keyword: address,
      matchAddress: true,
      matchName: false,
      matchNFD: false,
    }).at(0);
  }, [rawDisplay, address, findContacts]);

  const truncatedAddress =
    addressFormat === 'full'
      ? address
      : addressFormat === 'long'
        ? truncateAlgorandAddress(address, LONG_ADDRESS_FORMAT)
        : truncateAlgorandAddress(address);

  return (
    <PWView {...rest} style={[rest.style, styles.addressValueContainer]}>
      {!!contact && (
        <PWView style={styles.contactContainer}>
          <ContactAvatar size="small" contact={contact} />
          <Text>{contact.name}</Text>
        </PWView>
      )}

      {!contact && <Text {...textProps}>{truncatedAddress}</Text>}

      {showCopy && (
        <CopyIcon
          color={theme.colors.textGray}
          width={theme.spacing.lg}
          height={theme.spacing.lg}
          {...iconProps}
          onPress={copyAddress}
        />
      )}
    </PWView>
  );
};

export default AddressDisplay;
