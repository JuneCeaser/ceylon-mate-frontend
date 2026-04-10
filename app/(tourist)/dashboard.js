import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
    triggerEmergencyAlert,
    subscribeToEmergencyAlerts,
    getUserActiveAlert,
    requestLocationPermission,
    updateUserLocation,
} from '../../services/emergencyAlert';
import { getTouristBookings } from '../../services/api';

const { width } = Dimensions.get('window');
const CARD_W = width * 0.72;

const FEATURED = [
    {
        name: 'Sigiriya Rock Fortress', district: 'Matale District', tag: 'Heritage',
        icon: 'business-outline', popularity: '0.95',
        colors: ['#5D4037', '#8D6E63'], accent: '#FFCC80',
        fact: 'Ancient rock fortress from 5th century AD',
    },
    {
        name: 'Mirissa Beach', district: 'Matara District', tag: 'Beach',
        icon: 'water-outline', popularity: '0.90',
        colors: ['#0277BD', '#0288D1'], accent: '#80DEEA',
        fact: 'Best spot for whale watching in Asia',
    },
    {
        name: 'Nine Arch Bridge', district: 'Badulla District', tag: 'Scenic',
        icon: 'train-outline', popularity: '0.90',
        colors: ['#2E7D32', '#388E3C'], accent: '#A5D6A7',
        fact: 'Colonial-era viaduct set in lush jungle',
    },
    {
        name: 'Temple of the Tooth', district: 'Kandy', tag: 'Culture',
        icon: 'flower-outline', popularity: '0.93',
        colors: ['#6A1B9A', '#7B1FA2'], accent: '#CE93D8',
        fact: 'UNESCO site housing Buddha\'s tooth relic',
    },
    {
        name: 'Yala National Park', district: 'Hambantota', tag: 'Wildlife',
        icon: 'paw-outline', popularity: '0.93',
        colors: ['#E65100', '#EF6C00'], accent: '#FFCC80',
        fact: 'Highest leopard density in the world',
    },
    {
        name: 'Galle Dutch Fort', district: 'Galle', tag: 'History',
        icon: 'shield-outline', popularity: '0.92',
        colors: ['#1565C0', '#1976D2'], accent: '#90CAF9',
        fact: 'Best-preserved colonial fort in Asia',
    },
];

const QUICK_ACTIONS = [
    { icon: 'map-outline', label: 'Plan Trip', route: '/(tourist)/itinerary', colors: ['#1565C0', '#1976D2'] },
    { icon: 'shield-checkmark-outline', label: 'Risk Check', route: '/(tourist)/risk', colors: ['#B71C1C', '#D32F2F'] },
    { icon: 'location-outline', label: 'Emergency Map', route: '/(tourist)/emergency-map', colors: ['#4A148C', '#7B1FA2'] },
    { icon: 'time-outline', label: 'History', route: '/(tourist)/place', colors: ['#5D4037', '#8D6E63'] },
];

export default function TouristDashboard() {
    const router = useRouter();
    const { user, userProfile } = useAuth();

    const [stats, setStats] = useState({ totalItineraries: 0, savedAttractions: 0, upcomingBookings: 0 });
    const [recentItineraries, setRecentItineraries] = useState([]);
    const [upcomingBookings, setUpcomingBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [emergencyLoading, setEmergencyLoading] = useState(false);
    const [userActiveAlert, setUserActiveAlert] = useState(null);
    const [showAlertIndicator, setShowAlertIndicator] = useState(false);

    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (userActiveAlert) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [userActiveAlert]);

    useFocusEffect(
        useCallback(() => {
            loadDashboardData();
        }, [user])
    );

    useEffect(() => {
        requestLocationPermission();
        const unsubscribe = subscribeToEmergencyAlerts((alerts) => {
            const userAlert = getUserActiveAlert(alerts, user?.uid);
            setUserActiveAlert(userAlert);
            const otherAlerts = alerts.filter((a) => a.userId !== user?.uid);
            setShowAlertIndicator(otherAlerts.length > 0);
            const hasNewAlert = otherAlerts.some((alert) => {
                const alertTime = new Date(alert.timestamp);
                return Date.now() - alertTime.getTime() < 5000;
            });
            if (hasNewAlert && !userAlert) router.push('/(tourist)/emergency-map');
        });
        if (user?.uid) {
            updateUserLocation(user.uid);
            const interval = setInterval(() => updateUserLocation(user.uid), 5 * 60 * 1000);
            return () => { unsubscribe(); clearInterval(interval); };
        }
        return unsubscribe;
    }, [user]);

    const loadDashboardData = async (isRefresh = false) => {
        if (!user?.uid) return;
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const itinQuery = query(
                collection(db, 'itineraries'),
                where('userId', '==', user.uid),
                orderBy('createdAt', 'desc'),
                limit(3)
            );
            const itinSnap = await getDocs(itinQuery);
            const itins = itinSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setRecentItineraries(itins);

            const allItinSnap = await getDocs(
                query(collection(db, 'itineraries'), where('userId', '==', user.uid))
            );

            let bookings = [];
            try {
                bookings = await getTouristBookings(user.uid);
                const upcoming = bookings.filter(
                    (b) => b.status !== 'cancelled' && new Date(b.checkOut) >= new Date()
                );
                setUpcomingBookings(upcoming.slice(0, 3));
            } catch (_) {}

            setStats({
                totalItineraries: allItinSnap.size,
                upcomingBookings: bookings.filter(
                    (b) => b.status === 'confirmed' && new Date(b.checkIn) >= new Date()
                ).length,
                savedAttractions: allItinSnap.docs.reduce(
                    (sum, d) => sum + (d.data().selectedAttractions?.length || 0), 0
                ),
            });
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleEmergencyAlert = async () => {
        if (userActiveAlert) {
            router.push({ pathname: '/(tourist)/emergency-alert', params: { alertId: userActiveAlert.id, alertData: JSON.stringify(userActiveAlert) } });
            return;
        }

        const contacts = userProfile?.emergencyContacts || [];
        const contactNames = contacts.map(c => c.name || c.email).join(', ');
        const contactsMsg = contacts.length > 0
            ? `\n\nYour ${contacts.length} emergency contact${contacts.length > 1 ? 's' : ''} (${contactNames}) will be notified immediately.`
            : '\n\nTip: Add emergency contacts in your profile to ensure someone is always notified.';

        Alert.alert(
            'Emergency SOS',
            `This will alert nearby users and share your live location.${contactsMsg}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send SOS', style: 'destructive',
                    onPress: async () => {
                        setEmergencyLoading(true);
                        try {
                            const emergencyContactUids = contacts.map(c => c.uid);
                            const alertData = await triggerEmergencyAlert(user.uid, userProfile?.name || user.email, {
                                radiusKm: 5,
                                selectedEmergencyContactUids: emergencyContactUids,
                            });
                            router.push({ pathname: '/(tourist)/emergency-alert', params: { alertId: alertData.alertId || alertData.id, alertData: JSON.stringify(alertData) } });
                        } catch (err) {
                            Alert.alert('SOS Failed', `Could not send alert: ${err.message}`);
                        } finally {
                            setEmergencyLoading(false);
                        }
                    },
                },
            ]);
    };

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const firstName = userProfile?.name?.split(' ')[0] || 'Traveller';

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => loadDashboardData(true)} colors={[Colors.primary]} />
                }
            >
                {/* ── HEADER ── */}
                <LinearGradient colors={['#1B5E20', '#2E7D32', '#388E3C']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.headerCircle1} />
                    <View style={styles.headerCircle2} />

                    <View style={styles.headerContent}>
                        <View style={styles.headerTopRow}>
                            <View>
                                {userActiveAlert ? (
                                    <View style={styles.emergencyBanner}>
                                        <Ionicons name="warning" size={14} color={Colors.danger} />
                                        <Text style={styles.emergencyBannerText}>EMERGENCY ACTIVE</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.greeting}>{getGreeting()},</Text>
                                )}
                                <Text style={styles.userName}>{firstName}</Text>
                                <Text style={styles.headerTagline}>Explore Sri Lanka safely</Text>
                            </View>

                            <View style={styles.headerRight}>
                                {/* ── PROFILE BUTTON (new) ── */}
                                <TouchableOpacity
                                    style={styles.profileBtn}
                                    onPress={() => router.push('/(tourist)/profile')}
                                >
                                    <View style={styles.profileBtnInner}>
                                        <Ionicons name="person" size={18} color="#fff" />
                                    </View>
                                </TouchableOpacity>

                                {showAlertIndicator && (
                                    <TouchableOpacity style={styles.alertDot} onPress={() => router.push('/(tourist)/emergency-map')}>
                                        <Ionicons name="warning" size={18} color="#fff" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.friendsBtn}
                                    onPress={() => router.push('/(tourist)/friends-map')}
                                >
                                    <Ionicons name="people-outline" size={16} color="#fff" />
                                    <Text style={styles.friendsBtnText}>Friends</Text>
                                </TouchableOpacity>
                                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                    <TouchableOpacity
                                        style={[styles.sosBtn, userActiveAlert && styles.sosBtnActive]}
                                        onPress={handleEmergencyAlert}
                                        disabled={emergencyLoading}
                                    >
                                        {emergencyLoading
                                            ? <ActivityIndicator size="small" color="#fff" />
                                            : <>
                                                <Ionicons name={userActiveAlert ? 'radio' : 'warning'} size={16} color="#fff" />
                                                <Text style={styles.sosBtnText}>{userActiveAlert ? 'ACTIVE' : 'SOS'}</Text>
                                            </>
                                        }
                                    </TouchableOpacity>
                                </Animated.View>
                            </View>
                        </View>

                        {/* Stats strip */}
                        <View style={styles.statsStrip}>
                            <View style={styles.statCell}>
                                <Text style={styles.statNum}>{stats.totalItineraries}</Text>
                                <Text style={styles.statLbl}>Trips</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statCell}>
                                <Text style={styles.statNum}>{stats.savedAttractions}</Text>
                                <Text style={styles.statLbl}>Places Saved</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statCell}>
                                <Text style={styles.statNum}>{stats.upcomingBookings}</Text>
                                <Text style={styles.statLbl}>Bookings</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* ── QUICK ACTIONS ── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionsGrid}>
                        {QUICK_ACTIONS.map((action) => (
                            <TouchableOpacity
                                key={action.label}
                                style={styles.actionTile}
                                onPress={() => router.push(action.route)}
                                activeOpacity={0.8}
                            >
                                <LinearGradient colors={action.colors} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                    <View style={styles.actionIconWrap}>
                                        <Ionicons name={action.icon} size={26} color="#fff" />
                                    </View>
                                    <Text style={styles.actionLabel}>{action.label}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── FEATURED DESTINATIONS ── */}
                <View style={styles.section}>
                    <View style={styles.sectionRow}>
                        <Text style={styles.sectionTitle}>Top Destinations</Text>
                        <TouchableOpacity onPress={() => router.push('/(tourist)/itinerary')}>
                            <Text style={styles.seeAll}>Plan Now</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                        {FEATURED.map((dest, i) => (
                            <TouchableOpacity
                                key={i}
                                style={styles.featuredCard}
                                activeOpacity={0.88}
                                onPress={() => router.push('/(tourist)/itinerary')}
                            >
                                <LinearGradient colors={dest.colors} style={styles.featuredGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                    <View style={[styles.featuredBlob1, { backgroundColor: dest.accent + '30' }]} />
                                    <View style={[styles.featuredBlob2, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />

                                    <View style={styles.featuredTopRow}>
                                        <View style={[styles.featuredTagPill, { backgroundColor: dest.accent + '35', borderColor: dest.accent + '60' }]}>
                                            <Text style={[styles.featuredTagText, { color: dest.accent }]}>{dest.tag}</Text>
                                        </View>
                                        <View style={styles.popularityPill}>
                                            <Ionicons name="star" size={10} color="#FFD54F" />
                                            <Text style={styles.popularityText}>{(parseFloat(dest.popularity) * 100).toFixed(0)}%</Text>
                                        </View>
                                    </View>

                                    <View style={[styles.featuredIconWrap, { backgroundColor: dest.accent + '25' }]}>
                                        <Ionicons name={dest.icon} size={36} color={dest.accent} />
                                    </View>

                                    <View>
                                        <Text style={styles.featuredName}>{dest.name}</Text>
                                        <View style={styles.featuredDistrictRow}>
                                            <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.7)" />
                                            <Text style={styles.featuredDistrictText}>{dest.district}</Text>
                                        </View>
                                        <Text style={styles.featuredFact} numberOfLines={1}>{dest.fact}</Text>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ── SAFETY TIP BANNER ── */}
                <TouchableOpacity style={styles.safetyBanner} onPress={() => router.push('/(tourist)/risk')} activeOpacity={0.85}>
                    <LinearGradient colors={['#B71C1C', '#D32F2F']} style={styles.safetyBannerGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <View style={styles.safetyBannerIcon}>
                            <Ionicons name="shield-checkmark" size={28} color="#fff" />
                        </View>
                        <View style={styles.safetyBannerText}>
                            <Text style={styles.safetyBannerTitle}>Check Travel Safety</Text>
                            <Text style={styles.safetyBannerSub}>Real-time risk analysis for your itinerary</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
                    </LinearGradient>
                </TouchableOpacity>

                {/* ── RECENT TRIPS ── */}
                <View style={styles.section}>
                    <View style={styles.sectionRow}>
                        <Text style={styles.sectionTitle}>Recent Trips</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={() => router.push('/(tourist)/my-trips')}>
                                <Text style={styles.seeAll}>See All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/(tourist)/itinerary')}>
                                <Text style={[styles.seeAll, { color: Colors.secondary }]}>+ Plan New</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {recentItineraries.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <View style={styles.emptyIcon}>
                                <Ionicons name="map-outline" size={36} color={Colors.primary} />
                            </View>
                            <Text style={styles.emptyTitle}>No trips yet</Text>
                            <Text style={styles.emptySubtitle}>Plan your first Sri Lanka adventure</Text>
                            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tourist)/itinerary')}>
                                <Ionicons name="add" size={18} color="#fff" />
                                <Text style={styles.emptyBtnText}>Plan a Trip</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        recentItineraries.map((itin) => {
                            const tags = (itin.activityTypes || [itin.activityType]).filter(Boolean);
                            const budgetK = itin.estimatedBudget ? (itin.estimatedBudget / 1000).toFixed(0) + 'K' : '—';
                            return (
                                <TouchableOpacity
                                    key={itin.id}
                                    style={styles.tripCard}
                                    onPress={() => router.push({ pathname: '/(tourist)/itinerary-view', params: { itineraryId: itin.id } })}
                                    activeOpacity={0.85}
                                >
                                    <View style={styles.tripCardLeft}>
                                        <LinearGradient colors={[Colors.primary, Colors.accent]} style={styles.tripCardIcon}>
                                            <Ionicons name="map" size={20} color="#fff" />
                                        </LinearGradient>
                                    </View>
                                    <View style={styles.tripCardBody}>
                                        <Text style={styles.tripCardName} numberOfLines={1}>{itin.name || 'My Trip'}</Text>
                                        <View style={styles.tripCardMeta}>
                                            <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
                                            <Text style={styles.tripCardMetaText}>{itin.availableDays} days</Text>
                                            <Ionicons name="location-outline" size={12} color={Colors.textSecondary} />
                                            <Text style={styles.tripCardMetaText}>{itin.startLocation || '—'}</Text>
                                            <Ionicons name="cash-outline" size={12} color={Colors.textSecondary} />
                                            <Text style={styles.tripCardMetaText}>{budgetK} LKR</Text>
                                        </View>
                                        <View style={styles.tripCardTags}>
                                            {tags.slice(0, 3).map((t, i) => (
                                                <View key={i} style={styles.tag}>
                                                    <Text style={styles.tagText}>{t}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                    <View style={styles.tripCardRight}>
                                        <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

                {/* ── UPCOMING STAYS ── */}
                {upcomingBookings.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Upcoming Stays</Text>
                        {upcomingBookings.map((booking) => (
                            <View key={booking.id} style={styles.bookingCard}>
                                <View style={styles.bookingAccentBar} />
                                <View style={styles.bookingCardInner}>
                                    <View style={styles.bookingCardTop}>
                                        <View style={styles.bookingIconWrap}>
                                            <Ionicons name="bed-outline" size={22} color={Colors.accent} />
                                        </View>
                                        <View style={styles.bookingInfo}>
                                            <Text style={styles.bookingHotel} numberOfLines={1}>{booking.hotelName}</Text>
                                            <Text style={styles.bookingRoom}>{booking.roomType}</Text>
                                        </View>
                                        <View style={[styles.statusBadge, {
                                            backgroundColor: booking.status === 'confirmed' ? Colors.success + '20' : Colors.warning + '20'
                                        }]}>
                                            <Text style={[styles.statusText, {
                                                color: booking.status === 'confirmed' ? Colors.success : Colors.warning
                                            }]}>{booking.status}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.bookingDatesRow}>
                                        <View style={styles.bookingDate}>
                                            <Text style={styles.bookingDateLabel}>Check-in</Text>
                                            <Text style={styles.bookingDateValue}>{booking.checkIn}</Text>
                                        </View>
                                        <View style={styles.bookingArrow}>
                                            <Ionicons name="arrow-forward" size={16} color={Colors.textSecondary} />
                                        </View>
                                        <View style={styles.bookingDate}>
                                            <Text style={styles.bookingDateLabel}>Check-out</Text>
                                            <Text style={styles.bookingDateValue}>{booking.checkOut}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── SRI LANKA TIP CARD ── */}
                <View style={styles.tipCard}>
                    <LinearGradient colors={['#E3F2FD', '#BBDEFB']} style={styles.tipCardGrad}>
                        <Ionicons name="bulb-outline" size={22} color={Colors.accent} />
                        <View style={styles.tipCardText}>
                            <Text style={styles.tipTitle}>Did you know?</Text>
                            <Text style={styles.tipBody}>Sri Lanka has 8 UNESCO World Heritage Sites — including Sigiriya, Polonnaruwa, and Kandy's Sacred City.</Text>
                        </View>
                    </LinearGradient>
                </View>

                <View style={{ height: Spacing.xl * 2 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F4F0' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4F0' },
    scrollContent: { paddingBottom: 0 },

    // Header
    header: { paddingTop: 56, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg, overflow: 'hidden' },
    headerCircle1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -40 },
    headerCircle2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, left: 20 },
    headerContent: { position: 'relative' },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
    emergencyBanner: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.sm, marginBottom: 4 },
    emergencyBannerText: { fontSize: 11, fontWeight: 'bold', color: Colors.danger },
    greeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '400' },
    userName: { fontSize: 28, fontWeight: 'bold', color: '#fff', letterSpacing: -0.5 },
    headerTagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
    alertDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.warning, justifyContent: 'center', alignItems: 'center' },
    friendsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1565C0', paddingHorizontal: 11, paddingVertical: 9, borderRadius: BorderRadius.round, marginRight: 6, elevation: 4 },
    friendsBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    sosBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.danger, paddingHorizontal: 14, paddingVertical: 9, borderRadius: BorderRadius.round, elevation: 4 },
    sosBtnActive: { backgroundColor: '#6A0DAD' },
    sosBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
    statsStrip: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: BorderRadius.lg, paddingVertical: Spacing.md },
    statCell: { flex: 1, alignItems: 'center' },
    statNum: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
    statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 4 },

    // Profile button (new)
    profileBtn: { marginRight: 2 },
    profileBtnInner: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
        justifyContent: 'center', alignItems: 'center',
    },

    // Sections
    section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: Spacing.md },
    seeAll: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

    // Quick actions 2x2
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    actionTile: { width: (width - Spacing.lg * 2 - Spacing.sm) / 2, borderRadius: BorderRadius.lg, overflow: 'hidden', elevation: 3 },
    actionGrad: { padding: Spacing.md, minHeight: 96, justifyContent: 'flex-end' },
    actionIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
    actionLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },

    // Featured destinations
    horizontalScroll: { paddingRight: Spacing.lg },
    featuredCard: { width: CARD_W, height: 210, borderRadius: BorderRadius.xl, overflow: 'hidden', marginRight: Spacing.md, elevation: 5 },
    featuredGrad: { flex: 1, padding: Spacing.md, justifyContent: 'space-between', position: 'relative' },
    featuredBlob1: { position: 'absolute', width: 130, height: 130, borderRadius: 65, top: -30, right: -30 },
    featuredBlob2: { position: 'absolute', width: 80, height: 80, borderRadius: 40, bottom: 20, left: -10 },
    featuredTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    featuredTagPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: BorderRadius.round, borderWidth: 1 },
    featuredTagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
    popularityPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.round },
    popularityText: { fontSize: 11, fontWeight: '700', color: '#FFD54F' },
    featuredIconWrap: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
    featuredName: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 3, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    featuredDistrictRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 },
    featuredDistrictText: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
    featuredFact: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic' },

    // Safety banner
    safetyBanner: { marginHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: BorderRadius.lg, overflow: 'hidden', elevation: 3 },
    safetyBannerGrad: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
    safetyBannerIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    safetyBannerText: { flex: 1 },
    safetyBannerTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
    safetyBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

    // Trip cards
    emptyCard: { backgroundColor: '#fff', borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', elevation: 1 },
    emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
    emptySubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.lg },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.round },
    emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    tripCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, elevation: 2 },
    tripCardLeft: { marginRight: Spacing.sm },
    tripCardIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    tripCardBody: { flex: 1 },
    tripCardName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 3 },
    tripCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5, flexWrap: 'wrap' },
    tripCardMetaText: { fontSize: 11, color: Colors.textSecondary },
    tripCardTags: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
    tag: { backgroundColor: Colors.primary + '18', paddingHorizontal: 7, paddingVertical: 2, borderRadius: BorderRadius.round },
    tagText: { fontSize: 10, color: Colors.primary, fontWeight: '700', textTransform: 'capitalize' },
    tripCardRight: { paddingLeft: Spacing.sm },

    // Booking cards
    bookingCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, overflow: 'hidden', elevation: 2 },
    bookingAccentBar: { width: 4, backgroundColor: Colors.accent },
    bookingCardInner: { flex: 1, padding: Spacing.md },
    bookingCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
    bookingIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent + '15', justifyContent: 'center', alignItems: 'center' },
    bookingInfo: { flex: 1 },
    bookingHotel: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
    bookingRoom: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.round },
    statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    bookingDatesRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: BorderRadius.md, padding: Spacing.sm },
    bookingDate: { flex: 1, alignItems: 'center' },
    bookingDateLabel: { fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    bookingDateValue: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', marginTop: 2 },
    bookingArrow: { paddingHorizontal: Spacing.sm },

    // Tip card
    tipCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: BorderRadius.lg, overflow: 'hidden', elevation: 1 },
    tipCardGrad: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.md, gap: Spacing.sm },
    tipCardText: { flex: 1 },
    tipTitle: { fontSize: 13, fontWeight: '700', color: Colors.accent, marginBottom: 3 },
    tipBody: { fontSize: 13, color: '#37474F', lineHeight: 18 },
});