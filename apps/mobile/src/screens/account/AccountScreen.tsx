import { Text } from '@rneui/themed';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import { StaticScreenProps } from '@react-navigation/native';
import { WalletAccount } from '@perawallet/core';

type AccountScreenProps = StaticScreenProps<{
  account: WalletAccount;
}>;
const AccountScreen = ({ route }: AccountScreenProps) => {
  return (
    <MainScreenLayout header>
      <Text>
        This is the account details screen for {route.params.account.address}
      </Text>
    </MainScreenLayout>
  );
};

export default AccountScreen;
