import { Text, useTheme } from '@rneui/themed';
import { getAccountDisplayName, useAppStore } from '@perawallet/core';
import PeraView from '../view/PeraView';
import { useStyles } from './styles';

import ChevronDown from '../../../../assets/icons/chevron-down.svg';
import WalletIcon from '../../../../assets/icons/wallet-in-circle.svg';

const AccountSelection = () => {
  const { theme } = useTheme();
  const styles = useStyles();
  const getSelectedAccount = useAppStore(state => state.getSelectedAccount);
  const account = getSelectedAccount();
  const displayName = getAccountDisplayName(account);

  return (
    <PeraView style={styles.container}>
      <WalletIcon />
      <Text h4Style={styles.text} h4>
        {displayName}
      </Text>
      <ChevronDown color={theme.colors.textGray} />
    </PeraView>
  );
};

export default AccountSelection;
