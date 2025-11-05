import { useTheme } from '@rneui/themed';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import { useDeviceID, useV1DevicesNotificationsListInfinite } from '@perawallet/core';
import { FlatList } from 'react-native-gesture-handler';
import PeraView from '../../components/common/view/PeraView';
import { ActivityIndicator } from 'react-native';
import EmptyView from '../../components/common/empty-view/EmptyView';
import BellIcon from '../../../assets/icons/bell.svg';
import { useStyles } from './styles';
import NotificationItem from '../../components/notifications/NotificationItem';
import { useMemo } from 'react';

const NotificationsScreen = () => {
  const styles = useStyles()
  const { theme } = useTheme()
  const deviceID = useDeviceID()

  const { data, isPending, fetchNextPage, isFetchingNextPage, hasNextPage } = useV1DevicesNotificationsListInfinite({
    device_id: deviceID!
  }, {
    query: {
      enabled: !!deviceID,
    }
  })

  const renderItem = (info: any) => {
    return <NotificationItem item={info.item} />
  }

  const loadMoreItems = async () => {
    if (hasNextPage) {
      await fetchNextPage({})
    }
  }

  const items = useMemo(() => data?.pages.flatMap(p => p.results), [data]) ?? []

  return (
    <MainScreenLayout>
      {isPending && <PeraView><ActivityIndicator size='large' color={theme.colors.secondary} /></PeraView>}
      {!isPending && !items.length && 
        <EmptyView 
          icon={<PeraView style={styles.iconContainer}><BellIcon width={theme.spacing.xl * 2} height={theme.spacing.xl * 2} color={theme.colors.textGray} /></PeraView>}
          title="No current notifications" 
          body="Your recent transactions, asset requests and other transactions will appear here" />}
      {!isPending && !!items.length && 
        <FlatList data={items} renderItem={renderItem} contentContainerStyle={styles.messageContainer} 
          onEndReached={loadMoreItems} 
          onEndReachedThreshold={0.1} 
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={theme.colors.layerGray} /> : <></>}/>
        }
    </MainScreenLayout>
  );
};

export default NotificationsScreen;
