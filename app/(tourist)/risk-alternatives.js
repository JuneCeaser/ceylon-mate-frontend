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

export default function RiskAlternativesScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [loading, setLoading] = useState(true);
    const [originalLocation, setOriginalLocation] = useState(null);
    const [alternatives, setAlternatives] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadAlternatives();
    }, []);

    const loadAlternatives = async () => {
        try {
            setLoading(true);
            setError(null);

            const location = JSON.parse(params.locationData);

            // Normalise risk score — risk.js uses risk_score (snake_case from backend)
            const originalRisk = location.risk_score ?? location.riskScore ?? 0;
            setOriginalLocation({ ...location, riskScore: originalRisk });

            // Load all attractions from CSV
            const allAttractions = await loadAttractions();

            // Find attractions in the same category first, then fallback to all
            const sameCategory = allAttractions.filter(
                (a) => a.category === location.category && a.name !== location.name
            );
            const pool = sameCategory.length >= 5 ? sameCategory : allAttractions.filter(
                (a) => a.name !== location.name
            );

            // Exclude already-in-itinerary locations if itineraryData was passed
            let itineraryNames = new Set();
            if (params.itineraryData) {
                try {
                    const itin = JSON.parse(params.itineraryData);
                    const itinLocations = itin?.selectedAttractions || [];
                    itineraryNames = new Set(itinLocations.map((x) => String(x)));
                } catch (_) {}
            }

            // Pick 6 candidates by safety_rating (highest first) to run through ML risk model
            const candidates = pool
                .filter((a) => !itineraryNames.has(String(a.attraction_id)))
                .sort((a, b) => parseFloat(b.safety_rating || 0) - parseFloat(a.safety_rating || 0))
                .slice(0, 6);

            // Run real risk predictions on candidates
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
                // If ML call fails, use safety_rating as proxy (inverted)
                scoredAlts = candidates.map((a) => ({
                    ...a,
                    riskScore: Math.max(0, 1 - parseFloat(a.safety_rating || 0.8)),
                }));
            }

            // Sort by risk (lowest first = safest) and take top 3
            const top3 = scoredAlts
                .sort((a, b) => a.riskScore - b.riskScore)
                .slice(0, 3);

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
                <Text style={styles.loadingSubText}>Running risk analysis on nearby attractions</Text>
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
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

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
                                <Text style={styles.locationCategory}>{originalLocation?.category}</Text>
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

                        {/* Risk gauge bar */}
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
                        Recommended Alternatives ({alternatives.length})
                    </Text>

                    {alternatives.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="search-outline" size={64} color={Colors.textSecondary} />
                            <Text style={styles.emptyStateText}>No alternatives found</Text>
                            <Text style={styles.emptyStateSubtext}>Try a different location</Text>
                        </View>
                    ) : (
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
                                            <Text style={styles.locationCategory}>{alt.category} · {alt.district || ''}</Text>
                                        </View>
                                    </View>

                                    {/* Risk comparison row */}
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

                                    {/* Gauge */}
                                    <View style={styles.gauge}>
                                        <View style={[styles.gaugeFill, {
                                            width: `${alt.riskScore * 100}%`,
                                            backgroundColor: getRiskColor(alt.riskScore),
                                        }]} />
                                    </View>

                                    {/* Details */}
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
    header: { paddingTop: 60, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.surface },
    content: { flex: 1 },
    scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    section: { marginBottom: Spacing.xl },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.md },
    locationCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, elevation: 2 },
    originalCard: { borderWidth: 2, borderColor: Colors.danger + '40' },
    locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    locationIcon: { width: 48, height: 48, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
    locationInfo: { flex: 1 },
    locationName: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
    locationCategory: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
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
    emptyStateText: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
    emptyStateSubtext: { fontSize: 14, color: Colors.textSecondary, marginTop: Spacing.xs },
});