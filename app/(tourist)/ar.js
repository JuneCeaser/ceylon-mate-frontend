import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ARScreen() {
  const router = useRouter();

  // This captures the data you passed from place.js (name, coordinates, etc.)
  const params = useLocalSearchParams();
  const { name } = params;

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AR Reconstruction</Text>
      </View>

      {/* Placeholder for AR Camera Engine */}
      <View style={styles.arPlaceholder}>
        <Ionicons name="camera-outline" size={80} color="#ccc" />
        <Text style={styles.mainText}>
          AR Camera View for {name || "Historical Site"}
        </Text>
        <Text style={styles.subText}>
          The 3D model will be placed at the exact coordinates.
        </Text>
      </View>

      {/* Info Overlay (Optional) */}
      <View style={styles.footer}>
        <Text style={styles.statusText}>
          Initializing Visual Positioning System...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: "#fff",
    elevation: 2,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  arPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  mainText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginTop: 20,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  subText: {
    fontSize: 14,
    color: "#888",
    marginTop: 10,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 15,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "500",
  },
});
