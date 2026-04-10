// app/(hotel)/dashboard.js
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    RefreshControl,
    Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getHotelStats, getHotelBookings } from '../../services/api';

const { width } = Dimensions.get('window');
const PAD = 20;

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
    bg:        '#F7F8FC',
    surface:   '#FFFFFF',
    surfaceEl: '#F0F2F8',
    border:    '#E4E8F0',
    gold:      '#C9A84C',
    goldLight: '#E8C87A',
    goldDim:   '#C9A84C22',
    text:      '#1A1D2E',
    textSub:   '#6B7280',
    green:     '#2DC98A',
    greenDim:  '#2DC98A22',
    amber:     '#F59E0B',
    amberDim:  '#F59E0B22',
    red:       '#EF4444',
    redDim:    '#EF444422',
    blue:      '#60A5FA',
    blueDim:   '#60A5FA22',
};

// ── Mini sparkline (pure RN, no lib) ─────────────────────────────────────────
function Sparkline({ data, color, width: w, height: h }) {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => ({
        x: (i / (data.length - 1)) * w,
        y: h - ((v - min) / range) * h,
    }));

    return (
        <View style={{ width: w, height: h, overflow: 'hidden' }}>
            {pts.slice(1).map((pt, i) => {
                const prev = pts[i];
                const dx = pt.x - prev.x;
                const dy = pt.y - prev.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                return (
                    <View
                        key={i}
                        style={{
                            position: 'absolute',
                            left: prev.x,
                            top: prev.y - 1,
                            width: len,
                            height: 2,
                            backgroundColor: color,
                            borderRadius: 1,
                            transform: [{ rotate: `${angle}deg` }, { translateY: 0 }],
                            transformOrigin: '0 50%',
                            opacity: 0.85,
                        }}
                    />
                );
            })}
            {/* dot at latest */}
            <View style={{
                position: 'absolute',
                left: pts[pts.length - 1].x - 3,
                top: pts[pts.length - 1].y - 3,
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: color,
            }} />
        </View>
    );
}

// ── Occupancy ring ────────────────────────────────────────────────────────────
function OccupancyRing({ pct }) {
    const SIZE = 88;
    const STROKE = 7;
    const R = (SIZE - STROKE) / 2;
    const CIRC = 2 * Math.PI * R;
    const filled = (pct / 100) * CIRC;

    // Simulate with a series of thin bars in a circle approximation
    // (Real SVG not available in RN without lib — use segmented bars)
    const segments = 24;
    return (
        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
            {Array.from({ length: segments }).map((_, i) => {
                const angle = (i / segments) * 360;
                const filled = i < Math.round((pct / 100) * segments);
                return (
                    <View
                        key={i}
                        style={{
                            position: 'absolute',
                            width: STROKE,
                            height: 2.5,
                            borderRadius: 2,
                            backgroundColor: filled ? C.gold : C.border,
                            left: SIZE / 2 - STROKE / 2,
                            top: STROKE / 2,
                            transform: [
                                { translateY: R - STROKE / 2 },
                                { rotate: `${angle}deg` },
                                { translateY: -(R - STROKE / 2) },
                            ],
                        }}
                    />
                );
            })}
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.gold }}>{pct}%</Text>
            <Text style={{ fontSize: 9, color: C.textSub, marginTop: 1 }}>Confirmed</Text>
        </View>
    );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const cfg = {
        confirmed: { bg: C.greenDim, txt: C.green,  label: 'Confirmed' },
        pending:   { bg: C.amberDim, txt: C.amber,  label: 'Pending'   },
        cancelled: { bg: C.redDim,   txt: C.red,    label: 'Cancelled' },
    }[status] || { bg: C.border, txt: C.textSub, label: status };
    return (
        <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: cfg.txt, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {cfg.label}
            </Text>
        </View>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HotelDashboard() {
    const router   = useRouter();
    const { user, userProfile } = useAuth();

    const [stats,          setStats]          = useState(null);
    const [recentBookings, setRecentBookings] = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [refreshing,     setRefreshing]     = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const hotelId = userProfile?.hotelId || user?.uid;

    useFocusEffect(useCallback(() => { loadData(); }, [hotelId]));

    const loadData = async (isRefresh = false) => {
        if (!hotelId) return;
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const [statsData, bookingsData] = await Promise.all([
                getHotelStats(hotelId),
                getHotelBookings(hotelId),
            ]);
            setStats(statsData);
            setRecentBookings((bookingsData || []).slice(0, 6));
            Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }).start();
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    if (loading) {
        return (
            <View style={s.loader}>
                <ActivityIndicator size="large" color={C.gold} />
                <Text style={s.loaderText}>Loading dashboard…</Text>
            </View>
        );
    }

    const total    = stats?.totalRevenue    || 0;
    const pending  = stats?.pending         || 0;
    const confirmed= stats?.confirmed       || 0;
    const cancelled= stats?.cancelled       || 0;
    const listings = stats?.activeListings  || 0;
    const totalB   = stats?.totalBookings   || 0;
    const occPct   = totalB ? Math.round((confirmed / totalB) * 100) : 0;

    // Monthly revenue sparkline values
    const monthlyVals = stats?.monthlyRevenue
        ? Object.values(stats.monthlyRevenue)
        : [0, 0, 0, 0, 0, 0];

    const hotelLabel = userProfile?.hotelName || userProfile?.name || 'Your Property';
    const city       = userProfile?.hotelCity  || '';

    return (
        <View style={s.root}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.scroll}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={C.gold} />
                }
            >
                {/* ── HEADER ── */}
                <LinearGradient
                    colors={['#FFFBF0', '#FFF8E1']}
                    style={s.header}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                    <View style={s.headerDeco} />
                    <View style={s.headerRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.headerEyebrow}>Property Dashboard</Text>
                            <Text style={s.headerHotel} numberOfLines={1}>{hotelLabel}</Text>
                            {city ? (
                                <View style={s.headerCity}>
                                    <Ionicons name="location-outline" size={12} color={C.goldLight} />
                                    <Text style={s.headerCityText}>{city}</Text>
                                </View>
                            ) : null}
                        </View>
                        <TouchableOpacity
                            style={s.notifBtn}
                            onPress={() => router.push('/(hotel)/bookings')}
                        >
                            {pending > 0 && (
                                <View style={s.notifBadge}>
                                    <Text style={s.notifBadgeText}>{pending}</Text>
                                </View>
                            )}
                            <Ionicons name="notifications-outline" size={22} color={C.gold} />
                        </TouchableOpacity>
                    </View>

                    {/* Revenue hero */}
                    <View style={s.revenueHero}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.revenueLabel}>Total Revenue</Text>
                            <Text style={s.revenueValue}>
                                LKR {total >= 1000000
                                ? `${(total / 1000000).toFixed(2)}M`
                                : `${(total / 1000).toFixed(0)}K`}
                            </Text>
                            <Text style={s.revenueSubLabel}>
                                {confirmed} confirmed · {pending} pending
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 8 }}>
                            <Sparkline
                                data={monthlyVals}
                                color={C.gold}
                                width={110}
                                height={44}
                            />
                            <Text style={s.sparkLabel}>6-month trend</Text>
                        </View>
                    </View>
                </LinearGradient>

                <Animated.View style={{ opacity: fadeAnim }}>

                    {/* ── KPI TILES ── */}
                    <View style={s.kpiRow}>
                        <View style={[s.kpiTile, { flex: 1.3 }]}>
                            <OccupancyRing pct={occPct} />
                            <Text style={s.kpiTileLabel}>Confirmation{'\n'}Rate</Text>
                        </View>

                        <View style={s.kpiCol}>
                            <View style={[s.kpiTileSmall, { borderColor: C.greenDim }]}>
                                <Ionicons name="checkmark-circle-outline" size={18} color={C.green} />
                                <Text style={[s.kpiSmallVal, { color: C.green }]}>{confirmed}</Text>
                                <Text style={s.kpiSmallLabel}>Confirmed</Text>
                            </View>
                            <View style={[s.kpiTileSmall, { borderColor: C.redDim }]}>
                                <Ionicons name="close-circle-outline" size={18} color={C.red} />
                                <Text style={[s.kpiSmallVal, { color: C.red }]}>{cancelled}</Text>
                                <Text style={s.kpiSmallLabel}>Cancelled</Text>
                            </View>
                        </View>

                        <View style={s.kpiCol}>
                            <View style={[s.kpiTileSmall, { borderColor: C.amberDim }]}>
                                <Ionicons name="time-outline" size={18} color={C.amber} />
                                <Text style={[s.kpiSmallVal, { color: C.amber }]}>{pending}</Text>
                                <Text style={s.kpiSmallLabel}>Pending</Text>
                            </View>
                            <View style={[s.kpiTileSmall, { borderColor: C.blueDim }]}>
                                <Ionicons name="bed-outline" size={18} color={C.blue} />
                                <Text style={[s.kpiSmallVal, { color: C.blue }]}>{listings}</Text>
                                <Text style={s.kpiSmallLabel}>Listings</Text>
                            </View>
                        </View>
                    </View>

                    {/* ── MONTHLY REVENUE BAR CHART ── */}
                    {stats?.monthlyRevenue && (
                        <View style={s.card}>
                            <Text style={s.cardTitle}>Revenue by Month</Text>
                            <Text style={s.cardSub}>Last 6 months (LKR)</Text>
                            <View style={s.barChart}>
                                {Object.entries(stats.monthlyRevenue).map(([month, val]) => {
                                    const maxVal = Math.max(...Object.values(stats.monthlyRevenue), 1);
                                    const heightPct = val / maxVal;
                                    return (
                                        <View key={month} style={s.barCol}>
                                            <Text style={s.barValText}>
                                                {val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val > 0 ? val : ''}
                                            </Text>
                                            <View style={s.barTrack}>
                                                <LinearGradient
                                                    colors={heightPct > 0.6 ? [C.goldLight, C.gold] : [C.gold + '99', C.gold + '55']}
                                                    style={[s.barFill, { height: `${Math.max(heightPct * 100, 4)}%` }]}
                                                />
                                            </View>
                                            <Text style={s.barLabel}>{month}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* ── PENDING ALERT ── */}
                    {pending > 0 && (
                        <TouchableOpacity
                            style={s.alertBanner}
                            onPress={() => router.push('/(hotel)/bookings')}
                            activeOpacity={0.8}
                        >
                            <View style={s.alertDot} />
                            <Text style={s.alertText}>
                                {pending} booking{pending > 1 ? 's' : ''} awaiting your approval
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={C.amber} />
                        </TouchableOpacity>
                    )}

                    {/* ── RECENT BOOKINGS ── */}
                    <View style={s.section}>
                        <View style={s.sectionRow}>
                            <Text style={s.sectionTitle}>Recent Bookings</Text>
                            <TouchableOpacity onPress={() => router.push('/(hotel)/bookings')}>
                                <Text style={s.sectionLink}>View all</Text>
                            </TouchableOpacity>
                        </View>

                        {recentBookings.length === 0 ? (
                            <View style={[s.card, { alignItems: 'center', paddingVertical: 40 }]}>
                                <Ionicons name="calendar-outline" size={40} color={C.border} />
                                <Text style={[s.cardSub, { marginTop: 12 }]}>No bookings yet</Text>
                            </View>
                        ) : (
                            recentBookings.map((b, i) => (
                                <View key={b.id || i} style={s.bookingCard}>
                                    {/* left accent */}
                                    <View style={[s.bookingAccent, {
                                        backgroundColor:
                                            b.status === 'confirmed' ? C.green :
                                                b.status === 'pending'   ? C.amber : C.red,
                                    }]} />
                                    <View style={{ flex: 1 }}>
                                        <View style={s.bookingTop}>
                                            <Text style={s.bookingGuest} numberOfLines={1}>{b.touristName}</Text>
                                            <StatusBadge status={b.status} />
                                        </View>
                                        <Text style={s.bookingRoom}>{b.roomType}</Text>
                                        <View style={s.bookingMeta}>
                                            <Ionicons name="calendar-outline" size={12} color={C.textSub} />
                                            <Text style={s.bookingMetaText}>{b.checkIn} → {b.checkOut}</Text>
                                            <Text style={s.bookingDot}>·</Text>
                                            <Text style={s.bookingMetaText}>{b.nights}n</Text>
                                            <Text style={s.bookingDot}>·</Text>
                                            <Text style={[s.bookingMetaText, { color: C.goldLight, fontWeight: '700' }]}>
                                                LKR {(b.totalPrice || 0).toLocaleString()}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>

                    {/* ── QUICK ACTIONS ── */}
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Manage</Text>
                        <View style={s.actionRow}>
                            {[
                                { icon: 'bed-outline',      label: 'Rooms',    route: '/(hotel)/listings', color: C.blue },
                                { icon: 'calendar-outline', label: 'Bookings', route: '/(hotel)/bookings', color: C.green },
                                { icon: 'business-outline', label: 'Profile',  route: '/(hotel)/profile',  color: C.gold },
                            ].map((a) => (
                                <TouchableOpacity
                                    key={a.label}
                                    style={s.actionTile}
                                    onPress={() => router.push(a.route)}
                                    activeOpacity={0.75}
                                >
                                    <View style={[s.actionIcon, { backgroundColor: a.color + '22' }]}>
                                        <Ionicons name={a.icon} size={24} color={a.color} />
                                    </View>
                                    <Text style={s.actionLabel}>{a.label}</Text>
                                    <Ionicons name="chevron-forward" size={14} color={C.textSub} style={{ marginTop: 2 }} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={{ height: 40 }} />
                </Animated.View>
            </ScrollView>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.bg },
    scroll:  { paddingBottom: 32 },
    loader:  { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
    loaderText: { marginTop: 14, fontSize: 14, color: C.textSub },

    // Header
    header:        { paddingTop: 58, paddingBottom: 24, paddingHorizontal: PAD, overflow: 'hidden' },
    headerDeco:    { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: C.gold + '15', top: -80, right: -80 },
    headerRow:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
    headerEyebrow: { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, marginBottom: 4 },
    headerHotel:   { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
    headerCity:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
    headerCityText:{ fontSize: 12, color: C.goldLight },
    notifBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: C.goldDim, borderWidth: 1, borderColor: C.gold + '44', justifyContent: 'center', alignItems: 'center' },
    notifBadge:    { position: 'absolute', top: -2, right: -2, backgroundColor: C.red, borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
    notifBadgeText:{ color: '#fff', fontSize: 10, fontWeight: '800' },
    revenueHero:   { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: C.goldDim, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.gold + '33' },
    revenueLabel:  { fontSize: 11, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
    revenueValue:  { fontSize: 30, fontWeight: '900', color: C.gold, letterSpacing: -1 },
    revenueSubLabel: { fontSize: 12, color: C.textSub, marginTop: 4 },
    sparkLabel:    { fontSize: 9, color: C.textSub, letterSpacing: 0.5 },

    // KPI
    kpiRow:        { flexDirection: 'row', gap: 10, marginHorizontal: PAD, marginTop: 16 },
    kpiTile:       { backgroundColor: C.surface, borderRadius: 16, padding: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, gap: 8 },
    kpiTileLabel:  { fontSize: 10, color: C.textSub, textAlign: 'center', lineHeight: 14 },
    kpiCol:        { flex: 1, gap: 10 },
    kpiTileSmall:  { flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    kpiSmallVal:   { fontSize: 22, fontWeight: '800', marginTop: 3 },
    kpiSmallLabel: { fontSize: 10, color: C.textSub, marginTop: 1 },

    // Card
    card:          { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginHorizontal: PAD, marginTop: 14, borderWidth: 1, borderColor: C.border },
    cardTitle:     { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
    cardSub:       { fontSize: 12, color: C.textSub, marginBottom: 14 },

    // Bar chart
    barChart:      { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 8 },
    barCol:        { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
    barValText:    { fontSize: 9, color: C.textSub, marginBottom: 4 },
    barTrack:      { width: '100%', flex: 1, backgroundColor: C.border, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
    barFill:       { width: '100%', borderRadius: 6 },
    barLabel:      { fontSize: 10, color: C.textSub, marginTop: 6 },

    // Alert banner
    alertBanner:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.amberDim, borderWidth: 1, borderColor: C.amber + '44', borderRadius: 12, marginHorizontal: PAD, marginTop: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
    alertDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: C.amber },
    alertText:     { flex: 1, fontSize: 13, fontWeight: '600', color: C.amber },

    // Section
    section:       { marginHorizontal: PAD, marginTop: 22 },
    sectionRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle:  { fontSize: 16, fontWeight: '700', color: C.text },
    sectionLink:   { fontSize: 13, color: C.gold, fontWeight: '600' },

    // Booking card
    bookingCard:   { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
    bookingAccent: { width: 3 },
    bookingTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, padding: 12, paddingBottom: 0 },
    bookingGuest:  { fontSize: 14, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
    bookingRoom:   { fontSize: 12, color: C.textSub, paddingHorizontal: 12, marginBottom: 6 },
    bookingMeta:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingBottom: 12 },
    bookingMetaText: { fontSize: 11, color: C.textSub },
    bookingDot:    { fontSize: 11, color: C.textSub },

    // Quick actions
    actionRow:     { flexDirection: 'row', gap: 10 },
    actionTile:    { flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.border },
    actionIcon:    { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    actionLabel:   { fontSize: 12, fontWeight: '700', color: C.text },
});