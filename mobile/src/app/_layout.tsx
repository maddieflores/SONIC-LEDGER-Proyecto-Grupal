import { NativePlayerProvider, MiniPlayerMobile } from '../features/playback/NativePlayback';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
export default function RootLayout() {
  return <NativePlayerProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#070713' } }} /><MiniPlayerMobile /></NativePlayerProvider>;
}
