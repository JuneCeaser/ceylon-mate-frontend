import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Colors } from "../../constants/theme";

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
          fontWeight: "600",
        },
      }}
    >
      {/* ── VISIBLE TAB BAR SCREENS (5 buttons) ── */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="itinerary"
        options={{
          title: "Itinerary",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="risk"
        options={{
          title: "Safety",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="place"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="culture"
        options={{
          title: "Culture",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="earth" size={size} color={color} />
          ),
        }}
      />

      {/* ── ALL OTHER SCREENS HIDDEN FROM TAB BAR ── */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="3d-model" options={{ href: null }} />
      <Tabs.Screen name="ar" options={{ href: null }} />
      <Tabs.Screen name="artifact-scanner" options={{ href: null }} />
      <Tabs.Screen name="emergency-alert" options={{ href: null }} />
      <Tabs.Screen name="emergency-map" options={{ href: null }} />
      <Tabs.Screen name="facts" options={{ href: null }} />
      <Tabs.Screen name="friends-map" options={{ href: null }} />
      <Tabs.Screen name="itinerary-results" options={{ href: null }} />
      <Tabs.Screen name="itinerary-view" options={{ href: null }} />
      <Tabs.Screen name="map" options={{ href: null }} />
      <Tabs.Screen name="my-trips" options={{ href: null }} />
      <Tabs.Screen name="place-chat" options={{ href: null }} />
      <Tabs.Screen name="risk-alternatives" options={{ href: null }} />
    </Tabs>
  );
}
