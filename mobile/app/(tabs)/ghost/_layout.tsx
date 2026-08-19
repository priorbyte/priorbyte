import { Stack } from 'expo-router';
import { COLORS, FONTS } from '@/lib/theme';

export default function GhostLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.cyan,
        headerTitleStyle: { fontFamily: FONTS.label, fontSize: 14 },
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Ghost' }} />
      <Stack.Screen name="score" options={{ title: 'Ghost Score' }} />
      <Stack.Screen name="timeline" options={{ title: 'Timeline' }} />
      <Stack.Screen name="oracle" options={{ title: 'Oracle' }} />
    </Stack>
  );
}
