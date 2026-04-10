// app/(tourist)/risk-alternatives.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';
import { loadAttractions } from '../../services/csvDataLoader';
import { predictRisk } from '../../services/api';

const { width } = Dimensions.get('window');

const SEARCH_RADIUS_KM = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isWeatherRisky(weather) {
    if (!weather) return false;
    const main = (weather.weather_main || '').toLowerCase();
    const rain = parseFloat(weather.rainfall_mm || 0);
    const wind = parseFloat(weather.wind_speed || 0);
    return (
        rain > 2 ||
        wind > 10 ||
        main.includes('rain') ||
        main.includes('thunder') ||
        main.includes('storm') ||
        main.includes('squall')
    );
}

function getWeatherReason(weather) {
    if (!weather) return null;
    const main = weather.weather_main || '';
    const rain = parseFloat(weather.rainfall_mm || 0);
    const wind = parseFloat(weather.wind_speed || 0);
    if (main.toLowerCase().includes('thunder')) return `Thunderstorm conditions (${rain.toFixed(1)}mm)`;
    if (rain > 5) return `Heavy rainfall (${rain.toFixed(1)}mm/h)`;
    if (rain > 2) return `Rain in the area (${rain.toFixed(1)}mm/h)`;
    if (wind > 10) return `Strong winds (${wind.toFixed(0)} m/s)`;
    return main || 'Adverse weather';
}

// Returns true/false if field is present, null if unknown
function isOutdoor(attraction) {
    const v = attraction.outdoor;
    if (v === undefined || v === null) return null;
    if (typeof v === 'boolean') return v;
    const s = String(v).toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    return null;
}

export default function RiskAlternativesScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [loading, setLoading] = useState(true);
    const [originalLocation, setOriginalLocation] = useState(null);
    const [alternatives, setAlternatives] = useState([]);
    const [error, setError] = useState(null);
    const [searchMeta, setSearchMeta] = useState(null);

    useEffect(() => {
        loadAlternatives();
    }, []);

    const loadAlternatives = async () => {
        try {
            setLoading(true);
            setError(null);
            setSearchMeta(null);

            const location = JSON.parse(params.locationData);
            const originalRisk = location.risk_score ?? location.riskScore ?? 0;
            const origLat = parseFloat(location.lat ?? location.latitude ?? 0);
            const origLon = parseFloat(location.lon ?? location.longitude ?? 0);

            const weather = location.weather || location._weather || null;
            const weatherRisky = isWeatherRisky(weather);
            const origIsOutdoor = isOutdoor(location);

            // If weather is risky and original is outdoor → suggest indoor alternatives
            // Apply venue filter ONLY when we know for certain the original is outdoor
            // (origIsOutdoor === null means the prediction object didn't include the field)
            const wantIndoor = weatherRisky && origIsOutdoor === true;
            const applyVenueFilter = weatherRisky && origIsOutdoor !== null;

            setOriginalLocation({ ...location, riskScore: originalRisk });

            const allAttractions = await loadAttractions();

            // ── 20km radius filter ────────────────────────────────────────────
            let inRadius = allAttractions
                .filter((a) => a.name !== location.name)
                .map((a) => ({
                    ...a,
                    _distanceKm: haversineKm(
                        origLat, origLon,
                        parseFloat(a.latitude), parseFloat(a.longitude)
                    ),
                }))
                .filter((a) => a._distanceKm <= SEARCH_RADIUS_KM);

            if (inRadius.length === 0) {
                setSearchMeta({ type: 'empty_radius', radiusKm: SEARCH_RADIUS_KM });
                setAlternatives([]);
                setLoading(false);
                return;
            }

            // ── Venue type filter (only when weather is risky) ────────────────
            let pool = inRadius;
            let venueFilterApplied = false;

            if (applyVenueFilter) {
                const venueFiltered = inRadius.filter((a) =>
                    wantIndoor ? !isOutdoor(a) : isOutdoor(a)
                );
                if (venueFiltered.length >= 2) {
                    pool = venueFiltered;
                    venueFilterApplied = true;
                }
                // fewer than 2 matches → fall back to all in radius (don't over-filter)
            }

            // ── Exclude already-in-itinerary ──────────────────────────────────
            let itineraryNames = new Set();
            if (params.itineraryData) {
                try {
                    const itin = JSON.parse(params.itineraryData);
                    (itin?.selectedAttractions || []).forEach((x) => itineraryNames.add(String(x)));
                } catch (_) {}
            }
            pool = pool.filter((a) => !itineraryNames.has(String(a.attraction_id)));

            if (pool.length === 0) {
                setSearchMeta({
                    type: 'empty_after_filters',
                    radiusKm: SEARCH_RADIUS_KM,
                    weatherRisky,
                    wantIndoor,
                    venueFilterApplied,
                });
                setAlternatives([]);
                setLoading(false);
                return;
            }

            // ── Pick up to 8 by safety_rating for ML scoring ─────────────────
            const candidates = pool
                .sort((a, b) => parseFloat(b.safety_rating || 0) - parseFloat(a.safety_rating || 0))
                .slice(0, 8);

            // ── Run ML risk predictions ───────────────────────────────────────
            let scoredAlts = [];
            try {
                const locs = candidates.map((a) => ({
                    lat: parseFloat(a.latitude),
                    lon: parseFloat(a.longitude),
                    name: a.name,
                    type: 'attraction',
                }));
                const result = await predictRisk(locs);
                const predictions = result.predictions || [];

                scoredAlts = candidates.map((a, i) => {
                    const pred = predictions.find((p) => p.name === a.name) || predictions[i] || {};
                    return {
                        ...a,
                        riskScore: pred.risk_score ?? pred.riskScore ?? 0,
                        weather: pred.weather || pred._weather || {},
                    };
                });
            } catch (_) {
                scoredAlts = candidates.map((a) => ({
                    ...a,
                    riskScore: Math.max(0, 1 - parseFloat(a.safety_rating || 0.8)),
                }));
            }

            // Prefer actually safer ones; fall back to all if none qualify
            let safer = scoredAlts.filter((a) => a.riskScore < originalRisk);
            if (safer.length === 0) safer = scoredAlts;

            const top3 = safer
                .sort((a, b) => a.riskScore - b.riskScore)
                .slice(0, 3);

            setSearchMeta({
                type: 'results',
                radiusKm: SEARCH_RADIUS_KM,
                weatherRisky,
                wantIndoor,
                venueFilterApplied,
                weatherReason: weatherRisky ? getWeatherReason(weather) : null,
                totalInRadius: inRadius.length,
            });

            setAlternatives(top3);
        } catch (err) {
            console.error('Error loading alternatives:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (score) => {
        if (score < 0.3) return Colors.success;
        if (score < 0.6) return Colors.warning;
        return Colors.danger;
    };

    const getRiskLabel = (score) => {
        if (score < 0.3) return 'LOW';
        if (score < 0.6) return 'MEDIUM';
        return 'HIGH';
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Finding safer alternatives...</Text>
                <Text style={styles.loadingSubText}>Searching within {SEARCH_RADIUS_KM}km radius</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.loadingContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
                <Text style={styles.loadingText}>Could not load alternatives</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadAlternatives}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const origScore = originalLocation?.riskScore ?? 0;

    const renderEmptyState = () => {
        if (!searchMeta) return null;

        if (searchMeta.type === 'empty_radius') {
            return (
                <View style={styles.emptyState}>
                    <Ionicons name="location-outline" size={56} color={Colors.textSecondary} />
                    <Text style={styles.emptyStateText}>No alternatives within {searchMeta.radiusKm}km</Text>
                    <Text style={styles.emptyStateSubtext}>
                        There are no other tourist attractions within a {searchMeta.radiusKm}km radius of this location.
                    </Text>
                </View>
            );
        }

        if (searchMeta.type === 'empty_after_filters') {
            return (
                <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={56} color={Colors.textSecondary} />
                    <Text style={styles.emptyStateText}>
                        No {searchMeta.wantIndoor ? 'indoor' : 'suitable'} alternatives nearby
                    </Text>
                    <Text style={styles.emptyStateSubtext}>
                        {searchMeta.weatherRisky
                            ? `No ${searchMeta.wantIndoor ? 'indoor' : 'outdoor'} attractions found within ${searchMeta.radiusKm}km. Consider postponing your visit due to current weather conditions.`
                            : `No safer attractions found within ${searchMeta.radiusKm}km.`}
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={56} color={Colors.textSecondary} />
                <Text style={styles.emptyStateText}>No alternatives found</Text>
                <Text style={styles.emptyStateSubtext}>Try a different location</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={[Colors.danger, Colors.warning]} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={Colors.surface} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Safer Alternatives</Text>
                    <View style={{ width: 40 }} />
                </View>
                <Text style={styles.headerSub}>Within {SEARCH_RADIUS_KM}km radius</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Weather advisory banner */}
                {searchMeta?.weatherRisky && searchMeta?.weatherReason && (
                    <View style={styles.weatherBanner}>
                        <Ionicons name="rainy-outline" size={18} color="#1565C0" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.weatherBannerTitle}>Weather advisory</Text>
                            <Text style={styles.weatherBannerText}>
                                {searchMeta.weatherReason}
                                {searchMeta.venueFilterApplied
                                    ? ` — showing ${searchMeta.wantIndoor ? 'indoor' : 'outdoor'} alternatives`
                                    : ' — showing all nearby alternatives'}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Original Location */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Original Location</Text>
                    <View style={[styles.locationCard, styles.originalCard]}>
                        <View style={styles.locationHeader}>
                            <View style={[styles.locationIcon, { backgroundColor: Colors.danger + '15' }]}>
                                <Ionicons name="location" size={24} color={Colors.danger} />
                            </View>
                            <View style={styles.locationInfo}>
                                <Text style={styles.locationName}>
                                    {originalLocation?.name || 'Unknown Location'}
                                </Text>
                                <Text style={styles.locationCategory}>
                                    {originalLocation?.category}
                                    {originalLocation?.outdoor !== undefined
                                        ? ` · ${isOutdoor(originalLocation) ? 'Outdoor' : 'Indoor'}`
                                        : ''}
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.riskBar, { borderColor: getRiskColor(origScore) + '40' }]}>
                            <View style={styles.riskBarLeft}>
                                <View style={[styles.riskDot, { backgroundColor: getRiskColor(origScore) }]} />
                                <Text style={[styles.riskLabel, { color: getRiskColor(origScore) }]}>
                                    {getRiskLabel(origScore)} RISK
                                </Text>
                            </View>
                            <Text style={[styles.riskScoreText, { color: getRiskColor(origScore) }]}>
                                {(origScore * 100).toFixed(0)}%
                            </Text>
                        </View>

                        <View style={styles.gauge}>
                            <View style={[styles.gaugeFill, {
                                width: `${origScore * 100}%`,
                                backgroundColor: getRiskColor(origScore),
                            }]} />
                        </View>
                    </View>
                </View>

                {/* Alternatives */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {alternatives.length > 0
                            ? `Recommended Alternatives (${alternatives.length})`
                            : 'Alternatives'}
                    </Text>

                    {alternatives.length === 0 ? renderEmptyState() : (
                        alternatives.map((alt, index) => {
                            const improvement = origScore - alt.riskScore;
                            return (
                                <View key={alt.attraction_id || index} style={styles.locationCard}>
                                    <View style={styles.rankBadge}>
                                        <Text style={styles.rankText}>#{index + 1}</Text>
                                    </View>

                                    <View style={styles.locationHeader}>
                                        <View style={[styles.locationIcon, { backgroundColor: Colors.success + '15' }]}>
                                            <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                                        </View>
                                        <View style={styles.locationInfo}>
                                            <Text style={styles.locationName}>{alt.name}</Text>
                                            <View style={styles.locationMeta}>
                                                <Text style={styles.locationCategory}>
                                                    {alt.category}
                                                    {alt.outdoor !== undefined ? ` · ${isOutdoor(alt) ? 'Outdoor' : 'Indoor'}` : ''}
                                                </Text>
                                                {alt._distanceKm !== undefined && (
                                                    <View style={styles.distanceBadge}>
                                                        <Ionicons name="navigate-outline" size={10} color={Colors.primary} />
                                                        <Text style={styles.distanceText}>
                                                            {parseFloat(alt._distanceKm).toFixed(1)} km away
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.comparisonRow}>
                                        <View style={styles.comparisonBox}>
                                            <Text style={styles.comparisonLabel}>Risk Score</Text>
                                            <View style={[styles.riskBadge, { backgroundColor: getRiskColor(alt.riskScore) + '20' }]}>
                                                <View style={[styles.riskDot, { backgroundColor: getRiskColor(alt.riskScore) }]} />
                                                <Text style={[styles.comparisonValue, { color: getRiskColor(alt.riskScore) }]}>
                                                    {getRiskLabel(alt.riskScore)}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.comparisonBox}>
                                            <Text style={styles.comparisonLabel}>Score</Text>
                                            <Text style={[styles.scoreValue, { color: getRiskColor(alt.riskScore) }]}>
                                                {(alt.riskScore * 100).toFixed(0)}%
                                            </Text>
                                        </View>

                                        {improvement > 0 && (
                                            <View style={styles.comparisonBox}>
                                                <Text style={styles.comparisonLabel}>Improvement</Text>
                                                <Text style={styles.improvementValue}>
                                                    -{(improvement * 100).toFixed(0)}%
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.gauge}>
                                        <View style={[styles.gaugeFill, {
                                            width: `${alt.riskScore * 100}%`,
                                            backgroundColor: getRiskColor(alt.riskScore),
                                        }]} />
                                    </View>

                                    <View style={styles.detailsGrid}>
                                        <View style={styles.detailItem}>
                                            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                                            <Text style={styles.detailText}>{alt.avg_duration_hours || 'N/A'}h</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Ionicons name="cash-outline" size={14} color={Colors.textSecondary} />
                                            <Text style={styles.detailText}>LKR {parseFloat(alt.avg_cost || 0).toLocaleString()}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Ionicons name="shield-checkmark-outline" size={14} color={Colors.success} />
                                            <Text style={styles.detailText}>Safety {parseFloat(alt.safety_rating || 0).toFixed(1)}</Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.selectButton}
                                        onPress={() => router.back()}
                                    >
                                        <Text style={styles.selectButtonText}>Select This Location</Text>
                                        <Ionicons name="arrow-forward" size={16} color={Colors.surface} />
                                    </TouchableOpacity>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: Spacing.xl },
    loadingText: { marginTop: Spacing.md, fontSize: 16, fontWeight: '600', color: Colors.text },
    loadingSubText: { marginTop: 4, fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
    retryButton: { marginTop: Spacing.lg, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
    retryText: { color: Colors.surface, fontWeight: 'bold' },
    header: { paddingTop: 60, paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.surface },
    headerSub: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    content: { flex: 1 },
    scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    section: { marginBottom: Spacing.xl },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.md },
    weatherBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#E3F2FD', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, borderLeftWidth: 4, borderLeftColor: '#1565C0' },
    weatherBannerTitle: { fontSize: 12, fontWeight: '700', color: '#1565C0', marginBottom: 2 },
    weatherBannerText: { fontSize: 12, color: '#1A237E', lineHeight: 17 },
    locationCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, elevation: 2 },
    originalCard: { borderWidth: 2, borderColor: Colors.danger + '40' },
    locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    locationIcon: { width: 48, height: 48, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
    locationInfo: { flex: 1 },
    locationName: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
    locationMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    locationCategory: { fontSize: 12, color: Colors.textSecondary },
    distanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary + '12', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    distanceText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },
    rankBadge: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, backgroundColor: Colors.primary, borderRadius: BorderRadius.round, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    rankText: { color: Colors.surface, fontSize: 12, fontWeight: 'bold' },
    riskBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.sm, borderWidth: 1, marginBottom: Spacing.sm },
    riskBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    riskDot: { width: 8, height: 8, borderRadius: 4 },
    riskLabel: { fontSize: 13, fontWeight: '700' },
    riskScoreText: { fontSize: 18, fontWeight: 'bold' },
    gauge: { height: 6, backgroundColor: Colors.border, borderRadius: 3, marginBottom: Spacing.sm, overflow: 'hidden' },
    gaugeFill: { height: '100%', borderRadius: 3 },
    comparisonRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
    comparisonBox: { flex: 1 },
    comparisonLabel: { fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 },
    riskBadge: { flexDirection: 'row', alignItems: 'center', padding: Spacing.xs, borderRadius: BorderRadius.sm, gap: 4 },
    comparisonValue: { fontSize: 11, fontWeight: 'bold' },
    scoreValue: { fontSize: 20, fontWeight: 'bold' },
    improvementValue: { fontSize: 16, fontWeight: 'bold', color: Colors.success },
    detailsGrid: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
    detailItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
    detailText: { fontSize: 11, color: Colors.textSecondary },
    selectButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
    selectButtonText: { color: Colors.surface, fontSize: 14, fontWeight: 'bold' },
    emptyState: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center' },
    emptyStateText: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: Spacing.md, textAlign: 'center' },
    emptyStateSubtext: { fontSize: 13, color: Colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center', lineHeight: 19 },
});