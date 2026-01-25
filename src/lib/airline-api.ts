/**
 * Airline API Service
 *
 * Provides flight information lookup using:
 * 1. AviationStack API (if API key provided)
 * 2. Local Indian flight database (fallback)
 */

// Common Indian domestic flight routes with typical schedules
const INDIAN_FLIGHT_DATABASE: Record<string, {
  airline: string
  route: { from: string; to: string }
  typical_departure: string
  typical_arrival: string
  duration_mins: number
}> = {
  // === CCU (Kolkata) - PAT (Patna) Route ===
  "6E-342": { airline: "IndiGo", route: { from: "PAT", to: "CCU" }, typical_departure: "20:25", typical_arrival: "21:35", duration_mins: 70 },
  "6E-343": { airline: "IndiGo", route: { from: "CCU", to: "PAT" }, typical_departure: "10:50", typical_arrival: "12:00", duration_mins: 70 },
  "6E-6348": { airline: "IndiGo", route: { from: "CCU", to: "PAT" }, typical_departure: "10:10", typical_arrival: "11:20", duration_mins: 70 },
  "6E-6349": { airline: "IndiGo", route: { from: "PAT", to: "CCU" }, typical_departure: "12:50", typical_arrival: "14:00", duration_mins: 70 },
  "6E-527": { airline: "IndiGo", route: { from: "CCU", to: "PAT" }, typical_departure: "17:30", typical_arrival: "18:40", duration_mins: 70 },
  "6E-528": { airline: "IndiGo", route: { from: "PAT", to: "CCU" }, typical_departure: "07:00", typical_arrival: "08:10", duration_mins: 70 },
  "AI-433": { airline: "Air India", route: { from: "CCU", to: "PAT" }, typical_departure: "14:30", typical_arrival: "15:40", duration_mins: 70 },
  "AI-434": { airline: "Air India", route: { from: "PAT", to: "CCU" }, typical_departure: "16:15", typical_arrival: "17:25", duration_mins: 70 },

  // === DEL (Delhi) - PAT (Patna) Route ===
  "6E-175": { airline: "IndiGo", route: { from: "DEL", to: "PAT" }, typical_departure: "06:15", typical_arrival: "07:55", duration_mins: 100 },
  "6E-176": { airline: "IndiGo", route: { from: "PAT", to: "DEL" }, typical_departure: "08:25", typical_arrival: "10:15", duration_mins: 110 },
  "6E-2175": { airline: "IndiGo", route: { from: "DEL", to: "PAT" }, typical_departure: "14:00", typical_arrival: "15:40", duration_mins: 100 },
  "6E-2176": { airline: "IndiGo", route: { from: "PAT", to: "DEL" }, typical_departure: "16:15", typical_arrival: "18:05", duration_mins: 110 },
  "6E-5765": { airline: "IndiGo", route: { from: "DEL", to: "PAT" }, typical_departure: "21:00", typical_arrival: "22:40", duration_mins: 100 },
  "AI-435": { airline: "Air India", route: { from: "DEL", to: "PAT" }, typical_departure: "10:30", typical_arrival: "12:10", duration_mins: 100 },
  "AI-436": { airline: "Air India", route: { from: "PAT", to: "DEL" }, typical_departure: "12:45", typical_arrival: "14:35", duration_mins: 110 },
  "SG-8169": { airline: "SpiceJet", route: { from: "DEL", to: "PAT" }, typical_departure: "15:25", typical_arrival: "17:05", duration_mins: 100 },
  "SG-8170": { airline: "SpiceJet", route: { from: "PAT", to: "DEL" }, typical_departure: "17:35", typical_arrival: "19:25", duration_mins: 110 },

  // === DEL (Delhi) - CCU (Kolkata) Route ===
  "AI-401": { airline: "Air India", route: { from: "DEL", to: "CCU" }, typical_departure: "09:00", typical_arrival: "11:15", duration_mins: 135 },
  "AI-402": { airline: "Air India", route: { from: "CCU", to: "DEL" }, typical_departure: "12:00", typical_arrival: "14:20", duration_mins: 140 },
  "6E-2031": { airline: "IndiGo", route: { from: "DEL", to: "CCU" }, typical_departure: "06:30", typical_arrival: "08:45", duration_mins: 135 },
  "6E-2032": { airline: "IndiGo", route: { from: "CCU", to: "DEL" }, typical_departure: "09:30", typical_arrival: "11:50", duration_mins: 140 },
  "6E-286": { airline: "IndiGo", route: { from: "DEL", to: "CCU" }, typical_departure: "14:15", typical_arrival: "16:30", duration_mins: 135 },
  "6E-287": { airline: "IndiGo", route: { from: "CCU", to: "DEL" }, typical_departure: "17:15", typical_arrival: "19:35", duration_mins: 140 },
  "UK-725": { airline: "Vistara", route: { from: "DEL", to: "CCU" }, typical_departure: "07:10", typical_arrival: "09:25", duration_mins: 135 },
  "UK-726": { airline: "Vistara", route: { from: "CCU", to: "DEL" }, typical_departure: "10:05", typical_arrival: "12:30", duration_mins: 145 },
  "UK-773": { airline: "Vistara", route: { from: "DEL", to: "CCU" }, typical_departure: "19:00", typical_arrival: "21:15", duration_mins: 135 },
  "UK-774": { airline: "Vistara", route: { from: "CCU", to: "DEL" }, typical_departure: "22:00", typical_arrival: "00:20", duration_mins: 140 },

  // === DEL (Delhi) - BOM (Mumbai) Route ===
  "AI-505": { airline: "Air India", route: { from: "BOM", to: "DEL" }, typical_departure: "18:30", typical_arrival: "20:35", duration_mins: 125 },
  "AI-506": { airline: "Air India", route: { from: "DEL", to: "BOM" }, typical_departure: "07:00", typical_arrival: "09:10", duration_mins: 130 },
  "6E-6701": { airline: "IndiGo", route: { from: "DEL", to: "BOM" }, typical_departure: "06:00", typical_arrival: "08:15", duration_mins: 135 },
  "6E-6702": { airline: "IndiGo", route: { from: "BOM", to: "DEL" }, typical_departure: "09:00", typical_arrival: "11:15", duration_mins: 135 },
  "6E-2135": { airline: "IndiGo", route: { from: "DEL", to: "BOM" }, typical_departure: "13:30", typical_arrival: "15:45", duration_mins: 135 },
  "6E-2136": { airline: "IndiGo", route: { from: "BOM", to: "DEL" }, typical_departure: "16:30", typical_arrival: "18:45", duration_mins: 135 },
  "UK-955": { airline: "Vistara", route: { from: "DEL", to: "BOM" }, typical_departure: "08:00", typical_arrival: "10:15", duration_mins: 135 },
  "UK-956": { airline: "Vistara", route: { from: "BOM", to: "DEL" }, typical_departure: "11:00", typical_arrival: "13:15", duration_mins: 135 },

  // === BLR (Bangalore) - CCU (Kolkata) Route ===
  "6E-2341": { airline: "IndiGo", route: { from: "BLR", to: "CCU" }, typical_departure: "14:30", typical_arrival: "17:00", duration_mins: 150 },
  "6E-2342": { airline: "IndiGo", route: { from: "CCU", to: "BLR" }, typical_departure: "09:45", typical_arrival: "12:25", duration_mins: 160 },
  "6E-517": { airline: "IndiGo", route: { from: "BLR", to: "CCU" }, typical_departure: "07:00", typical_arrival: "09:30", duration_mins: 150 },
  "6E-518": { airline: "IndiGo", route: { from: "CCU", to: "BLR" }, typical_departure: "18:00", typical_arrival: "20:40", duration_mins: 160 },
  "AI-771": { airline: "Air India", route: { from: "BLR", to: "CCU" }, typical_departure: "11:00", typical_arrival: "13:30", duration_mins: 150 },
  "AI-772": { airline: "Air India", route: { from: "CCU", to: "BLR" }, typical_departure: "14:30", typical_arrival: "17:10", duration_mins: 160 },

  // === DEL (Delhi) - BLR (Bangalore) Route ===
  "6E-2765": { airline: "IndiGo", route: { from: "DEL", to: "BLR" }, typical_departure: "06:30", typical_arrival: "09:15", duration_mins: 165 },
  "6E-2766": { airline: "IndiGo", route: { from: "BLR", to: "DEL" }, typical_departure: "10:00", typical_arrival: "12:45", duration_mins: 165 },
  "6E-891": { airline: "IndiGo", route: { from: "DEL", to: "BLR" }, typical_departure: "14:00", typical_arrival: "16:45", duration_mins: 165 },
  "6E-892": { airline: "IndiGo", route: { from: "BLR", to: "DEL" }, typical_departure: "17:30", typical_arrival: "20:15", duration_mins: 165 },
  "AI-501": { airline: "Air India", route: { from: "DEL", to: "BLR" }, typical_departure: "08:30", typical_arrival: "11:15", duration_mins: 165 },
  "AI-502": { airline: "Air India", route: { from: "BLR", to: "DEL" }, typical_departure: "12:00", typical_arrival: "14:45", duration_mins: 165 },
  "UK-821": { airline: "Vistara", route: { from: "DEL", to: "BLR" }, typical_departure: "07:00", typical_arrival: "09:45", duration_mins: 165 },
  "UK-822": { airline: "Vistara", route: { from: "BLR", to: "DEL" }, typical_departure: "10:30", typical_arrival: "13:15", duration_mins: 165 },

  // === BOM (Mumbai) - BLR (Bangalore) Route ===
  "6E-5315": { airline: "IndiGo", route: { from: "BOM", to: "BLR" }, typical_departure: "07:00", typical_arrival: "08:30", duration_mins: 90 },
  "6E-5316": { airline: "IndiGo", route: { from: "BLR", to: "BOM" }, typical_departure: "09:15", typical_arrival: "10:45", duration_mins: 90 },
  "6E-361": { airline: "IndiGo", route: { from: "BOM", to: "BLR" }, typical_departure: "14:00", typical_arrival: "15:30", duration_mins: 90 },
  "6E-362": { airline: "IndiGo", route: { from: "BLR", to: "BOM" }, typical_departure: "16:15", typical_arrival: "17:45", duration_mins: 90 },

  // === DEL (Delhi) - HYD (Hyderabad) Route ===
  "6E-6205": { airline: "IndiGo", route: { from: "DEL", to: "HYD" }, typical_departure: "06:15", typical_arrival: "08:30", duration_mins: 135 },
  "6E-6206": { airline: "IndiGo", route: { from: "HYD", to: "DEL" }, typical_departure: "09:15", typical_arrival: "11:30", duration_mins: 135 },
  "6E-559": { airline: "IndiGo", route: { from: "DEL", to: "HYD" }, typical_departure: "15:00", typical_arrival: "17:15", duration_mins: 135 },
  "6E-560": { airline: "IndiGo", route: { from: "HYD", to: "DEL" }, typical_departure: "18:00", typical_arrival: "20:15", duration_mins: 135 },
  "AI-615": { airline: "Air India", route: { from: "DEL", to: "HYD" }, typical_departure: "11:00", typical_arrival: "13:15", duration_mins: 135 },
  "AI-616": { airline: "Air India", route: { from: "HYD", to: "DEL" }, typical_departure: "14:00", typical_arrival: "16:15", duration_mins: 135 },

  // === BBI (Bhubaneswar) Routes ===
  "6E-381": { airline: "IndiGo", route: { from: "DEL", to: "BBI" }, typical_departure: "07:30", typical_arrival: "09:45", duration_mins: 135 },
  "6E-382": { airline: "IndiGo", route: { from: "BBI", to: "DEL" }, typical_departure: "10:30", typical_arrival: "12:45", duration_mins: 135 },
  "6E-769": { airline: "IndiGo", route: { from: "CCU", to: "BBI" }, typical_departure: "08:00", typical_arrival: "09:00", duration_mins: 60 },
  "6E-770": { airline: "IndiGo", route: { from: "BBI", to: "CCU" }, typical_departure: "09:45", typical_arrival: "10:45", duration_mins: 60 },
  "6E-6385": { airline: "IndiGo", route: { from: "BLR", to: "BBI" }, typical_departure: "11:30", typical_arrival: "13:45", duration_mins: 135 },
  "6E-6386": { airline: "IndiGo", route: { from: "BBI", to: "BLR" }, typical_departure: "14:30", typical_arrival: "16:45", duration_mins: 135 },

  // === IXR (Ranchi) Routes ===
  "6E-621": { airline: "IndiGo", route: { from: "DEL", to: "IXR" }, typical_departure: "08:00", typical_arrival: "09:55", duration_mins: 115 },
  "6E-622": { airline: "IndiGo", route: { from: "IXR", to: "DEL" }, typical_departure: "10:40", typical_arrival: "12:35", duration_mins: 115 },
  "6E-779": { airline: "IndiGo", route: { from: "CCU", to: "IXR" }, typical_departure: "14:00", typical_arrival: "14:50", duration_mins: 50 },
  "6E-780": { airline: "IndiGo", route: { from: "IXR", to: "CCU" }, typical_departure: "15:35", typical_arrival: "16:25", duration_mins: 50 },

  // === GAU (Guwahati) Routes ===
  "6E-6171": { airline: "IndiGo", route: { from: "DEL", to: "GAU" }, typical_departure: "07:00", typical_arrival: "09:30", duration_mins: 150 },
  "6E-6172": { airline: "IndiGo", route: { from: "GAU", to: "DEL" }, typical_departure: "10:15", typical_arrival: "12:45", duration_mins: 150 },
  "6E-295": { airline: "IndiGo", route: { from: "CCU", to: "GAU" }, typical_departure: "09:00", typical_arrival: "10:15", duration_mins: 75 },
  "6E-296": { airline: "IndiGo", route: { from: "GAU", to: "CCU" }, typical_departure: "11:00", typical_arrival: "12:15", duration_mins: 75 },

  // === CJB (Coimbatore) Routes ===
  "6E-383": { airline: "IndiGo", route: { from: "CJB", to: "PAT" }, typical_departure: "11:30", typical_arrival: "14:40", duration_mins: 190 },
  "6E-384": { airline: "IndiGo", route: { from: "PAT", to: "CJB" }, typical_departure: "15:30", typical_arrival: "18:40", duration_mins: 190 },
  "6E-421": { airline: "IndiGo", route: { from: "CJB", to: "DEL" }, typical_departure: "06:30", typical_arrival: "09:15", duration_mins: 165 },
  "6E-422": { airline: "IndiGo", route: { from: "DEL", to: "CJB" }, typical_departure: "10:00", typical_arrival: "12:45", duration_mins: 165 },
  "6E-691": { airline: "IndiGo", route: { from: "CJB", to: "BOM" }, typical_departure: "07:15", typical_arrival: "08:45", duration_mins: 90 },
  "6E-692": { airline: "IndiGo", route: { from: "BOM", to: "CJB" }, typical_departure: "09:30", typical_arrival: "11:00", duration_mins: 90 },
  "6E-245": { airline: "IndiGo", route: { from: "CJB", to: "BLR" }, typical_departure: "14:00", typical_arrival: "14:50", duration_mins: 50 },
  "6E-246": { airline: "IndiGo", route: { from: "BLR", to: "CJB" }, typical_departure: "15:30", typical_arrival: "16:20", duration_mins: 50 },
  "6E-553": { airline: "IndiGo", route: { from: "CJB", to: "MAA" }, typical_departure: "08:00", typical_arrival: "08:55", duration_mins: 55 },
  "6E-554": { airline: "IndiGo", route: { from: "MAA", to: "CJB" }, typical_departure: "09:30", typical_arrival: "10:25", duration_mins: 55 },
  "6E-7231": { airline: "IndiGo", route: { from: "CJB", to: "HYD" }, typical_departure: "11:00", typical_arrival: "12:15", duration_mins: 75 },
  "6E-7232": { airline: "IndiGo", route: { from: "HYD", to: "CJB" }, typical_departure: "13:00", typical_arrival: "14:15", duration_mins: 75 },
  "AI-593": { airline: "Air India", route: { from: "CJB", to: "DEL" }, typical_departure: "14:30", typical_arrival: "17:15", duration_mins: 165 },
  "AI-594": { airline: "Air India", route: { from: "DEL", to: "CJB" }, typical_departure: "07:00", typical_arrival: "09:45", duration_mins: 165 },
  "SG-531": { airline: "SpiceJet", route: { from: "CJB", to: "BOM" }, typical_departure: "16:00", typical_arrival: "17:30", duration_mins: 90 },
  "SG-532": { airline: "SpiceJet", route: { from: "BOM", to: "CJB" }, typical_departure: "13:30", typical_arrival: "15:00", duration_mins: 90 },

  // === MAA (Chennai) - PAT (Patna) Route ===
  "6E-271": { airline: "IndiGo", route: { from: "MAA", to: "PAT" }, typical_departure: "10:30", typical_arrival: "13:00", duration_mins: 150 },
  "6E-272": { airline: "IndiGo", route: { from: "PAT", to: "MAA" }, typical_departure: "13:45", typical_arrival: "16:15", duration_mins: 150 },
  "AI-575": { airline: "Air India", route: { from: "MAA", to: "PAT" }, typical_departure: "07:30", typical_arrival: "10:00", duration_mins: 150 },
  "AI-576": { airline: "Air India", route: { from: "PAT", to: "MAA" }, typical_departure: "18:00", typical_arrival: "20:30", duration_mins: 150 },

  // === BLR (Bangalore) - PAT (Patna) Route ===
  "6E-831": { airline: "IndiGo", route: { from: "BLR", to: "PAT" }, typical_departure: "06:00", typical_arrival: "08:40", duration_mins: 160 },
  "6E-832": { airline: "IndiGo", route: { from: "PAT", to: "BLR" }, typical_departure: "09:30", typical_arrival: "12:10", duration_mins: 160 },
  "AI-881": { airline: "Air India", route: { from: "BLR", to: "PAT" }, typical_departure: "15:00", typical_arrival: "17:40", duration_mins: 160 },
  "AI-882": { airline: "Air India", route: { from: "PAT", to: "BLR" }, typical_departure: "18:30", typical_arrival: "21:10", duration_mins: 160 },

  // === HYD (Hyderabad) - PAT (Patna) Route ===
  "6E-451": { airline: "IndiGo", route: { from: "HYD", to: "PAT" }, typical_departure: "08:30", typical_arrival: "10:45", duration_mins: 135 },
  "6E-452": { airline: "IndiGo", route: { from: "PAT", to: "HYD" }, typical_departure: "11:30", typical_arrival: "13:45", duration_mins: 135 },

  // === BOM (Mumbai) - PAT (Patna) Route ===
  "6E-561": { airline: "IndiGo", route: { from: "BOM", to: "PAT" }, typical_departure: "07:00", typical_arrival: "09:30", duration_mins: 150 },
  "6E-562": { airline: "IndiGo", route: { from: "PAT", to: "BOM" }, typical_departure: "10:15", typical_arrival: "12:45", duration_mins: 150 },
  "AI-681": { airline: "Air India", route: { from: "BOM", to: "PAT" }, typical_departure: "14:00", typical_arrival: "16:30", duration_mins: 150 },
  "AI-682": { airline: "Air India", route: { from: "PAT", to: "BOM" }, typical_departure: "17:15", typical_arrival: "19:45", duration_mins: 150 },
}

// Comprehensive Indian Airport information (70+ airports)
export const AIRPORT_INFO: Record<string, {
  code: string
  name: string
  city: string
  state: string
  terminal?: string
}> = {
  // === METRO CITIES ===
  "DEL": { code: "DEL", name: "Indira Gandhi International Airport", city: "Delhi", state: "Delhi", terminal: "T3" },
  "BOM": { code: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai", state: "Maharashtra", terminal: "T2" },
  "BLR": { code: "BLR", name: "Kempegowda International Airport", city: "Bangalore", state: "Karnataka", terminal: "T1" },
  "MAA": { code: "MAA", name: "Chennai International Airport", city: "Chennai", state: "Tamil Nadu", terminal: "T1" },
  "CCU": { code: "CCU", name: "Netaji Subhas Chandra Bose International Airport", city: "Kolkata", state: "West Bengal", terminal: "T2" },
  "HYD": { code: "HYD", name: "Rajiv Gandhi International Airport", city: "Hyderabad", state: "Telangana" },

  // === TAMIL NADU ===
  "CJB": { code: "CJB", name: "Coimbatore International Airport", city: "Coimbatore", state: "Tamil Nadu" },
  "TRZ": { code: "TRZ", name: "Tiruchirappalli International Airport", city: "Tiruchirappalli", state: "Tamil Nadu" },
  "IXM": { code: "IXM", name: "Madurai Airport", city: "Madurai", state: "Tamil Nadu" },
  "TRV": { code: "TRV", name: "Trivandrum International Airport", city: "Thiruvananthapuram", state: "Kerala" },
  "SXV": { code: "SXV", name: "Salem Airport", city: "Salem", state: "Tamil Nadu" },
  "TJV": { code: "TJV", name: "Thanjavur Airport", city: "Thanjavur", state: "Tamil Nadu" },

  // === KERALA ===
  "COK": { code: "COK", name: "Cochin International Airport", city: "Kochi", state: "Kerala" },
  "CCJ": { code: "CCJ", name: "Calicut International Airport", city: "Kozhikode", state: "Kerala" },

  // === KARNATAKA ===
  "IXE": { code: "IXE", name: "Mangalore International Airport", city: "Mangalore", state: "Karnataka" },
  "HBX": { code: "HBX", name: "Hubli Airport", city: "Hubli", state: "Karnataka" },
  "BEP": { code: "BEP", name: "Bellary Airport", city: "Bellary", state: "Karnataka" },
  "MYQ": { code: "MYQ", name: "Mysore Airport", city: "Mysore", state: "Karnataka" },

  // === ANDHRA PRADESH & TELANGANA ===
  "VTZ": { code: "VTZ", name: "Visakhapatnam Airport", city: "Visakhapatnam", state: "Andhra Pradesh" },
  "VGA": { code: "VGA", name: "Vijayawada Airport", city: "Vijayawada", state: "Andhra Pradesh" },
  "TIR": { code: "TIR", name: "Tirupati Airport", city: "Tirupati", state: "Andhra Pradesh" },
  "RJA": { code: "RJA", name: "Rajahmundry Airport", city: "Rajahmundry", state: "Andhra Pradesh" },

  // === MAHARASHTRA ===
  "PNQ": { code: "PNQ", name: "Pune Airport", city: "Pune", state: "Maharashtra" },
  "NAG": { code: "NAG", name: "Dr. Babasaheb Ambedkar International Airport", city: "Nagpur", state: "Maharashtra" },
  "AUR": { code: "AUR", name: "Aurangabad Airport", city: "Aurangabad", state: "Maharashtra" },
  "KLH": { code: "KLH", name: "Kolhapur Airport", city: "Kolhapur", state: "Maharashtra" },
  "NDC": { code: "NDC", name: "Nanded Airport", city: "Nanded", state: "Maharashtra" },

  // === GUJARAT ===
  "AMD": { code: "AMD", name: "Sardar Vallabhbhai Patel International Airport", city: "Ahmedabad", state: "Gujarat", terminal: "T2" },
  "STV": { code: "STV", name: "Surat Airport", city: "Surat", state: "Gujarat" },
  "RAJ": { code: "RAJ", name: "Rajkot Airport", city: "Rajkot", state: "Gujarat" },
  "BDQ": { code: "BDQ", name: "Vadodara Airport", city: "Vadodara", state: "Gujarat" },
  "BHJ": { code: "BHJ", name: "Bhuj Airport", city: "Bhuj", state: "Gujarat" },
  "PBD": { code: "PBD", name: "Porbandar Airport", city: "Porbandar", state: "Gujarat" },
  "JGA": { code: "JGA", name: "Jamnagar Airport", city: "Jamnagar", state: "Gujarat" },

  // === RAJASTHAN ===
  "JAI": { code: "JAI", name: "Jaipur International Airport", city: "Jaipur", state: "Rajasthan", terminal: "T2" },
  "UDR": { code: "UDR", name: "Maharana Pratap Airport", city: "Udaipur", state: "Rajasthan" },
  "JDH": { code: "JDH", name: "Jodhpur Airport", city: "Jodhpur", state: "Rajasthan" },
  "BKB": { code: "BKB", name: "Bikaner Airport", city: "Bikaner", state: "Rajasthan" },
  "KTU": { code: "KTU", name: "Kota Airport", city: "Kota", state: "Rajasthan" },

  // === UTTAR PRADESH ===
  "LKO": { code: "LKO", name: "Chaudhary Charan Singh International Airport", city: "Lucknow", state: "Uttar Pradesh" },
  "VNS": { code: "VNS", name: "Lal Bahadur Shastri International Airport", city: "Varanasi", state: "Uttar Pradesh" },
  "AGR": { code: "AGR", name: "Agra Airport", city: "Agra", state: "Uttar Pradesh" },
  "KNU": { code: "KNU", name: "Kanpur Airport", city: "Kanpur", state: "Uttar Pradesh" },
  "GOP": { code: "GOP", name: "Gorakhpur Airport", city: "Gorakhpur", state: "Uttar Pradesh" },
  "AYJ": { code: "AYJ", name: "Ayodhya Airport", city: "Ayodhya", state: "Uttar Pradesh" },
  "PGH": { code: "PGH", name: "Prayagraj Airport", city: "Prayagraj", state: "Uttar Pradesh" },

  // === MADHYA PRADESH ===
  "IDR": { code: "IDR", name: "Devi Ahilyabai Holkar Airport", city: "Indore", state: "Madhya Pradesh" },
  "BHO": { code: "BHO", name: "Raja Bhoj Airport", city: "Bhopal", state: "Madhya Pradesh" },
  "JLR": { code: "JLR", name: "Jabalpur Airport", city: "Jabalpur", state: "Madhya Pradesh" },
  "GWL": { code: "GWL", name: "Gwalior Airport", city: "Gwalior", state: "Madhya Pradesh" },

  // === BIHAR ===
  "PAT": { code: "PAT", name: "Jay Prakash Narayan Airport", city: "Patna", state: "Bihar" },
  "GAY": { code: "GAY", name: "Gaya Airport", city: "Gaya", state: "Bihar" },
  "DBR": { code: "DBR", name: "Darbhanga Airport", city: "Darbhanga", state: "Bihar" },

  // === JHARKHAND ===
  "IXR": { code: "IXR", name: "Birsa Munda Airport", city: "Ranchi", state: "Jharkhand" },
  "IXW": { code: "IXW", name: "Jamshedpur Airport", city: "Jamshedpur", state: "Jharkhand" },
  "DEO": { code: "DEO", name: "Deoghar Airport", city: "Deoghar", state: "Jharkhand" },

  // === ODISHA ===
  "BBI": { code: "BBI", name: "Biju Patnaik International Airport", city: "Bhubaneswar", state: "Odisha" },
  "JRG": { code: "JRG", name: "Jharsuguda Airport", city: "Jharsuguda", state: "Odisha" },

  // === CHHATTISGARH ===
  "RPR": { code: "RPR", name: "Swami Vivekananda Airport", city: "Raipur", state: "Chhattisgarh" },
  "BUP": { code: "BUP", name: "Bilaspur Airport", city: "Bilaspur", state: "Chhattisgarh" },

  // === WEST BENGAL ===
  "IXB": { code: "IXB", name: "Bagdogra Airport", city: "Siliguri", state: "West Bengal" },

  // === NORTH EAST ===
  "GAU": { code: "GAU", name: "Lokpriya Gopinath Bordoloi International Airport", city: "Guwahati", state: "Assam" },
  "DIB": { code: "DIB", name: "Dibrugarh Airport", city: "Dibrugarh", state: "Assam" },
  "JRH": { code: "JRH", name: "Jorhat Airport", city: "Jorhat", state: "Assam" },
  "IXS": { code: "IXS", name: "Silchar Airport", city: "Silchar", state: "Assam" },
  "IMF": { code: "IMF", name: "Imphal International Airport", city: "Imphal", state: "Manipur" },
  "DMU": { code: "DMU", name: "Dimapur Airport", city: "Dimapur", state: "Nagaland" },
  "AJL": { code: "AJL", name: "Lengpui Airport", city: "Aizawl", state: "Mizoram" },
  "IXA": { code: "IXA", name: "Agartala Airport", city: "Agartala", state: "Tripura" },
  "IXZ": { code: "IXZ", name: "Veer Savarkar International Airport", city: "Port Blair", state: "Andaman & Nicobar" },

  // === PUNJAB & HARYANA ===
  "ATQ": { code: "ATQ", name: "Sri Guru Ram Dass Jee International Airport", city: "Amritsar", state: "Punjab" },
  "LUH": { code: "LUH", name: "Ludhiana Airport", city: "Ludhiana", state: "Punjab" },
  "IXC": { code: "IXC", name: "Chandigarh International Airport", city: "Chandigarh", state: "Chandigarh" },
  "HSR": { code: "HSR", name: "Hisar Airport", city: "Hisar", state: "Haryana" },

  // === JAMMU & KASHMIR / LADAKH / UTTARAKHAND ===
  "SXR": { code: "SXR", name: "Srinagar International Airport", city: "Srinagar", state: "Jammu & Kashmir" },
  "IXJ": { code: "IXJ", name: "Jammu Airport", city: "Jammu", state: "Jammu & Kashmir" },
  "IXL": { code: "IXL", name: "Kushok Bakula Rimpochee Airport", city: "Leh", state: "Ladakh" },
  "DED": { code: "DED", name: "Jolly Grant Airport", city: "Dehradun", state: "Uttarakhand" },
  "PGH2": { code: "PGH2", name: "Pantnagar Airport", city: "Pantnagar", state: "Uttarakhand" },

  // === GOA ===
  "GOI": { code: "GOI", name: "Goa International Airport", city: "Goa", state: "Goa" },
  "GOX": { code: "GOX", name: "Manohar International Airport", city: "Mopa", state: "Goa" },
}

// Comprehensive Indian cities list for simple text-based matching
export const INDIAN_CITIES: Array<{
  city: string
  state: string
  airportCode?: string
}> = [
  // Metro cities
  { city: "Delhi", state: "Delhi", airportCode: "DEL" },
  { city: "Mumbai", state: "Maharashtra", airportCode: "BOM" },
  { city: "Bangalore", state: "Karnataka", airportCode: "BLR" },
  { city: "Bengaluru", state: "Karnataka", airportCode: "BLR" },
  { city: "Chennai", state: "Tamil Nadu", airportCode: "MAA" },
  { city: "Kolkata", state: "West Bengal", airportCode: "CCU" },
  { city: "Hyderabad", state: "Telangana", airportCode: "HYD" },

  // Tamil Nadu
  { city: "Coimbatore", state: "Tamil Nadu", airportCode: "CJB" },
  { city: "Tiruchirappalli", state: "Tamil Nadu", airportCode: "TRZ" },
  { city: "Trichy", state: "Tamil Nadu", airportCode: "TRZ" },
  { city: "Madurai", state: "Tamil Nadu", airportCode: "IXM" },
  { city: "Salem", state: "Tamil Nadu", airportCode: "SXV" },
  { city: "Thanjavur", state: "Tamil Nadu" },
  { city: "Tirunelveli", state: "Tamil Nadu" },
  { city: "Vellore", state: "Tamil Nadu" },
  { city: "Erode", state: "Tamil Nadu" },

  // Kerala
  { city: "Kochi", state: "Kerala", airportCode: "COK" },
  { city: "Cochin", state: "Kerala", airportCode: "COK" },
  { city: "Thiruvananthapuram", state: "Kerala", airportCode: "TRV" },
  { city: "Trivandrum", state: "Kerala", airportCode: "TRV" },
  { city: "Kozhikode", state: "Kerala", airportCode: "CCJ" },
  { city: "Calicut", state: "Kerala", airportCode: "CCJ" },
  { city: "Thrissur", state: "Kerala" },
  { city: "Kannur", state: "Kerala" },

  // Karnataka
  { city: "Mangalore", state: "Karnataka", airportCode: "IXE" },
  { city: "Mangaluru", state: "Karnataka", airportCode: "IXE" },
  { city: "Mysore", state: "Karnataka", airportCode: "MYQ" },
  { city: "Mysuru", state: "Karnataka", airportCode: "MYQ" },
  { city: "Hubli", state: "Karnataka", airportCode: "HBX" },
  { city: "Hubballi", state: "Karnataka", airportCode: "HBX" },
  { city: "Belgaum", state: "Karnataka" },
  { city: "Bellary", state: "Karnataka", airportCode: "BEP" },

  // Andhra Pradesh & Telangana
  { city: "Visakhapatnam", state: "Andhra Pradesh", airportCode: "VTZ" },
  { city: "Vizag", state: "Andhra Pradesh", airportCode: "VTZ" },
  { city: "Vijayawada", state: "Andhra Pradesh", airportCode: "VGA" },
  { city: "Tirupati", state: "Andhra Pradesh", airportCode: "TIR" },
  { city: "Rajahmundry", state: "Andhra Pradesh", airportCode: "RJA" },
  { city: "Guntur", state: "Andhra Pradesh" },
  { city: "Nellore", state: "Andhra Pradesh" },
  { city: "Warangal", state: "Telangana" },

  // Maharashtra
  { city: "Pune", state: "Maharashtra", airportCode: "PNQ" },
  { city: "Nagpur", state: "Maharashtra", airportCode: "NAG" },
  { city: "Aurangabad", state: "Maharashtra", airportCode: "AUR" },
  { city: "Nashik", state: "Maharashtra" },
  { city: "Kolhapur", state: "Maharashtra", airportCode: "KLH" },
  { city: "Nanded", state: "Maharashtra", airportCode: "NDC" },
  { city: "Solapur", state: "Maharashtra" },
  { city: "Thane", state: "Maharashtra" },
  { city: "Navi Mumbai", state: "Maharashtra" },

  // Gujarat
  { city: "Ahmedabad", state: "Gujarat", airportCode: "AMD" },
  { city: "Surat", state: "Gujarat", airportCode: "STV" },
  { city: "Vadodara", state: "Gujarat", airportCode: "BDQ" },
  { city: "Baroda", state: "Gujarat", airportCode: "BDQ" },
  { city: "Rajkot", state: "Gujarat", airportCode: "RAJ" },
  { city: "Bhavnagar", state: "Gujarat" },
  { city: "Jamnagar", state: "Gujarat", airportCode: "JGA" },
  { city: "Bhuj", state: "Gujarat", airportCode: "BHJ" },
  { city: "Porbandar", state: "Gujarat", airportCode: "PBD" },

  // Rajasthan
  { city: "Jaipur", state: "Rajasthan", airportCode: "JAI" },
  { city: "Udaipur", state: "Rajasthan", airportCode: "UDR" },
  { city: "Jodhpur", state: "Rajasthan", airportCode: "JDH" },
  { city: "Bikaner", state: "Rajasthan", airportCode: "BKB" },
  { city: "Kota", state: "Rajasthan", airportCode: "KTU" },
  { city: "Ajmer", state: "Rajasthan" },

  // Uttar Pradesh
  { city: "Lucknow", state: "Uttar Pradesh", airportCode: "LKO" },
  { city: "Varanasi", state: "Uttar Pradesh", airportCode: "VNS" },
  { city: "Banaras", state: "Uttar Pradesh", airportCode: "VNS" },
  { city: "Agra", state: "Uttar Pradesh", airportCode: "AGR" },
  { city: "Kanpur", state: "Uttar Pradesh", airportCode: "KNU" },
  { city: "Gorakhpur", state: "Uttar Pradesh", airportCode: "GOP" },
  { city: "Ayodhya", state: "Uttar Pradesh", airportCode: "AYJ" },
  { city: "Prayagraj", state: "Uttar Pradesh", airportCode: "PGH" },
  { city: "Allahabad", state: "Uttar Pradesh", airportCode: "PGH" },
  { city: "Noida", state: "Uttar Pradesh" },
  { city: "Ghaziabad", state: "Uttar Pradesh" },
  { city: "Meerut", state: "Uttar Pradesh" },

  // Madhya Pradesh
  { city: "Indore", state: "Madhya Pradesh", airportCode: "IDR" },
  { city: "Bhopal", state: "Madhya Pradesh", airportCode: "BHO" },
  { city: "Jabalpur", state: "Madhya Pradesh", airportCode: "JLR" },
  { city: "Gwalior", state: "Madhya Pradesh", airportCode: "GWL" },
  { city: "Ujjain", state: "Madhya Pradesh" },
  { city: "Rewa", state: "Madhya Pradesh" },

  // Bihar
  { city: "Patna", state: "Bihar", airportCode: "PAT" },
  { city: "Gaya", state: "Bihar", airportCode: "GAY" },
  { city: "Darbhanga", state: "Bihar", airportCode: "DBR" },
  { city: "Muzaffarpur", state: "Bihar" },
  { city: "Bhagalpur", state: "Bihar" },

  // Jharkhand
  { city: "Ranchi", state: "Jharkhand", airportCode: "IXR" },
  { city: "Jamshedpur", state: "Jharkhand", airportCode: "IXW" },
  { city: "Dhanbad", state: "Jharkhand" },
  { city: "Deoghar", state: "Jharkhand", airportCode: "DEO" },
  { city: "Bokaro", state: "Jharkhand" },

  // Odisha
  { city: "Bhubaneswar", state: "Odisha", airportCode: "BBI" },
  { city: "Cuttack", state: "Odisha" },
  { city: "Puri", state: "Odisha" },
  { city: "Rourkela", state: "Odisha" },
  { city: "Jharsuguda", state: "Odisha", airportCode: "JRG" },

  // Chhattisgarh
  { city: "Raipur", state: "Chhattisgarh", airportCode: "RPR" },
  { city: "Bilaspur", state: "Chhattisgarh", airportCode: "BUP" },
  { city: "Bhilai", state: "Chhattisgarh" },

  // West Bengal
  { city: "Siliguri", state: "West Bengal", airportCode: "IXB" },
  { city: "Bagdogra", state: "West Bengal", airportCode: "IXB" },
  { city: "Darjeeling", state: "West Bengal" },
  { city: "Durgapur", state: "West Bengal" },
  { city: "Asansol", state: "West Bengal" },

  // North East
  { city: "Guwahati", state: "Assam", airportCode: "GAU" },
  { city: "Dibrugarh", state: "Assam", airportCode: "DIB" },
  { city: "Jorhat", state: "Assam", airportCode: "JRH" },
  { city: "Silchar", state: "Assam", airportCode: "IXS" },
  { city: "Tezpur", state: "Assam" },
  { city: "Imphal", state: "Manipur", airportCode: "IMF" },
  { city: "Dimapur", state: "Nagaland", airportCode: "DMU" },
  { city: "Aizawl", state: "Mizoram", airportCode: "AJL" },
  { city: "Agartala", state: "Tripura", airportCode: "IXA" },
  { city: "Shillong", state: "Meghalaya" },
  { city: "Itanagar", state: "Arunachal Pradesh" },
  { city: "Gangtok", state: "Sikkim" },

  // Punjab & Haryana
  { city: "Amritsar", state: "Punjab", airportCode: "ATQ" },
  { city: "Ludhiana", state: "Punjab", airportCode: "LUH" },
  { city: "Chandigarh", state: "Chandigarh", airportCode: "IXC" },
  { city: "Jalandhar", state: "Punjab" },
  { city: "Patiala", state: "Punjab" },
  { city: "Hisar", state: "Haryana", airportCode: "HSR" },
  { city: "Faridabad", state: "Haryana" },
  { city: "Gurugram", state: "Haryana" },
  { city: "Gurgaon", state: "Haryana" },

  // Jammu & Kashmir / Ladakh / Uttarakhand / HP
  { city: "Srinagar", state: "Jammu & Kashmir", airportCode: "SXR" },
  { city: "Jammu", state: "Jammu & Kashmir", airportCode: "IXJ" },
  { city: "Leh", state: "Ladakh", airportCode: "IXL" },
  { city: "Dehradun", state: "Uttarakhand", airportCode: "DED" },
  { city: "Haridwar", state: "Uttarakhand" },
  { city: "Rishikesh", state: "Uttarakhand" },
  { city: "Nainital", state: "Uttarakhand" },
  { city: "Pantnagar", state: "Uttarakhand" },
  { city: "Shimla", state: "Himachal Pradesh" },
  { city: "Manali", state: "Himachal Pradesh" },
  { city: "Dharamshala", state: "Himachal Pradesh" },
  { city: "Kullu", state: "Himachal Pradesh" },

  // Goa
  { city: "Goa", state: "Goa", airportCode: "GOI" },
  { city: "Panaji", state: "Goa", airportCode: "GOI" },
  { city: "Vasco", state: "Goa", airportCode: "GOI" },
  { city: "Mopa", state: "Goa", airportCode: "GOX" },

  // Andaman & Nicobar
  { city: "Port Blair", state: "Andaman & Nicobar", airportCode: "IXZ" },
]

// Helper function to find city by name or airport code
export function findCity(query: string): typeof INDIAN_CITIES[0] | undefined {
  const q = query.toLowerCase().trim()
  return INDIAN_CITIES.find(c =>
    c.city.toLowerCase() === q ||
    c.airportCode?.toLowerCase() === q ||
    c.city.toLowerCase().includes(q) ||
    q.includes(c.city.toLowerCase())
  )
}

// Helper function to get airport code from city name
export function getAirportCode(cityName: string): string | undefined {
  const city = findCity(cityName)
  return city?.airportCode
}

// Airline information
export const AIRLINE_INFO: Record<string, {
  code: string
  name: string
  country: string
}> = {
  "6E": { code: "6E", name: "IndiGo", country: "India" },
  "AI": { code: "AI", name: "Air India", country: "India" },
  "SG": { code: "SG", name: "SpiceJet", country: "India" },
  "UK": { code: "UK", name: "Vistara", country: "India" },
  "G8": { code: "G8", name: "Go First", country: "India" },
  "I5": { code: "I5", name: "AirAsia India", country: "India" },
  "QP": { code: "QP", name: "Akasa Air", country: "India" },
}

export type FlightInfo = {
  flight_number: string
  airline: string
  airline_code: string
  departure: {
    airport: string
    city: string
    time: string
    terminal?: string
  }
  arrival: {
    airport: string
    city: string
    time: string
    terminal?: string
  }
  duration_mins: number
  status?: string
}

/**
 * Get all flights for a specific route
 * Returns flights sorted by departure time
 */
export function getFlightsByRoute(from: string, to: string): FlightInfo[] {
  const flights: FlightInfo[] = []

  for (const [flightNumber, flightData] of Object.entries(INDIAN_FLIGHT_DATABASE)) {
    if (flightData.route.from === from && flightData.route.to === to) {
      const [airlineCode] = flightNumber.split("-")
      const fromAirport = AIRPORT_INFO[flightData.route.from]
      const toAirport = AIRPORT_INFO[flightData.route.to]

      flights.push({
        flight_number: flightNumber,
        airline: flightData.airline,
        airline_code: airlineCode,
        departure: {
          airport: flightData.route.from,
          city: fromAirport?.city || flightData.route.from,
          time: flightData.typical_departure,
          terminal: fromAirport?.terminal,
        },
        arrival: {
          airport: flightData.route.to,
          city: toAirport?.city || flightData.route.to,
          time: flightData.typical_arrival,
          terminal: toAirport?.terminal,
        },
        duration_mins: flightData.duration_mins,
      })
    }
  }

  // Sort by departure time
  flights.sort((a, b) => a.departure.time.localeCompare(b.departure.time))

  return flights
}

/**
 * Get list of all available airports for dropdown
 */
export function getAirportList(): Array<{ code: string; city: string; name: string }> {
  return Object.entries(AIRPORT_INFO).map(([code, info]) => ({
    code,
    city: info.city,
    name: info.name,
  })).sort((a, b) => a.city.localeCompare(b.city))
}

/**
 * Get routes that have flights available from a specific airport
 */
export function getAvailableDestinations(from: string): string[] {
  const destinations = new Set<string>()

  for (const flightData of Object.values(INDIAN_FLIGHT_DATABASE)) {
    if (flightData.route.from === from) {
      destinations.add(flightData.route.to)
    }
  }

  return Array.from(destinations).sort()
}

/**
 * Look up flight information
 * First tries AviationStack API if key is available, then falls back to local database
 */
export async function lookupFlight(flightNumber: string, date?: string): Promise<FlightInfo | null> {
  // Normalize flight number (6E-342 or 6E342 -> 6E-342)
  const normalized = normalizeFlightNumber(flightNumber)
  if (!normalized) return null

  // Try AviationStack API if key is available
  const aviationStackKey = process.env.AVIATIONSTACK_API_KEY
  if (aviationStackKey) {
    try {
      const apiResult = await lookupFromAviationStack(normalized, aviationStackKey, date)
      if (apiResult) return apiResult
    } catch (error) {
      console.error("AviationStack API error:", error)
    }
  }

  // Fallback to local database
  return lookupFromLocalDatabase(normalized)
}

/**
 * Normalize flight number to standard format (6E-342)
 */
function normalizeFlightNumber(flightNumber: string): string | null {
  const match = flightNumber.toUpperCase().match(/^(6E|AI|SG|UK|G8|I5|QP)[-\s]?(\d{2,4})$/)
  if (!match) return null
  return `${match[1]}-${match[2]}`
}

/**
 * Look up flight from AviationStack API
 */
async function lookupFromAviationStack(
  flightNumber: string,
  apiKey: string,
  date?: string
): Promise<FlightInfo | null> {
  const [airlineCode, flightNum] = flightNumber.split("-")
  const url = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${airlineCode}${flightNum}&limit=1`

  const response = await fetch(url)
  const data = await response.json()

  if (data.data && data.data.length > 0) {
    const flight = data.data[0]
    return {
      flight_number: flightNumber,
      airline: flight.airline?.name || AIRLINE_INFO[airlineCode]?.name || airlineCode,
      airline_code: airlineCode,
      departure: {
        airport: flight.departure?.iata || "",
        city: flight.departure?.airport || "",
        time: flight.departure?.scheduled?.substring(11, 16) || "",
        terminal: flight.departure?.terminal,
      },
      arrival: {
        airport: flight.arrival?.iata || "",
        city: flight.arrival?.airport || "",
        time: flight.arrival?.scheduled?.substring(11, 16) || "",
        terminal: flight.arrival?.terminal,
      },
      duration_mins: 0,
      status: flight.flight_status,
    }
  }

  return null
}

/**
 * Look up flight from local database
 */
function lookupFromLocalDatabase(flightNumber: string): FlightInfo | null {
  const flightData = INDIAN_FLIGHT_DATABASE[flightNumber]
  if (!flightData) return null

  const [airlineCode] = flightNumber.split("-")
  const fromAirport = AIRPORT_INFO[flightData.route.from]
  const toAirport = AIRPORT_INFO[flightData.route.to]

  return {
    flight_number: flightNumber,
    airline: flightData.airline,
    airline_code: airlineCode,
    departure: {
      airport: flightData.route.from,
      city: fromAirport?.city || flightData.route.from,
      time: flightData.typical_departure,
      terminal: fromAirport?.terminal,
    },
    arrival: {
      airport: flightData.route.to,
      city: toAirport?.city || flightData.route.to,
      time: flightData.typical_arrival,
      terminal: toAirport?.terminal,
    },
    duration_mins: flightData.duration_mins,
  }
}

/**
 * Calculate arrival time based on departure time and duration
 */
export function calculateArrivalTime(departureTime: string, durationMins: number): string {
  const [hours, mins] = departureTime.split(":").map(Number)
  const totalMins = hours * 60 + mins + durationMins
  const arrHours = Math.floor(totalMins / 60) % 24
  const arrMins = totalMins % 60
  return `${arrHours.toString().padStart(2, "0")}:${arrMins.toString().padStart(2, "0")}`
}

/**
 * Get typical flight duration between two airports (in minutes)
 */
export function getTypicalDuration(fromAirport: string, toAirport: string): number {
  // Common routes with typical durations
  const routes: Record<string, number> = {
    // Metro to Metro
    "DEL-BOM": 130, "BOM-DEL": 130,
    "DEL-BLR": 165, "BLR-DEL": 165,
    "DEL-CCU": 135, "CCU-DEL": 140,
    "DEL-MAA": 165, "MAA-DEL": 165,
    "DEL-HYD": 135, "HYD-DEL": 135,
    "BOM-BLR": 90, "BLR-BOM": 90,
    "BOM-MAA": 120, "MAA-BOM": 120,
    "BOM-CCU": 150, "CCU-BOM": 150,
    "BOM-HYD": 90, "HYD-BOM": 90,
    "BLR-CCU": 155, "CCU-BLR": 160,
    "BLR-MAA": 55, "MAA-BLR": 55,
    "BLR-HYD": 75, "HYD-BLR": 75,
    "MAA-CCU": 135, "CCU-MAA": 135,
    "MAA-HYD": 75, "HYD-MAA": 75,
    // Patna routes
    "DEL-PAT": 100, "PAT-DEL": 110,
    "CCU-PAT": 70, "PAT-CCU": 70,
    "BLR-PAT": 160, "PAT-BLR": 160,
    "MAA-PAT": 150, "PAT-MAA": 150,
    "BOM-PAT": 150, "PAT-BOM": 150,
    "HYD-PAT": 135, "PAT-HYD": 135,
    // Coimbatore routes
    "CJB-PAT": 190, "PAT-CJB": 190,
    "CJB-DEL": 165, "DEL-CJB": 165,
    "CJB-BOM": 90, "BOM-CJB": 90,
    "CJB-BLR": 50, "BLR-CJB": 50,
    "CJB-MAA": 55, "MAA-CJB": 55,
    "CJB-HYD": 75, "HYD-CJB": 75,
    "CJB-CCU": 160, "CCU-CJB": 160,
    // Other South India
    "COK-DEL": 180, "DEL-COK": 180,
    "COK-BOM": 105, "BOM-COK": 105,
    "COK-BLR": 60, "BLR-COK": 60,
    "TRV-DEL": 195, "DEL-TRV": 195,
    "TRV-BOM": 120, "BOM-TRV": 120,
    "TRV-BLR": 70, "BLR-TRV": 70,
    "IXE-BOM": 90, "BOM-IXE": 90,
    "IXE-BLR": 55, "BLR-IXE": 55,
    // Northeast
    "GAU-DEL": 150, "DEL-GAU": 150,
    "GAU-CCU": 75, "CCU-GAU": 75,
    "IXB-DEL": 130, "DEL-IXB": 130,
    "IXB-CCU": 55, "CCU-IXB": 55,
    // Other important routes
    "AMD-DEL": 90, "DEL-AMD": 90,
    "AMD-BOM": 70, "BOM-AMD": 70,
    "PNQ-DEL": 120, "DEL-PNQ": 120,
    "JAI-DEL": 60, "DEL-JAI": 60,
    "JAI-BOM": 110, "BOM-JAI": 110,
    "LKO-DEL": 75, "DEL-LKO": 75,
    "VNS-DEL": 90, "DEL-VNS": 90,
    "BBI-DEL": 135, "DEL-BBI": 135,
    "BBI-CCU": 60, "CCU-BBI": 60,
    "IXR-DEL": 115, "DEL-IXR": 115,
    "IXR-CCU": 50, "CCU-IXR": 50,
    "RPR-DEL": 120, "DEL-RPR": 120,
    "NAG-DEL": 100, "DEL-NAG": 100,
    "GOI-DEL": 150, "DEL-GOI": 150,
    "GOI-BOM": 75, "BOM-GOI": 75,
    "GOI-BLR": 65, "BLR-GOI": 65,
  }

  const key = `${fromAirport}-${toAirport}`
  return routes[key] || 120 // Default 2 hours
}

/**
 * Enhance extracted flight data with API/database lookup
 */
export async function enhanceFlightData(extracted: {
  flight_number?: string | null
  departure_airport?: string | null
  arrival_airport?: string | null
  departure_time?: string | null
  arrival_time?: string | null
}): Promise<{
  flight_number?: string
  airline?: string
  departure_airport?: string
  departure_city?: string
  departure_time?: string
  departure_terminal?: string
  arrival_airport?: string
  arrival_city?: string
  arrival_time?: string
  arrival_terminal?: string
  enhanced: boolean
}> {
  const result: any = { enhanced: false }

  // If we have a flight number, look it up
  if (extracted.flight_number) {
    const flightInfo = await lookupFlight(extracted.flight_number)
    if (flightInfo) {
      result.flight_number = flightInfo.flight_number
      result.airline = flightInfo.airline
      result.departure_airport = flightInfo.departure.airport
      result.departure_city = flightInfo.departure.city
      result.departure_terminal = flightInfo.departure.terminal
      result.arrival_airport = flightInfo.arrival.airport
      result.arrival_city = flightInfo.arrival.city
      result.arrival_terminal = flightInfo.arrival.terminal

      // ALWAYS use API/database times - they are more reliable than PDF extraction
      if (flightInfo.departure.time) {
        result.departure_time = flightInfo.departure.time
      }
      if (flightInfo.arrival.time) {
        result.arrival_time = flightInfo.arrival.time
      }

      result.enhanced = true
    }
  }

  // If we have departure time but no arrival time, calculate it
  if (extracted.departure_time && !extracted.arrival_time && extracted.departure_airport && extracted.arrival_airport) {
    const duration = getTypicalDuration(extracted.departure_airport, extracted.arrival_airport)
    result.arrival_time = calculateArrivalTime(extracted.departure_time, duration)
    result.enhanced = true
  }

  return result
}
