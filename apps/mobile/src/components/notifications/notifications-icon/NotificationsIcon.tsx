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

import {
  useDeviceID,
  useV1DevicesNotificationStatusList
} from '@perawallet/core';
import BellIcon from '../../../../assets/icons/bell.svg';
import BellWithBadgeIcon from '../../../../assets/icons/bell-with-badge.svg';
import { SvgProps } from 'react-native-svg';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity';

export type NotificationsIconProps = {} & SvgProps;

const NotificationsIcon = (props: NotificationsIconProps) => {
  const deviceID = useDeviceID();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const goToNotifications = () => {
    navigation.navigate('Notifications');
  };

  const { data } = useV1DevicesNotificationStatusList(
    {
      device_id: deviceID!
    },
    {
      query: {
        enabled: !!deviceID,
        staleTime: 30_000 //TODO make configurable or at least store somewhere sensible
      }
    }
  );

  return (
    <PWTouchableOpacity onPress={goToNotifications}>
      {data?.has_new_notification ? (
        <BellWithBadgeIcon {...props} />
      ) : (
        <BellIcon {...props} />
      )}
    </PWTouchableOpacity>
  );
};

export default NotificationsIcon;
