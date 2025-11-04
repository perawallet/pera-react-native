import { Text, useTheme } from '@rneui/themed';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import { useAppStore, useV1DevicesNotificationsList } from '@perawallet/core';
import { FlatList } from 'react-native-gesture-handler';
import PeraView from '../../components/common/view/PeraView';
import { ActivityIndicator } from 'react-native';
import EmptyView from '../../components/common/empty-view/EmptyView';
import BellIcon from '../../../assets/icons/bell.svg';
import { useStyles } from './styles';
import NotificationItem from '../../components/notifications/NotificationItem';

const NotificationsScreen = () => {
  const styles = useStyles()
  const { theme } = useTheme()
  const deviceID = useAppStore(state => state.deviceID)

  //TODO implement pagination (we need to probably add an Infinite hook via kubb for this)
  // const { data, isPending } = useV1DevicesNotificationsList({
  //   device_id: deviceID!
  // }, {
  //   query: {
  //     enabled: !!deviceID
  //   }
  // })

  const isPending = false
  const data = {
  "next": "https://mainnet.api.perawallet.app/v1/devices/3664538627474650210/notifications/?cursor=cD01ODQ0MDkxMDU%3D",
  "previous": null,
  "results": [
    {
      "id": 592470664,
      "account": null,
      "type": "custom-text-message",
      "message": "Peace of mind = backed-up mnemonics 🔐. Your keys, your crypto, your control. 🛡️",
      "creation_datetime": "2025-10-30T14:08:52+0000",
      "metadata": {
        "url": "",
        "icon": {
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/notifications/custom_notification/2025/10/30/9631593ea8b6488f941ad04579ca7143.png",
          "shape": "circle"
        },
        "message": "Peace of mind = backed-up mnemonics 🔐. Your keys, your crypto, your control. 🛡️"
      },
      "is_unread": true
    },
    {
      "id": 591808853,
      "account": null,
      "type": "custom-text-message",
      "message": "The Pera Lucky Spin is back! Start your streak, earn bonus spins, and see if luck’s on your side 🍀",
      "creation_datetime": "2025-10-28T14:48:38+0000",
      "metadata": {
        "url": "perawallet://discover",
        "icon": {
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/notifications/custom_notification/2025/10/28/7742e8cf03964a1e8cc76d44eb2be5bd.png",
          "shape": "circle"
        },
        "message": "The Pera Lucky Spin is back! Start your streak, earn bonus spins, and see if luck’s on your side 🍀"
      },
      "is_unread": true
    },
    {
      "id": 591683435,
      "account": null,
      "type": "custom-text-message",
      "message": "🚀 The wait is over. Earn 1% back in USDC every time you spend with your Pera Card on eligible purchases. Get started now.",
      "creation_datetime": "2025-10-28T13:26:03+0000",
      "metadata": {
        "url": "perawallet://cards",
        "icon": {
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/notifications/custom_notification/2025/10/28/0ae5e0817e1e4c06b104e090c9ba0f0b.png",
          "shape": "circle"
        },
        "message": "🚀 The wait is over. Earn 1% back in USDC every time you spend with your Pera Card on eligible purchases. Get started now."
      },
      "is_unread": true
    },
    {
      "id": 591329396,
      "account": 3664538627534775000,
      "type": "inbox-asset-rejected",
      "message": "DROPDIST has been rejected by HS4U...Z2SI and 0.097 of Algo has been claimed.",
      "creation_datetime": "2025-10-27T08:56:21+0000",
      "metadata": {
        "asset": {
          "url": "ipfs://QmWvMgiGW7T5UcCM42kTesGb61r6TakK65GbuBZhdqo5KQ",
          "logo": "https://mainnet.api.perawallet.app/v1/ipfs-thumbnails/QmWvMgiGW7T5UcCM42kTesGb61r6TakK65GbuBZhdqo5KQ",
          "type": "collectible",
          "asset_id": 3293038422,
          "unit_name": "DROPDIST",
          "usd_value": null,
          "asset_name": "Authentic Access",
          "fraction_decimals": 0
        },
        "algo_gain": "0.097",
        "rejector_address": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 590939980,
      "account": 3664538627534775000,
      "type": "inbox-asset-transaction-received",
      "message": "KWTD...O6SU sent 1 DROPDIST to HS4U...Z2SI's asset inbox.",
      "creation_datetime": "2025-10-25T17:57:44+0100",
      "metadata": {
        "asset": {
          "url": "ipfs://QmWvMgiGW7T5UcCM42kTesGb61r6TakK65GbuBZhdqo5KQ",
          "logo": "https://mainnet.api.perawallet.app/v1/ipfs-thumbnails/QmWvMgiGW7T5UcCM42kTesGb61r6TakK65GbuBZhdqo5KQ",
          "type": "collectible",
          "asset_id": 3293038422,
          "unit_name": "DROPDIST",
          "usd_value": null,
          "asset_name": "Authentic Access",
          "fraction_decimals": 0
        },
        "amount": 1,
        "sender_address": "KWTDNDUUGTJDMQF7L5DY4RHO6HM7WVOOEYCWWNR7L3ROLBUNZVOUMIO6SU",
        "receiver_address": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 590877210,
      "account": 3664538627534775000,
      "type": "lucky-spin-streak-warning",
      "message": "Your 3-day spin streak expires in 1 hours! Don't lose your bonus multiplier.",
      "creation_datetime": "2025-10-25T11:00:02+0100",
      "metadata": {
        "streak": 3,
        "game_id": "8a94154a-37cd-45b7-89d2-327d492c2a49",
        "hours_remaining": 1
      },
      "is_unread": true
    },
    {
      "id": 590650904,
      "account": 3664538627534775000,
      "type": "lucky-spin-cooldown-ended",
      "message": "Your Lucky Spin credits are ready! You have 2 new spins available.",
      "creation_datetime": "2025-10-24T12:00:45+0100",
      "metadata": {
        "game_id": "8a94154a-37cd-45b7-89d2-327d492c2a49",
        "game_name": "Lucky Spin",
        "bonus_credits": 2
      },
      "is_unread": true
    },
    {
      "id": 590450752,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to PERA...RWM4",
      "creation_datetime": "2025-10-23T11:22:30+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.182713374687,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "PERAFH7RLULOOYV6K3Q2MTW2USTKVLLF7OVHKX4ZRVQFMDWXM42XLPRWM4"
      },
      "is_unread": true
    },
    {
      "id": 590448331,
      "account": 3664538627534775000,
      "type": "lucky-spin-cooldown-ended",
      "message": "Your Lucky Spin credits are ready! You have 1 new spin available.",
      "creation_datetime": "2025-10-23T11:00:31+0100",
      "metadata": {
        "game_id": "8a94154a-37cd-45b7-89d2-327d492c2a49",
        "game_name": "Lucky Spin",
        "bonus_credits": 1
      },
      "is_unread": true
    },
    {
      "id": 590226052,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to PERA...RWM4",
      "creation_datetime": "2025-10-22T10:08:16+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.181573362183,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "PERAFH7RLULOOYV6K3Q2MTW2USTKVLLF7OVHKX4ZRVQFMDWXM42XLPRWM4"
      },
      "is_unread": true
    },
    {
      "id": 590225497,
      "account": 3664538627534775000,
      "type": "lucky-spin-cooldown-ended",
      "message": "Your Lucky Spin credits are ready! You have 1 new spin available.",
      "creation_datetime": "2025-10-22T10:00:38+0100",
      "metadata": {
        "game_id": "8a94154a-37cd-45b7-89d2-327d492c2a49",
        "game_name": "Lucky Spin",
        "bonus_credits": 1
      },
      "is_unread": true
    },
    {
      "id": 590015591,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to pera.algo",
      "creation_datetime": "2025-10-21T12:06:53+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.180604712233,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "V73GWLED56UUKKGOESJYHQADILUFMDM4RIBZZOLOOR4RKONZFDXYTVPMRM"
      },
      "is_unread": true
    },
    {
      "id": 590015577,
      "account": 3664538627534775000,
      "type": "asset-transaction-received",
      "message": "0.180442 USDC (~0.18 USD) received from ESPO...7D5A",
      "creation_datetime": "2025-10-21T12:06:50+0100",
      "metadata": {
        "asset": {
          "url": "https://www.centre.io/usdc",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/usd-coin-usdc-logo.png",
          "type": "standard_asset",
          "asset_id": 31566704,
          "unit_name": "USDC",
          "usd_value": 1,
          "asset_name": "USDC",
          "fraction_decimals": 6
        },
        "amount": 180442,
        "transaction_note": "",
        "sender_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A",
        "receiver_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 590015569,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 1 ALGO (~0.18 USD) to ESPO...7D5A",
      "creation_datetime": "2025-10-21T12:06:49+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.180604712233,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 1000000,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A"
      },
      "is_unread": true
    },
    {
      "id": 589966299,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to PERA...RWM4",
      "creation_datetime": "2025-10-21T09:22:40+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.178726135909,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "PERAFH7RLULOOYV6K3Q2MTW2USTKVLLF7OVHKX4ZRVQFMDWXM42XLPRWM4"
      },
      "is_unread": true
    },
    {
      "id": 587680900,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to pera.algo",
      "creation_datetime": "2025-10-13T13:16:56+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.202422677309,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "V73GWLED56UUKKGOESJYHQADILUFMDM4RIBZZOLOOR4RKONZFDXYTVPMRM"
      },
      "is_unread": true
    },
    {
      "id": 587680884,
      "account": 3664538627534775000,
      "type": "asset-transaction-received",
      "message": "0.203379 USDC (~0.20 USD) received from ESPO...7D5A",
      "creation_datetime": "2025-10-13T13:16:50+0100",
      "metadata": {
        "asset": {
          "url": "https://www.centre.io/usdc",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/usd-coin-usdc-logo.png",
          "type": "standard_asset",
          "asset_id": 31566704,
          "unit_name": "USDC",
          "usd_value": 1,
          "asset_name": "USDC",
          "fraction_decimals": 6
        },
        "amount": 203379,
        "transaction_note": "",
        "sender_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A",
        "receiver_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 587680876,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 1 ALGO (~0.20 USD) to ESPO...7D5A",
      "creation_datetime": "2025-10-13T13:16:50+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.202422677309,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 1000000,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A"
      },
      "is_unread": true
    },
    {
      "id": 587678384,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to pera.algo",
      "creation_datetime": "2025-10-13T13:08:51+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.202422677309,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "V73GWLED56UUKKGOESJYHQADILUFMDM4RIBZZOLOOR4RKONZFDXYTVPMRM"
      },
      "is_unread": true
    },
    {
      "id": 587678357,
      "account": 3664538627534775000,
      "type": "asset-transaction-received",
      "message": "0.202764 USDC (~0.20 USD) received from ESPO...7D5A",
      "creation_datetime": "2025-10-13T13:08:44+0100",
      "metadata": {
        "asset": {
          "url": "https://www.centre.io/usdc",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/usd-coin-usdc-logo.png",
          "type": "standard_asset",
          "asset_id": 31566704,
          "unit_name": "USDC",
          "usd_value": 1,
          "asset_name": "USDC",
          "fraction_decimals": 6
        },
        "amount": 202764,
        "transaction_note": "",
        "sender_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A",
        "receiver_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 587678349,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 1 ALGO (~0.20 USD) to ESPO...7D5A",
      "creation_datetime": "2025-10-13T13:08:44+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.202422677309,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 1000000,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A"
      },
      "is_unread": true
    },
    {
      "id": 587675941,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to pera.algo",
      "creation_datetime": "2025-10-13T12:55:50+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.202824353468,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "V73GWLED56UUKKGOESJYHQADILUFMDM4RIBZZOLOOR4RKONZFDXYTVPMRM"
      },
      "is_unread": true
    },
    {
      "id": 587675935,
      "account": 3664538627534775000,
      "type": "asset-transaction-received",
      "message": "0.2025 USDC (~0.20 USD) received from 2PIF...RNMM",
      "creation_datetime": "2025-10-13T12:55:50+0100",
      "metadata": {
        "asset": {
          "url": "https://www.centre.io/usdc",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/usd-coin-usdc-logo.png",
          "type": "standard_asset",
          "asset_id": 31566704,
          "unit_name": "USDC",
          "usd_value": 1,
          "asset_name": "USDC",
          "fraction_decimals": 6
        },
        "amount": 202500,
        "transaction_note": "",
        "sender_public_key": "2PIFZW53RHCSFSYMCFUBW4XOCXOMB7XOYQSQ6KGT3KVGJTL4HM6COZRNMM",
        "receiver_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 587675929,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 1 ALGO (~0.20 USD) to 2PIF...RNMM",
      "creation_datetime": "2025-10-13T12:55:50+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.202824353468,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 1000000,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "2PIFZW53RHCSFSYMCFUBW4XOCXOMB7XOYQSQ6KGT3KVGJTL4HM6COZRNMM"
      },
      "is_unread": true
    },
    {
      "id": 587673623,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to pera.algo",
      "creation_datetime": "2025-10-13T12:44:10+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.202154042686,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "V73GWLED56UUKKGOESJYHQADILUFMDM4RIBZZOLOOR4RKONZFDXYTVPMRM"
      },
      "is_unread": true
    },
    {
      "id": 587673611,
      "account": 3664538627534775000,
      "type": "asset-transaction-received",
      "message": "0.203208 USDC (~0.20 USD) received from ESPO...7D5A",
      "creation_datetime": "2025-10-13T12:44:04+0100",
      "metadata": {
        "asset": {
          "url": "https://www.centre.io/usdc",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/usd-coin-usdc-logo.png",
          "type": "standard_asset",
          "asset_id": 31566704,
          "unit_name": "USDC",
          "usd_value": 1,
          "asset_name": "USDC",
          "fraction_decimals": 6
        },
        "amount": 203208,
        "transaction_note": "",
        "sender_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A",
        "receiver_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 587673603,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 1 ALGO (~0.20 USD) to ESPO...7D5A",
      "creation_datetime": "2025-10-13T12:44:04+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.202154042686,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 1000000,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A"
      },
      "is_unread": true
    },
    {
      "id": 587672542,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to pera.algo",
      "creation_datetime": "2025-10-13T12:37:06+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.204044830329,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "V73GWLED56UUKKGOESJYHQADILUFMDM4RIBZZOLOOR4RKONZFDXYTVPMRM"
      },
      "is_unread": true
    },
    {
      "id": 587672524,
      "account": 3664538627534775000,
      "type": "asset-transaction-received",
      "message": "0.202458 USDC (~0.20 USD) received from ESPO...7D5A",
      "creation_datetime": "2025-10-13T12:37:02+0100",
      "metadata": {
        "asset": {
          "url": "https://www.centre.io/usdc",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/usd-coin-usdc-logo.png",
          "type": "standard_asset",
          "asset_id": 31566704,
          "unit_name": "USDC",
          "usd_value": 1,
          "asset_name": "USDC",
          "fraction_decimals": 6
        },
        "amount": 202458,
        "transaction_note": "",
        "sender_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A",
        "receiver_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 587672516,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 1 ALGO (~0.20 USD) to ESPO...7D5A",
      "creation_datetime": "2025-10-13T12:37:02+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.204044830329,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 1000000,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A"
      },
      "is_unread": true
    },
    {
      "id": 587672034,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to pera.algo",
      "creation_datetime": "2025-10-13T12:33:27+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.204044830329,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "V73GWLED56UUKKGOESJYHQADILUFMDM4RIBZZOLOOR4RKONZFDXYTVPMRM"
      },
      "is_unread": true
    },
    {
      "id": 587672023,
      "account": 3664538627534775000,
      "type": "transaction-received",
      "message": "4.972062 ALGO (~1.01 USD) received from ESPO...7D5A",
      "creation_datetime": "2025-10-13T12:33:22+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.204044830329,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 4972062,
        "transaction_note": "",
        "sender_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A",
        "receiver_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 587672015,
      "account": 3664538627534775000,
      "type": "asset-transaction-sent",
      "message": "Transaction successful: 1 USDC (~1.00 USD) to ESPO...7D5A",
      "creation_datetime": "2025-10-13T12:33:22+0100",
      "metadata": {
        "asset": {
          "url": "https://www.centre.io/usdc",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/usd-coin-usdc-logo.png",
          "type": "standard_asset",
          "asset_id": 31566704,
          "unit_name": "USDC",
          "usd_value": 1,
          "asset_name": "USDC",
          "fraction_decimals": 6
        },
        "amount": 1000000,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A"
      },
      "is_unread": true
    },
    {
      "id": 587668737,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to pera.algo",
      "creation_datetime": "2025-10-13T12:28:53+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.204044830329,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "V73GWLED56UUKKGOESJYHQADILUFMDM4RIBZZOLOOR4RKONZFDXYTVPMRM"
      },
      "is_unread": true
    },
    {
      "id": 587668731,
      "account": 3664538627534775000,
      "type": "asset-transaction-received",
      "message": "0.201282 USDC (~0.20 USD) received from 2PIF...RNMM",
      "creation_datetime": "2025-10-13T12:28:53+0100",
      "metadata": {
        "asset": {
          "url": "https://www.centre.io/usdc",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/usd-coin-usdc-logo.png",
          "type": "standard_asset",
          "asset_id": 31566704,
          "unit_name": "USDC",
          "usd_value": 1,
          "asset_name": "USDC",
          "fraction_decimals": 6
        },
        "amount": 201282,
        "transaction_note": "",
        "sender_public_key": "2PIFZW53RHCSFSYMCFUBW4XOCXOMB7XOYQSQ6KGT3KVGJTL4HM6COZRNMM",
        "receiver_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 587668725,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 1 ALGO (~0.20 USD) to 2PIF...RNMM",
      "creation_datetime": "2025-10-13T12:28:53+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.204044830329,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 1000000,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "2PIFZW53RHCSFSYMCFUBW4XOCXOMB7XOYQSQ6KGT3KVGJTL4HM6COZRNMM"
      },
      "is_unread": true
    },
    {
      "id": 587665885,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to pera.algo",
      "creation_datetime": "2025-10-13T12:14:52+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.20563137911,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "V73GWLED56UUKKGOESJYHQADILUFMDM4RIBZZOLOOR4RKONZFDXYTVPMRM"
      },
      "is_unread": true
    },
    {
      "id": 587665876,
      "account": 3664538627534775000,
      "type": "asset-transaction-received",
      "message": "0.205852 USDC (~0.21 USD) received from ESPO...7D5A",
      "creation_datetime": "2025-10-13T12:14:45+0100",
      "metadata": {
        "asset": {
          "url": "https://www.centre.io/usdc",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/usd-coin-usdc-logo.png",
          "type": "standard_asset",
          "asset_id": 31566704,
          "unit_name": "USDC",
          "usd_value": 1,
          "asset_name": "USDC",
          "fraction_decimals": 6
        },
        "amount": 205852,
        "transaction_note": "",
        "sender_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A",
        "receiver_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 587665868,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 1 ALGO (~0.21 USD) to ESPO...7D5A",
      "creation_datetime": "2025-10-13T12:14:45+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.20563137911,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 1000000,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A"
      },
      "is_unread": true
    },
    {
      "id": 587664391,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to pera.algo",
      "creation_datetime": "2025-10-13T12:08:07+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.20563137911,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "V73GWLED56UUKKGOESJYHQADILUFMDM4RIBZZOLOOR4RKONZFDXYTVPMRM"
      },
      "is_unread": true
    },
    {
      "id": 587664385,
      "account": 3664538627534775000,
      "type": "asset-transaction-received",
      "message": "0.203388 USDC (~0.20 USD) received from 2PIF...RNMM",
      "creation_datetime": "2025-10-13T12:08:06+0100",
      "metadata": {
        "asset": {
          "url": "https://www.centre.io/usdc",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/usd-coin-usdc-logo.png",
          "type": "standard_asset",
          "asset_id": 31566704,
          "unit_name": "USDC",
          "usd_value": 1,
          "asset_name": "USDC",
          "fraction_decimals": 6
        },
        "amount": 203388,
        "transaction_note": "",
        "sender_public_key": "2PIFZW53RHCSFSYMCFUBW4XOCXOMB7XOYQSQ6KGT3KVGJTL4HM6COZRNMM",
        "receiver_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 587664379,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 1 ALGO (~0.21 USD) to 2PIF...RNMM",
      "creation_datetime": "2025-10-13T12:08:06+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.20563137911,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 1000000,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "2PIFZW53RHCSFSYMCFUBW4XOCXOMB7XOYQSQ6KGT3KVGJTL4HM6COZRNMM"
      },
      "is_unread": true
    },
    {
      "id": 587663403,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to pera.algo",
      "creation_datetime": "2025-10-13T12:05:44+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.205994871046,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "V73GWLED56UUKKGOESJYHQADILUFMDM4RIBZZOLOOR4RKONZFDXYTVPMRM"
      },
      "is_unread": true
    },
    {
      "id": 587663396,
      "account": 3664538627534775000,
      "type": "asset-transaction-received",
      "message": "0.206208 USDC (~0.21 USD) received from ESPO...7D5A",
      "creation_datetime": "2025-10-13T12:05:41+0100",
      "metadata": {
        "asset": {
          "url": "https://www.centre.io/usdc",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/usd-coin-usdc-logo.png",
          "type": "standard_asset",
          "asset_id": 31566704,
          "unit_name": "USDC",
          "usd_value": 1,
          "asset_name": "USDC",
          "fraction_decimals": 6
        },
        "amount": 206208,
        "transaction_note": "",
        "sender_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A",
        "receiver_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 587663387,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 1 ALGO (~0.21 USD) to ESPO...7D5A",
      "creation_datetime": "2025-10-13T12:05:40+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.205994871046,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 1000000,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A"
      },
      "is_unread": true
    },
    {
      "id": 587663216,
      "account": 3664538627534775000,
      "type": "transaction-sent",
      "message": "Transaction successful: 0 ALGO (~0.00 USD) to pera.algo",
      "creation_datetime": "2025-10-13T12:04:20+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.205994871046,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 0,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "V73GWLED56UUKKGOESJYHQADILUFMDM4RIBZZOLOOR4RKONZFDXYTVPMRM"
      },
      "is_unread": true
    },
    {
      "id": 587663206,
      "account": 3664538627534775000,
      "type": "transaction-received",
      "message": "4.867768 ALGO (~1.00 USD) received from ESPO...7D5A",
      "creation_datetime": "2025-10-13T12:04:14+0100",
      "metadata": {
        "asset": {
          "url": "https://www.algorand.foundation",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/algo_logo_dark.png",
          "type": "algo",
          "asset_id": 0,
          "unit_name": "ALGO",
          "usd_value": 0.205994871046,
          "asset_name": "ALGO",
          "fraction_decimals": 6
        },
        "amount": 4867768,
        "transaction_note": "",
        "sender_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A",
        "receiver_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 587663198,
      "account": 3664538627534775000,
      "type": "asset-transaction-sent",
      "message": "Transaction successful: 1 USDC (~1.00 USD) to ESPO...7D5A",
      "creation_datetime": "2025-10-13T12:04:13+0100",
      "metadata": {
        "asset": {
          "url": "https://www.centre.io/usdc",
          "logo": "https://algorand-wallet-mainnet.b-cdn.net/media/usd-coin-usdc-logo.png",
          "type": "standard_asset",
          "asset_id": 31566704,
          "unit_name": "USDC",
          "usd_value": 1,
          "asset_name": "USDC",
          "fraction_decimals": 6
        },
        "amount": 1000000,
        "sender_public_key": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI",
        "receiver_public_key": "ESPO2SMA5BPAAAFAN66EFNHGR3HJ63U2OYM6RJXSEP6YOBU4HJTWZG7D5A"
      },
      "is_unread": true
    },
    {
      "id": 584780372,
      "account": 3664538627534775000,
      "type": "triggered-via-endpoint",
      "message": "Testing \n Will Test with push",
      "creation_datetime": "2025-10-03T14:58:39+0100",
      "metadata": {
        "body": "Will Test with push",
        "title": "Testing",
        "deeplink": "https://google.com/",
        "image_url": "https://algorand-wallet-mainnet.b-cdn.net/media/asset_verification_requests_logo_png/2024/11/15/02752e6e7e084f2cabf2a20346ec47c8.png?width=200&quality=70",
        "recipient_address": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    },
    {
      "id": 584409105,
      "account": 3664538627534775000,
      "type": "triggered-via-endpoint",
      "message": "Test from Aampe",
      "creation_datetime": "2025-10-01T13:24:13+0100",
      "metadata": {
        "body": "Test from Aampe",
        "deeplink": "https://algoland.co/",
        "image_url": "https://algorand-wallet-mainnet.b-cdn.net/media/asset_verification_requests_logo_png/2024/11/15/02752e6e7e084f2cabf2a20346ec47c8.png?width=200&quality=70",
        "recipient_address": "HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI"
      },
      "is_unread": true
    }
  ]
}

  const renderItem = (info: any) => {
    return <NotificationItem item={info.item} />
  }

  return (
    <MainScreenLayout>
      {isPending && <PeraView><ActivityIndicator size='large' color={theme.colors.secondary} /></PeraView>}
      {!isPending && !data?.results?.length && 
        <EmptyView 
          icon={<PeraView style={styles.iconContainer}><BellIcon width={theme.spacing.xl * 2} height={theme.spacing.xl * 2} color={theme.colors.textGray}  /></PeraView>}
          title="No current notifications" 
          body="Your recent transactions, asset requests and other transactions will appear here" />}
      {!isPending && data?.results?.length && 
        <FlatList data={data.results} renderItem={renderItem} contentContainerStyle={styles.messageContainer} />
        }
    </MainScreenLayout>
  );
};

export default NotificationsScreen;
