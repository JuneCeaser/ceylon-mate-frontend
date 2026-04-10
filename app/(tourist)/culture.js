import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';

const { width } = Dimensions.get('window');

const CULTURE_TABS = ['All', 'Festivals', 'Food', 'Arts', 'Traditions'];

const CULTURE_ITEMS = [
    {
        id: '1',
        title: 'Kandy Esala Perahera',
        subtitle: 'Grand Festival of the Tooth Relic',
        type: 'Festivals',
        month: 'July / August',
        colors: ['#6A1B9A', '#7B1FA2'],
        accent: '#CE93D8',
        icon: 'sparkles-outline',
        description: 'One of the grandest Buddhist festivals in the world, held annually in Kandy. The 10-day festival features thousands of magnificently adorned elephants, traditional dancers, fire-jugglers, and whip-crackers parading through the streets, culminating in the procession of the Sacred Tooth Relic.',
        tips: ['Book accommodation months in advance', 'Best viewing spots are along Dalada Veediya', 'Evening processions are most spectacular'],
        mustSee: true,
    },
    {
        id: '2',
        title: 'Rice & Curry',
        subtitle: 'The Heart of Sri Lankan Cuisine',
        type: 'Food',
        month: 'Year Round',
        colors: ['#E65100', '#F57C00'],
        accent: '#FFCC80',
        icon: 'restaurant-outline',
        description: 'Sri Lankan rice and curry is a symphony of flavours — a mound of steaming rice surrounded by a dozen small dishes of curries, sambols, and chutneys. Made with an elaborate blend of spices including cinnamon (which Sri Lanka pioneered), cardamom, and pandan leaves.',
        tips: ['Eat with your right hand for the authentic experience', 'Try coconut roti (pol roti) for breakfast', 'Hoppers (appa) are a must-try street food'],
        mustSee: false,
    },
    {
        id: '3',
        title: 'Kandyan Dance',
        subtitle: 'Sacred Classical Dance Form',
        type: 'Arts',
        month: 'Year Round',
        colors: ['#B71C1C', '#D32F2F'],
        accent: '#EF9A9A',
        icon: 'musical-notes-outline',
        description: 'One of the most vibrant and energetic classical dance forms in the world. Originating from the Kandyan Kingdom, this sacred art form features 18 distinct rhythmic patterns, elaborate costumes with layers of silver ornaments, and death-defying acrobatic movements. It was traditionally performed at the Esala Perahera.',
        tips: ['Watch a show at the Kandy Cultural Centre', 'Shows run nightly at 5:00 PM and 7:30 PM', 'Classes available for tourists'],
        mustSee: true,
    },
    {
        id: '4',
        title: 'Sinhala & Tamil New Year',
        subtitle: 'Aluth Avurudda — April 13 & 14',
        type: 'Festivals',
        month: 'April',
        colors: ['#1565C0', '#1976D2'],
        accent: '#90CAF9',
        icon: 'sunny-outline',
        description: 'The most important cultural festival in Sri Lanka, celebrating the traditional new year of both the Sinhala and Tamil communities. The festival marks the end of the harvest season with rituals timed to the minute by astrologers, including the lighting of the hearth, the first meal, and traditional games.',
        tips: ['Try traditional sweets like kevum and kokis', 'Join in the traditional games in villages', 'Expect everything to close for 2–3 days'],
        mustSee: true,
    },
    {
        id: '5',
        title: 'Batik & Handloom',
        subtitle: 'Traditional Sri Lankan Textiles',
        type: 'Arts',
        month: 'Year Round',
        colors: ['#2E7D32', '#388E3C'],
        accent: '#A5D6A7',
        icon: 'color-palette-outline',
        description: 'Sri Lanka\'s batik tradition is renowned across Asia, featuring intricate patterns drawn with wax and dyed in vibrant colours. The island also produces exquisite handloom fabrics from places like Dumbara, famous for its distinctive geometric patterns and natural dyes made from plants.',
        tips: ['Visit the Barefoot Gallery in Colombo for quality pieces', 'Workshops available in Kandy and Galle', 'Bargain respectfully at craft markets'],
        mustSee: false,
    },
    {
        id: '6',
        title: 'Vesak Festival',
        subtitle: 'Festival of Lights — Buddha\'s Birthday',
        type: 'Festivals',
        month: 'May (Full Moon)',
        colors: ['#F57F17', '#F9A825'],
        accent: '#FFF176',
        icon: 'balloon-outline',
        description: 'The most sacred Buddhist festival, commemorating the birth, enlightenment and death of the Buddha. The entire island lights up with millions of lanterns, pandals (illuminated tableaux depicting Jataka stories), and dansalas (free food stalls) open to anyone, regardless of religion.',
        tips: ['Walk around Colombo to see the pandals', 'Free food is offered at dansalas — accept graciously', 'Carry a small lantern to join the celebrations'],
        mustSee: true,
    },
    {
        id: '7',
        title: 'Ceylon Tea Culture',
        subtitle: 'From Nuwara Eliya to Your Cup',
        type: 'Traditions',
        month: 'Year Round',
        colors: ['#4E342E', '#6D4C41'],
        accent: '#FFCC80',
        icon: 'cafe-outline',
        description: 'Tea is more than a drink in Sri Lanka — it\'s a national identity. Introduced by the British in the 1860s, Ceylon tea (now Sri Lanka tea) is world-famous for its rich flavour and golden colour. The central highlands are blanketed with emerald tea estates where you can witness the entire process from plucking to packaging.',
        tips: ['Visit a tea factory in Nuwara Eliya for a free tour', 'Try "plain tea" — black, unsweetened', 'Buy directly from estates for the freshest tea'],
        mustSee: false,
    },
    {
        id: '8',
        title: 'Mask Making & Devil Dance',
        subtitle: 'Kolam & Tovil Traditions',
        type: 'Traditions',
        month: 'Year Round',
        colors: ['#4A148C', '#7B1FA2'],
        accent: '#CE93D8',
        icon: 'happy-outline',
        description: 'The ancient art of mask carving from Ambalangoda is a living tradition unique to Sri Lanka. The carved wooden masks represent demons, spirits and characters from folk dramas. These masks are used in Kolam theatre (comic ritual drama) and Tovil healing ceremonies to drive away evil spirits.',
        tips: ['Visit the Mask Museum in Ambalangoda', 'Workshops offer hands-on carving experiences', 'Authentic masks make unique souvenirs'],
        mustSee: false,
    },
];

export default function CulturePage() {
    const router = useRouter();
    const [selectedTab, setSelectedTab] = useState('All');
    const [expandedId, setExpandedId] = useState(null);

    const filtered = selectedTab === 'All'
        ? CULTURE_ITEMS
        : CULTURE_ITEMS.filter((c) => c.type === selectedTab);

    const mustSeeItems = CULTURE_ITEMS.filter((c) => c.mustSee);

    return (
        <View style={styles.container}>
            {/* ── HEADER ── */}
            <LinearGradient colors={['#4A148C', '#6A1B9A', '#9C27B0']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.headerCircle1} />
                <View style={styles.headerCircle2} />
                <View style={styles.headerContent}>
                    <Text style={styles.headerLabel}>Experience</Text>
                    <Text style={styles.headerTitle}>Sri Lankan Culture</Text>
                    <Text style={styles.headerSub}>Festivals, food, arts & living traditions</Text>
                </View>
            </LinearGradient>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* ── MUST-SEE HORIZONTAL STRIP ── */}
                <View style={styles.mustSeeSection}>
                    <Text style={styles.sectionTitle}>Must Experience 🌟</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mustSeeScroll}>
                        {mustSeeItems.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.mustSeeCard}
                                onPress={() => setExpandedId(item.id === expandedId ? null : item.id)}
                                activeOpacity={0.88}
                            >
                                <LinearGradient colors={item.colors} style={styles.mustSeeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                    <View style={[styles.mustSeeBlob, { backgroundColor: item.accent + '25' }]} />
                                    <View style={[styles.mustSeeIconWrap, { backgroundColor: item.accent + '30' }]}>
                                        <Ionicons name={item.icon} size={30} color={item.accent} />
                                    </View>
                                    <View style={styles.mustSeeMonthPill}>
                                        <Ionicons name="calendar-outline" size={10} color="rgba(255,255,255,0.8)" />
                                        <Text style={styles.mustSeeMonthText}>{item.month}</Text>
                                    </View>
                                    <Text style={styles.mustSeeTitle}>{item.title}</Text>
                                    <Text style={styles.mustSeeSub} numberOfLines={1}>{item.subtitle}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ── TAB FILTER ── */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
                    {CULTURE_TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tabChip, selectedTab === tab && styles.tabChipActive]}
                            onPress={() => setSelectedTab(tab)}
                        >
                            <Text style={[styles.tabChipText, selectedTab === tab && styles.tabChipTextActive]}>{tab}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* ── CULTURE CARDS ── */}
                <View style={styles.cardsSection}>
                    {filtered.map((item) => {
                        const isExpanded = expandedId === item.id;
                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.card}
                                onPress={() => setExpandedId(isExpanded ? null : item.id)}
                                activeOpacity={0.9}
                            >
                                {/* Card Header */}
                                <LinearGradient colors={item.colors} style={styles.cardTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    <View style={[styles.cardIconWrap, { backgroundColor: item.accent + '30' }]}>
                                        <Ionicons name={item.icon} size={24} color={item.accent} />
                                    </View>
                                    <View style={styles.cardTopInfo}>
                                        <View style={styles.cardTopRow}>
                                            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                                            {item.mustSee && (
                                                <View style={styles.mustSeeBadge}>
                                                    <Ionicons name="star" size={9} color="#FFD54F" />
                                                    <Text style={styles.mustSeeBadgeText}>Must See</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                                        <View style={styles.cardBottomRow}>
                                            <View style={[styles.typePill, { borderColor: item.accent + '70' }]}>
                                                <Text style={[styles.typePillText, { color: item.accent }]}>{item.type}</Text>
                                            </View>
                                            <View style={styles.monthRow}>
                                                <Ionicons name="calendar-outline" size={10} color="rgba(255,255,255,0.7)" />
                                                <Text style={styles.monthText}>{item.month}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <Ionicons
                                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                        size={18}
                                        color="rgba(255,255,255,0.7)"
                                    />
                                </LinearGradient>

                                {/* Expanded Body */}
                                {isExpanded && (
                                    <View style={styles.cardBody}>
                                        <Text style={styles.cardDescription}>{item.description}</Text>

                                        <Text style={styles.cardSectionLabel}>Traveller Tips</Text>
                                        {item.tips.map((tip, i) => (
                                            <View key={i} style={styles.tipRow}>
                                                <View style={styles.tipDot} />
                                                <Text style={styles.tipText}>{tip}</Text>
                                            </View>
                                        ))}

                                        <TouchableOpacity
                                            style={styles.exploreBtn}
                                            onPress={() => router.push('/(tourist)/itinerary')}
                                        >
                                            <LinearGradient colors={item.colors} style={styles.exploreBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                                <Ionicons name="map-outline" size={15} color="#fff" />
                                                <Text style={styles.exploreBtnText}>Plan to Visit</Text>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ── ETIQUETTE CARD ── */}
                <View style={styles.etiquetteCard}>
                    <LinearGradient colors={['#E8F5E9', '#C8E6C9']} style={styles.etiquetteGrad}>
                        <View style={styles.etiquetteHeader}>
                            <Ionicons name="hand-left-outline" size={22} color={Colors.primary} />
                            <Text style={styles.etiquetteTitle}>Cultural Etiquette</Text>
                        </View>
                        {[
                            { icon: 'shirt-outline', text: 'Remove shoes before entering temples' },
                            { icon: 'body-outline', text: 'Cover shoulders and knees at religious sites' },
                            { icon: 'camera-outline', text: 'Always ask before photographing locals' },
                            { icon: 'hand-left-outline', text: 'Receive gifts and food with both hands' },
                            { icon: 'heart-outline', text: 'Greet with "Ayubowan" (may you live long)' },
                        ].map((e, i) => (
                            <View key={i} style={styles.etiquetteRow}>
                                <Ionicons name={e.icon} size={15} color={Colors.primary} />
                                <Text style={styles.etiquetteText}>{e.text}</Text>
                            </View>
                        ))}
                    </LinearGradient>
                </View>

                <View style={{ height: Spacing.xl * 2 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F0FF' },

    // Header
    header: { paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, overflow: 'hidden' },
    headerCircle1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 },
    headerCircle2: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -20, left: 20 },
    headerContent: {},
    headerLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.2 },
    headerTitle: { fontSize: 30, fontWeight: 'bold', color: '#fff', letterSpacing: -0.5, marginTop: 2 },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

    scrollContent: { paddingTop: Spacing.md },

    // Must-see strip
    mustSeeSection: { marginBottom: Spacing.md },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    mustSeeScroll: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    mustSeeCard: { width: width * 0.48, height: 170, borderRadius: BorderRadius.xl, overflow: 'hidden', elevation: 4 },
    mustSeeGrad: { flex: 1, padding: Spacing.md, justifyContent: 'flex-end', position: 'relative' },
    mustSeeBlob: { position: 'absolute', width: 100, height: 100, borderRadius: 50, top: -20, right: -20 },
    mustSeeIconWrap: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
    mustSeeMonthPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.2)', alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: BorderRadius.round, marginBottom: 6 },
    mustSeeMonthText: { fontSize: 9, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
    mustSeeTitle: { fontSize: 13, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
    mustSeeSub: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },

    // Tab filter
    tabScroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: 8 },
    tabChip: {
        paddingHorizontal: 16, paddingVertical: 8,
        backgroundColor: '#fff', borderRadius: BorderRadius.round,
        borderWidth: 1, borderColor: '#D8CCF0', elevation: 1,
    },
    tabChipActive: { backgroundColor: '#6A1B9A', borderColor: '#6A1B9A' },
    tabChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
    tabChipTextActive: { color: '#fff' },

    // Cards
    cardsSection: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    card: { borderRadius: BorderRadius.xl, overflow: 'hidden', elevation: 3 },
    cardTop: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
    cardIconWrap: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    cardTopInfo: { flex: 1 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
    cardTitle: { flex: 1, fontSize: 14, fontWeight: 'bold', color: '#fff' },
    mustSeeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.round },
    mustSeeBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFD54F' },
    cardSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 6 },
    cardBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    typePill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: BorderRadius.round, borderWidth: 1 },
    typePillText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
    monthRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    monthText: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },

    // Card body
    cardBody: { backgroundColor: '#fff', padding: Spacing.md },
    cardDescription: { fontSize: 13, color: '#37474F', lineHeight: 20, marginBottom: Spacing.md },
    cardSectionLabel: { fontSize: 11, fontWeight: '700', color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
    tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6A1B9A', marginTop: 6 },
    tipText: { flex: 1, fontSize: 13, color: '#37474F', lineHeight: 18 },
    exploreBtn: { marginTop: Spacing.md, borderRadius: BorderRadius.lg, overflow: 'hidden' },
    exploreBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    exploreBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    // Etiquette card
    etiquetteCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', elevation: 1 },
    etiquetteGrad: { padding: Spacing.md },
    etiquetteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
    etiquetteTitle: { fontSize: 16, fontWeight: '700', color: Colors.primary },
    etiquetteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    etiquetteText: { fontSize: 13, color: '#37474F', flex: 1 },
});