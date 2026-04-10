// services/api.js
// Central service for all Node backend calls

const BASE_URL = 'http://192.168.8.101'; // Change to your machine IP (not localhost on device)

async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

// --- Itinerary ---

export async function generateItinerary(payload) {
    // payload: { budget, available_days, distance_preference, num_travelers,
    //            activity_type, season, start_latitude, start_longitude }
    return request('/api/itinerary/recommend', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function getSimilarAttractions(attractionId, excludeIds = []) {
    return request('/api/itinerary/similar-attractions', {
        method: 'POST',
        body: JSON.stringify({ attraction_id: attractionId, exclude_ids: excludeIds }),
    });
}

export async function getAllAttractions(category = null, limit = 100) {
    const params = new URLSearchParams({ limit });
    if (category) params.append('category', category);
    return request(`/api/itinerary/attractions?${params}`);
}

export async function getAttractionCategories() {
    return request('/api/itinerary/attractions/categories');
}

// --- Risk ---

// locations: [{ lat, lon, name?, type? }]
export async function predictRisk(locations) {
    return request('/api/risk/predict', {
        method: 'POST',
        body: JSON.stringify({ locations }),
    });
}

// itinerary_locations: [{ type: 'hotel'|'attraction', id, name? }]
export async function predictItineraryRisk(itineraryLocations) {
    return request('/api/risk/predict-itinerary', {
        method: 'POST',
        body: JSON.stringify({ itinerary_locations: itineraryLocations }),
    });
}

// --- Hotels ---

export async function getHotels(filters = {}) {
    const params = new URLSearchParams(filters);
    return request(`/api/hotels?${params}`);
}

export async function getHotel(hotelId) {
    return request(`/api/hotels/${hotelId}`);
}

export async function getHotelRooms(hotelId) {
    return request(`/api/hotels/${hotelId}/rooms`);
}

export async function getHotelReviews(hotelId, limit = 20) {
    return request(`/api/hotels/${hotelId}/reviews?limit=${limit}`);
}

export async function postReview(hotelId, review) {
    return request(`/api/hotels/${hotelId}/reviews`, {
        method: 'POST',
        body: JSON.stringify(review),
    });
}

// --- Hotel Listings (hotel account) ---

export async function getHotelListings(hotelId) {
    return request(`/api/hotels/${hotelId}/listings`);
}

export async function createListing(hotelId, listing) {
    return request(`/api/hotels/${hotelId}/listings`, {
        method: 'POST',
        body: JSON.stringify(listing),
    });
}

export async function updateListing(hotelId, listingId, updates) {
    return request(`/api/hotels/${hotelId}/listings/${listingId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
    });
}

export async function deleteListing(hotelId, listingId) {
    return request(`/api/hotels/${hotelId}/listings/${listingId}`, {
        method: 'DELETE',
    });
}

// --- Bookings ---

export async function createBooking(booking) {
    return request('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(booking),
    });
}

export async function getTouristBookings(uid) {
    return request(`/api/bookings/tourist/${uid}`);
}

export async function getHotelBookings(hotelId) {
    return request(`/api/bookings/hotel/${hotelId}`);
}

export async function getHotelStats(hotelId) {
    return request(`/api/bookings/hotel/${hotelId}/stats`);
}

export async function updateBookingStatus(bookingId, status) {
    return request(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

// --- Emergency ---

export async function triggerEmergencyAlertApi({ userId, userName, latitude, longitude, selectedEmergencyContactUids = [], selectedFriendUids = [], radiusKm = 5 }) {
    return request('/api/emergency/alert', {
        method: 'POST',
        body: JSON.stringify({ userId, userName, latitude, longitude, selectedEmergencyContactUids: selectedEmergencyContactUids.length ? selectedEmergencyContactUids : selectedFriendUids, radiusKm }),
    });
}

export async function updateAlertLocation(alertId, latitude, longitude) {
    return request(`/api/emergency/alert/${alertId}/location`, {
        method: 'PATCH',
        body: JSON.stringify({ latitude, longitude }),
    });
}

export async function cancelAlertApi(alertId) {
    return request(`/api/emergency/alert/${alertId}`, { method: 'DELETE' });
}

export async function getActiveAlerts() {
    return request('/api/emergency/alerts/active');
}

export async function getEmergencyNotifications(uid) {
    return request(`/api/emergency/notifications/${uid}`);
}

export async function markNotificationRead(notifId) {
    return request(`/api/emergency/notifications/${notifId}/read`, { method: 'PATCH' });
}

export async function updatePassiveLocation(userId, latitude, longitude) {
    return request('/api/emergency/location', {
        method: 'POST',
        body: JSON.stringify({ userId, latitude, longitude }),
    });
}
export async function startLocationSharing(userId, latitude, longitude, sharingWith) {
    return request('/api/emergency/share-location', {
        method: 'POST',
        body: JSON.stringify({ userId, latitude, longitude, sharingWith }),
    });
}

export async function stopLocationSharing(userId) {
    return request(`/api/emergency/share-location/${userId}`, { method: 'DELETE' });
}

export async function getFriendsLocations(userId) {
    return request(`/api/emergency/friends-locations/${userId}`);
}

export async function searchAppUsers(query) {
    return request(`/api/emergency/users/search?q=${encodeURIComponent(query)}`);
}