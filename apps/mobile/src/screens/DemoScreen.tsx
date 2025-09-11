import React, { useEffect, useMemo } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  useAppStore,
  RemoteConfigKey,
  useRemoteConfigService,
  useSecureStorageService,
} from '@perawallet/core';

type Todo = { id: number; title: string; completed: boolean };

const fetchTodo = async (): Promise<Todo> => {
  const res = await fetch('https://jsonplaceholder.typicode.com/todos/1');
  if (!res.ok) throw new Error('Network error');
  return res.json();
};

export default function DemoScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['todo'],
    queryFn: fetchTodo,
  });
  const fcmToken = useAppStore(s => s.fcmToken);
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);
  const remoteConfig = useRemoteConfigService();
  const secureStorage = useSecureStorageService();

  // Reanimated sample
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [rotation]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const welcome = remoteConfig.getStringValue(
    RemoteConfigKey.welcome_message,
    'Welcome',
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-white dark:bg-black"
    >
      <View className="p-4 gap-4">
        <Text className="text-2xl font-bold text-black dark:text-white">
          {welcome}
        </Text>

        {/* Animated circle without NativeWind wrapper to keep compatibility */}
        <Animated.View
          style={[
            {
              height: 64,
              width: 64,
              borderRadius: 9999,
              backgroundColor: '#0EA5E9',
              alignSelf: 'center',
            },
            animatedStyle,
          ]}
        />

        <View className="rounded-xl bg-gray-100 dark:bg-neutral-900 p-4">
          <Text className="text-base font-semibold text-black dark:text-white mb-2">
            React Query (REST) demo
          </Text>
          {isLoading ? (
            <Text className="text-gray-500 dark:text-gray-400">Loading...</Text>
          ) : (
            <Text className="text-gray-800 dark:text-gray-200">
              {JSON.stringify(data)}
            </Text>
          )}
          <Pressable
            onPress={() => refetch()}
            className="mt-3 self-start rounded-md bg-black px-3 py-2 dark:bg-white"
          >
            <Text className="text-white dark:text-black">Refetch</Text>
          </Pressable>
        </View>

        <View className="rounded-xl bg-gray-100 dark:bg-neutral-900 p-4">
          <Text className="text-base font-semibold text-black dark:text-white mb-2">
            Zustand state
          </Text>
          <Text className="text-gray-800 dark:text-gray-200">
            Theme: {theme}
          </Text>
          <View className="flex-row gap-2 mt-2">
            <Pressable
              onPress={() => setTheme('light')}
              className="rounded-md bg-sky-500 px-3 py-2"
            >
              <Text className="text-white">Light</Text>
            </Pressable>
            <Pressable
              onPress={() => setTheme('dark')}
              className="rounded-md bg-gray-800 px-3 py-2"
            >
              <Text className="text-white">Dark</Text>
            </Pressable>
            <Pressable
              onPress={() => setTheme('system')}
              className="rounded-md bg-emerald-600 px-3 py-2"
            >
              <Text className="text-white">System</Text>
            </Pressable>
          </View>
        </View>

        <View className="rounded-xl bg-gray-100 dark:bg-neutral-900 p-4">
          <Text className="text-base font-semibold text-black dark:text-white mb-2">
            Notifications / FCM
          </Text>
          <Text className="text-gray-800 dark:text-gray-200">
            FCM token: {fcmToken ?? '(no token)'}
          </Text>
        </View>

        <View className="rounded-xl bg-gray-100 dark:bg-neutral-900 p-4">
          <Text className="text-base font-semibold text-black dark:text-white mb-2">
            Keychain (secure storage)
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              className="rounded-md bg-indigo-600 px-3 py-2"
              onPress={async () => {
                await secureStorage.setItem('demo', 'super-secret');
                Alert.alert('Saved', 'Saved secret');
              }}
            >
              <Text className="text-white">Save</Text>
            </Pressable>
            <Pressable
              className="rounded-md bg-amber-600 px-3 py-2"
              onPress={async () => {
                const v = await secureStorage.getItem('demo');
                Alert.alert('Read', String(v));
              }}
            >
              <Text className="text-white">Read</Text>
            </Pressable>
            <Pressable
              className="rounded-md bg-rose-600 px-3 py-2"
              onPress={async () => {
                await secureStorage.removeItem('demo');
                Alert.alert('Deleted', 'Deleted');
              }}
            >
              <Text className="text-white">Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
