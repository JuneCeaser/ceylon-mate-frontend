// app/(tourist)/risk.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Circle } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ConditionalMapView, ConditionalMarker } from '../../components/MapWrapper';
import { predictRisk, predictItineraryRisk } from '../../services/api';

const { width, height } = Dimensions.get('window');

export default function RiskCheckerScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [savedItineraries, setSavedItineraries] = useState([]);
    const [selectedItinerary, setSelectedItinerary] = useState(null);
    const [riskData, setRiskData] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);

    useFocusEffect(
        useCallback(() => {
            loadSavedItineraries();
        }, [user])
    );

    useEffect(() => {
        // If navigated from itinerary-results with pre-built locations list
        if (params.itineraryLocations) {
            try {
                const locations = JSON.parse(params.itineraryLocations);
                // Run analysis immediately
                runRiskForLocations(locations);
            } catch (_) {}
        }
    }, [params.itineraryLocations]);

    const loadSavedItineraries = async () => {
        if (!user?.uid) return;
        try {
            const q = query(collection(db, 'itineraries'), where('userId', '==', user.uid));
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setSavedItineraries(docs);
            if (docs.length > 0 && !selectedItinerary) setSelectedItinerary(docs[0]);
        } catch (err) {
            console.error('Error loading itineraries:', err);
        }
    };

    // Run risk using pre-built location objects (from itinerary-results)
    const runRiskForLocations = async (locations) => {
        setLoading(true);
        try {
            const result = await predictItineraryRisk(locations);
            const predictions = result.predictions || [];
            if (!predictions.length) {
                Alert.alert('No data', 'No risk data returned from server.');
                setLoading(false);
                return;
            }
            setRiskData({ predictions });
            setSelectedLocation(predictions[0]);
        } catch (err) {
            Alert.alert('Risk Analysis Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyzeRisk = async () => {
        if (!selectedItinerary) {
            Alert.alert('No Itinerary', 'Please select an itinerary first.');
            return;
        }

        setLoading(true);

        try {
            // Build location list from saved itinerary
            const attractionIds = selectedItinerary.selectedAttractions || [];
            const hotelIds = selectedItinerary.selectedHotelIds || [];

            const itineraryLocations = [
                ...attractionIds.map((id) => ({ type: 'attraction', id: String(id) })),
                ...hotelIds.map((id) => ({ type: 'hotel', id: String(id) })),
            ];

            if (!itineraryLocations.length) {
                Alert.alert('No Locations', 'This itinerary has no locations to analyse.');
                setLoading(false);
                return;
            }

            const result = await predictItineraryRisk(itineraryLocations);
            const predictions = result.predictions || [];

            if (!predictions.length) {
                Alert.alert('No data', 'No risk predictions returned.');
                setLoading(false);
                return;
            }

            setRiskData({ predictions });
            setSelectedLocation(predictions[0]);
        } catch (err) {
            Alert.alert('Error', `Risk analysis failed: ${err.message}`);
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

    if (!riskData) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={[Colors.danger, Colors.warning]} style={styles.header}>
                    <Text style={styles.headerTitle}>Risk Zone Checker</Text>
                    <Text style={styles.headerSubtitle}>Real-time safety analysis for your trip</Text>
                </LinearGradient>

                <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Select Your Trip</Text>

                        {savedItineraries.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="map-outline" size={64} color={Colors.textSecondary} />
                                <Text style={styles.emptyStateText}>No saved itineraries</Text>
                                <Text style={styles.emptyStateSubtext}>Create an itinerary first to check safety</Text>
                                <TouchableOpacity
                                    style={styles.emptyStateButton}
                                    onPress={() => router.push('/(tourist)/itinerary')}
                                >
                                    <Text style={styles.emptyStateButtonText}>Plan Trip</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            savedItineraries.map((itin) => (
                                <TouchableOpacity
                                    key={itin.id}
                                    style={[styles.itineraryCard, selectedItinerary?.id === itin.id && styles.itineraryCardSelected]}
                                    onPress={() => setSelectedItinerary(itin)}
                                >
                                    <View style={styles.itineraryHeader}>
                                        <Text style={styles.itineraryTitle}>
                                            {itin.name || (itin.activityTypes?.[0] || 'Trip').toUpperCase()}
                                        </Text>
                                        {selectedItinerary?.id === itin.id && (
                                            <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                                        )}
                                    </View>
                                    <View style={styles.itineraryDetails}>
                                        <View style={styles.itineraryDetail}>
                                            <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
                                            <Text style={styles.itineraryDetailText}>{itin.availableDays} days</Text>
                                        </View>
                                        <View style={styles.itineraryDetail}>
                                            <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
                                            <Text style={styles.itineraryDetailText}>
                                                {(itin.selectedAttractions || []).length} places
                                            </Text>
                                        </View>
                                        <View style={styles.itineraryDetail}>
                                            <Ionicons name="cash-outline" size={16} color={Colors.textSecondary} />
                                            <Text style={styles.itineraryDetailText}>
                                                {((itin.estimatedBudget || 0) / 1000).toFixed(0)}K LKR
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>

                    {selectedItinerary && (
                        <TouchableOpacity
                            style={[styles.analyzeButton, loading && { opacity: 0.6 }]}
                            onPress={handleAnalyzeRisk}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={[Colors.danger, Colors.warning]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.analyzeButtonGradient}
                            >
                                {loading ? (
                                    <ActivityIndicator color={Colors.surface} />
                                ) : (
                                    <>
                                        <Ionicons name="analytics" size={24} color={Colors.surface} />
                                        <Text style={styles.analyzeButtonText}>Analyse Risk</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle" size={24} color={Colors.accent} />
                        <View style={styles.infoBoxContent}>
                            <Text style={styles.infoBoxTitle}>How it works</Text>
                            <Text style={styles.infoBoxText}>
                                We fetch real-time weather and traffic data for each location in your itinerary, then run our ML risk model to give you accurate safety scores.
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    const predictions = riskData.predictions;
    const low = predictions.filter((p) => (p.risk_score ?? p.riskScore ?? 0) < 0.3).length;
    const medium = predictions.filter((p) => { const s = p.risk_score ?? p.riskScore ?? 0; return s >= 0.3 && s < 0.6; }).length;
    const high = predictions.filter((p) => (p.risk_score ?? p.riskScore ?? 0) >= 0.6).length;

    return (
        <View style={styles.container}>
            <LinearGradient colors={[Colors.danger, Colors.warning]} style={styles.headerSmall}>
                <View style={styles.headerTopRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => setRiskData(null)}>
                        <Ionicons name="arrow-back" size={24} color={Colors.surface} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitleSmall}>Risk Analysis</Text>
                    <TouchableOpacity onPress={handleAnalyzeRisk}>
                        <Ionicons name="refresh" size={24} color={Colors.surface} />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ConditionalMapView
                style={styles.map}
                initialRegion={{
                    latitude: parseFloat(predictions[0]?.lat || 7.8731),
                    longitude: parseFloat(predictions[0]?.lon || 80.7718),
                    latitudeDelta: 2,
                    longitudeDelta: 2,
                }}
            >
                {predictions.map((loc, i) => {
                    const score = loc.risk_score ?? loc.riskScore ?? 0;
                    const lat = parseFloat(loc.lat || loc.latitude || 7.8731);
                    const lon = parseFloat(loc.lon || loc.longitude || 80.7718);
                    return (
                        <React.Fragment key={i}>
                            <Circle
                                center={{ latitude: lat, longitude: lon }}
                                radius={score * 12000}
                                fillColor={getRiskColor(score) + '40'}
                                strokeColor={getRiskColor(score)}
                                strokeWidth={2}
                            />
                            <ConditionalMarker
                                coordinate={{ latitude: lat, longitude: lon }}
                                onPress={() => setSelectedLocation(loc)}
                            >
                                <View style={[styles.mapMarker, { backgroundColor: getRiskColor(score) }]}>
                                    <Text style={styles.mapMarkerText}>{i + 1}</Text>
                                </View>
                            </ConditionalMarker>
                        </React.Fragment>
                    );
                })}
            </ConditionalMapView>

            {selectedLocation && (() => {
                const score = selectedLocation.risk_score ?? selectedLocation.riskScore ?? 0;
                const weather   = selectedLocation.weather   || selectedLocation._weather   || {};
                const traffic   = selectedLocation.traffic   || selectedLocation._traffic   || null;
                const incidents = selectedLocation.incidents || selectedLocation._incidents || null;
                return (
                    <View style={styles.detailsPanel}>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailsPanelContent}>
                            <TouchableOpacity style={styles.closeDetailsButton} onPress={() => setSelectedLocation(null)}>
                                <Ionicons name="close" size={20} color={Colors.text} />
                            </TouchableOpacity>

                            <Text style={styles.detailsLocationName}>{selectedLocation.name}</Text>

                            <View style={styles.riskGaugeContainer}>
                                <View style={styles.riskGauge}>
                                    <View style={[styles.riskGaugeFill, { width: `${score * 100}%`, backgroundColor: getRiskColor(score) }]} />
                                </View>
                                <Text style={[styles.riskCategoryText, { color: getRiskColor(score) }]}>
                                    {getRiskLabel(score)} RISK — {(score * 100).toFixed(0)}%
                                </Text>
                            </View>

                            {/* ── Conditions Breakdown ── */}
                            <View style={styles.breakdownSection}>
                                <Text style={styles.breakdownTitle}>Conditions</Text>

                                {/* Weather */}
                                {weather.temperature !== undefined && (
                                    <View style={styles.breakdownCard}>
                                        <View style={styles.breakdownItem}>
                                            <View style={styles.breakdownHeader}>
                                                <Ionicons name="rainy" size={18} color="#1565C0" />
                                                <Text style={styles.breakdownLabel}>Weather</Text>
                                            </View>
                                            <View style={[styles.sourcePill, { backgroundColor: '#E3F2FD' }]}>
                                                <Text style={[styles.sourcePillText, { color: '#1565C0' }]}>
                                                    {weather.source === 'openweathermap' ? 'Live' : 'Estimated'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.metricsGrid}>
                                            <View style={styles.metricCell}>
                                                <Text style={styles.metricValue}>{weather.temperature?.toFixed(1)}°C</Text>
                                                <Text style={styles.metricLabel}>Temp</Text>
                                            </View>
                                            <View style={styles.metricCell}>
                                                <Text style={styles.metricValue}>{weather.rainfall_mm?.toFixed(1)}</Text>
                                                <Text style={styles.metricLabel}>Rain mm</Text>
                                            </View>
                                            <View style={styles.metricCell}>
                                                <Text style={styles.metricValue}>{weather.wind_speed?.toFixed(1)}</Text>
                                                <Text style={styles.metricLabel}>Wind m/s</Text>
                                            </View>
                                            <View style={styles.metricCell}>
                                                <Text style={styles.metricValue}>{weather.humidity ?? '—'}%</Text>
                                                <Text style={styles.metricLabel}>Humidity</Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.breakdownDetailText, { textTransform: 'capitalize', marginTop: 4 }]}>
                                            {weather.weather_description}
                                            {weather.visibility_km ? ` · Visibility ${weather.visibility_km} km` : ''}
                                        </Text>
                                    </View>
                                )}

                                {/* Traffic */}
                                {traffic && traffic.traffic_congestion_level !== undefined && (() => {
                                    const rawCongestion = traffic.traffic_congestion_level; // 0-1 fraction
                                    const pct = Math.round(rawCongestion * 100);
                                    const color = traffic.congestion_color || (
                                        rawCongestion < 0.2 ? '#4CAF50' :
                                            rawCongestion < 0.45 ? '#8BC34A' :
                                                rawCongestion < 0.65 ? '#FFC107' :
                                                    rawCongestion < 0.80 ? '#FF9800' : '#F44336'
                                    );
                                    const label = traffic.congestion_label || (
                                        rawCongestion < 0.2 ? 'Free flow' :
                                            rawCongestion < 0.45 ? 'Light' :
                                                rawCongestion < 0.65 ? 'Moderate' :
                                                    rawCongestion < 0.80 ? 'Heavy' : 'Severe'
                                    );
                                    return (
                                        <View style={styles.breakdownCard}>
                                            <View style={styles.breakdownItem}>
                                                <View style={styles.breakdownHeader}>
                                                    <Ionicons name="car" size={18} color={color} />
                                                    <Text style={styles.breakdownLabel}>Traffic Now</Text>
                                                </View>
                                                <View style={[styles.sourcePill, { backgroundColor: color + '22' }]}>
                                                    <Text style={[styles.sourcePillText, { color }]}>
                                                        {traffic.source === 'here_api' ? 'HERE Live' :
                                                            traffic.source === 'tomtom_api' ? 'TomTom Live' : 'Simulated'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={styles.congestionBarWrap}>
                                                <View style={styles.congestionBarBg}>
                                                    <View style={[styles.congestionBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                                                </View>
                                                <Text style={[styles.congestionPct, { color }]}>{label} · {pct}%</Text>
                                            </View>
                                            <View style={styles.metricsGrid}>
                                                <View style={styles.metricCell}>
                                                    <Text style={[styles.metricValue, { color }]}>{traffic.average_speed ?? '—'}</Text>
                                                    <Text style={styles.metricLabel}>km/h</Text>
                                                </View>
                                                <View style={styles.metricCell}>
                                                    <Text style={styles.metricValue}>{traffic.traffic_volume ?? '—'}</Text>
                                                    <Text style={styles.metricLabel}>Vol/hr</Text>
                                                </View>
                                                <View style={styles.metricCell}>
                                                    <Text style={styles.metricValue}>{traffic.free_flow_speed ?? '—'}</Text>
                                                    <Text style={styles.metricLabel}>Free flow</Text>
                                                </View>
                                                <View style={styles.metricCell}>
                                                    <Text style={[styles.metricValue, { color: traffic.is_rush_hour ? Colors.danger : Colors.success, fontSize: 11 }]}>
                                                        {traffic.is_rush_hour ? 'Rush hour' : 'Off-peak'}
                                                    </Text>
                                                    <Text style={styles.metricLabel}>Period</Text>
                                                </View>
                                            </View>
                                            {traffic.nearest_city && (
                                                <Text style={[styles.breakdownDetailText, { marginTop: 4 }]}>
                                                    {traffic.distance_to_city_km?.toFixed(1)} km from {traffic.nearest_city}
                                                    {traffic.is_holiday ? ' · Public holiday' : traffic.is_weekend ? ' · Weekend' : ''}
                                                </Text>
                                            )}
                                        </View>
                                    );
                                })()}

                                {/* Incidents */}
                                {incidents && (
                                    <View style={styles.breakdownCard}>
                                        <View style={styles.breakdownItem}>
                                            <View style={styles.breakdownHeader}>
                                                <Ionicons name="warning" size={18} color={
                                                    (incidents.num_recent_accidents + incidents.num_recent_incidents) > 2
                                                        ? Colors.danger : Colors.success
                                                } />
                                                <Text style={styles.breakdownLabel}>Recent Incidents</Text>
                                            </View>
                                        </View>
                                        <View style={styles.metricsGrid}>
                                            <View style={styles.metricCell}>
                                                <Text style={[styles.metricValue, { color: incidents.num_recent_accidents > 0 ? Colors.warning : Colors.success }]}>
                                                    {incidents.num_recent_accidents}
                                                </Text>
                                                <Text style={styles.metricLabel}>Accidents</Text>
                                            </View>
                                            <View style={styles.metricCell}>
                                                <Text style={[styles.metricValue, { color: incidents.num_recent_incidents > 0 ? Colors.warning : Colors.success }]}>
                                                    {incidents.num_recent_incidents}
                                                </Text>
                                                <Text style={styles.metricLabel}>Incidents</Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.breakdownDetailText, { marginTop: 4, color: '#666' }]}>
                                            {incidents.accident_context || 'Signal-based estimate'}
                                        </Text>
                                    </View>
                                )}

                                {/* Risk Score */}
                                <View style={styles.breakdownCard}>
                                    <View style={styles.breakdownItem}>
                                        <View style={styles.breakdownHeader}>
                                            <Ionicons name="shield-checkmark" size={18} color={getRiskColor(score)} />
                                            <Text style={styles.breakdownLabel}>ML Risk Score</Text>
                                        </View>
                                        <Text style={[styles.breakdownValue, { color: getRiskColor(score) }]}>
                                            {(score * 100).toFixed(0)}%
                                        </Text>
                                    </View>
                                    {selectedLocation.risk_category && (
                                        <Text style={styles.breakdownDetailText}>
                                            Category: {selectedLocation.risk_category}
                                        </Text>
                                    )}
                                    {selectedLocation.risk_factors?.length > 0 && (
                                        <View style={{ marginTop: 6 }}>
                                            {selectedLocation.risk_factors.map((f, fi) => (
                                                <View key={fi} style={styles.riskFactorRow}>
                                                    <Ionicons name="alert-circle" size={13} color={Colors.warning} />
                                                    <Text style={styles.riskFactorText}>{f}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                    {selectedLocation.recommendations?.length > 0 && (
                                        <Text style={[styles.breakdownDetailText, { marginTop: 6, fontStyle: 'italic' }]}>
                                            {selectedLocation.recommendations[0]}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            {/* News Risk Incidents */}
                            {selectedLocation.news_incidents && selectedLocation.news_incidents.length > 0 && (
                                <View style={styles.newsBox}>
                                    <View style={styles.newsBoxHeader}>
                                        <Ionicons name="newspaper-outline" size={16} color={
                                            selectedLocation.news_risk_level >= 3 ? Colors.danger :
                                                selectedLocation.news_risk_level >= 2 ? Colors.warning : Colors.accent
                                        } />
                                        <Text style={[styles.newsBoxTitle, {
                                            color: selectedLocation.news_risk_level >= 3 ? Colors.danger :
                                                selectedLocation.news_risk_level >= 2 ? Colors.warning : Colors.accent
                                        }]}>
                                            Live News · {selectedLocation.news_risk_label} signal
                                            {selectedLocation.news_boosted ? ' · Score adjusted' : ''}
                                        </Text>
                                    </View>
                                    {selectedLocation.news_incidents.map((inc, ni) => (
                                        <View key={ni} style={styles.newsIncident}>
                                            <View style={[styles.newsIncidentDot, {
                                                backgroundColor: inc.severity === 'high' ? Colors.danger :
                                                    inc.severity === 'medium' ? Colors.warning : Colors.accent
                                            }]} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.newsIncidentTitle} numberOfLines={2}>{inc.title}</Text>
                                                <View style={styles.newsKeywords}>
                                                    {(inc.keywords || []).map((kw, ki) => (
                                                        <View key={ki} style={styles.newsKeywordPill}>
                                                            <Text style={styles.newsKeywordText}>{kw}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* No news signal */}
                            {(!selectedLocation.news_incidents || selectedLocation.news_incidents.length === 0) && selectedLocation.district && (
                                <View style={[styles.newsBox, { backgroundColor: '#F1F8E9' }]}>
                                    <View style={styles.newsBoxHeader}>
                                        <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                                        <Text style={[styles.newsBoxTitle, { color: Colors.success }]}>No incidents in {selectedLocation.district}</Text>
                                    </View>
                                    <Text style={styles.newsBoxSub}>No recent news alerts for this area.</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.alternativeButton}
                                onPress={() =>
                                    router.push({
                                        pathname: '/(tourist)/risk-alternatives',
                                        params: {
                                            locationData: JSON.stringify(selectedLocation),
                                            itineraryData: JSON.stringify(selectedItinerary),
                                        },
                                    })
                                }
                            >
                                <Ionicons name="swap-horizontal" size={20} color={Colors.surface} />
                                <Text style={styles.alternativeButtonText}>Find Safer Alternative</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                );
            })()}

            {!selectedLocation && (
                <View style={styles.summaryFooter}>
                    <View style={styles.summaryStats}>
                        <View style={styles.summaryStatItem}>
                            <Text style={[styles.summaryStatValue, { color: Colors.success }]}>{low}</Text>
                            <Text style={styles.summaryStatLabel}>Low Risk</Text>
                        </View>
                        <View style={styles.summaryStatItem}>
                            <Text style={[styles.summaryStatValue, { color: Colors.warning }]}>{medium}</Text>
                            <Text style={styles.summaryStatLabel}>Medium</Text>
                        </View>
                        <View style={styles.summaryStatItem}>
                            <Text style={[styles.summaryStatValue, { color: Colors.danger }]}>{high}</Text>
                            <Text style={styles.summaryStatLabel}>High Risk</Text>
                        </View>
                    </View>
                    <Text style={styles.summaryHint}>Tap a marker to see details</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { paddingTop: 60, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
    headerTitle: { fontSize: 30, fontWeight: 'bold', color: Colors.surface, marginBottom: 4 },
    headerSubtitle: { fontSize: 15, color: Colors.surface, opacity: 0.9 },
    headerSmall: { paddingTop: 60, paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    headerTitleSmall: { fontSize: 20, fontWeight: 'bold', color: Colors.surface },
    content: { flex: 1 },
    scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    section: { marginBottom: Spacing.lg },
    sectionTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.md },
    emptyState: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center' },
    emptyStateText: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
    emptyStateSubtext: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
    emptyStateButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.md },
    emptyStateButtonText: { color: Colors.surface, fontSize: 16, fontWeight: '600' },
    itineraryCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 2, borderColor: Colors.border },
    itineraryCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
    itineraryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    itineraryTitle: { fontSize: 17, fontWeight: 'bold', color: Colors.text },
    itineraryDetails: { flexDirection: 'row', gap: Spacing.md },
    itineraryDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    itineraryDetailText: { fontSize: 13, color: Colors.textSecondary },
    analyzeButton: { borderRadius: BorderRadius.md, overflow: 'hidden', marginBottom: Spacing.lg },
    analyzeButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
    analyzeButtonText: { color: Colors.surface, fontSize: 18, fontWeight: 'bold' },
    infoBox: { flexDirection: 'row', backgroundColor: Colors.accent + '20', borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.md },
    infoBoxContent: { flex: 1 },
    infoBoxTitle: { fontSize: 15, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
    infoBoxText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
    map: { flex: 1 },
    mapMarker: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.surface, elevation: 4 },
    mapMarkerText: { color: Colors.surface, fontSize: 14, fontWeight: 'bold' },
    detailsPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: height * 0.65, backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xl * 2, borderTopRightRadius: BorderRadius.xl * 2, elevation: 8 },
    detailsPanelContent: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    closeDetailsButton: { alignSelf: 'flex-end', width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
    detailsLocationName: { fontSize: 22, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.md },
    riskGaugeContainer: { marginBottom: Spacing.lg },
    riskGauge: { height: 12, backgroundColor: Colors.border, borderRadius: BorderRadius.sm, overflow: 'hidden', marginBottom: Spacing.sm },
    riskGaugeFill: { height: '100%', borderRadius: BorderRadius.sm },
    riskCategoryText: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
    breakdownSection: { marginBottom: Spacing.lg },
    breakdownTitle: { fontSize: 17, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.md },
    breakdownCard: { backgroundColor: Colors.background, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
    breakdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
    breakdownHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    breakdownLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
    breakdownValue: { fontSize: 18, fontWeight: 'bold' },
    breakdownDetails: { gap: 3 },
    breakdownDetailText: { fontSize: 13, color: Colors.textSecondary },
    alternativeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, gap: Spacing.sm },
    alternativeButtonText: { color: Colors.surface, fontSize: 16, fontWeight: 'bold' },
    // Traffic & Incident breakdown styles
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    metricCell: { flex: 1, minWidth: 60, alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 4 },
    metricValue: { fontSize: 16, fontWeight: '700', color: '#222' },
    metricLabel: { fontSize: 10, color: '#888', marginTop: 2 },
    sourcePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    sourcePillText: { fontSize: 10, fontWeight: '700' },
    congestionBarWrap: { marginTop: 8, marginBottom: 4 },
    congestionBarBg: { height: 8, backgroundColor: '#EEE', borderRadius: 4, overflow: 'hidden' },
    congestionBarFill: { height: 8, borderRadius: 4 },
    congestionPct: { fontSize: 12, fontWeight: '700', marginTop: 4 },
    riskFactorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    riskFactorText: { fontSize: 12, color: '#555', flex: 1 },
    // News styles
    newsBox: { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: Colors.warning },
    newsBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    newsBoxTitle: { fontSize: 13, fontWeight: '700' },
    newsBoxSub: { fontSize: 12, color: '#666' },
    newsIncident: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
    newsIncidentDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
    newsIncidentTitle: { fontSize: 12, color: '#333', lineHeight: 17, marginBottom: 4 },
    newsKeywords: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    newsKeywordPill: { backgroundColor: 'rgba(0,0,0,0.07)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    newsKeywordText: { fontSize: 10, color: '#555', fontWeight: '600' },
    summaryFooter: { backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.lg },
    summaryStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.sm },
    summaryStatItem: { alignItems: 'center' },
    summaryStatValue: { fontSize: 32, fontWeight: 'bold' },
    summaryStatLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
    summaryHint: { textAlign: 'center', fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },
});