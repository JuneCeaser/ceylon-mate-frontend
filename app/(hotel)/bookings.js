// app/(hotel)/bookings.js
import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Modal,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getHotelBookings, updateBookingStatus } from '../../services/api';

const FILTERS = ['all', 'pending', 'confirmed', 'cancelled'];

export default function BookingsScreen() {
    const { user, userProfile } = useAuth();
    const hotelId = userProfile?.hotelId || user?.uid;

    const [bookings, setBookings] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);

    useFocusEffect(
        useCallback(() => {
            loadBookings();
        }, [hotelId])
    );

    const loadBookings = async (isRefresh = false) => {
        if (!hotelId) return;
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const data = await getHotelBookings(hotelId);
            setBookings(data || []);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleStatusUpdate = async (bookingId, status) => {
        setUpdatingId(bookingId);
        try {
            await updateBookingStatus(bookingId, status);
            await loadBookings();
            setSelectedBooking(null);
            Alert.alert('Updated', `Booking ${status} successfully.`);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setUpdatingId(null);
        }
    };

    const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

    const getStatusColor = (status) => {
        switch (status) {
            case 'confirmed': return Colors.success;
            case 'pending': return Colors.warning;
            case 'cancelled': return Colors.danger;
            default: return Colors.textSecondary;
        }
    };

    const pendingCount = bookings.filter((b) => b.status === 'pending').length;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.secondary} />
                <Text style={styles.loadingText}>Loading bookings...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={[Colors.secondary, Colors.warning]} style={styles.header}>
                <Text style={styles.headerTitle}>Bookings</Text>
                <Text style={styles.headerSubtitle}>
                    {bookings.length} total · {pendingCount} pending
                </Text>
            </LinearGradient>

            {/* Filter tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
                {FILTERS.map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterTab, filter === f && styles.filterTabActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                            {f !== 'all' && ` (${bookings.filter((b) => b.status === f).length})`}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => loadBookings(true)} colors={[Colors.secondary]} />
                }
            >
                {filtered.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={64} color={Colors.textSecondary} />
                        <Text style={styles.emptyText}>No {filter !== 'all' ? filter : ''} bookings</Text>
                    </View>
                ) : (
                    filtered.map((booking) => (
                        <TouchableOpacity
                            key={booking.id}
                            style={styles.bookingCard}
                            onPress={() => setSelectedBooking(booking)}
                        >
                            <View style={styles.bookingCardHeader}>
                                <View>
                                    <Text style={styles.guestName}>{booking.touristName}</Text>
                                    <Text style={styles.roomType}>{booking.roomType}</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                                    <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                                        {booking.status.toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.bookingDatesRow}>
                                <View style={styles.bookingDateItem}>
                                    <Ionicons name="log-in-outline" size={16} color={Colors.textSecondary} />
                                    <Text style={styles.dateText}>{booking.checkIn}</Text>
                                </View>
                                <Ionicons name="arrow-forward" size={14} color={Colors.textSecondary} />
                                <View style={styles.bookingDateItem}>
                                    <Ionicons name="log-out-outline" size={16} color={Colors.textSecondary} />
                                    <Text style={styles.dateText}>{booking.checkOut}</Text>
                                </View>
                                <Text style={styles.nightsText}>{booking.nights}n</Text>
                            </View>

                            <View style={styles.bookingFooter}>
                                <View style={styles.bookingMeta}>
                                    <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
                                    <Text style={styles.metaText}>{booking.numGuests} guests</Text>
                                </View>
                                <Text style={styles.totalPrice}>LKR {(booking.totalPrice || 0).toLocaleString()}</Text>
                            </View>

                            {booking.status === 'pending' && (
                                <View style={styles.quickActions}>
                                    <TouchableOpacity
                                        style={styles.confirmBtn}
                                        onPress={() => handleStatusUpdate(booking.id, 'confirmed')}
                                        disabled={updatingId === booking.id}
                                    >
                                        {updatingId === booking.id ? (
                                            <ActivityIndicator size="small" color={Colors.surface} />
                                        ) : (
                                            <>
                                                <Ionicons name="checkmark" size={16} color={Colors.surface} />
                                                <Text style={styles.confirmBtnText}>Confirm</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.cancelBtn}
                                        onPress={() =>
                                            Alert.alert('Cancel Booking', 'Are you sure?', [
                                                { text: 'No', style: 'cancel' },
                                                { text: 'Yes', style: 'destructive', onPress: () => handleStatusUpdate(booking.id, 'cancelled') },
                                            ])
                                        }
                                        disabled={updatingId === booking.id}
                                    >
                                        <Ionicons name="close" size={16} color={Colors.danger} />
                                        <Text style={styles.cancelBtnText}>Decline</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Booking Detail Modal */}
            <Modal visible={!!selectedBooking} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedBooking && (
                            <>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Booking Details</Text>
                                    <TouchableOpacity onPress={() => setSelectedBooking(null)}>
                                        <Ionicons name="close" size={24} color={Colors.text} />
                                    </TouchableOpacity>
                                </View>

                                <View style={[styles.statusBannerFull, { backgroundColor: getStatusColor(selectedBooking.status) + '20' }]}>
                                    <Text style={[styles.statusBannerText, { color: getStatusColor(selectedBooking.status) }]}>
                                        {selectedBooking.status.toUpperCase()}
                                    </Text>
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false}>
                                    <DetailRow icon="person-outline" label="Guest" value={selectedBooking.touristName} />
                                    <DetailRow icon="mail-outline" label="Email" value={selectedBooking.touristEmail} />
                                    <DetailRow icon="call-outline" label="Phone" value={selectedBooking.touristPhone} />
                                    <DetailRow icon="bed-outline" label="Room" value={selectedBooking.roomType} />
                                    <DetailRow icon="log-in-outline" label="Check-in" value={selectedBooking.checkIn} />
                                    <DetailRow icon="log-out-outline" label="Check-out" value={selectedBooking.checkOut} />
                                    <DetailRow icon="moon-outline" label="Nights" value={String(selectedBooking.nights || 0)} />
                                    <DetailRow icon="people-outline" label="Guests" value={String(selectedBooking.numGuests)} />
                                    <DetailRow icon="cash-outline" label="Price/Night" value={`LKR ${(selectedBooking.pricePerNight || 0).toLocaleString()}`} />
                                    <DetailRow icon="wallet-outline" label="Total" value={`LKR ${(selectedBooking.totalPrice || 0).toLocaleString()}`} bold />
                                    {selectedBooking.specialRequests && (
                                        <DetailRow icon="chatbubble-outline" label="Special Requests" value={selectedBooking.specialRequests} />
                                    )}
                                    <DetailRow icon="calendar-outline" label="Booked On" value={new Date(selectedBooking.bookingDate || selectedBooking.createdAt).toLocaleDateString()} />

                                    {selectedBooking.status === 'pending' && (
                                        <View style={styles.modalActions}>
                                            <TouchableOpacity
                                                style={styles.confirmBtnLg}
                                                onPress={() => handleStatusUpdate(selectedBooking.id, 'confirmed')}
                                                disabled={updatingId === selectedBooking.id}
                                            >
                                                {updatingId === selectedBooking.id ? (
                                                    <ActivityIndicator color={Colors.surface} />
                                                ) : (
                                                    <Text style={styles.confirmBtnText}>Confirm Booking</Text>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.cancelBtnLg}
                                                onPress={() =>
                                                    Alert.alert('Cancel Booking', 'Decline this booking?', [
                                                        { text: 'No', style: 'cancel' },
                                                        { text: 'Yes', style: 'destructive', onPress: () => handleStatusUpdate(selectedBooking.id, 'cancelled') },
                                                    ])
                                                }
                                                disabled={updatingId === selectedBooking.id}
                                            >
                                                <Text style={styles.cancelBtnLgText}>Decline</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function DetailRow({ icon, label, value, bold }) {
    return (
        <View style={detailStyles.row}>
            <Ionicons name={icon} size={18} color={Colors.textSecondary} style={detailStyles.icon} />
            <Text style={detailStyles.label}>{label}</Text>
            <Text style={[detailStyles.value, bold && detailStyles.valueBold]}>{value}</Text>
        </View>
    );
}

const detailStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
    icon: { marginRight: Spacing.sm },
    label: { fontSize: 14, color: Colors.textSecondary, width: 110 },
    value: { flex: 1, fontSize: 14, color: Colors.text },
    valueBold: { fontWeight: 'bold', color: Colors.primary },
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: Spacing.md, fontSize: 16, color: Colors.textSecondary },
    header: { paddingTop: 60, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
    headerTitle: { fontSize: 30, fontWeight: 'bold', color: Colors.surface },
    headerSubtitle: { fontSize: 15, color: Colors.surface, opacity: 0.85, marginTop: 4 },
    filterBar: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, maxHeight: 50 },
    filterBarContent: { paddingHorizontal: Spacing.md, gap: Spacing.sm, alignItems: 'center' },
    filterTab: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.round },
    filterTabActive: { backgroundColor: Colors.secondary + '20' },
    filterTabText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
    filterTabTextActive: { color: Colors.secondary, fontWeight: '700' },
    content: { flex: 1 },
    scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xl * 2 },
    emptyText: { fontSize: 16, color: Colors.textSecondary, marginTop: Spacing.md },
    bookingCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, elevation: 2 },
    bookingCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
    guestName: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
    roomType: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
    statusText: { fontSize: 11, fontWeight: 'bold' },
    bookingDatesRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    bookingDateItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dateText: { fontSize: 13, color: Colors.text },
    nightsText: { marginLeft: 'auto', fontSize: 13, fontWeight: '600', color: Colors.primary },
    bookingFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
    bookingMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 13, color: Colors.textSecondary },
    totalPrice: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
    quickActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    confirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.success, borderRadius: BorderRadius.sm, paddingVertical: Spacing.sm, gap: 4 },
    confirmBtnText: { color: Colors.surface, fontSize: 14, fontWeight: '600' },
    cancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.danger, borderRadius: BorderRadius.sm, paddingVertical: Spacing.sm, gap: 4 },
    cancelBtnText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
    statusBannerFull: { borderRadius: BorderRadius.md, padding: Spacing.sm, alignItems: 'center', marginBottom: Spacing.md },
    statusBannerText: { fontSize: 16, fontWeight: 'bold' },
    modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, marginBottom: Spacing.xl },
    confirmBtnLg: { flex: 1, backgroundColor: Colors.success, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center' },
    cancelBtnLg: { flex: 1, borderWidth: 2, borderColor: Colors.danger, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center' },
    cancelBtnLgText: { color: Colors.danger, fontSize: 16, fontWeight: 'bold' },
});