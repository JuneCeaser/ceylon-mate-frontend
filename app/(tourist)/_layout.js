import { Tabs } from 'expo-router';
import { Colors } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function TouristLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textSecondary,
                tabBarStyle: {
                    backgroundColor: Colors.surface,
                    borderTopWidth: 1,
                    borderTopColor: Colors.border,
                    paddingBottom: 8,
                    paddingTop: 8,
                    height: 60,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '600',
                },
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="itinerary"
                options={{
                    title: 'Plan Trip',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="map" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="risk"
                options={{
                    title: 'Risk Zones',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="alert-circle" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person" size={size} color={color} />
                    ),
                }}
            />

            {/* Hide these screens from tab bar */}
            <Tabs.Screen
                name="itinerary-results"
                options={{ href: null }}
            />
            <Tabs.Screen
                name="my-trips"
                options={{ href: null }}
            />
            <Tabs.Screen
                name="itinerary-view"
                options={{ href: null }}
            />
            <Tabs.Screen
                name="risk-alternatives"
                options={{
                    href: null, // This hides it from the tab bar
                }}
            />
            <Tabs.Screen
                name="emergency-alert"
                options={{
                    href: null, // Emergency alert screen (for user who triggered)
                }}
            />
            <Tabs.Screen
                name="emergency-map"
                options={{ href: null }}
            />
            <Tabs.Screen
                name="friends-map"
                options={{ href: null }}
            />
        </Tabs>
    );
}