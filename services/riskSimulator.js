// services/riskSimulator.js

// Helper: safely get a coordinate from multiple possible keys
const getCoord = (attr, keys) => {
    for (const key of keys) {
        if (attr[key] !== undefined && attr[key] !== null && attr[key] !== '') {
            const val = parseFloat(attr[key]);
            if (!Number.isNaN(val)) return val;
        }
    }
    return null;
};

export const simulateRiskData = (attractions) => {
    const locations = attractions.map((attr, index) => {
        // 1) Try to get latitude / longitude from your CSV-style keys first
        const latitude = getCoord(attr, ['latitude', 'lat', 'Latitude', 'LAT']);
        const longitude = getCoord(attr, ['longitude', 'lng', 'Longitude', 'LON', 'Lon']);

        const name =
            attr.name ||
            attr.Name ||
            attr.location ||
            attr.place ||
            attr.title ||
            `Location ${index + 1}`;

        // 2) Fallback to Sri Lanka center if we still don't have coords
        const latFinal = latitude ?? 7.8731;
        const lngFinal = longitude ?? 80.7718;

        // 3) Fake risk values (you can adjust logic later)
        const weatherRisk = Math.random() * 0.7;
        const trafficRisk = Math.random() * 0.7;
        const incidentRisk = Math.random() * 0.8;
        const riskScore = (weatherRisk + trafficRisk + incidentRisk) / 3;

        const simulatedData = {
            temperature: 24 + Math.round(Math.random() * 8),
            rainfall: Math.round(Math.random() * 50),
            windSpeed: 5 + Math.round(Math.random() * 25),
            congestionLevel: 3 + Math.round(Math.random() * 7),
            avgSpeed: 20 + Math.round(Math.random() * 40),
            trafficVolume: 500 + Math.round(Math.random() * 2500),
            recentAccidents: Math.round(Math.random() * 3),
            recentIncidents: Math.round(Math.random() * 4),
            severityLevel: 1 + Math.round(Math.random() * 4),
        };

        const riskFactors = [];
        if (weatherRisk > 0.5) riskFactors.push('Unstable or rainy weather expected.');
        if (trafficRisk > 0.5) riskFactors.push('High traffic congestion during peak hours.');
        if (incidentRisk > 0.5) riskFactors.push('Recent safety incidents in the surrounding area.');

        const recommendations = [];
        if (riskScore < 0.3) {
            recommendations.push('This area is generally safe. Enjoy your visit as planned.');
        } else if (riskScore < 0.6) {
            recommendations.push('Plan travel during daylight and avoid peak traffic hours.');
            recommendations.push('Check weather updates before traveling.');
        } else {
            recommendations.push('Consider visiting in the morning or choosing an alternative location.');
            recommendations.push('Avoid traveling alone at night in this area.');
        }

        return {
            ...attr, // Keep all original attraction data
            name,
            latitude: latFinal,
            longitude: lngFinal,
            weatherRisk,
            trafficRisk,
            incidentRisk,
            riskScore,
            simulatedData,
            riskFactors,
            recommendations,
        };
    });

    const totalLocations = locations.length;
    const lowRisk = locations.filter((l) => l.riskScore < 0.3).length;
    const mediumRisk = locations.filter((l) => l.riskScore >= 0.3 && l.riskScore < 0.6).length;
    const highRisk = locations.filter((l) => l.riskScore >= 0.6).length;

    const averageRisk =
        totalLocations > 0
            ? locations.reduce((sum, l) => sum + l.riskScore, 0) / totalLocations
            : 0;

    return {
        locations,
        summary: {
            totalLocations,
            lowRisk,
            mediumRisk,
            highRisk,
            averageRisk,
        },
        timestamp: new Date().toISOString(),
    };
};

/**
 * Recalculate risk for a specific location with new simulated data
 */
export const recalculateRisk = (location) => {
    const newData = simulateRiskData([location]);
    return newData.locations[0];
};

/**
 * Generate alternative locations based on original location preferences
 */
export const generateAlternatives = async (originalLocation, allAttractions, userPreferences) => {
    console.log('Generating alternatives for:', originalLocation.name);
    console.log('Total attractions available:', allAttractions.length);

    // Get the category of the original location
    const originalCategory = originalLocation.category ||
        originalLocation.Category ||
        originalLocation.type ||
        '';

    console.log('Original category:', originalCategory);

    // Filter attractions by same category, excluding the original
    const sameCategory = allAttractions.filter(attr => {
        const attrCategory = attr.category || attr.Category || attr.type || '';
        const attrId = attr.attraction_id || attr.id || attr.name;
        const originalId = originalLocation.attraction_id || originalLocation.id || originalLocation.name;

        return attrCategory.toLowerCase() === originalCategory.toLowerCase() &&
            attrId !== originalId;
    });

    console.log('Same category attractions found:', sameCategory.length);

    if (sameCategory.length === 0) {
        console.log('No alternatives in same category, using all attractions');
        // If no same category, use all attractions except the original
        sameCategory.push(...allAttractions.filter(attr => {
            const attrId = attr.attraction_id || attr.id || attr.name;
            const originalId = originalLocation.attraction_id || originalLocation.id || originalLocation.name;
            return attrId !== originalId;
        }));
    }

    // Score alternatives based on multiple factors
    const scoredAlternatives = sameCategory.map(attraction => {
        let score = 0;

        // Category match bonus (if same category)
        const attrCategory = attraction.category || attraction.Category || attraction.type || '';
        if (attrCategory.toLowerCase() === originalCategory.toLowerCase()) {
            score += 0.3;
        }

        // Safety rating (higher is better)
        const safetyRating = parseFloat(attraction.safety_rating || attraction.safetyRating || 0.8);
        score += safetyRating * 0.25;

        // Popularity (higher is better)
        const popularity = parseFloat(attraction.popularity_score || attraction.popularity || 0.5);
        score += popularity * 0.15;

        // Budget match (closer to original is better)
        const attractionCost = parseFloat(attraction.avg_cost || attraction.cost || 0);
        const originalCost = parseFloat(originalLocation.avg_cost || originalLocation.cost || 0);
        const costDiff = Math.abs(attractionCost - originalCost);
        const maxCost = Math.max(attractionCost, originalCost, 1); // Avoid division by zero
        score += (1 - (costDiff / maxCost)) * 0.15;

        // Duration similarity (closer to original is better)
        const attractionDuration = parseFloat(attraction.avg_duration_hours || attraction.duration || 2);
        const originalDuration = parseFloat(originalLocation.avg_duration_hours || originalLocation.duration || 2);
        const durationDiff = Math.abs(attractionDuration - originalDuration);
        score += (1 - Math.min(durationDiff / 5, 1)) * 0.15;

        return {
            ...attraction,
            alternativeScore: score,
        };
    });

    // Sort by score (highest first) and take top 3
    const topAlternatives = scoredAlternatives
        .sort((a, b) => b.alternativeScore - a.alternativeScore)
        .slice(0, 3);

    console.log('Top alternatives selected:', topAlternatives.length);

    // Simulate risk for alternatives
    const alternativesWithRisk = simulateRiskData(topAlternatives);

    return alternativesWithRisk.locations;
};