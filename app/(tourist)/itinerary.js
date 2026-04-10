// app/(tourist)/itinerary.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function ItineraryGeneratorScreen() {
    const router = useRouter();

    const [budget, setBudget] = useState(150000);
    const [days, setDays] = useState(3);
    const [travelers, setTravelers] = useState(2);
    const [distance, setDistance] = useState(100);
    const [activityTypes, setActivityTypes] = useState(['cultural']);
    const [season, setSeason] = useState(1);

    // District picker state
    const [districts, setDistricts] = useState([]);
    const [loadingDistricts, setLoadingDistricts] = useState(true);
    const [selectedDistrict, setSelectedDistrict] = useState(null);
    const [showDistrictPicker, setShowDistrictPicker] = useState(false);

    useEffect(() => {
        loadDistricts();
    }, []);

    const loadDistricts = async () => {
        try {
            const snap = await getDocs(query(collection(db, 'districts'), orderBy('name')));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setDistricts(data);
            // Default to Colombo
            const colombo = data.find(d => d.id === 'colombo') || data[0];
            if (colombo) setSelectedDistrict(colombo);
        } catch (err) {
            console.error('Failed to load districts:', err);
            // Fallback hardcoded if Firestore fails
            const fallback = { id: 'colombo', name: 'Colombo', province: 'Western', lat: 6.9271, lon: 79.8612 };
            setDistricts([fallback]);
            setSelectedDistrict(fallback);
        } finally {
            setLoadingDistricts(false);
        }
    };

    // Group districts by province for the picker
    const districtsByProvince = districts.reduce((acc, d) => {
        const p = d.province || 'Other';
        if (!acc[p]) acc[p] = [];
        acc[p].push(d);
        return acc;
    }, {});

    const ACTIVITY_OPTIONS = [
        { value: 'cultural', label: 'Cultural', icon: 'flower-outline' },
        { value: 'beach', label: 'Beach', icon: 'water-outline' },
        { value: 'wildlife', label: 'Wildlife', icon: 'paw-outline' },
        { value: 'adventure', label: 'Adventure', icon: 'bicycle-outline' },
        { value: 'nature', label: 'Nature', icon: 'leaf-outline' },
        { value: 'historical', label: 'Historical', icon: 'library-outline' },
    ];

    const toggleActivityType = (type) => {
        if (activityTypes.includes(type)) {
            if (activityTypes.length > 1) {
                setActivityTypes(activityTypes.filter(t => t !== type));
            }
        } else {
            setActivityTypes([...activityTypes, type]);
        }
    };

    const seasons = [
        { value: 1, label: 'Dry Season (Dec–Mar)' },
        { value: 2, label: 'Inter-monsoon (Apr–May)' },
        { value: 3, label: 'Southwest Monsoon (Jun–Sep)' },
        { value: 4, label: 'Northeast Monsoon (Oct–Nov)' },
    ];

    const handleGenerate = () => {
        if (!selectedDistrict) {
            Alert.alert('Select a starting location', 'Please choose a district to start from.');
            return;
        }
        router.replace({
            pathname: '/(tourist)/itinerary-results',
            params: {
                budget,
                availableDays: days,
                numTravelers: travelers,
                distancePreference: distance,
                activityTypes: JSON.stringify(activityTypes),
                season,
                startLocation: selectedDistrict.name,
                startLat: selectedDistrict.lat,
                startLon: selectedDistrict.lon,
            },
        });
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={[Colors.primary, Colors.accent]} style={styles.header}>
                <Text style={styles.headerTitle}>Plan Your Trip</Text>
                <Text style={styles.headerSubtitle}>Let AI create your perfect itinerary</Text>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Budget */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="cash-outline" size={24} color={Colors.primary} />
                        <Text style={styles.cardTitle}>Budget</Text>
                    </View>
                    <Text style={styles.valueDisplay}>LKR {budget.toLocaleString()}</Text>
                    <Slider
                        style={styles.slider}
                        minimumValue={50000}
                        maximumValue={500000}
                        step={10000}
                        value={budget}
                        onValueChange={setBudget}
                        minimumTrackTintColor={Colors.primary}
                        maximumTrackTintColor={Colors.border}
                        thumbTintColor={Colors.primary}
                    />
                    <View style={styles.sliderLabels}>
                        <Text style={styles.sliderLabel}>50K</Text>
                        <Text style={styles.sliderLabel}>500K</Text>
                    </View>
                </View>

                {/* Duration */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="calendar-outline" size={24} color={Colors.primary} />
                        <Text style={styles.cardTitle}>Duration</Text>
                    </View>
                    <Text style={styles.valueDisplay}>{days} {days === 1 ? 'Day' : 'Days'}</Text>
                    <Slider
                        style={styles.slider}
                        minimumValue={1}
                        maximumValue={14}
                        step={1}
                        value={days}
                        onValueChange={setDays}
                        minimumTrackTintColor={Colors.primary}
                        maximumTrackTintColor={Colors.border}
                        thumbTintColor={Colors.primary}
                    />
                    <View style={styles.sliderLabels}>
                        <Text style={styles.sliderLabel}>1 Day</Text>
                        <Text style={styles.sliderLabel}>14 Days</Text>
                    </View>
                </View>

                {/* Travelers */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="people-outline" size={24} color={Colors.primary} />
                        <Text style={styles.cardTitle}>Number of Travelers</Text>
                    </View>
                    <View style={styles.stepperContainer}>
                        <TouchableOpacity
                            style={styles.stepperButton}
                            onPress={() => setTravelers(Math.max(1, travelers - 1))}
                        >
                            <Ionicons name="remove" size={24} color={Colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.stepperValue}>{travelers}</Text>
                        <TouchableOpacity
                            style={styles.stepperButton}
                            onPress={() => setTravelers(Math.min(10, travelers + 1))}
                        >
                            <Ionicons name="add" size={24} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Max Distance */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="car-outline" size={24} color={Colors.primary} />
                        <Text style={styles.cardTitle}>Max Travel Distance</Text>
                    </View>
                    <Text style={styles.valueDisplay}>{distance} km</Text>
                    <Slider
                        style={styles.slider}
                        minimumValue={50}
                        maximumValue={300}
                        step={10}
                        value={distance}
                        onValueChange={setDistance}
                        minimumTrackTintColor={Colors.primary}
                        maximumTrackTintColor={Colors.border}
                        thumbTintColor={Colors.primary}
                    />
                    <View style={styles.sliderLabels}>
                        <Text style={styles.sliderLabel}>50 km</Text>
                        <Text style={styles.sliderLabel}>300 km</Text>
                    </View>
                </View>

                {/* Activity Type */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="compass-outline" size={24} color={Colors.primary} />
                        <Text style={styles.cardTitle}>Activity Preference</Text>
                    </View>
                    <View style={styles.activityGrid}>
                        {ACTIVITY_OPTIONS.map((activity) => (
                            <TouchableOpacity
                                key={activity.value}
                                style={[
                                    styles.activityButton,
                                    activityTypes.includes(activity.value) && styles.activityButtonActive,
                                ]}
                                onPress={() => toggleActivityType(activity.value)}
                            >
                                <Ionicons
                                    name={activity.icon}
                                    size={24}
                                    color={activityTypes.includes(activity.value) ? Colors.surface : Colors.primary}
                                />
                                <Text style={[
                                    styles.activityButtonText,
                                    activityTypes.includes(activity.value) && styles.activityButtonTextActive,
                                ]}>
                                    {activity.label}
                                </Text>
                                {activityTypes.includes(activity.value) && (
                                    <View style={styles.selectedBadge}>
                                        <Ionicons name="checkmark-circle" size={16} color={Colors.surface} />
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Season */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="rainy-outline" size={24} color={Colors.primary} />
                        <Text style={styles.cardTitle}>Travel Season</Text>
                    </View>
                    {seasons.map((s) => (
                        <TouchableOpacity
                            key={s.value}
                            style={[styles.seasonButton, season === s.value && styles.seasonButtonActive]}
                            onPress={() => setSeason(s.value)}
                        >
                            <Text style={[styles.seasonButtonText, season === s.value && styles.seasonButtonTextActive]}>
                                {s.label}
                            </Text>
                            {season === s.value && (
                                <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Starting Location — District Picker */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="location-outline" size={24} color={Colors.primary} />
                        <Text style={styles.cardTitle}>Starting Location</Text>
                    </View>

                    {loadingDistricts ? (
                        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />
                    ) : (
                        <TouchableOpacity
                            style={styles.districtSelector}
                            onPress={() => setShowDistrictPicker(true)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.districtSelectorLeft}>
                                <View style={styles.districtDot} />
                                <View>
                                    <Text style={styles.districtSelectorName}>
                                        {selectedDistrict?.name || 'Select district'}
                                    </Text>
                                    {selectedDistrict?.province && (
                                        <Text style={styles.districtSelectorProvince}>
                                            {selectedDistrict.province} Province
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <Ionicons name="chevron-down" size={20} color={Colors.primary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Generate */}
                <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
                    <LinearGradient
                        colors={[Colors.primary, Colors.accent]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.generateButtonGradient}
                    >
                        <Ionicons name="sparkles" size={24} color={Colors.surface} />
                        <Text style={styles.generateButtonText}>Generate Itinerary</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={{ height: 32 }} />
            </ScrollView>

            {/* District picker modal */}
            <Modal visible={showDistrictPicker} animationType="slide" transparent>
                <View style={styles.pickerOverlay}>
                    <View style={styles.pickerSheet}>
                        <View style={styles.pickerHandle} />
                        <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>Select Starting District</Text>
                            <TouchableOpacity onPress={() => setShowDistrictPicker(false)}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {Object.entries(districtsByProvince)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([province, provDistricts]) => (
                                    <View key={province}>
                                        <View style={styles.provinceHeader}>
                                            <Text style={styles.provinceLabel}>{province} Province</Text>
                                        </View>
                                        {provDistricts.map((district) => {
                                            const isSelected = selectedDistrict?.id === district.id;
                                            return (
                                                <TouchableOpacity
                                                    key={district.id}
                                                    style={[styles.districtRow, isSelected && styles.districtRowActive]}
                                                    onPress={() => {
                                                        setSelectedDistrict(district);
                                                        setShowDistrictPicker(false);
                                                    }}
                                                >
                                                    <View style={[styles.districtRowDot, isSelected && styles.districtRowDotActive]} />
                                                    <Text style={[styles.districtRowName, isSelected && styles.districtRowNameActive]}>
                                                        {district.name}
                                                    </Text>
                                                    {isSelected && (
                                                        <Ionicons name="checkmark" size={18} color={Colors.primary} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ))}
                            <View style={{ height: 32 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { paddingTop: 60, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
    headerTitle: { fontSize: 32, fontWeight: 'bold', color: Colors.surface, marginBottom: Spacing.xs },
    headerSubtitle: { fontSize: 16, color: Colors.surface, opacity: 0.9 },
    content: { flex: 1 },
    scrollContent: { padding: Spacing.lg },
    card: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    cardTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginLeft: Spacing.sm },
    valueDisplay: { fontSize: 24, fontWeight: 'bold', color: Colors.primary, marginBottom: Spacing.sm },
    slider: { width: '100%', height: 40 },
    sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    sliderLabel: { fontSize: 12, color: Colors.textSecondary },
    stepperContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
    stepperButton: { width: 48, height: 48, borderRadius: BorderRadius.md, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
    stepperValue: { fontSize: 32, fontWeight: 'bold', color: Colors.primary, minWidth: 60, textAlign: 'center' },
    activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    activityButton: { flex: 1, minWidth: '30%', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 2, borderColor: Colors.border },
    activityButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    activityButtonText: { fontSize: 12, color: Colors.text, fontWeight: '600', marginTop: Spacing.xs },
    activityButtonTextActive: { color: Colors.surface },
    selectedBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.success, borderRadius: 8 },
    seasonButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
    seasonButtonActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
    seasonButtonText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
    seasonButtonTextActive: { color: Colors.primary, fontWeight: '600' },

    // District selector
    districtSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary },
    districtSelectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    districtDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
    districtSelectorName: { fontSize: 16, fontWeight: '700', color: Colors.text },
    districtSelectorProvince: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

    // Generate button
    generateButton: { borderRadius: BorderRadius.md, overflow: 'hidden', marginTop: Spacing.md, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    generateButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
    generateButtonText: { color: Colors.surface, fontSize: 18, fontWeight: 'bold' },

    // Picker modal
    pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    pickerSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingTop: 10 },
    pickerHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 12 },
    pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
    pickerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
    provinceHeader: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: Colors.background },
    provinceLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
    districtRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border + '80', gap: 10 },
    districtRowActive: { backgroundColor: Colors.primary + '10' },
    districtRowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
    districtRowDotActive: { backgroundColor: Colors.primary },
    districtRowName: { flex: 1, fontSize: 15, color: Colors.text },
    districtRowNameActive: { color: Colors.primary, fontWeight: '700' },
    helperText: { fontSize: 12, color: Colors.textSecondary, marginTop: Spacing.xs, fontStyle: 'italic' },
});