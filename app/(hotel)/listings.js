// app/(hotel)/listings.js
import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
    ActivityIndicator,
    Switch,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getHotelListings, createListing, updateListing, deleteListing } from '../../services/api';

const AMENITIES_LIST = [
    { id: 'wifi', label: 'WiFi', icon: 'wifi' },
    { id: 'ac', label: 'A/C', icon: 'snow' },
    { id: 'tv', label: 'TV', icon: 'tv' },
    { id: 'minibar', label: 'Mini Bar', icon: 'beer' },
    { id: 'breakfast', label: 'Breakfast', icon: 'restaurant' },
    { id: 'parking', label: 'Parking', icon: 'car' },
    { id: 'pool', label: 'Pool', icon: 'water' },
    { id: 'gym', label: 'Gym', icon: 'fitness' },
    { id: 'spa', label: 'Spa', icon: 'sparkles' },
    { id: 'balcony', label: 'Balcony', icon: 'home' },
    { id: 'safe', label: 'Safe', icon: 'lock-closed' },
    { id: 'kitchenette', label: 'Kitchenette', icon: 'cafe' },
];

const emptyForm = {
    roomType: '',
    description: '',
    price: '',
    maxGuests: '2',
    amenities: [],
    availability: 'available',
};

export default function ListingsScreen() {
    const { user, userProfile } = useAuth();
    const hotelId = userProfile?.hotelId || user?.uid;

    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);

    useFocusEffect(
        useCallback(() => {
            loadListings();
        }, [hotelId])
    );

    const loadListings = async () => {
        if (!hotelId) return;
        setLoading(true);
        try {
            const data = await getHotelListings(hotelId);
            setListings(data || []);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEdit = (listing) => {
        setEditingId(listing.id);
        setForm({
            roomType: listing.roomType || '',
            description: listing.description || '',
            price: String(listing.price || ''),
            maxGuests: String(listing.maxGuests || 2),
            amenities: listing.amenities || [],
            availability: listing.availability || 'available',
        });
        setShowModal(true);
    };

    const toggleAmenity = (id) => {
        setForm((f) => ({
            ...f,
            amenities: f.amenities.includes(id) ? f.amenities.filter((a) => a !== id) : [...f.amenities, id],
        }));
    };

    const handleSave = async () => {
        if (!form.roomType.trim() || !form.price) {
            Alert.alert('Required', 'Room type and price are required.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                roomType: form.roomType.trim(),
                description: form.description.trim(),
                price: parseInt(form.price),
                maxGuests: parseInt(form.maxGuests) || 2,
                amenities: form.amenities,
                availability: form.availability,
            };

            if (editingId) {
                await updateListing(hotelId, editingId, payload);
                Alert.alert('Updated', 'Listing updated successfully.');
            } else {
                await createListing(hotelId, payload);
                Alert.alert('Created', 'New room listing added.');
            }

            setShowModal(false);
            await loadListings();
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (listing) => {
        Alert.alert('Delete Listing', `Delete "${listing.roomType}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteListing(hotelId, listing.id);
                        await loadListings();
                    } catch (err) {
                        Alert.alert('Error', err.message);
                    }
                },
            },
        ]);
    };

    const handleToggleStatus = async (listing) => {
        try {
            const newStatus = listing.status === 'active' ? 'inactive' : 'active';
            await updateListing(hotelId, listing.id, { status: newStatus });
            await loadListings();
        } catch (err) {
            Alert.alert('Error', err.message);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.secondary} />
                <Text style={styles.loadingText}>Loading listings...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={[Colors.secondary, Colors.warning]} style={styles.header}>
                <Text style={styles.headerTitle}>Room Listings</Text>
                <Text style={styles.headerSubtitle}>{listings.length} listing{listings.length !== 1 ? 's' : ''}</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {listings.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="bed-outline" size={80} color={Colors.textSecondary} />
                        <Text style={styles.emptyTitle}>No Listings Yet</Text>
                        <Text style={styles.emptySubtext}>Add your first room listing to start receiving bookings.</Text>
                    </View>
                ) : (
                    listings.map((listing) => (
                        <View key={listing.id} style={styles.listingCard}>
                            <View style={styles.listingHeader}>
                                <View>
                                    <Text style={styles.listingRoomType}>{listing.roomType}</Text>
                                    <Text style={styles.listingDescription} numberOfLines={2}>{listing.description}</Text>
                                </View>
                                <View style={styles.listingActions}>
                                    <TouchableOpacity style={styles.editButton} onPress={() => openEdit(listing)}>
                                        <Ionicons name="pencil-outline" size={18} color={Colors.accent} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(listing)}>
                                        <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.listingStats}>
                                <View style={styles.statItem}>
                                    <Ionicons name="cash-outline" size={16} color={Colors.textSecondary} />
                                    <Text style={styles.statText}>LKR {(listing.price || 0).toLocaleString()}/night</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
                                    <Text style={styles.statText}>Max {listing.maxGuests} guests</Text>
                                </View>
                                {listing.bookings !== undefined && (
                                    <View style={styles.statItem}>
                                        <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
                                        <Text style={styles.statText}>{listing.bookings} bookings</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.amenitiesRow}>
                                {(listing.amenities || []).slice(0, 5).map((a) => {
                                    const amenity = AMENITIES_LIST.find((am) => am.id === a);
                                    return (
                                        <View key={a} style={styles.amenityChip}>
                                            <Ionicons name={amenity?.icon || 'checkmark'} size={12} color={Colors.primary} />
                                            <Text style={styles.amenityChipText}>{amenity?.label || a}</Text>
                                        </View>
                                    );
                                })}
                                {(listing.amenities || []).length > 5 && (
                                    <View style={styles.amenityChip}>
                                        <Text style={styles.amenityChipText}>+{listing.amenities.length - 5}</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.listingFooter}>
                                <View style={[styles.availabilityBadge, { backgroundColor: listing.availability === 'available' ? Colors.success + '20' : Colors.warning + '20' }]}>
                                    <Text style={[styles.availabilityText, { color: listing.availability === 'available' ? Colors.success : Colors.warning }]}>
                                        {listing.availability === 'available' ? 'Available' : 'Unavailable'}
                                    </Text>
                                </View>
                                <View style={styles.switchRow}>
                                    <Text style={styles.switchLabel}>{listing.status === 'active' ? 'Active' : 'Inactive'}</Text>
                                    <Switch
                                        value={listing.status === 'active'}
                                        onValueChange={() => handleToggleStatus(listing)}
                                        trackColor={{ false: Colors.border, true: Colors.success + '80' }}
                                        thumbColor={listing.status === 'active' ? Colors.success : Colors.textSecondary}
                                    />
                                </View>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            <TouchableOpacity style={styles.fab} onPress={openAdd}>
                <Ionicons name="add" size={28} color={Colors.surface} />
            </TouchableOpacity>

            {/* Add/Edit Modal */}
            <Modal visible={showModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingId ? 'Edit Listing' : 'Add Room'}</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Room Type *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Deluxe Ocean View Room"
                                value={form.roomType}
                                onChangeText={(v) => setForm((f) => ({ ...f, roomType: v }))}
                            />

                            <Text style={styles.inputLabel}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.inputMulti]}
                                placeholder="Describe the room..."
                                multiline
                                value={form.description}
                                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                            />

                            <Text style={styles.inputLabel}>Price per Night (LKR) *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="12000"
                                keyboardType="numeric"
                                value={form.price}
                                onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                            />

                            <Text style={styles.inputLabel}>Max Guests</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="2"
                                keyboardType="numeric"
                                value={form.maxGuests}
                                onChangeText={(v) => setForm((f) => ({ ...f, maxGuests: v }))}
                            />

                            <Text style={styles.inputLabel}>Amenities</Text>
                            <View style={styles.amenitiesGrid}>
                                {AMENITIES_LIST.map((amenity) => (
                                    <TouchableOpacity
                                        key={amenity.id}
                                        style={[styles.amenityToggle, form.amenities.includes(amenity.id) && styles.amenityToggleActive]}
                                        onPress={() => toggleAmenity(amenity.id)}
                                    >
                                        <Ionicons
                                            name={amenity.icon}
                                            size={18}
                                            color={form.amenities.includes(amenity.id) ? Colors.surface : Colors.textSecondary}
                                        />
                                        <Text style={[styles.amenityToggleText, form.amenities.includes(amenity.id) && styles.amenityToggleTextActive]}>
                                            {amenity.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Availability</Text>
                            <View style={styles.availRow}>
                                {['available', 'unavailable'].map((v) => (
                                    <TouchableOpacity
                                        key={v}
                                        style={[styles.availOption, form.availability === v && styles.availOptionActive]}
                                        onPress={() => setForm((f) => ({ ...f, availability: v }))}
                                    >
                                        <Text style={[styles.availOptionText, form.availability === v && styles.availOptionTextActive]}>
                                            {v.charAt(0).toUpperCase() + v.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color={Colors.surface} />
                                ) : (
                                    <Text style={styles.saveButtonText}>{editingId ? 'Save Changes' : 'Add Listing'}</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: Spacing.md, fontSize: 16, color: Colors.textSecondary },
    header: { paddingTop: 60, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
    headerTitle: { fontSize: 30, fontWeight: 'bold', color: Colors.surface },
    headerSubtitle: { fontSize: 15, color: Colors.surface, opacity: 0.85, marginTop: 4 },
    content: { flex: 1 },
    scrollContent: { padding: Spacing.lg, paddingBottom: 100 },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xl * 2 },
    emptyTitle: { fontSize: 20, fontWeight: '600', color: Colors.text, marginTop: Spacing.lg },
    emptySubtext: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
    listingCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, elevation: 2 },
    listingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
    listingRoomType: { fontSize: 17, fontWeight: 'bold', color: Colors.text },
    listingDescription: { fontSize: 13, color: Colors.textSecondary, marginTop: 3, maxWidth: '80%' },
    listingActions: { flexDirection: 'row', gap: Spacing.sm },
    editButton: { padding: 6, backgroundColor: Colors.accent + '15', borderRadius: BorderRadius.sm },
    deleteButton: { padding: 6, backgroundColor: Colors.danger + '15', borderRadius: BorderRadius.sm },
    listingStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.sm },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 13, color: Colors.textSecondary },
    amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: Spacing.sm },
    amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary + '15', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
    amenityChipText: { fontSize: 11, color: Colors.primary, fontWeight: '500' },
    listingFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs },
    availabilityBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
    availabilityText: { fontSize: 12, fontWeight: '600' },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    switchLabel: { fontSize: 13, color: Colors.textSecondary },
    fab: { position: 'absolute', bottom: Spacing.xl, right: Spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', elevation: 6 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
    inputLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 5, marginTop: Spacing.sm },
    input: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, fontSize: 15, marginBottom: Spacing.xs },
    inputMulti: { height: 80, textAlignVertical: 'top' },
    amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    amenityToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
    amenityToggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    amenityToggleText: { fontSize: 13, color: Colors.textSecondary },
    amenityToggleTextActive: { color: Colors.surface, fontWeight: '600' },
    availRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    availOption: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 2, borderColor: Colors.border, alignItems: 'center' },
    availOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
    availOptionText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
    availOptionTextActive: { color: Colors.primary },
    saveButton: { backgroundColor: Colors.secondary, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.xl },
    saveButtonText: { color: Colors.surface, fontSize: 17, fontWeight: 'bold' },
});