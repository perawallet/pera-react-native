import PeraView from '../../components/common/view/PeraView';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import { Text, useTheme } from '@rneui/themed';
import { useStyles } from './styles';
import { TouchableOpacity } from 'react-native';

import CameraIcon from '../../../assets/icons/camera.svg';
import BellIcon from '../../../assets/icons/bell.svg';
import InfoIcon from '../../../assets/icons/info.svg';

import CurrencyDisplay from '../../components/common/currency-display/CurrencyDisplay';
import ButtonPanel from '../../components/portfolio/button-panel/ButtonPanel';
import AccountList from '../../components/portfolio/account-list/AccountList';
import Decimal from 'decimal.js';
import { useAccountBalances, useAppStore } from '@perawallet/core';

const PortfolioScreen = () => {
  const { theme } = useTheme();
  const styles = useStyles();

  const accounts = useAppStore(state => state.accounts);
  const data = useAccountBalances(accounts);

  const loading = data.some(d => !d.isFetched);
  const algoAmount = data.reduce(
    (acc, cur) => acc.plus(cur.algoAmount),
    Decimal(0),
  );
  const usdAmount = data.reduce(
    (acc, cur) => acc.plus(cur.usdAmount),
    Decimal(0),
  );

  return (
    <MainScreenLayout>
      <PeraView style={styles.iconBar}>
        <TouchableOpacity>
          <CameraIcon style={styles.icon} color={theme.colors.textMain} />
        </TouchableOpacity>
        <TouchableOpacity>
          <BellIcon style={styles.icon} color={theme.colors.textMain} />
        </TouchableOpacity>
      </PeraView>
      <PeraView style={styles.valueTitleBar}>
        <Text h4Style={styles.valueTitle} h4>
          Portfolio Value
        </Text>
        <TouchableOpacity>
          <InfoIcon style={styles.icon} color={theme.colors.textGray} />
        </TouchableOpacity>
      </PeraView>
      <PeraView style={styles.valueBar}>
        <CurrencyDisplay
          h1
          value={algoAmount}
          currency="ALGO"
          precision={2}
          h1Style={styles.primaryCurrency}
          skeleton={loading}
        />
        <CurrencyDisplay
          h4
          h4Style={styles.valueTitle}
          value={usdAmount}
          currency="USD"
          prefix="≈ "
          precision={2}
          skeleton={loading}
        />
      </PeraView>

      {/* TODO: Render chart here... */}

      <ButtonPanel />

      {/* TODO: Render banners and spot banners here... */}

      <AccountList />
    </MainScreenLayout>
  );
};

export default PortfolioScreen;
