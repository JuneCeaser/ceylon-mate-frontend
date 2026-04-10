// app/(tourist)/friends-map.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Switch,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import { onSnapshot, collection, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';
import { getCurrentLocation, updateUserLocation } from '../../services/emergencyAlert';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

async function startSharingApi(userId, latitude, longitude, sharingWith) {
    const res = await fetch(`${API_BASE}/api/emergency/share-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, latitude, longitude, sharingWith }),
    });
    if (!res.ok) throw new Error('Failed to start sharing');
    return res.json();
}

async function stopSharingApi(userId) {
    const res = await fetch(`${API_BASE}/api/emergency/share-location/${userId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to stop sharing');
    return res.json();
}

function timeSince(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 10) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
}

const FRIEND_COLORS = ['#1565C0', '#6A1B9A', '#E65100', '#00695C', '#AD1457', '#37474F'];

export default function FriendsMapScreen() {
    const router = useRouter();
    const { user, userProfile } = useAuth();

    const [myLocation, setMyLocation] = useState(null);
    const [friendLocations, setFriendLocations] = useState([]);
    const [sharingPeople, setSharingPeople] = useState([]); // from profile.locationSharingWith
    const [isSharing, setIsSharing] = useState(false);
    const [sharingLoading, setSharingLoading] = useState(false);
    const [loadingFriends, setLoadingFriends] = useState(true);
    const [tick, setTick] = useState(0); // forces "x ago" re-render

    const locationInterval = useRef(null);
    const tickInterval = useRef(null);
    const friendsUnsub = useRef(null);

    useFocusEffect(
        useCallback(() => {
            init();
            tickInterval.current = setInterval(() => setTick((t) => t + 1), 5000);
            return () => {
                cleanup();
                clearInterval(tickInterval.current);
            };
        }, [user])
    );

    const init = async () => {
        if (!user?.uid) return;

        // Load sharing list from profile
        try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.exists()) {
                const people = snap.data().locationSharingWith || [];
                setSharingPeople(people);
                subscribeFriendLocations(people.map((p) => p.uid));
            }
        } catch (err) {
            console.error('Init friends map error:', err);
        }

        // Get my location
        try {
            const loc = await getCurrentLocation();
            setMyLocation(loc);
        } catch (_) {}
    };

    const subscribeFriendLocations = (friendUids) => {
        if (friendsUnsub.current) friendsUnsub.current();
        if (friendUids.length === 0) { setFriendLocations([]); setLoadingFriends(false); return; }

        // Listen to sharedLocations where the doc owner is one of our friends
        // AND they have us in their sharingWith list
        // We query by document ID (friend's userId)
        // Firestore doesn't support OR queries across IDs, so we use a Firestore listener
        // on the sharedLocations collection filtered by active:true and check in-memory

        const q = query(
            collection(db, 'sharedLocations'),
            where('active', '==', true),
            where('sharingWith', 'array-contains', user.uid)
        );

        friendsUnsub.current = onSnapshot(q, (snapshot) => {
            const locs = snapshot.docs.map((d) => {
                const data = d.data();
                const profile = sharingPeople.find((p) => p.uid === data.userId);
                return {
                    userId: data.userId,
                    userName: profile?.name || data.userName || 'Friend',
                    latitude: data.latitude,
                    longitude: data.longitude,
                    updatedAt: data.updatedAt,
                };
            });
            setFriendLocations(locs);
            setLoadingFriends(false);
        });
    };

    const cleanup = () => {
        if (locationInterval.current) clearInterval(locationInterval.current);
        if (friendsUnsub.current) friendsUnsub.current();
        locationInterval.current = null;
    };

    const toggleSharing = async () => {
        if (isSharing) {
            // Stop sharing
            setSharingLoading(true);
            try {
                await stopSharingApi(user.uid);
                if (locationInterval.current) clearInterval(locationInterval.current);
                locationInterval.current = null;
                setIsSharing(false);
            } catch (err) {
                Alert.alert('Error', err.message);
            } finally {
                setSharingLoading(false);
            }
        } else {
            // Start sharing
            if (sharingPeople.length === 0) {
                Alert.alert(
                    'No sharing list',
                    'Add people to share your location with in Profile > Location Sharing first.',
                    [{ text: 'Go to Profile', onPress: () => router.push('/(tourist)/profile') }, { text: 'Cancel', style: 'cancel' }]
                );
                return;
            }

            setSharingLoading(true);
            try {
                const loc = await getCurrentLocation();
                setMyLocation(loc);
                const uids = sharingPeople.map((p) => p.uid);
                await startSharingApi(user.uid, loc.latitude, loc.longitude, uids);
                setIsSharing(true);

                // Send location update every 3 seconds
                locationInterval.current = setInterval(async () => {
                    try {
                        const updated = await getCurrentLocation();
                        setMyLocation(updated);
                        await startSharingApi(user.uid, updated.latitude, updated.longitude, uids);
                    } catch (_) {}
                }, 3000);
            } catch (err) {
                Alert.alert('Error', err.message);
            } finally {
                setSharingLoading(false);
            }
        }
    };

    const getMapRegion = () => {
        const all = [
            ...(myLocation ? [myLocation] : []),
            ...friendLocations.map((f) => ({ latitude: f.latitude, longitude: f.longitude })),
        ];

        if (all.length === 0) {
            return { latitude: 7.8731, longitude: 80.7718, latitudeDelta: 2, longitudeDelta: 2 };
        }
        if (all.length === 1) {
            return { latitude: all[0].latitude, longitude: all[0].longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        }

        const lats = all.map((p) => p.latitude);
        const lons = all.map((p) => p.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLon + maxLon) / 2,
            latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.05),
            longitudeDelta: Math.max((maxLon - minLon) * 1.6, 0.05),
        };
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient colors={['#1565C0', '#1976D2']} style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.headerTitle}>Friends Map</Text>
                    <Text style={styles.headerSub}>
                        {friendLocations.length} friend{friendLocations.length !== 1 ? 's' : ''} visible
                    </Text>
                </View>

                {/* Share toggle */}
                <View style={styles.shareToggle}>
                    {sharingLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Text style={styles.shareToggleLabel}>{isSharing ? 'Sharing' : 'Share'}</Text>
                            <Switch
                                value={isSharing}
                                onValueChange={toggleSharing}
                                thumbColor={isSharing ? '#fff' : '#ccc'}
                                trackColor={{ false: 'rgba(255,255,255,0.3)', true: Colors.success }}
                            />
                        </>
                    )}
                </View>
            </LinearGradient>

            {/* Map */}
            <MapView
                style={styles.map}
                region={getMapRegion()}
                showsUserLocation={true}
                showsMyLocationButton={false}
            >
                {/* My marker (when sharing) */}
                {isSharing && myLocation && (
                    <Marker coordinate={myLocation} title="You">
                        <View style={styles.myMarker}>
                            <Ionicons name="person" size={16} color="#fff" />
                        </View>
                    </Marker>
                )}

                {/* Friend markers */}
                {friendLocations.map((friend, idx) => (
                    <Marker
                        key={friend.userId}
                        coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
                        title={friend.userName}
                        description={`Updated ${timeSince(friend.updatedAt)}`}
                    >
                        <View style={[styles.friendMarker, { backgroundColor: FRIEND_COLORS[idx % FRIEND_COLORS.length] }]}>
                            <Text style={styles.friendMarkerInitial}>
                                {(friend.userName || '?')[0].toUpperCase()}
                            </Text>
                        </View>
                    </Marker>
                ))}
            </MapView>

            {/* Friend list panel */}
            <View style={styles.panel}>
                {isSharing && (
                    <View style={styles.sharingBanner}>
                        <Ionicons name="radio-outline" size={16} color={Colors.success} />
                        <Text style={styles.sharingBannerText}>
                            Sharing with {sharingPeople.length} person{sharingPeople.length !== 1 ? 's' : ''} · updates every 3s
                        </Text>
                    </View>
                )}

                <Text style={styles.panelTitle}>
                    {friendLocations.length === 0 ? 'No friends sharing right now' : 'Friends online'}
                </Text>

                {loadingFriends ? (
                    <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendScroll}>
                        {friendLocations.map((friend, idx) => (
                            <View key={friend.userId} style={styles.friendChip}>
                                <View style={[styles.friendChipDot, { backgroundColor: FRIEND_COLORS[idx % FRIEND_COLORS.length] }]}>
                                    <Text style={styles.friendChipInitial}>
                                        {(friend.userName || '?')[0].toUpperCase()}
                                    </Text>
                                </View>
                                <View>
                                    <Text style={styles.friendChipName} numberOfLines={1}>{friend.userName}</Text>
                                    <Text style={styles.friendChipTime}>{timeSince(friend.updatedAt)}</Text>
                                </View>
                            </View>
                        ))}
                        {friendLocations.length === 0 && sharingPeople.length > 0 && (
                            <Text style={styles.waitingText}>
                                Waiting for friends to share their location...
                            </Text>
                        )}
                        {sharingPeople.length === 0 && (
                            <TouchableOpacity
                                style={styles.addPeopleBtn}
                                onPress={() => router.push('/(tourist)/profile')}
                            >
                                <Ionicons name="person-add-outline" size={16} color={Colors.accent} />
                                <Text style={styles.addPeopleBtnText}>Add people in Profile</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },

    header: { paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
    headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
    shareToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    shareToggleLabel: { fontSize: 12, color: '#fff', fontWeight: '600' },

    map: { flex: 1 },

    // Markers
    myMarker: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff', elevation: 4 },
    friendMarker: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff', elevation: 4 },
    friendMarkerInitial: { fontSize: 15, fontWeight: '700', color: '#fff' },

    // Panel
    panel: { backgroundColor: '#fff', paddingTop: 12, paddingHorizontal: 16, paddingBottom: 20, borderTopWidth: 1, borderTopColor: '#EEE', maxHeight: 150 },
    sharingBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.success + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 8 },
    sharingBannerText: { fontSize: 12, color: Colors.success, fontWeight: '600' },
    panelTitle: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 8 },
    friendScroll: { flexDirection: 'row' },
    friendChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
    friendChipDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    friendChipInitial: { fontSize: 13, fontWeight: '700', color: '#fff' },
    friendChipName: { fontSize: 12, fontWeight: '600', color: '#222', maxWidth: 80 },
    friendChipTime: { fontSize: 10, color: '#999' },
    waitingText: { fontSize: 13, color: '#aaa', paddingVertical: 8 },
    addPeopleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
    addPeopleBtnText: { fontSize: 13, color: Colors.accent, fontWeight: '600' },
});
