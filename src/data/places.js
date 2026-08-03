// A compact, fully-local list of major world places. Used only to label the
// live feed with "near <place>" — it lives entirely on the device, so nothing
// is sent anywhere to name a location.

export const PLACES = [
  ['New York', 40.7, -74.0], ['Los Angeles', 34.1, -118.2], ['Chicago', 41.9, -87.6],
  ['Houston', 29.8, -95.4], ['Miami', 25.8, -80.2], ['Boston', 42.4, -71.1],
  ['San Francisco', 37.8, -122.4], ['Seattle', 47.6, -122.3], ['Washington', 38.9, -77.0],
  ['Atlanta', 33.7, -84.4], ['Mexico City', 19.4, -99.1], ['Toronto', 43.7, -79.4],
  ['Montreal', 45.5, -73.6], ['Vancouver', 49.3, -123.1],
  ['São Paulo', -23.5, -46.6], ['Rio de Janeiro', -22.9, -43.2], ['Buenos Aires', -34.6, -58.4],
  ['Lima', -12.0, -77.0], ['Bogotá', 4.7, -74.1], ['Santiago', -33.5, -70.7],
  ['Caracas', 10.5, -66.9], ['Quito', -0.2, -78.5],
  ['London', 51.5, -0.1], ['Paris', 48.9, 2.3], ['Berlin', 52.5, 13.4],
  ['Madrid', 40.4, -3.7], ['Rome', 41.9, 12.5], ['Amsterdam', 52.4, 4.9],
  ['Brussels', 50.8, 4.4], ['Vienna', 48.2, 16.4], ['Warsaw', 52.2, 21.0],
  ['Prague', 50.1, 14.4], ['Istanbul', 41.0, 28.9], ['Athens', 38.0, 23.7],
  ['Lisbon', 38.7, -9.1], ['Dublin', 53.3, -6.3], ['Stockholm', 59.3, 18.1],
  ['Oslo', 59.9, 10.8], ['Copenhagen', 55.7, 12.6], ['Moscow', 55.8, 37.6],
  ['Kyiv', 50.5, 30.5], ['Zurich', 47.4, 8.5], ['Barcelona', 41.4, 2.2], ['Milan', 45.5, 9.2],
  ['Cairo', 30.0, 31.2], ['Lagos', 6.5, 3.4], ['Nairobi', -1.3, 36.8],
  ['Johannesburg', -26.2, 28.0], ['Accra', 5.6, -0.2], ['Addis Ababa', 9.0, 38.7],
  ['Casablanca', 33.6, -7.6], ['Tunis', 36.8, 10.2], ['Dakar', 14.7, -17.4],
  ['Khartoum', 15.5, 32.5],
  ['Delhi', 28.6, 77.2], ['Mumbai', 19.1, 72.9], ['Bangalore', 13.0, 77.6],
  ['Chennai', 13.1, 80.3], ['Kolkata', 22.6, 88.4], ['Hyderabad', 17.4, 78.5],
  ['Tokyo', 35.7, 139.7], ['Osaka', 34.7, 135.5], ['Beijing', 39.9, 116.4],
  ['Shanghai', 31.2, 121.5], ['Guangzhou', 23.1, 113.3], ['Hong Kong', 22.3, 114.2],
  ['Seoul', 37.6, 127.0], ['Bangkok', 13.8, 100.5], ['Singapore', 1.4, 103.8],
  ['Jakarta', -6.2, 106.8], ['Manila', 14.6, 121.0], ['Karachi', 24.9, 67.0],
  ['Lahore', 31.5, 74.3], ['Dhaka', 23.8, 90.4], ['Tehran', 35.7, 51.4],
  ['Baghdad', 33.3, 44.4], ['Riyadh', 24.7, 46.7], ['Dubai', 25.2, 55.3],
  ['Tel Aviv', 32.1, 34.8], ['Amman', 31.9, 35.9], ['Ho Chi Minh City', 10.8, 106.6],
  ['Hanoi', 21.0, 105.8], ['Kuala Lumpur', 3.1, 101.7],
  ['Sydney', -33.9, 151.2], ['Melbourne', -37.8, 145.0], ['Brisbane', -27.5, 153.0],
  ['Perth', -31.9, 115.9], ['Auckland', -36.8, 174.8], ['Wellington', -41.3, 174.8],
  ['Suva', -18.1, 178.4]
]

// The nearest bundled place to a coordinate — a rough "near <place>" label.
export function nearestPlace(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null
  const cos = Math.cos((lat * Math.PI) / 180)
  let best = null
  let bestD = Infinity
  for (const [name, pl, pn] of PLACES) {
    const dlat = lat - pl
    const dlon = (lon - pn) * cos
    const d = dlat * dlat + dlon * dlon
    if (d < bestD) {
      bestD = d
      best = name
    }
  }
  return best
}
