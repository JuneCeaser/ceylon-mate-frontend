// app/(tourist)/my-trips.js
import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    TextInput,
    Modal,
    Animated,
    RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    updateDoc,
    doc,
    orderBy,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';

const DAY_COLOURS = [
    ['#1565C0', '#1976D2'],
    ['#2E7D32', '#388E3C'],
    ['#6A1B9A', '#7B1FA2'],
    ['#E65100', '#F57C00'],
    ['#00695C', '#00897B'],
    ['#AD1457', '#C2185B'],
    ['#37474F', '#546E7A'],
];

const SORT_OPTIONS = [
    { key: 'newest', label: 'Newest first' },
    { key: 'oldest', label: 'Oldest first' },
    { key: 'name', label: 'Name A–Z' },
    { key: 'days', label: 'Most days' },
    { key: 'budget', label: 'Highest budget' },
];

export default function MyTripsScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const [itineraries, setItineraries] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState('newest');
    const [showSortSheet, setShowSortSheet] = useState(false);

    // Rename modal state
    const [renameModal, setRenameModal] = useState(false);
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameDraft, setRenameDraft] = useState('');
    const [renameLoading, setRenameLoading] = useState(false);

    const sheetAnim = useRef(new Animated.Value(0)).current;

    useFocusEffect(
        useCallback(() => {
            loadItineraries();
        }, [user])
    );

    const loadItineraries = async (isRefresh = false) => {
        if (!user?.uid) return;
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const q = query(
                collection(db, 'itineraries'),
                where('userId', '==', user.uid),
                orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(q);
            const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setItineraries(data);
            applyFilter(data, search, sortKey);
        } catch (err) {
            console.error('Load itineraries error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const applyFilter = (data, searchText, sort) => {
        let result = [...data];

        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            result = result.filter(
                (i) =>
                    (i.name || '').toLowerCase().includes(q) ||
                    (i.startLocation || '').toLowerCase().includes(q)
            );
        }

        switch (sort) {
            case 'newest':
                result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'oldest':
                result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'name':
                result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                break;
            case 'days':
                result.sort((a, b) => (b.availableDays || 0) - (a.availableDays || 0));
                break;
            case 'budget':
                result.sort((a, b) => (b.budget || b.estimatedBudget || 0) - (a.budget || a.estimatedBudget || 0));
                break;
        }

        setFiltered(result);
    };

    const handleSearch = (text) => {
        setSearch(text);
        applyFilter(itineraries, text, sortKey);
    };

    const handleSort = (key) => {
        setSortKey(key);
        applyFilter(itineraries, search, key);
        setShowSortSheet(false);
    };

    const handleDelete = (itin) => {
        Alert.alert(
            'Delete trip',
            `Delete "${itin.name || 'My Trip'}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'itineraries', itin.id));
                            const updated = itineraries.filter((i) => i.id !== itin.id);
                            setItineraries(updated);
                            applyFilter(updated, search, sortKey);
                        } catch (err) {
                            Alert.alert('Error', err.message);
                        }
                    },
                },
            ]
        );
    };

    const openRename = (itin) => {
        setRenameTarget(itin);
        setRenameDraft(itin.name || 'My Trip');
        setRenameModal(true);
    };

    const confirmRename = async () => {
        if (!renameTarget || !renameDraft.trim()) return;
        setRenameLoading(true);
        try {
            await updateDoc(doc(db, 'itineraries', renameTarget.id), {
                name: renameDraft.trim(),
            });
            const updated = itineraries.map((i) =>
                i.id === renameTarget.id ? { ...i, name: renameDraft.trim() } : i
            );
            setItineraries(updated);
            applyFilter(updated, search, sortKey);
            setRenameModal(false);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setRenameLoading(false);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (_) {
            return '';
        }
    };

    const formatBudget = (val) => {
        if (!val) return '—';
        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
        return String(val);
    };

    if (loading) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const sortLabel = SORT_OPTIONS.find((s) => s.key === sortKey)?.label || 'Sort';

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient colors={['#1B5E20', '#2E7D32', '#388E3C']} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleWrap}>
                        <Text style={styles.headerTitle}>My Trips</Text>
                        <Text style={styles.headerSub}>{itineraries.length} saved itinerar{itineraries.length === 1 ? 'y' : 'ies'}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.planBtn}
                        onPress={() => router.push('/(tourist)/itinerary')}
                    >
                        <Ionicons name="add" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Search bar */}
                <View style={styles.searchWrap}>
                    <Ionicons name="search" size={16} color="#aaa" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search trips..."
                        placeholderTextColor="#aaa"
                        value={search}
                        onChangeText={handleSearch}
                        returnKeyType="search"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Ionicons name="close-circle" size={18} color="#aaa" />
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>

            {/* Sort bar */}
            <View style={styles.sortBar}>
                <Text style={styles.sortCount}>
                    {filtered.length} trip{filtered.length !== 1 ? 's' : ''}
                </Text>
                <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortSheet(true)}>
                    <Ionicons name="funnel-outline" size={14} color={Colors.primary} />
                    <Text style={styles.sortBtnText}>{sortLabel}</Text>
                    <Ionicons name="chevron-down" size={14} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* List */}
            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadItineraries(true)}
                        colors={[Colors.primary]}
                    />
                }
            >
                {filtered.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="map-outline" size={52} color="#ddd" />
                        <Text style={styles.emptyTitle}>
                            {search ? 'No trips match your search' : 'No saved trips yet'}
                        </Text>
                        {!search && (
                            <TouchableOpacity
                                style={styles.emptyBtn}
                                onPress={() => router.push('/(tourist)/itinerary')}
                            >
                                <Ionicons name="add" size={18} color="#fff" />
                                <Text style={styles.emptyBtnText}>Plan a trip</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    filtered.map((itin, idx) => {
                        const colours = DAY_COLOURS[idx % DAY_COLOURS.length];
                        const budget = itin.budget || itin.estimatedBudget || 0;
                        const tags = (itin.activityTypes || []).slice(0, 3);
                        const days = itin.availableDays || 0;
                        const loc = itin.startLocation || '—';
                        const travellers = itin.numTravelers || itin.numTravellers || 1;

                        return (
                            <TouchableOpacity
                                key={itin.id}
                                style={styles.card}
                                activeOpacity={0.88}
                                onPress={() =>
                                    router.push({
                                        pathname: '/(tourist)/itinerary-view',
                                        params: { itineraryId: itin.id },
                                    })
                                }
                            >
                                {/* Colour accent strip */}
                                <LinearGradient
                                    colors={colours}
                                    style={styles.cardStrip}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name="map" size={22} color="#fff" />
                                </LinearGradient>

                                {/* Card body */}
                                <View style={styles.cardBody}>
                                    <View style={styles.cardTitleRow}>
                                        <Text style={styles.cardName} numberOfLines={1}>
                                            {itin.name || 'My Trip'}
                                        </Text>
                                        <View style={styles.cardActions}>
                                            <TouchableOpacity
                                                style={styles.cardActionBtn}
                                                onPress={(e) => { e.stopPropagation(); openRename(itin); }}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.cardActionBtn, { marginLeft: 6 }]}
                                                onPress={(e) => { e.stopPropagation(); handleDelete(itin); }}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.cardMeta}>
                                        <View style={styles.cardMetaItem}>
                                            <Ionicons name="calendar-outline" size={12} color="#999" />
                                            <Text style={styles.cardMetaText}>{days} day{days !== 1 ? 's' : ''}</Text>
                                        </View>
                                        <View style={styles.cardMetaItem}>
                                            <Ionicons name="location-outline" size={12} color="#999" />
                                            <Text style={styles.cardMetaText} numberOfLines={1}>{loc}</Text>
                                        </View>
                                        <View style={styles.cardMetaItem}>
                                            <Ionicons name="people-outline" size={12} color="#999" />
                                            <Text style={styles.cardMetaText}>{travellers}</Text>
                                        </View>
                                        <View style={styles.cardMetaItem}>
                                            <Ionicons name="cash-outline" size={12} color="#999" />
                                            <Text style={styles.cardMetaText}>LKR {formatBudget(budget)}</Text>
                                        </View>
                                    </View>

                                    {tags.length > 0 && (
                                        <View style={styles.tags}>
                                            {tags.map((t, ti) => (
                                                <View key={ti} style={styles.tag}>
                                                    <Text style={styles.tagText}>{t}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    <View style={styles.cardFooter}>
                                        <Text style={styles.cardDate}>{formatDate(itin.createdAt)}</Text>
                                        <View style={styles.viewBtn}>
                                            <Text style={styles.viewBtnText}>View</Text>
                                            <Ionicons name="chevron-forward" size={13} color={colours[0]} />
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
                <View style={{ height: 32 }} />
            </ScrollView>

            {/* Sort bottom sheet */}
            <Modal visible={showSortSheet} transparent animationType="slide">
                <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowSortSheet(false)}>
                    <View style={styles.sheet}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Sort by</Text>
                        {SORT_OPTIONS.map((opt) => (
                            <TouchableOpacity
                                key={opt.key}
                                style={[styles.sheetRow, sortKey === opt.key && styles.sheetRowActive]}
                                onPress={() => handleSort(opt.key)}
                            >
                                <Text style={[styles.sheetRowText, sortKey === opt.key && { color: Colors.primary, fontWeight: '700' }]}>
                                    {opt.label}
                                </Text>
                                {sortKey === opt.key && (
                                    <Ionicons name="checkmark" size={18} color={Colors.primary} />
                                )}
                            </TouchableOpacity>
                        ))}
                        <View style={{ height: 16 }} />
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Rename modal */}
            <Modal visible={renameModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.renameModal}>
                        <Text style={styles.renameTitle}>Rename trip</Text>
                        <TextInput
                            style={styles.renameInput}
                            value={renameDraft}
                            onChangeText={setRenameDraft}
                            placeholder="Trip name"
                            placeholderTextColor="#aaa"
                            autoFocus
                            maxLength={80}
                            returnKeyType="done"
                            onSubmitEditing={confirmRename}
                        />
                        <View style={styles.renameActions}>
                            <TouchableOpacity
                                style={styles.renameCancelBtn}
                                onPress={() => setRenameModal(false)}
                            >
                                <Text style={styles.renameCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.renameSaveBtn, (!renameDraft.trim() || renameLoading) && { opacity: 0.5 }]}
                                onPress={confirmRename}
                                disabled={!renameDraft.trim() || renameLoading}
                            >
                                {renameLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.renameSaveText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },

    // Header
    header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16 },
    headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
    headerTitleWrap: { flex: 1, marginHorizontal: 12 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
    planBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
    searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: '#fff', fontSize: 14 },

    // Sort bar
    sortBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEE' },
    sortCount: { fontSize: 13, color: '#888' },
    sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.primary + '12' },
    sortBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

    // List
    list: { flex: 1 },
    listContent: { padding: 14, gap: 12 },

    // Card
    card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
    cardStrip: { width: 56, justifyContent: 'center', alignItems: 'center' },
    cardBody: { flex: 1, padding: 12 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    cardName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#222', marginRight: 8 },
    cardActions: { flexDirection: 'row', alignItems: 'center' },
    cardActionBtn: { padding: 4 },
    cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
    cardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    cardMetaText: { fontSize: 11, color: '#888' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
    tag: { backgroundColor: Colors.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    tagText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardDate: { fontSize: 11, color: '#bbb' },
    viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    viewBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

    // Empty
    empty: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 14, marginBottom: 20 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    // Sort sheet
    sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 10 },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 },
    sheetTitle: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 8 },
    sheetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    sheetRowActive: { backgroundColor: Colors.primary + '08' },
    sheetRowText: { fontSize: 14, color: '#333' },

    // Rename modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    renameModal: { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '100%' },
    renameTitle: { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: 16 },
    renameInput: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#222', marginBottom: 20 },
    renameActions: { flexDirection: 'row', gap: 10 },
    renameCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#DDD', alignItems: 'center' },
    renameCancelText: { fontSize: 14, fontWeight: '600', color: '#666' },
    renameSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
    renameSaveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
