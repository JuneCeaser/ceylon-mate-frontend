// app/(tourist)/itinerary-results.js
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    Dimensions,
    TextInput,
    Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { generateItinerary, getSimilarAttractions, createBooking } from '../../services/api';

const { width, height } = Dimensions.get('window');

const CITY_COORDS = {
    colombo:     { lat: 6.9271, lon: 79.8612 },
    kandy:       { lat: 7.2906, lon: 80.6337 },
    galle:       { lat: 6.0535, lon: 80.2210 },
    negombo:     { lat: 7.2092, lon: 79.8360 },
    anuradhapura:{ lat: 8.3114, lon: 80.4037 },
    sigiriya:    { lat: 7.9570, lon: 80.7603 },
    ella:        { lat: 6.8667, lon: 81.0467 },
    trincomalee: { lat: 8.5874, lon: 81.2152 },
};

function resolveCityCoords(startLocation) {
    if (!startLocation) return { lat: 6.9271, lon: 79.8612 };
    const key = startLocation.toLowerCase().trim();
    for (const [city, coords] of Object.entries(CITY_COORDS)) {
        if (key.includes(city)) return coords;
    }
    return { lat: 6.9271, lon: 79.8612 };
}

// ── Category icon + colour map ───────────────────────────────────────────────
const CATEGORY_STYLE = {
    beach:       { icon: 'water-outline',        color: '#0288D1', bg: '#E3F2FD' },
    historical:  { icon: 'business-outline',      color: '#6D4C41', bg: '#EFEBE9' },
    cultural:    { icon: 'flower-outline',         color: '#7B1FA2', bg: '#F3E5F5' },
    temple:      { icon: 'home-outline',           color: '#E65100', bg: '#FBE9E7' },
    national_park:{ icon: 'leaf-outline',          color: '#2E7D32', bg: '#E8F5E9' },
    adventure:   { icon: 'bicycle-outline',        color: '#F57C00', bg: '#FFF3E0' },
    mountain:    { icon: 'triangle-outline',       color: '#37474F', bg: '#ECEFF1' },
    waterfall:   { icon: 'rainy-outline',          color: '#1565C0', bg: '#E3F2FD' },
    wildlife:    { icon: 'paw-outline',            color: '#558B2F', bg: '#F1F8E9' },
    scenic:      { icon: 'eye-outline',            color: '#00838F', bg: '#E0F7FA' },
    default:     { icon: 'location-outline',       color: '#455A64', bg: '#ECEFF1' },
};

function catStyle(category) {
    return CATEGORY_STYLE[category?.toLowerCase()] || CATEGORY_STYLE.default;
}

// ── Amenity icon map ─────────────────────────────────────────────────────────
const AMENITY_ICONS = {
    wifi: 'wifi-outline', pool: 'water-outline', spa: 'sparkles-outline',
    gym: 'barbell-outline', parking: 'car-outline', restaurant: 'restaurant-outline',
    breakfast: 'cafe-outline', ac: 'snow-outline', tv: 'tv-outline',
    bar: 'wine-outline', minibar: 'wine-outline', balcony: 'image-outline',
    safe: 'shield-outline', kitchenette: 'home-outline', airport_shuttle: 'bus-outline',
};

// ── Day header colours ───────────────────────────────────────────────────────
const DAY_COLOURS = [
    ['#1565C0', '#1976D2'],
    ['#2E7D32', '#388E3C'],
    ['#6A1B9A', '#7B1FA2'],
    ['#E65100', '#F57C00'],
    ['#00695C', '#00897B'],
    ['#AD1457', '#C2185B'],
    ['#37474F', '#546E7A'],
];

// ── Attract card ─────────────────────────────────────────────────────────────
function AttractionCard({ attraction, index, dayIndex, onSwap, swapMode }) {
    const cs = catStyle(attraction.category);
    const isHighlighted = swapMode;

    return (
        <TouchableOpacity
            style={[s.attractCard, isHighlighted && s.attractCardHighlight]}
            onPress={swapMode ? onSwap : undefined}
            activeOpacity={swapMode ? 0.7 : 1}
        >
            {/* Timeline dot */}
            <View style={s.timelineDotWrap}>
                <View style={[s.timelineDot, { backgroundColor: cs.color }]}>
                    <Text style={s.timelineDotText}>{index + 1}</Text>
                </View>
                <View style={[s.timelineLine, { backgroundColor: cs.color + '40' }]} />
            </View>

            <View style={[s.attractCardInner, { borderLeftColor: cs.color }]}>
                {/* Category icon */}
                <View style={[s.attractIconWrap, { backgroundColor: cs.bg }]}>
                    <Ionicons name={cs.icon} size={22} color={cs.color} />
                </View>

                <View style={s.attractBody}>
                    <Text style={s.attractName} numberOfLines={2}>{attraction.name}</Text>
                    <View style={[s.catPill, { backgroundColor: cs.bg }]}>
                        <Text style={[s.catPillText, { color: cs.color }]}>
                            {attraction.category}
                        </Text>
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
                        {attraction.match_score !== undefined && (
                            <View style={[s.metaChip, { backgroundColor: '#FFF8E1' }]}>
                                <Ionicons name="star" size={12} color="#F9A825" />
                                <Text style={[s.metaChipText, { color: '#F9A825' }]}>
                                    {(attraction.match_score * 100).toFixed(0)}%
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

// ── Hotel card per day ───────────────────────────────────────────────────────
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
            <LinearGradient colors={['#1B5E20', '#2E7D32']} style={s.hotelCardHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <View style={s.hotelCardHeaderLeft}>
                    <View style={s.hotelNightBadge}>
                        <Ionicons name="moon-outline" size={14} color="#fff" />
                        <Text style={s.hotelNightText}>Tonight&#39;s Stay</Text>
                    </View>
                    <Text style={s.hotelName} numberOfLines={1}>{hotel.name}</Text>
                    <View style={s.hotelMeta}>
                        <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.8)" />
                        <Text style={s.hotelMetaText}>{hotel.location}</Text>
                        {hotel.distance_km !== undefined && (
                            <Text style={s.hotelMetaText}> · {parseFloat(hotel.distance_km).toFixed(1)} km away</Text>
                        )}
                    </View>
                </View>
                <View style={s.hotelRatingWrap}>
                    <Ionicons name="star" size={14} color="#FFD54F" />
                    <Text style={s.hotelRatingText}>{parseFloat(hotel.rating || 0).toFixed(1)}</Text>
                </View>
            </LinearGradient>

            <View style={s.hotelCardBody}>
                {/* Amenities */}
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

                {/* Price range */}
                <View style={s.priceRow}>
                    <Ionicons name="cash-outline" size={14} color="#555" />
                    <Text style={s.priceText}>
                        LKR {(hotel.price_range_min || 0).toLocaleString()} – {(hotel.price_range_max || 0).toLocaleString()} / night
                    </Text>
                </View>

                {/* Room recommendations */}
                {rooms && rooms.length > 0 && (
                    <>
                        <TouchableOpacity style={s.roomsToggle} onPress={() => setExpanded(!expanded)}>
                            <Text style={s.roomsToggleText}>
                                {expanded ? 'Hide' : 'View'} {rooms.length} room{rooms.length > 1 ? 's' : ''} in your budget
                            </Text>
                            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
                        </TouchableOpacity>

                        {expanded && rooms.map((room, ri) => (
                            <TouchableOpacity key={ri} style={s.roomRow} onPress={() => onBook(hotel, room)}>
                                <View style={s.roomLeft}>
                                    <View style={s.roomIconWrap}>
                                        <Ionicons name="bed-outline" size={16} color={Colors.primary} />
                                    </View>
                                    <View>
                                        <Text style={s.roomType}>{room.type}</Text>
                                        <Text style={s.roomMeta}>
                                            {room.max_guests} guests
                                            {room.amenities?.length > 0 ? ' · ' + room.amenities.slice(0, 2).join(', ') : ''}
                                        </Text>
                                    </View>
                                </View>
                                <View style={s.roomRight}>
                                    <Text style={s.roomPrice}>LKR {(room.price_per_night || 0).toLocaleString()}</Text>
                                    <Text style={s.roomPerNight}>/night</Text>
                                    <View style={s.bookNowBtn}>
                                        <Text style={s.bookNowText}>Book</Text>
                                    </View>
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
export default function ItineraryResultsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user, userProfile } = useAuth();

    const [loading, setLoading] = useState(true);
    const [itinerary, setItinerary] = useState(null);
    const [activeDay, setActiveDay] = useState(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Save state
    const [savedDocId, setSavedDocId] = useState(null);
    const [saveNameModal, setSaveNameModal] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);

    // Swap mode
    const [swapMode, setSwapMode] = useState(false);
    const [swappingItem, setSwappingItem] = useState(null); // { dayIdx, attractionId }
    const [similarAttractions, setSimilarAttractions] = useState([]);
    const [loadingSimilar, setLoadingSimilar] = useState(false);

    // Booking modal
    const [bookingModal, setBookingModal] = useState(false);
    const [bookingHotel, setBookingHotel] = useState(null);
    const [bookingRoom, setBookingRoom] = useState(null);
    const [bookingForm, setBookingForm] = useState({ checkIn: '', checkOut: '', numGuests: '2', specialRequests: '' });
    const [bookingLoading, setBookingLoading] = useState(false);

    useEffect(() => { callGenerateItinerary(); }, []);

    const callGenerateItinerary = async () => {
        try {
            setLoading(true);
            fadeAnim.setValue(0);
            const activityTypes = params.activityTypes ? JSON.parse(params.activityTypes) : ['cultural'];
            const coords = resolveCityCoords(params.startLocation);
            const days = parseInt(params.availableDays) || 3;

            const payload = {
                budget: parseFloat(params.budget) || 150000,
                available_days: days,
                distance_preference: parseFloat(params.distancePreference) || 100,
                num_travelers: parseInt(params.numTravelers) || 2,
                activity_type: activityTypes[0],
                activity_types: activityTypes,
                season: parseInt(params.season) || 1,
                start_latitude: coords.lat,
                start_longitude: coords.lon,
                trip_mode: 'packed',
                max_attractions_per_day: 4,
                max_attractions: days * 4,
                min_attraction_score: 0.1,
                cluster_radius_km: Math.max(parseFloat(params.distancePreference) || 100, 120),
            };

            const result = await generateItinerary(payload);
            setItinerary(result);
            setActiveDay(0);
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        } catch (err) {
            Alert.alert('Error', `Failed to generate itinerary: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Build day plan from itinerary_days (preferred) or split recommended_attractions
    const buildDayPlan = (itin) => {
        if (!itin) return [];

        // Use Flask's day plan if it has items
        if (Array.isArray(itin.itinerary_days) && itin.itinerary_days.some((d) => d.items?.length > 0)) {
            return itin.itinerary_days.map((d) => ({
                day: d.day,
                items: d.items || [],
                hotel: d.recommended_hotel || null,
                rooms: d.budget_rooms || [],
                timeUsed: d.time_used_hours || 0,
            }));
        }

        // Fallback: split recommended_attractions evenly across days
        const attractions = itin.recommended_attractions || [];
        const hotels = itin.recommended_hotels || [];
        const days = parseInt(params.availableDays) || 3;
        const perDay = Math.ceil(attractions.length / days);
        return Array.from({ length: days }, (_, i) => ({
            day: i + 1,
            items: attractions.slice(i * perDay, (i + 1) * perDay),
            hotel: hotels[i] || hotels[0] || null,
            rooms: hotels[i]?.rooms?.slice(0, 3) || [],
            timeUsed: 0,
        }));
    };

    const handleSwapStart = async (dayIdx, attraction) => {
        const aId = attraction.attraction_id || attraction.id;
        setSwappingItem({ dayIdx, attractionId: aId });
        setSwapMode(true);
        setLoadingSimilar(true);
        setSimilarAttractions([]);
        try {
            const allIds = dayPlan.flatMap((d) => d.items.map((a) => a.attraction_id || a.id));
            const result = await getSimilarAttractions(aId, allIds);
            setSimilarAttractions(result.similar_attractions || []);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setLoadingSimilar(false);
        }
    };

    const handleSwapConfirm = (newAttraction) => {
        if (!swappingItem) return;
        setItinerary((prev) => {
            const days = [...(prev.itinerary_days || [])];
            days[swappingItem.dayIdx] = {
                ...days[swappingItem.dayIdx],
                items: days[swappingItem.dayIdx].items.map((a) =>
                    (a.attraction_id || a.id) === swappingItem.attractionId ? newAttraction : a
                ),
            };
            return { ...prev, itinerary_days: days };
        });
        setSwapMode(false);
        setSwappingItem(null);
        setSimilarAttractions([]);
    };

    const handleOpenBooking = (hotel, room) => {
        setBookingHotel(hotel);
        setBookingRoom(room);
        setBookingModal(true);
    };

    const handleSubmitBooking = async () => {
        if (!bookingForm.checkIn || !bookingForm.checkOut) {
            Alert.alert('Error', 'Please fill in check-in and check-out dates.');
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
                itineraryId: null,
            });
            Alert.alert('Booked!', `Booking at ${bookingHotel.name} confirmed. ID: ${booking.id}`);
            setBookingModal(false);
        } catch (err) {
            Alert.alert('Booking Error', err.message);
        } finally {
            setBookingLoading(false);
        }
    };

    const openSaveModal = () => {
        setSaveName(itinerary?.itinerary_name || `${parseInt(params.availableDays) || 3}-Day Trip`);
        setSaveNameModal(true);
    };

    const saveItinerary = async () => {
        if (!saveName.trim()) return;
        setSaveLoading(true);
        try {
            const days = buildDayPlan(itinerary);
            const attractions = days.flatMap((d) => d.items || []);
            const hotels = days.map((d) => d.hotel).filter(Boolean);

            if (savedDocId) {
                // Already saved — just update name + itinerary_days
                await updateDoc(doc(db, 'itineraries', savedDocId), {
                    name: saveName.trim(),
                    itinerary_days: itinerary?.itinerary_days || [],
                    estimatedBudget: itinerary?.estimated_total_budget || itinerary?.total_cost || 0,
                });
            } else {
                const ref = await addDoc(collection(db, 'itineraries'), {
                    userId: user?.uid,
                    name: saveName.trim(),
                    budget: parseFloat(params.budget),
                    availableDays: parseInt(params.availableDays),
                    numTravelers: parseInt(params.numTravelers),
                    season: parseInt(params.season),
                    startLocation: params.startLocation,
                    activityTypes: params.activityTypes ? JSON.parse(params.activityTypes) : [],
                    selectedAttractions: attractions.map((a) => String(a.attraction_id || a.id)),
                    selectedHotelIds: hotels.map((h) => h.hotel_id || h.id),
                    estimatedBudget: itinerary?.estimated_total_budget || itinerary?.total_cost || 0,
                    // Save full day-by-day data so itinerary-view can render it
                    itinerary_days: itinerary?.itinerary_days || [],
                    createdAt: new Date().toISOString(),
                });
                setSavedDocId(ref.id);
            }
            setSaveNameModal(false);
            Alert.alert('Saved!', `"${saveName.trim()}" saved to My Trips.`, [
                { text: 'View trips', onPress: () => router.push('/(tourist)/my-trips') },
                { text: 'Stay here', style: 'cancel' },
            ]);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setSaveLoading(false);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={s.loadingWrap}>
                <LinearGradient colors={['#1B5E20', '#2E7D32']} style={s.loadingGrad}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={s.loadingTitle}>Crafting your itinerary…</Text>
                    <Text style={s.loadingSub}>AI is picking the best spots for each day</Text>
                </LinearGradient>
            </View>
        );
    }

    if (!itinerary) {
        return (
            <View style={s.loadingWrap}>
                <Ionicons name="alert-circle-outline" size={64} color={Colors.danger} />
                <Text style={[s.loadingTitle, { color: Colors.text }]}>Generation failed</Text>
                <TouchableOpacity style={s.retryBtn} onPress={callGenerateItinerary}>
                    <Text style={s.retryBtnText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const dayPlan = buildDayPlan(itinerary);
    const totalAttractions = dayPlan.reduce((s, d) => s + d.items.length, 0);
    const totalCost = itinerary.estimated_total_budget || itinerary.total_cost || 0;

    return (
        <View style={s.root}>
            {/* ── HEADER ── */}
            <LinearGradient colors={['#1B5E20', '#2E7D32', '#388E3C']} style={s.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={s.headerTop}>
                    <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                        <Text style={s.headerTitle} numberOfLines={1}>
                            {itinerary.itinerary_name || `${parseInt(params.availableDays) || 3}-Day Sri Lanka Trip`}
                        </Text>
                        <Text style={s.headerSub}>{params.startLocation || 'Sri Lanka'}</Text>
                    </View>
                    <TouchableOpacity style={s.backBtn} onPress={() => {
                        const attractions = dayPlan.flatMap((d) => d.items);
                        const hotels = dayPlan.map((d) => d.hotel).filter(Boolean);
                        router.push({
                            pathname: '/(tourist)/risk',
                            params: {
                                itineraryLocations: JSON.stringify([
                                    ...attractions.map((a) => ({ type: 'attraction', id: String(a.attraction_id || a.id), name: a.name })),
                                    ...hotels.map((h) => ({ type: 'hotel', id: String(h.hotel_id || h.id), name: h.name })),
                                ]),
                            },
                        });
                    }}>
                        <Ionicons name="shield-checkmark-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Summary strip */}
                <View style={s.summaryStrip}>
                    <View style={s.summaryCell}>
                        <Text style={s.summaryCellVal}>{dayPlan.length}</Text>
                        <Text style={s.summaryCellLbl}>Days</Text>
                    </View>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryCell}>
                        <Text style={s.summaryCellVal}>{totalAttractions}</Text>
                        <Text style={s.summaryCellLbl}>Places</Text>
                    </View>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryCell}>
                        <Text style={s.summaryCellVal}>{(totalCost / 1000).toFixed(0)}K</Text>
                        <Text style={s.summaryCellLbl}>Est. LKR</Text>
                    </View>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryCell}>
                        <Text style={s.summaryCellVal}>{parseInt(params.numTravelers) || 2}</Text>
                        <Text style={s.summaryCellLbl}>Travellers</Text>
                    </View>
                </View>
            </LinearGradient>



            {/* ── ALL DAYS STACKED ── */}
            <Animated.ScrollView
                style={[s.scroll, { opacity: fadeAnim }]}
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {dayPlan.map((currentDay, dayIdx) => {
                    const dc = DAY_COLOURS[dayIdx % DAY_COLOURS.length];
                    const isSwappingThisDay = swapMode && swappingItem?.dayIdx === dayIdx;
                    return (
                        <View key={dayIdx} style={s.dayBlock}>
                            {/* Day header */}
                            <LinearGradient colors={[...dc, dc[1] + 'CC']} style={s.dayHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                <View style={s.dayHeaderDecor} />
                                <Text style={s.dayHeaderLabel}>Day {currentDay.day}</Text>
                                <Text style={s.dayHeaderTitle}>
                                    {currentDay.items.length > 0
                                        ? `${currentDay.items.length} attraction${currentDay.items.length > 1 ? 's' : ''}`
                                        : 'Free day'}
                                    {currentDay.timeUsed > 0 ? ` · ~${currentDay.timeUsed.toFixed(0)}h` : ''}
                                </Text>
                                {isSwappingThisDay && (
                                    <TouchableOpacity style={s.cancelSwapBtn} onPress={() => { setSwapMode(false); setSwappingItem(null); setSimilarAttractions([]); }}>
                                        <Text style={s.cancelSwapText}>Cancel swap</Text>
                                    </TouchableOpacity>
                                )}
                            </LinearGradient>

                            {/* Swap panel — only show for the day being customised */}
                            {isSwappingThisDay && (
                                <View style={s.similarBox}>
                                    <Text style={s.similarTitle}>
                                        {loadingSimilar ? 'Finding similar attractions…' : `${similarAttractions.length} alternatives found`}
                                    </Text>
                                    {loadingSimilar ? (
                                        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />
                                    ) : (
                                        similarAttractions.map((a, i) => {
                                            const cs = catStyle(a.category);
                                            return (
                                                <TouchableOpacity key={i} style={s.similarRow} onPress={() => handleSwapConfirm(a)}>
                                                    <View style={[s.similarIcon, { backgroundColor: cs.bg }]}>
                                                        <Ionicons name={cs.icon} size={18} color={cs.color} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={s.similarName}>{a.name}</Text>
                                                        <Text style={s.similarMeta}>{a.category} · LKR {parseFloat(a.avg_cost || 0).toLocaleString()} · {parseFloat(a.avg_duration_hours || 2).toFixed(1)}h</Text>
                                                    </View>
                                                    <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
                                                </TouchableOpacity>
                                            );
                                        })
                                    )}
                                </View>
                            )}

                            {/* Attractions timeline */}
                            {currentDay.items.length === 0 ? (
                                <View style={s.emptyDay}>
                                    <Ionicons name="calendar-outline" size={40} color="#ccc" />
                                    <Text style={s.emptyDayText}>Free day — rest or explore nearby</Text>
                                </View>
                            ) : (
                                <View style={s.timelineWrap}>
                                    <View style={s.sectionHeaderRow}>
                                        <Text style={s.sectionTitle}>Attractions</Text>
                                        {!swapMode && (
                                            <TouchableOpacity onPress={() => { setSwapMode(true); setSwappingItem({ dayIdx, attractionId: null }); }}>
                                                <Text style={s.swapToggle}>Customise</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    {currentDay.items.map((attraction, idx) => (
                                        <AttractionCard
                                            key={attraction.attraction_id || attraction.id || idx}
                                            attraction={attraction}
                                            index={idx}
                                            dayIndex={dayIdx}
                                            swapMode={isSwappingThisDay && swappingItem?.attractionId === (attraction.attraction_id || attraction.id)}
                                            onSwap={() => handleSwapStart(dayIdx, attraction)}
                                        />
                                    ))}
                                </View>
                            )}

                            {/* Hotel for this night */}
                            <View style={s.sectionHeaderRow}>
                                <Text style={s.sectionTitle}>Tonight&#39;s Stay</Text>
                            </View>
                            <DayHotelCard
                                hotel={currentDay.hotel}
                                rooms={currentDay.rooms}
                                onBook={handleOpenBooking}
                            />
                        </View>
                    );
                })}

                <View style={{ height: 110 }} />
            </Animated.ScrollView>

            {/* ── BOTTOM ACTIONS ── */}
            <View style={s.bottomBar}>
                <TouchableOpacity style={s.bottomBtnSave} onPress={openSaveModal}>
                    <Ionicons name="bookmark-outline" size={18} color="#fff" />
                    <Text style={s.bottomBtnText}>Save Trip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.bottomBtnRegen} onPress={callGenerateItinerary}>
                    <Ionicons name="refresh-outline" size={18} color={Colors.primary} />
                    <Text style={[s.bottomBtnText, { color: Colors.primary }]}>Regenerate</Text>
                </TouchableOpacity>
            </View>

            {/* ── SAVE NAME MODAL ── */}
            <Modal visible={saveNameModal} transparent animationType="fade">
                <View style={s.modalOverlay}>
                    <View style={s.saveSheet}>
                        <Text style={s.saveSheetTitle}>
                            {savedDocId ? 'Rename trip' : 'Save trip'}
                        </Text>
                        <Text style={s.saveSheetSub}>Give your itinerary a name so you can find it later</Text>
                        <TextInput
                            style={s.saveInput}
                            value={saveName}
                            onChangeText={setSaveName}
                            placeholder="e.g. Colombo 3-Day Adventure"
                            placeholderTextColor="#aaa"
                            autoFocus
                            maxLength={80}
                            returnKeyType="done"
                            onSubmitEditing={saveItinerary}
                        />
                        <View style={s.saveActions}>
                            <TouchableOpacity
                                style={s.saveCancelBtn}
                                onPress={() => setSaveNameModal(false)}
                            >
                                <Text style={s.saveCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.saveConfirmBtn, (!saveName.trim() || saveLoading) && { opacity: 0.5 }]}
                                onPress={saveItinerary}
                                disabled={!saveName.trim() || saveLoading}
                            >
                                {saveLoading
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={s.saveConfirmText}>Save</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── BOOKING MODAL ── */}
            <Modal visible={bookingModal} animationType="slide" transparent>
                <View style={s.modalOverlay}>
                    <View style={s.modalSheet}>
                        <View style={s.modalHandle} />
                        <View style={s.modalHeaderRow}>
                            <Text style={s.modalTitle}>Book Room</Text>
                            <TouchableOpacity onPress={() => setBookingModal(false)}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        {bookingHotel && bookingRoom && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={s.modalHotelInfo}>
                                    <Text style={s.modalHotelName}>{bookingHotel.name}</Text>
                                    <Text style={s.modalRoomType}>{bookingRoom.type}</Text>
                                    <Text style={s.modalPrice}>LKR {(bookingRoom.price_per_night || 0).toLocaleString()} / night</Text>
                                </View>

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
                                        placeholder="e.g. Late check-in, extra pillows"
                                        multiline
                                        value={bookingForm.specialRequests}
                                        onChangeText={(v) => setBookingForm((prev) => ({ ...prev, specialRequests: v }))}
                                    />
                                </View>

                                <TouchableOpacity
                                    style={[s.confirmBtn, bookingLoading && { opacity: 0.6 }]}
                                    onPress={handleSubmitBooking}
                                    disabled={bookingLoading}
                                >
                                    {bookingLoading
                                        ? <ActivityIndicator color="#fff" />
                                        : <Text style={s.confirmBtnText}>Confirm Booking</Text>
                                    }
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

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F5F6FA' },

    // Loading
    loadingWrap: { flex: 1, backgroundColor: '#F5F6FA', justifyContent: 'center', alignItems: 'center' },
    loadingGrad: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    loadingTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 20, textAlign: 'center' },
    loadingSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 6, textAlign: 'center' },
    retryBtn: { marginTop: 20, backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24 },
    retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Header
    header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 },
    headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
    summaryStrip: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, paddingVertical: 12 },
    summaryCell: { flex: 1, alignItems: 'center' },
    summaryCellVal: { fontSize: 22, fontWeight: '800', color: '#fff' },
    summaryCellLbl: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },

    // Day block (stacked)
    dayBlock: { marginBottom: 24 },

    // Scroll
    scroll: { flex: 1 },
    scrollContent: { padding: 16 },

    // Day header card
    dayHeader: { borderRadius: 16, padding: 16, marginBottom: 16, overflow: 'hidden', position: 'relative' },
    dayHeaderDecor: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)', top: -50, right: -30 },
    dayHeaderLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 1.5, textTransform: 'uppercase' },
    dayHeaderTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 2 },
    cancelSwapBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
    cancelSwapText: { fontSize: 12, fontWeight: '700', color: '#fff' },

    // Section header
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
    swapToggle: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

    // Swap / similar
    similarBox: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 14, elevation: 1, borderWidth: 1, borderColor: '#E8F5E9' },
    similarTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 },
    similarRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 10 },
    similarIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    similarName: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
    similarMeta: { fontSize: 11, color: '#888', marginTop: 1 },

    // Timeline
    timelineWrap: { marginBottom: 16 },
    attractCard: { flexDirection: 'row', marginBottom: 4 },
    attractCardHighlight: { opacity: 0.9 },
    timelineDotWrap: { width: 28, alignItems: 'center', paddingTop: 4 },
    timelineDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    timelineDotText: { fontSize: 12, fontWeight: '800', color: '#fff' },
    timelineLine: { flex: 1, width: 2, marginTop: 3, minHeight: 20 },
    attractCardInner: { flex: 1, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginLeft: 8, marginBottom: 8, padding: 12, elevation: 1, borderLeftWidth: 3, gap: 10 },
    attractIconWrap: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
    attractBody: { flex: 1 },
    attractName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
    catPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginBottom: 6 },
    catPillText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
    attractMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F5F5F5', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
    metaChipText: { fontSize: 11, color: '#555' },
    swapBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },

    // Empty day
    emptyDay: { backgroundColor: '#fff', borderRadius: 14, padding: 32, alignItems: 'center', marginBottom: 16 },
    emptyDayText: { fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' },

    // Hotel card
    hotelCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 16, elevation: 2 },
    hotelCardHeader: { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    hotelCardHeaderLeft: { flex: 1 },
    hotelNightBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    hotelNightText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 0.8 },
    hotelName: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
    hotelMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
    hotelMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
    hotelRatingWrap: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
    hotelRatingText: { fontSize: 13, fontWeight: '800', color: '#FFD54F' },
    hotelCardBody: { padding: 14 },
    amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F7F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    amenityChipText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
    priceText: { fontSize: 13, color: '#555' },
    roomsToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0F7F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
    roomsToggleText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
    roomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
    roomLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
    roomIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
    roomType: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
    roomMeta: { fontSize: 11, color: '#888', marginTop: 1 },
    roomRight: { alignItems: 'flex-end', gap: 2 },
    roomPrice: { fontSize: 14, fontWeight: '800', color: Colors.primary },
    roomPerNight: { fontSize: 10, color: '#999' },
    bookNowBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginTop: 3 },
    bookNowText: { fontSize: 11, fontWeight: '800', color: '#fff' },
    noHotelCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#EEE' },
    noHotelText: { fontSize: 13, color: '#999' },

    // Bottom bar
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 14, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EEE', elevation: 8 },
    bottomBtnSave: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 13 },
    bottomBtnRegen: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary + '15', borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: Colors.primary },
    bottomBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    // Booking modal
    // Save name modal
    saveSheet: { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '100%' },
    saveSheetTitle: { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: 6 },
    saveSheetSub: { fontSize: 13, color: '#888', marginBottom: 16 },
    saveInput: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#222', marginBottom: 18 },
    saveActions: { flexDirection: 'row', gap: 10 },
    saveCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#DDD', alignItems: 'center' },
    saveCancelText: { fontSize: 14, fontWeight: '600', color: '#666' },
    saveConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
    saveConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: height * 0.88 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 14 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
    modalHotelInfo: { backgroundColor: '#F5F6FA', borderRadius: 12, padding: 14, marginBottom: 16 },
    modalHotelName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
    modalRoomType: { fontSize: 14, color: Colors.primary, fontWeight: '600', marginTop: 3 },
    modalPrice: { fontSize: 13, color: '#666', marginTop: 4 },
    formGroup: { marginBottom: 12 },
    formLabel: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', marginBottom: 5 },
    formInput: { backgroundColor: '#F5F6FA', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15 },
    confirmBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
    confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});