import PeraView from "../common/view/PeraView"
import { getAccountDisplayName, useAllAccounts, useAppStore, WalletAccount } from "@perawallet/core";
import { TouchableOpacity } from "react-native"
import { useStyles } from "./styles";
import { Text, useTheme } from "@rneui/themed";

import WalletIcon from '../../../assets/icons/wallet.svg';
import SortIcon from '../../../assets/icons/list-arrow-down.svg';
import PlusIcon from '../../../assets/icons/plus-with-border.svg';

type AccountsTabProps = {
  onSelected: (account: WalletAccount) => void
}
const AccountsTab = (props: AccountsTabProps) => {
  const styles = useStyles();
  const { theme } = useTheme();
    const accounts = useAllAccounts();
    const { selectedAccountAddress, setSelectedAccountAddress } = useAppStore();

    const getRouteName = (account?: WalletAccount): string => {
        return account ? getAccountDisplayName(account) : 'Account';
    };

    const getWalletIcon = (acct: WalletAccount) => {
        return (
        <WalletIcon
            color={
            acct.address === selectedAccountAddress
                ? theme.colors.secondary
                : theme.colors.textMain
            }
        />
        );
    };

    const handleTap = (acct: WalletAccount) => {
        setSelectedAccountAddress(acct.address);
        props?.onSelected?.(acct)
    };
    return (   
        <>
        <PeraView style={styles.titleBar}>
            <PeraView style={styles.titleBarButtonContainer}>
              <TouchableOpacity style={styles.addButtonContainer}>
                <PlusIcon style={styles.addButton} />
                <Text style={styles.addButtonTitle}>Add Account</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sortButton}>
                <SortIcon />
                <Text style={styles.sortButtonTitle}>Sort</Text>
              </TouchableOpacity>
            </PeraView>
          </PeraView>
            <PeraView style={styles.accountContainer}>
            {accounts.map(acct => (
              <TouchableOpacity
                key={acct.address}
                style={
                  acct.address === selectedAccountAddress
                    ? styles.activeItem
                    : styles.passiveItem
                }
                onPress={() => handleTap(acct)}
              >
                {getWalletIcon(acct)}
                <Text style={acct.address === selectedAccountAddress
                    ? styles.activeLabel
                    : styles.passiveLabel}>{getRouteName(acct)}</Text>
              </TouchableOpacity>
            ))}
        </PeraView>
    </>)
}
export default AccountsTab
