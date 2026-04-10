// app/(tourist)/itinerary-view.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/theme';
import { getSimilarAttractions, createBooking } from '../../services/api';

// ── Shared style maps ────────────────────────────────────────────────────────
const CATEGORY_STYLE = {
    beach:        { icon: 'water-outline',     color: '#0288D1', bg: '#E3F2FD' },
    historical:   { icon: 'business-outline',  color: '#6D4C41', bg: '#EFEBE9' },
    cultural:     { icon: 'flower-outline',    color: '#7B1FA2', bg: '#F3E5F5' },
    temple:       { icon: 'home-outline',      color: '#E65100', bg: '#FBE9E7' },
    national_park:{ icon: 'leaf-outline',      color: '#2E7D32', bg: '#E8F5E9' },
    adventure:    { icon: 'bicycle-outline',   color: '#F57C00', bg: '#FFF3E0' },
    mountain:     { icon: 'triangle-outline',  color: '#37474F', bg: '#ECEFF1' },
    waterfall:    { icon: 'rainy-outline',     color: '#1565C0', bg: '#E3F2FD' },
    wildlife:     { icon: 'paw-outline',       color: '#558B2F', bg: '#F1F8E9' },
    scenic:       { icon: 'eye-outline',       color: '#00838F', bg: '#E0F7FA' },
    default:      { icon: 'location-outline',  color: '#455A64', bg: '#ECEFF1' },
};

const AMENITY_ICONS = {
    wifi: 'wifi-outline', pool: 'water-outline', spa: 'sparkles-outline',
    gym: 'barbell-outline', parking: 'car-outline', restaurant: 'restaurant-outline',
    breakfast: 'cafe-outline', ac: 'snow-outline',
};

const DAY_COLOURS = [
    ['#1565C0', '#1976D2'],
    ['#2E7D32', '#388E3C'],
    ['#6A1B9A', '#7B1FA2'],
    ['#E65100', '#F57C00'],
    ['#00695C', '#00897B'],
    ['#AD1457', '#C2185B'],
    ['#37474F', '#546E7A'],
];

function catStyle(cat) {
    return CATEGORY_STYLE[cat?.toLowerCase()] || CATEGORY_STYLE.default;
}

// ── Attraction card (same as results screen) ─────────────────────────────────
function AttractionCard({ attraction, index, onSwap, swapMode }) {
    const cs = catStyle(attraction.category);
    return (
        <TouchableOpacity
            style={[s.attractCard, swapMode && s.attractCardHighlight]}
            onPress={swapMode ? onSwap : undefined}
            activeOpacity={swapMode ? 0.7 : 1}
        >
            <View style={s.timelineDotWrap}>
                <View style={[s.timelineDot, { backgroundColor: cs.color }]}>
                    <Text style={s.timelineDotText}>{index + 1}</Text>
                </View>
                <View style={[s.timelineLine, { backgroundColor: cs.color + '40' }]} />
            </View>

            <View style={[s.attractCardInner, { borderLeftColor: cs.color }]}>
                <View style={[s.attractIconWrap, { backgroundColor: cs.bg }]}>
                    <Ionicons name={cs.icon} size={22} color={cs.color} />
                </View>
                <View style={s.attractBody}>
                    <Text style={s.attractName} numberOfLines={2}>{attraction.name}</Text>
                    <View style={[s.catPill, { backgroundColor: cs.bg }]}>
                        <Text style={[s.catPillText, { color: cs.color }]}>{attraction.category}</Text>
                    </View>
                    <View style={s.attractMeta}>
                        <View style={s.metaChip}>
                            <Ionicons name="time-outline" size={12} color="#666" />
                            <Text style={s.metaChipText}>{parseFloat(attraction.avg_duration_hours || 2).toFixed(1)}h</Text>
                        </View>
                        <View style={s.metaChip}>
                            <Ionicons name="cash-outline" size={12} color="#666" />
                            <Text style={s.metaChipText}>LKR {parseFloat(attraction.avg_cost || 0).toLocaleString()}</Text>
                        </View>
                        {attraction.safety_rating && (
                            <View style={[s.metaChip, { backgroundColor: '#E8F5E9' }]}>
                                <Ionicons name="shield-checkmark-outline" size={12} color="#2E7D32" />
                                <Text style={[s.metaChipText, { color: '#2E7D32' }]}>
                                    {parseFloat(attraction.safety_rating).toFixed(1)}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
                {swapMode && (
                    <View style={s.swapBadge}>
                        <Ionicons name="swap-horizontal" size={16} color="#fff" />
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}

// ── Hotel card ────────────────────────────────────────────────────────────────
function DayHotelCard({ hotel, rooms, onBook }) {
    const [expanded, setExpanded] = useState(false);
    if (!hotel) return (
        <View style={s.noHotelCard}>
            <Ionicons name="bed-outline" size={18} color="#999" />
            <Text style={s.noHotelText}>No hotel found nearby for this day</Text>
        </View>
    );
    const amenities = (hotel.amenities || []).slice(0, 5);
    return (
        <View style={s.hotelCard}>
            <LinearGradient colors={['#1B5E20', '#2E7D32']} style={s.hotelCardHeader}>
                <View style={s.hotelHeaderLeft}>
                    <Ionicons name="bed-outline" size={18} color="#fff" />
                    <View style={{ marginLeft: 8 }}>
                        <Text style={s.hotelName} numberOfLines={1}>{hotel.name}</Text>
                        <Text style={s.hotelMeta} numberOfLines={1}>{hotel.location}</Text>
                    </View>
                </View>
                <View style={s.hotelRatingWrap}>
                    <Ionicons name="star" size={14} color="#FFD54F" />
                    <Text style={s.hotelRatingText}>{parseFloat(hotel.rating || 0).toFixed(1)}</Text>
                </View>
            </LinearGradient>

            <View style={s.hotelCardBody}>
                {amenities.length > 0 && (
                    <View style={s.amenitiesRow}>
                        {amenities.map((a, i) => (
                            <View key={i} style={s.amenityChip}>
                                <Ionicons name={AMENITY_ICONS[a] || 'checkmark-outline'} size={12} color={Colors.primary} />
                                <Text style={s.amenityChipText}>{a}</Text>
                            </View>
                        ))}
                    </View>
                )}
                <View style={s.priceRow}>
                    <Ionicons name="cash-outline" size={14} color="#555" />
                    <Text style={s.priceText}>
                        LKR {(hotel.price_range_min || 0).toLocaleString()} – {(hotel.price_range_max || 0).toLocaleString()} / night
                    </Text>
                </View>
                {rooms && rooms.length > 0 && (
                    <>
                        <TouchableOpacity style={s.expandRoomsBtn} onPress={() => setExpanded(!expanded)}>
                            <Text style={s.expandRoomsBtnText}>{expanded ? 'Hide rooms' : `${rooms.length} rooms available`}</Text>
                            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.primary} />
                        </TouchableOpacity>
                        {expanded && rooms.map((room, ri) => (
                            <TouchableOpacity key={ri} style={s.roomRow} onPress={() => onBook?.(hotel, room)}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.roomType}>{room.type}</Text>
                                    <Text style={s.roomPrice}>LKR {(room.price_per_night || 0).toLocaleString()} / night</Text>
                                </View>
                                <View style={s.bookNowBtn}>
                                    <Text style={s.bookNowText}>Book</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </>
                )}
            </View>
        </View>
    );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ItineraryViewScreen() {
    const router = useRouter();
    const { itineraryId } = useLocalSearchParams();
    const { user, userProfile } = useAuth();

    const [itin, setItin] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Rename
    const [renameModal, setRenameModal] = useState(false);
    const [renameDraft, setRenameDraft] = useState('');
    const [renameLoading, setRenameLoading] = useState(false);

    // Swap / customize
    const [swapMode, setSwapMode] = useState(false);
    const [swappingItem, setSwappingItem] = useState(null);
    const [similarAttractions, setSimilarAttractions] = useState([]);
    const [loadingSimilar, setLoadingSimilar] = useState(false);

    // Booking
    const [bookingModal, setBookingModal] = useState(false);
    const [bookingHotel, setBookingHotel] = useState(null);
    const [bookingRoom, setBookingRoom] = useState(null);
    const [bookingForm, setBookingForm] = useState({ checkIn: '', checkOut: '', numGuests: '2', specialRequests: '' });
    const [bookingLoading, setBookingLoading] = useState(false);

    useFocusEffect(useCallback(() => { loadItinerary(); }, [itineraryId]));

    const loadItinerary = async () => {
        if (!itineraryId) { setNotFound(true); setLoading(false); return; }
        setLoading(true);
        fadeAnim.setValue(0);
        try {
            const snap = await getDoc(doc(db, 'itineraries', itineraryId));
            if (!snap.exists()) { setNotFound(true); return; }
            const data = { id: snap.id, ...snap.data() };
            setItin(data);
            Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const openRename = () => {
        setRenameDraft(itin?.name || 'My Trip');
        setRenameModal(true);
    };

    const confirmRename = async () => {
        if (!renameDraft.trim()) return;
        setRenameLoading(true);
        try {
            await updateDoc(doc(db, 'itineraries', itineraryId), { name: renameDraft.trim() });
            setItin((prev) => ({ ...prev, name: renameDraft.trim() }));
            setRenameModal(false);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setRenameLoading(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete trip',
            `Delete "${itin?.name || 'this trip'}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'itineraries', itineraryId));
                            router.back();
                        } catch (err) {
                            Alert.alert('Error', err.message);
                        }
                    },
                },
            ]
        );
    };

    // Build day plan from saved itinerary_days OR selectedAttractions fallback
    const buildDayPlan = () => {
        if (!itin) return [];
        if (Array.isArray(itin.itinerary_days) && itin.itinerary_days.some((d) => d.items?.length > 0)) {
            return itin.itinerary_days.map((d) => ({
                day: d.day,
                items: d.items || [],
                hotel: d.recommended_hotel || null,
                rooms: d.budget_rooms || [],
                timeUsed: d.time_used_hours || 0,
            }));
        }
        // Sparse fallback: no day-level data saved (old format)
        return [];
    };

    const handleSwapStart = async (dayIdx, attraction) => {
        const aId = attraction.attraction_id || attraction.id;
        setSwappingItem({ dayIdx, attractionId: aId });
        setSwapMode(true);
        setLoadingSimilar(true);
        setSimilarAttractions([]);
        try {
            const allIds = buildDayPlan().flatMap((d) => d.items.map((a) => a.attraction_id || a.id));
            const result = await getSimilarAttractions(aId, allIds);
            setSimilarAttractions(result.similar_attractions || []);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setLoadingSimilar(false);
        }
    };

    const handleSwapConfirm = async (newAttraction) => {
        if (!swappingItem) return;
        const updatedDays = itin.itinerary_days.map((d, di) => {
            if (di !== swappingItem.dayIdx) return d;
            return {
                ...d,
                items: d.items.map((a) =>
                    (a.attraction_id || a.id) === swappingItem.attractionId ? newAttraction : a
                ),
            };
        });
        const updated = { ...itin, itinerary_days: updatedDays };
        setItin(updated);
        // Persist to Firestore
        try {
            await updateDoc(doc(db, 'itineraries', itineraryId), { itinerary_days: updatedDays });
        } catch (_) {}
        setSwapMode(false);
        setSwappingItem(null);
        setSimilarAttractions([]);
    };

    const cancelSwap = () => { setSwapMode(false); setSwappingItem(null); setSimilarAttractions([]); };

    const handleOpenBooking = (hotel, room) => {
        setBookingHotel(hotel); setBookingRoom(room); setBookingModal(true);
    };

    const handleSubmitBooking = async () => {
        if (!bookingForm.checkIn || !bookingForm.checkOut) {
            Alert.alert('Error', 'Fill in check-in and check-out dates.');
            return;
        }
        setBookingLoading(true);
        try {
            const booking = await createBooking({
                hotelId: bookingHotel.hotel_id || bookingHotel.id,
                roomType: bookingRoom.type,
                touristName: userProfile?.name || '',
                touristEmail: user?.email || '',
                touristPhone: userProfile?.phone || '',
                touristUid: user?.uid,
                checkIn: bookingForm.checkIn,
                checkOut: bookingForm.checkOut,
                numGuests: parseInt(bookingForm.numGuests) || 2,
                specialRequests: bookingForm.specialRequests,
                itineraryId,
            });
            Alert.alert('Booked!', `Booking at ${bookingHotel.name} confirmed. ID: ${booking.id}`);
            setBookingModal(false);
        } catch (err) {
            Alert.alert('Booking Error', err.message);
        } finally {
            setBookingLoading(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={s.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (notFound || !itin) {
        return (
            <View style={s.center}>
                <Ionicons name="alert-circle-outline" size={56} color={Colors.danger} />
                <Text style={s.notFoundText}>Itinerary not found</Text>
                <TouchableOpacity style={s.backLink} onPress={() => router.back()}>
                    <Text style={s.backLinkText}>Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const dayPlan = buildDayPlan();
    const totalAttractions = dayPlan.reduce((sum, d) => sum + d.items.length, 0);
    const totalCost = itin.estimatedBudget || itin.budget || 0;
    const budgetK = totalCost >= 1000 ? `${(totalCost / 1000).toFixed(0)}K` : String(totalCost);

    const createdDate = itin.createdAt
        ? new Date(itin.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';

    return (
        <View style={s.root}>
            {/* ── HEADER ── */}
            <LinearGradient colors={['#1B5E20', '#2E7D32', '#388E3C']} style={s.header}>
                <View style={s.headerTop}>
                    <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>

                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <Text style={s.headerTitle} numberOfLines={1}>{itin.name || 'My Trip'}</Text>
                        <Text style={s.headerSub}>
                            {itin.startLocation || 'Sri Lanka'}
                            {createdDate ? ` · ${createdDate}` : ''}
                        </Text>
                    </View>

                    {/* Rename */}
                    <TouchableOpacity style={s.iconBtn} onPress={openRename}>
                        <Ionicons name="pencil-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    {/* Delete */}
                    <TouchableOpacity style={[s.iconBtn, { marginLeft: 6 }]} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={20} color="#ffcdd2" />
                    </TouchableOpacity>
                </View>

                {/* Summary strip */}
                <View style={s.summaryStrip}>
                    {[
                        { val: itin.availableDays || dayPlan.length, lbl: 'Days' },
                        { val: totalAttractions, lbl: 'Places' },
                        { val: budgetK, lbl: 'LKR Budget' },
                        { val: itin.numTravelers || itin.numTravellers || 1, lbl: 'Travellers' },
                    ].map((c, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <View style={s.summaryDivider} />}
                            <View style={s.summaryCell}>
                                <Text style={s.summaryCellVal}>{c.val}</Text>
                                <Text style={s.summaryCellLbl}>{c.lbl}</Text>
                            </View>
                        </React.Fragment>
                    ))}
                </View>

                {/* Action row */}
                <View style={s.headerActions}>
                    <TouchableOpacity
                        style={s.headerActionBtn}
                        onPress={() => {
                            const locations = dayPlan.flatMap((d) => [
                                ...d.items.map((a) => ({ type: 'attraction', id: String(a.attraction_id || a.id), name: a.name })),
                                ...(d.hotel ? [{ type: 'hotel', id: String(d.hotel.hotel_id || d.hotel.id), name: d.hotel.name }] : []),
                            ]);
                            router.push({ pathname: '/(tourist)/risk', params: { itineraryLocations: JSON.stringify(locations) } });
                        }}
                    >
                        <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />
                        <Text style={s.headerActionText}>Safety Check</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {dayPlan.length === 0 ? (
                // Old-format itinerary — no day data saved
                <View style={s.center}>
                    <Ionicons name="information-circle-outline" size={48} color="#ccc" />
                    <Text style={s.notFoundText}>
                        This itinerary was saved in an older format{'\n'}and cannot be previewed.
                    </Text>
                    <TouchableOpacity
                        style={s.replanBtn}
                        onPress={() => router.push({ pathname: '/(tourist)/itinerary' })}
                    >
                        <Text style={s.replanBtnText}>Plan a new trip</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <Animated.ScrollView
                    style={{ opacity: fadeAnim }}
                    contentContainerStyle={s.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {dayPlan.map((currentDay, dayIdx) => {
                        const dc = DAY_COLOURS[dayIdx % DAY_COLOURS.length];
                        const isSwappingThisDay = swapMode && swappingItem?.dayIdx === dayIdx;

                        return (
                            <View key={dayIdx} style={s.dayBlock}>
                                {/* Day header */}
                                <LinearGradient colors={[...dc, dc[1] + 'CC']} style={s.dayHeader}>
                                    <Text style={s.dayHeaderLabel}>Day {currentDay.day}</Text>
                                    <Text style={s.dayHeaderSub}>
                                        {currentDay.items.length > 0
                                            ? `${currentDay.items.length} attraction${currentDay.items.length > 1 ? 's' : ''}`
                                            : 'Free day'}
                                        {currentDay.timeUsed > 0 ? ` · ~${currentDay.timeUsed.toFixed(0)}h` : ''}
                                    </Text>
                                    {isSwappingThisDay && (
                                        <TouchableOpacity style={s.cancelSwapBtn} onPress={cancelSwap}>
                                            <Text style={s.cancelSwapText}>Cancel</Text>
                                        </TouchableOpacity>
                                    )}
                                </LinearGradient>

                                {/* Swap panel */}
                                {isSwappingThisDay && (
                                    <View style={s.similarBox}>
                                        <Text style={s.similarTitle}>
                                            {loadingSimilar
                                                ? 'Finding alternatives…'
                                                : `${similarAttractions.length} alternatives`}
                                        </Text>
                                        {loadingSimilar ? (
                                            <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />
                                        ) : (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                                {similarAttractions.map((alt, ai) => {
                                                    const cs = catStyle(alt.category);
                                                    return (
                                                        <TouchableOpacity
                                                            key={ai}
                                                            style={s.altCard}
                                                            onPress={() => handleSwapConfirm(alt)}
                                                        >
                                                            <View style={[s.altIconWrap, { backgroundColor: cs.bg }]}>
                                                                <Ionicons name={cs.icon} size={18} color={cs.color} />
                                                            </View>
                                                            <Text style={s.altName} numberOfLines={2}>{alt.name}</Text>
                                                            <Text style={s.altMeta}>{parseFloat(alt.avg_duration_hours || 2).toFixed(1)}h</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </ScrollView>
                                        )}
                                    </View>
                                )}

                                {/* Attractions */}
                                {currentDay.items.length === 0 ? (
                                    <View style={s.emptyDay}>
                                        <Text style={s.emptyDayText}>Free day — rest or explore nearby</Text>
                                    </View>
                                ) : (
                                    <View style={s.timelineWrap}>
                                        {currentDay.items.map((attraction, idx) => (
                                            <View key={idx}>
                                                <AttractionCard
                                                    attraction={attraction}
                                                    index={idx}
                                                    dayIndex={dayIdx}
                                                    swapMode={isSwappingThisDay}
                                                    onSwap={() => handleSwapStart(dayIdx, attraction)}
                                                />
                                                {/* Customise button — only shown when not in swap mode */}
                                                {!swapMode && (
                                                    <TouchableOpacity
                                                        style={s.customiseBtn}
                                                        onPress={() => handleSwapStart(dayIdx, attraction)}
                                                    >
                                                        <Ionicons name="swap-horizontal-outline" size={13} color={Colors.accent} />
                                                        <Text style={s.customiseBtnText}>Swap attraction</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}

                                <DayHotelCard
                                    hotel={currentDay.hotel}
                                    rooms={currentDay.rooms}
                                    onBook={handleOpenBooking}
                                />
                            </View>
                        );
                    })}

                    <View style={{ height: 40 }} />
                </Animated.ScrollView>
            )}

            {/* ── RENAME MODAL ── */}
            <Modal visible={renameModal} transparent animationType="fade">
                <View style={s.modalOverlay}>
                    <View style={s.renameSheet}>
                        <Text style={s.renameTitle}>Rename trip</Text>
                        <TextInput
                            style={s.renameInput}
                            value={renameDraft}
                            onChangeText={setRenameDraft}
                            placeholder="Trip name"
                            placeholderTextColor="#aaa"
                            autoFocus
                            maxLength={80}
                            returnKeyType="done"
                            onSubmitEditing={confirmRename}
                        />
                        <View style={s.renameActions}>
                            <TouchableOpacity style={s.renameCancelBtn} onPress={() => setRenameModal(false)}>
                                <Text style={s.renameCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.renameSaveBtn, (!renameDraft.trim() || renameLoading) && { opacity: 0.5 }]}
                                onPress={confirmRename}
                                disabled={!renameDraft.trim() || renameLoading}
                            >
                                {renameLoading
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={s.renameSaveText}>Save</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── BOOKING MODAL ── */}
            <Modal visible={bookingModal} animationType="slide" transparent>
                <View style={s.modalOverlay}>
                    <View style={s.bookingSheet}>
                        <View style={s.bookingHandle} />
                        <View style={s.bookingHeaderRow}>
                            <Text style={s.bookingTitle}>Book Room</Text>
                            <TouchableOpacity onPress={() => setBookingModal(false)}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>
                        {bookingHotel && bookingRoom && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={s.bookingHotelName}>{bookingHotel.name}</Text>
                                <Text style={s.bookingRoomType}>{bookingRoom.type} · LKR {(bookingRoom.price_per_night || 0).toLocaleString()} / night</Text>
                                {[
                                    { label: 'Check-In (YYYY-MM-DD)', key: 'checkIn', placeholder: '2025-06-01' },
                                    { label: 'Check-Out (YYYY-MM-DD)', key: 'checkOut', placeholder: '2025-06-03' },
                                    { label: 'Number of Guests', key: 'numGuests', placeholder: '2', numeric: true },
                                ].map((f) => (
                                    <View key={f.key} style={s.formGroup}>
                                        <Text style={s.formLabel}>{f.label}</Text>
                                        <TextInput
                                            style={s.formInput}
                                            placeholder={f.placeholder}
                                            keyboardType={f.numeric ? 'numeric' : 'default'}
                                            value={bookingForm[f.key]}
                                            onChangeText={(v) => setBookingForm((prev) => ({ ...prev, [f.key]: v }))}
                                        />
                                    </View>
                                ))}
                                <View style={s.formGroup}>
                                    <Text style={s.formLabel}>Special Requests (optional)</Text>
                                    <TextInput
                                        style={[s.formInput, { height: 72, textAlignVertical: 'top' }]}
                                        placeholder="Any special requests…"
                                        multiline
                                        value={bookingForm.specialRequests}
                                        onChangeText={(v) => setBookingForm((prev) => ({ ...prev, specialRequests: v }))}
                                    />
                                </View>
                                <TouchableOpacity
                                    style={[s.confirmBookingBtn, bookingLoading && { opacity: 0.6 }]}
                                    onPress={handleSubmitBooking}
                                    disabled={bookingLoading}
                                >
                                    {bookingLoading
                                        ? <ActivityIndicator color="#fff" />
                                        : <Text style={s.confirmBookingText}>Confirm Booking</Text>}
                                </TouchableOpacity>
                                <View style={{ height: 32 }} />
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F5F5F5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 24 },
    notFoundText: { fontSize: 15, color: '#999', textAlign: 'center', marginTop: 14 },
    backLink: { marginTop: 16 },
    backLinkText: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
    replanBtn: { marginTop: 20, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    replanBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    // Header
    header: { paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16 },
    headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
    headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    summaryStrip: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, padding: 10, marginBottom: 10 },
    summaryCell: { flex: 1, alignItems: 'center' },
    summaryCellVal: { fontSize: 16, fontWeight: '800', color: '#fff' },
    summaryCellLbl: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
    summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 4 },
    headerActions: { flexDirection: 'row', gap: 8 },
    headerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    headerActionText: { fontSize: 12, color: '#fff', fontWeight: '600' },

    // Scroll
    scrollContent: { padding: 14 },

    // Day block
    dayBlock: { marginBottom: 20 },
    dayHeader: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 1 },
    dayHeaderLabel: { fontSize: 15, fontWeight: '800', color: '#fff', marginRight: 10 },
    dayHeaderSub: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
    cancelSwapBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    cancelSwapText: { fontSize: 12, color: '#fff', fontWeight: '600' },

    // Swap panel
    similarBox: { backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 8 },
    similarTitle: { fontSize: 13, fontWeight: '700', color: '#1565C0' },
    altCard: { width: 110, backgroundColor: '#fff', borderRadius: 10, padding: 10, marginRight: 8, alignItems: 'center' },
    altIconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    altName: { fontSize: 11, fontWeight: '600', color: '#222', textAlign: 'center', marginBottom: 4 },
    altMeta: { fontSize: 10, color: '#888' },

    // Timeline
    timelineWrap: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
    attractCard: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    attractCardHighlight: { backgroundColor: '#E3F2FD' },
    timelineDotWrap: { width: 28, alignItems: 'center', marginRight: 10 },
    timelineDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    timelineDotText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    timelineLine: { flex: 1, width: 2, marginTop: 3 },
    attractCardInner: { flex: 1, flexDirection: 'row', borderLeftWidth: 3, paddingLeft: 10, borderRadius: 4 },
    attractIconWrap: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    attractBody: { flex: 1 },
    attractName: { fontSize: 14, fontWeight: '700', color: '#222', marginBottom: 4 },
    catPill: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginBottom: 6 },
    catPillText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
    attractMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F5F5F5', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    metaChipText: { fontSize: 11, color: '#555' },
    swapBadge: { backgroundColor: Colors.accent, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginLeft: 8 },

    // Customise / swap button
    customiseBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 50, marginBottom: 4 },
    customiseBtnText: { fontSize: 11, color: Colors.accent, fontWeight: '600' },

    // Empty day
    emptyDay: { backgroundColor: '#fff', borderRadius: 10, padding: 20, alignItems: 'center', marginBottom: 8 },
    emptyDayText: { fontSize: 13, color: '#aaa' },

    // Hotel card
    noHotelCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FAFAFA', borderRadius: 10, padding: 14, marginBottom: 4 },
    noHotelText: { fontSize: 13, color: '#aaa' },
    hotelCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 4 },
    hotelCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
    hotelHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    hotelName: { fontSize: 14, fontWeight: '700', color: '#fff' },
    hotelMeta: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
    hotelRatingWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    hotelRatingText: { fontSize: 13, fontWeight: '700', color: '#FFD54F' },
    hotelCardBody: { padding: 12 },
    amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '12', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    amenityChipText: { fontSize: 11, color: Colors.primary },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    priceText: { fontSize: 12, color: '#555' },
    expandRoomsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
    expandRoomsBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
    roomRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
    roomType: { fontSize: 13, fontWeight: '600', color: '#222' },
    roomPrice: { fontSize: 12, color: '#888', marginTop: 2 },
    bookNowBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
    bookNowText: { fontSize: 12, fontWeight: '700', color: '#fff' },

    // Rename modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
    renameSheet: { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '100%' },
    renameTitle: { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: 16 },
    renameInput: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#222', marginBottom: 18 },
    renameActions: { flexDirection: 'row', gap: 10 },
    renameCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#DDD', alignItems: 'center' },
    renameCancelText: { fontSize: 14, fontWeight: '600', color: '#666' },
    renameSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
    renameSaveText: { fontSize: 14, fontWeight: '700', color: '#fff' },

    // Booking modal
    bookingSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%', position: 'absolute', bottom: 0, left: 0, right: 0 },
    bookingHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 },
    bookingHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    bookingTitle: { fontSize: 18, fontWeight: '700', color: '#222' },
    bookingHotelName: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 4 },
    bookingRoomType: { fontSize: 13, color: '#666', marginBottom: 16 },
    formGroup: { marginBottom: 14 },
    formLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 },
    formInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 12, fontSize: 14, color: '#222' },
    confirmBookingBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
    confirmBookingText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
