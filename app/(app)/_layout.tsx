import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { auth } from '@/src/config/firebase';
import { signInAnonymously } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FilterProvider } from '../../context/FilterContext';
import { ThemeProvider as TeamThemeProvider, useTheme } from '../../context/ThemeContext';

export const unstable_settings = {
    anchor: '(tabs)',
};

function AppLayoutNav() {
    const colorScheme = useColorScheme();
    const [authInitializing, setAuthInitializing] = useState(true);
    const { selectedTeam, isLoading: themeLoading } = useTheme();
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                setAuthInitializing(false);
            } else {
                signInAnonymously(auth).catch((error) => {
                    console.error('Anonymous auth failed', error);
                    setAuthInitializing(false);
                });
            }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (authInitializing || themeLoading) return;

        const inOnboarding = segments[0] === 'onboarding';

        // Adjusted logic for nested route
        // If inside (app), segments might process differently?
        // Actually, creating (app) group does not change URL segments drastically if handled correctly,
        // but typically it does.
        // However, since we are moving files, 'onboarding' will be '(app)/onboarding'.
        // useSegments() returns array of segments.
        // if we are at /onboarding, segments might be ['(app)', 'onboarding']

        // Let's print segments to debug if needed, but safe check:
        const isOnboardingRoute = (segments as string[]).includes('onboarding');

        // If we are at root or something else?

        if (!selectedTeam && !isOnboardingRoute) {
            // Need to ensure we replace to the correct relative or absolute path
            // router.replace('/onboarding') should work if onboarding is in (app) and (app) is default?
            // Actually if (app) is a group, '/onboarding' resolves to 'app/(app)/onboarding'.
            router.replace('/(app)/onboarding');
        } else if (selectedTeam && isOnboardingRoute) {
            router.replace('/(app)/(tabs)');
        }
    }, [authInitializing, themeLoading, selectedTeam, segments]);

    if (authInitializing || themeLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    return (
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                <Stack.Screen name="record/[id]" options={{ presentation: 'card', title: '상세 기록' }} />
                <Stack.Screen name="settings" options={{ title: '설정', headerBackTitle: '뒤로' }} />
            </Stack>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}

export default function AppLayout() {
    return (
        <TeamThemeProvider>
            <FilterProvider>
                <AppLayoutNav />
            </FilterProvider>
        </TeamThemeProvider>
    );
}
