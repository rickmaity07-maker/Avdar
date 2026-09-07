"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, getGoogleProvider, getFacebookProvider } from '../lib/firebase';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, verifyBeforeUpdateEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, getDoc, DocumentReference, query, where } from 'firebase/firestore';

type Language = string;
type Page = 'home' | 'services' | 'gallery' | 'products' | 'contact' | 'booking' | 'admin' | 'auth' | 'profile';

export type UserProfile = { id: string; name: string; email: string; phone: string; haircutCount: number; role: 'user' | 'admin'; photoURL?: string; hasUpdatedPassword?: boolean; };

export type Appointment = { 
  id: string; userId: string; name: string; phone: string; 
  services: string[]; totalDurationMins: number; stylist: string; 
  date: string; time: string; 
  status: 'pending' | 'confirmed' | 'cancelled' | 'proposed' | 'blocked'; 
  proposedDate?: string; proposedTime?: string;
  sendsms: boolean; usedReward: boolean; notes?: string; isEmergency?: boolean;
  referenceImage?: string; 
  specialRequests?: string;
};

export type WaitlistItem = { id: string; userId: string; name: string; phone: string; date: string; stylist: string; createdAt: number; };

// Phase 4 Dynamic Management Types
export type StylistItem = { id: string; name: string; services: string[] };
export type GeneralSettings = { walkinWaitTime: string; holidays: string[] };

export type Alert = { id: string; userId: string; message: string; isRead: boolean; link: Page; createdAt: number };
export type ServiceItem = { id: string; name: string; price: string; oldPrice?: string; durationMins: number };
export type ProductItem = { id: string; name: string; price: string; desc: string; image: string; stockCount?: number; };
export type Notification = { id: number; message: string; type: 'success' | 'info' | 'error' };
export type TimeSlot = { id: string; time: string; isBooked: boolean };
export type TranslationData = { [key: string]: { [key: string]: any } };

const initialSlots: TimeSlot[] = [
  { id: 't1', time: '09:00', isBooked: false }, { id: 't2', time: '10:00', isBooked: false },
  { id: 't3', time: '11:00', isBooked: false }, { id: 't4', time: '13:00', isBooked: false },
  { id: 't5', time: '14:00', isBooked: false }, { id: 't6', time: '15:30', isBooked: false },
];

export interface AppContextType {
  lang: Language; setLang: (lang: Language) => void;
  changeLanguage: (newLang: string) => Promise<void>;
  isTranslatingUI: boolean;
  page: Page; setPage: (page: Page) => void;
  t: any; updateTranslation: (lang: Language, section: string, key: string, val: string) => Promise<void>;
  isAdminAuth: boolean;
  currentUser: UserProfile | null; 
  usersDB: UserProfile[]; clientNotesDB: Record<string, string>; updateUserNotes: (id: string, notes: string) => Promise<void>;
  loginOAuth: (provider: 'Google' | 'Facebook') => Promise<void>; 
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string, name: string, phone?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserPassword: (oldPass: string, newPass: string) => Promise<void>;
  logout: () => void;
  appointments: Appointment[]; 
  addAppointment: (appt: Omit<Appointment, 'id'>) => Promise<DocumentReference | undefined>;
  addAdminAppointment: (appt: Omit<Appointment, 'id'>) => Promise<void>;
  updateAppointmentStatus: (id: string, status: Appointment['status'], sendsms: boolean, notes?: string, proposedDate?: string, proposedTime?: string) => Promise<void>;
  servicesDB: ServiceItem[]; addService: (s: Omit<ServiceItem, 'id'>) => Promise<void>; deleteService: (id: string) => Promise<void>;
  productsDB: ProductItem[]; addProduct: (p: Omit<ProductItem, 'id'>) => Promise<void>; deleteProduct: (id: string) => Promise<void>;
  updateProductStock: (id: string, newStock: number) => Promise<void>;
  // Phase 4 Dynamic Actions
  stylistsDB: StylistItem[]; addStylist: (s: Omit<StylistItem, 'id'>) => Promise<void>; deleteStylist: (id: string) => Promise<void>;
  generalSettings: GeneralSettings; updateGeneralSettings: (settings: Partial<GeneralSettings>) => Promise<void>;
  waitlist: WaitlistItem[]; addToWaitlist: (item: Omit<WaitlistItem, 'id' | 'createdAt'>) => Promise<void>; removeFromWaitlist: (id: string) => Promise<void>; notifyWaitlist: (item: WaitlistItem) => Promise<void>; resendConfirmation: (id: string) => Promise<void>;
  notifications: Notification[]; addNotification: (msg: string, type?: 'success' | 'info' | 'error') => void;
  alerts: Alert[]; markAlertRead: (id: string) => Promise<void>; clearAlerts: () => Promise<void>;
  getAvailableSlots: (date: string, stylist: string, requiredDuration?: number) => TimeSlot[];
}

export const fallbackTranslations: TranslationData = {
  de: { 
    common: { loading: "Lädt...", searchLang: "Sprache suchen...", noResults: "Keine gefunden.", footer: "Alle Rechte vorbehalten.", design: "Design", at: "um", by: "bei" },
    nav: { home: "Startseite", services: "Leistungen", gallery: "Galerie", team: "Team", products: "Produkte", contact: "Kontakt", contacts: "Kontakt", book: "Termin buchen", login: "Anmelden", profile: "Profil", myAccount: "Mein Konto", logout: "Abmelden", admin: "Admin Panel", language: "Sprache" }, 
    hero: { titleLine1: "Wo Stil auf", titleWordItalic: "Handwerk", titleLine2: "trifft.", sub: "Präzision, Handwerkskunst und ein kompromissloser Blick fürs Detail neu definiert.", bookBtn: "Termin buchen", location: "Standort", todaysHours: "Heutige Öffnungszeiten", openUntil: "Geöffnet bis", opensAt: "Öffnet um", closedNow: "Geschlossen", closedToday: "Heute geschlossen", walkin: "Ohne Termin möglich (Wartezeit", walkinSuffix: ")" }, 
    about: { title: "Über Uns", text: "Willkommen bei Avdar." }, 
    services: { title: "Unsere Leistungen", subtitle: "Goldenes Angebot Jeden Dienstag", min: "Minuten", from: "Ab", items: [
      { title: "Klassischer Haarschnitt", desc: "Präzisionsschnitt, abgestimmt auf Ihren Stil und Ihre Gesichtsform.", price: "35" },
      { title: "Skin Fade", desc: "Sauberer Fade mit nahtlosem Übergang und scharfen Konturen.", price: "40" },
      { title: "Bart Trimmen & Formen", desc: "Professionelle Bartmodellierung, Konturen und Finish.", price: "25" },
      { title: "Heißes-Handtuch-Rasur", desc: "Traditionelle Rasur mit dem Rasiermesser und Handtuchbehandlung.", price: "30" },
      { title: "Haarschnitt & Bart Kombi", desc: "Komplettes Grooming-Erlebnis mit Haarschnitt und Bartstyling.", price: "55" },
      { title: "Premium Grooming Paket", desc: "Haarschnitt, Bart Trimmen, Heißrasur, Waschen und Styling.", price: "75" },
    ] }, 
    gallery: { title: "Unsere Arbeit", subtitle: "Einblicke in unseren Salon", images: [
      "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&q=80",
      "https://images.unsplash.com/photo-1599305090598-fe179d501227?w=800&q=80",
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80",
      "https://images.unsplash.com/photo-1516975080661-4602f3066a24?w=800&q=80"
    ] }, 
    team: { title: "Das Team", members: [
      { name: "Oliver Hayes", role: "Master" },
      { name: "Sophia Bennett", role: "Master Barber" },
      { name: "Marcus Steele", role: "Senior Barber" },
    ] },
    numbers: { title: "Die Zahlen", years: "Jahre Erfahrung", clients: "Zufriedene Kunden", rating: "Kundenbewertung" },
    footerSection: { tagline: "Bei Avdar dreht sich jeder Termin um Präzision, Handwerkskunst und persönlichen Stil.", visit: "Besuchen Sie uns", openingHours: "Öffnungszeiten", monToSat: "Montag – Samstag", sunday: "Sonntag", closed: "Geschlossen", allRightsReserved: "Alle Rechte vorbehalten." },
    products: { title: "Store & Produkte", subtitle: "Professionelle Pflege für Zuhause" }, 
    contact: { title: "Kontakt", subtitle: "Besuchen Sie uns", addressLabel: "Adresse", address: "Obere Str. 30, 97421 Schweinfurt", phoneLabel: "Telefon", phone: "01523 2163823", hoursLabel: "Öffnungszeiten", hours: [ { days: "Montag - Samstag", time: "09:00 - 18:00 Uhr" }, { days: "Sonntag", time: "Geschlossen" } ], socialLabel: "Social Media" }, 
    auth: { loginTitle: "Anmelden", loginSub: "Um einen Termin zu buchen, melden Sie sich bitte an.", email: "E-Mail-Adresse", pass: "Passwort", loginBtn: "Einloggen", register: "Oder neu registrieren", social: "Mit Social Media fortfahren", noAccount: "Noch kein Konto?", haveAccount: "Bereits ein Konto?", registerTitle: "Konto erstellen", resetPassBtn: "Passwort vergessen?", passStrength: "Passwort-Stärke:", weak: "Schwach", medium: "Mittel", strong: "Stark", ruleLength: "Mindestens 8 Zeichen", ruleUpper: "Ein Großbuchstabe", ruleLower: "Ein Kleinbuchstabe", ruleNum: "Eine Zahl", ruleSpec: "Ein Sonderzeichen", continueGoogle: "Mit Google fortfahren", continueFacebook: "Mit Facebook fortfahren", or: "oder", cancel: "Abbrechen", pleaseWait: "Bitte warten…", fullName: "Vollständiger Name" }, 
    booking: { title: "Termin buchen", subtitle: "Wählen Sie Ihren Stylisten.", quote: "Dein perfekter Look beginnt hier.", name: "Vollständiger Name", phone: "Telefon", service: "Leistung", stylist: "Stylist auswählen", stylistAny: "Egal (Wer frei ist)", stylistOptions: ["Egal (Wer frei ist)", "Oliver Hayes", "Sophia Bennett", "Marcus Steele"], requestsLabel: "Besondere Wünsche / Notizen (Optional)", date: "Datum", time: "Uhrzeit", dsgvoNote: "Mit dem Absenden stimmen Sie der DSGVO zu.", smsNote: "SMS-Erinnerung 24h vor dem Termin erhalten.", reward: "Loyalty Bonus", rewardDesc: "Sie haben 10 Haarschnitte erreicht! Möchten Sie 50% Rabatt auf diesen Termin anwenden?", submit: "Kostenpflichtig Buchen", success: "Anfrage gesendet! Wir haben eine Bestätigungsmail an Sie gesendet.", refImage: "Referenzbild (Optional)", totalDuration: "Gesamtdauer:", pickDateFirst: "Wählen Sie zuerst ein Datum.", bookNew: "Neuen Termin anfragen", waitlistLabel: "Kein passender Termin?", joinWaitlistBtn: "Warteliste beitreten", chooseService: "Leistung auswählen", chooseMaster: "Wählen Sie Ihren Meister", noServicesYet: "Noch keine Leistungen verfügbar — schauen Sie bald wieder vorbei.", loginPrompt: "Bitte melden Sie sich an, um einen Termin anzufragen.", confirmBooking: "Termin bestätigen", walkinWaitLive: "Aktuelle Wartezeit für Walk-ins" }, 
    profile: { title: "Mein Profil", pointsTitle: "Ihre Treuepunkte", pointsDesc: "Sammeln Sie 10 Punkte für 50% Rabatt auf Ihren nächsten Schnitt!", historyTitle: "Ihr Besuchsverlauf", upcomingTitle: "Anstehende Termine", notesLabel: "Stylisten-Notizen:", noHistory: "Bisher keine Termine.", saveNote: "Notiz speichern", welcome: "Willkommen zurück", overview: "Übersicht", settings: "Einstellungen", editProfile: "Profil bearbeiten", contactData: "Kontaktdaten", noPhone: "Keine Telefonnummer gespeichert. Bitte in den Einstellungen hinzufügen.", acceptTime: "Zeit Akzeptieren", cancel: "Stornieren", pending: "Ausstehend", completed: "Abgeschlossen", newProposal: "Neuer Terminvorschlag vom Salon:", myAccount: "Mein Konto", close: "Schließen", dataPrivacyTitle: "Ihre Daten & Datenschutz", dataPrivacyDesc: "Gemäß DSGVO können Sie eine Kopie aller bei uns gespeicherten Daten herunterladen oder Ihr Konto dauerhaft löschen." }, 
    notifications: { title: "Benachrichtigungen", empty: "Keine Benachrichtigungen.", clearAll: "Alle löschen" },
    security: { title: "Sicherheitsupdate", desc: "Wir haben unsere Sicherheitsstandards aktualisiert. Bitte ändern Sie Ihr Passwort, um fortzufahren.", currentPass: "Aktuelles Passwort", newPass: "Neues Passwort", confirmPass: "Neues Passwort bestätigen", sendCode: "Code via E-Mail senden", enterCode: "E-Mail Bestätigungscode", cancel: "Abbrechen", confirmBtn: "Bestätigen & Ändern", secTitle: "Passwort & Sicherheit", oauthMsg: "Sie sind über einen Drittanbieter (Google/Facebook) angemeldet. Passwortänderungen sind hier nicht verfügbar.", sendOtpBtn: "OTP per E-Mail senden" },
    admin: { title: "Admin Control Panel", workspace: "Arbeitsbereich", backToWebsite: "Zurück zur Website", backToAdmin: "Zurück zum Admin", logoutBtn: "Abmelden", dashboardTabs: { dashboard: "Dashboard", appointments: "Termine", clients: "Kunden", team: "Team", waitlist: "Warteliste", services: "Leistungen", settings: "Einstellungen" },
    dash: {
      welcomeBack: "Willkommen zurück", overviewToday: "Hier ist Ihre heutige Übersicht.",
      todaysAppts: "Termine Heute", confirmedSuffix: "bestätigt", pendingRequests: "Ausstehende Anfragen", needsReview: "Zu prüfen",
      newClients: "Neue Kunden", noVisitsYet: "Noch keine Besuche", todaysAppointments: "Heutige Termine", viewAll: "Alle anzeigen",
      time: "Uhrzeit", client: "Kunde", service: "Leistung", master: "Meister", status: "Status", noAppointmentsToday: "Heute keine Termine.",
      apptsTitle: "Termine", apptsSubtitle: "Verwalten Sie alle Buchungen im Salon.", newBooking: "+ Neue Buchung",
      walkinFormTitle: "Laufkundschaft / Manuelle Buchung", clientNamePh: "Kundenname", phonePh: "Telefon",
      selectServicePh: "Leistung auswählen…", anyMasterPh: "Beliebiger Meister", save: "Speichern", cancel: "Abbrechen",
      searchPh: "Kunde oder ID suchen...", allMasters: "Alle Meister", id: "ID", dateTime: "Datum & Uhrzeit", actions: "Aktionen",
      noApptsFound: "Keine Termine gefunden.", confirm: "Bestätigen",
      clientsTitle: "Kunden", clientsSubtitle: "Kundendatenbank und -verlauf.", noClientsYet: "Noch keine Kundenkonten.",
      noPhoneOnFile: "Keine Telefonnummer hinterlegt", tier: "Stufe", loyalty: "Treuepunkte", cuts: "Schnitte", lastVisitLbl: "Letzter Besuch",
      staffNotesLabel: "Personalnotizen (privat — für Kunden nicht sichtbar)", staffNotesPh: "z.B. bevorzugte Fade-Länge, Allergien, Stammplatz...",
      saveNote: "Notiz speichern", tierPlatinum: "Platin", tierGold: "Gold", tierSilver: "Silber", tierBronze: "Bronze",
      servicesTitle: "Leistungen", servicesSubtitle: "Leistungsangebot und Preise verwalten.", serviceNameLbl: "Name der Leistung",
      priceLbl: "Preis", durationMinLbl: "Dauer (Min)", addServiceBtn: "Leistung hinzufügen", noServicesYet: "Noch keine Leistungen — fügen Sie oben eine hinzu.",
      durationCol: "Dauer", priceCol: "Preis", actionsCol: "Aktionen", deleteBtn: "Löschen",
      teamTitle: "Team", teamSubtitle: "Meister und Barbiere, die Termine annehmen.", nameLbl: "Name", specialtiesLbl: "Spezialisierungen (kommagetrennt)",
      specialtiesPh: "Skin Fade, Bart Trimmen", saveMasterBtn: "Meister speichern", noTeamYet: "Noch keine Teammitglieder — fügen Sie oben eines hinzu.",
      noSpecialties: "Keine Spezialisierungen aufgeführt", removeBtn: "Entfernen",
      waitlistTitle: "Warteliste", waitlistSubtitle: "Kunden, die auf einen freien Termin warten.", requestedDate: "Gewünschtes Datum",
      waitlistEmpty: "Warteliste ist leer.", notifyBtn: "Benachrichtigen",
      settingsTitle: "Einstellungen", settingsSubtitle: "Systemkonfiguration und Geschäftsdetails.",
      walkinWaitTitle: "Wartezeit für Laufkundschaft", walkinWaitDesc: "Wird Besuchern live auf der Buchungsseite angezeigt.",
      currentWaitLbl: "Aktuelle Wartezeit", currentWaitPh: "z.B. 15 Minuten, Ausgebucht...", updateBtn: "Aktualisieren",
      businessProfileTitle: "Geschäftsprofil", businessProfileDesc: "Geschäftsname, Kontakt-E-Mail und Adresse werden direkt im Website-Template (im Code) festgelegt, nicht hier — sagen Sie Bescheid, falls Sie das auch hier bearbeiten möchten.",
    },
    analytics: { revenue: "Umsatz Heute", completed: "Bestätigt (Heute)", upcoming: "Ausstehend (Heute)" }, tabs: { requests: "Anfragen", calendar: "Kalender", services: "Leistungen", products: "Produkte", clients: "Kunden", waitlist: "Warteliste", team: "Team", settings: "Einstellungen" }, team: { title: "Team & Stylisten", name: "Name des Stylisten", services: "Spezialisierungen (Leistungen)", saveBtn: "Stylist speichern", deleteBtn: "Löschen" }, settings: { title: "Allgemeine Einstellungen", walkin: "Live-Wartezeit für Walk-ins", walkinPlaceholder: "z.B. ca. 30 Minuten, Ausgebucht...", saveWalkin: "Wartezeit updaten", holidays: "Geschlossene Tage (Urlaub / Feiertage)", holidayDate: "Datum auswählen", addHoliday: "Tag blockieren" }, calendar: { back: "Zurück", next: "Weiter", freeSlot: "Freier Slot", allStylists: "Alle Stylisten", blockBtn: "Blockieren", unblockBtn: "Freigeben" }, walkIn: { title: "Walk-In / Termin Hinzufügen", name: "Kundenname", service: "Leistung / Info", duration: "Dauer (Min)", saveBtn: "Speichern", cancel: "Abbrechen", btn: "+ Walk-In" }, clients: { search: "Kunde nach Name oder Telefon suchen...", notes: "Stylisten-Notizen (z.B. Haarfarbe, Formel...)", saveNotes: "Notizen speichern" }, waitlist: { title: "Warteliste", empty: "Warteliste ist leer.", notifyBtn: "Kunde Benachrichtigen", removeBtn: "Entfernen" }, requests: { pending: "Ausstehende Anfragen", noPending: "Keine neuen Anfragen.", services: "Leistungen:", refImage: "Referenzbild:", confirmBtn: "Bestätigen", rejectBtn: "Ablehnen", reschedule: "Termin verschieben (Neuer Vorschlag)", proposeBtn: "Vorschlagen", confirmed: "Bestätigt & Historie", notesPlaceholder: "Interne Notizen (z.B. Skin fade #1...)", saveNote: "Notiz speichern", cancelBtn: "Stornieren", move: "Verschieben:", proposeClientBtn: "Kunden Vorschlagen", status: "Status", resendBtn: "Bestätigung neu senden" }, services: { addTitle: "Leistung hinzufügen", nameDe: "Name der Leistung (Deutsch)", nameEn: "Name (Englische Vorschau)", price: "Preis (€)", duration: "Dauer (Min)", saveBtn: "In Datenbank speichern", deleteBtn: "Löschen", translateBtn: "✨ KI: Auf Englisch übersetzen", translating: "Übersetzen..." }, products: { addTitle: "Produkt hinzufügen", nameDe: "Produktname (Deutsch)", descDe: "Beschreibung (Deutsch)", nameEn: "Name (Englische Vorschau)", descEn: "Beschreibung (Englische Vorschau)", price: "Preis (€)", initialStock: "Anfangsbestand", uploadImg: "Produktbild hochladen", saveBtn: "Produkt speichern", stockLabel: "Bestand" } },
    alertsMsg: { confirmed1: "Dein Termin am", confirmed2: "Uhr wurde bestätigt!", cancelled1: "Dein Termin am", cancelled2: "wurde leider storniert.", proposed1: "Neuer Termin-Vorschlag:", proposed2: "Bitte bestätigen!" }
  },
  en: { 
    common: { loading: "Loading...", searchLang: "Search language...", noResults: "None found.", footer: "All rights reserved.", design: "Design", at: "at", by: "with" },
    nav: { home: "Home", services: "Services", gallery: "Gallery", team: "Team", products: "Products", contact: "Contact", contacts: "Contacts", book: "Book Now", login: "Login", profile: "Profile", myAccount: "My Account", logout: "Log Out", admin: "Admin Panel", language: "Language" }, 
    hero: { titleLine1: "Where", titleWordItalic: "Style", titleLine2: "Meets Craft.", sub: "Elevating the traditional grooming experience through precision, artistry, and an uncompromising attention to detail.", bookBtn: "Book Appointment", location: "Location", todaysHours: "Today's Hours", openUntil: "Open until", opensAt: "Opens at", closedNow: "Closed now", closedToday: "Closed today", walkin: "Walk-in possible (Waiting time", walkinSuffix: ")" }, 
    about: { title: "About Us", text: "Welcome to Avdar." }, 
    services: { title: "Our Services", subtitle: "Golden Offer Every Tuesday", min: "minutes", from: "From", items: [
      { title: "Classic Haircut", desc: "Precision cut tailored to your style and face shape.", price: "35" },
      { title: "Skin Fade", desc: "Clean fade with seamless blending and sharp detailing.", price: "40" },
      { title: "Beard Trim & Shape", desc: "Expert beard sculpting, lining, and finishing.", price: "25" },
      { title: "Hot Towel Shave", desc: "Traditional straight razor shave with hot towel treatment.", price: "30" },
      { title: "Haircut & Beard Combo", desc: "Complete grooming experience with haircut and beard styling.", price: "55" },
      { title: "Premium Grooming Package", desc: "Haircut, beard trim, hot towel shave, wash, and styling.", price: "75" },
    ] }, 
    gallery: { title: "Our Work", subtitle: "Inside the salon", images: [
      "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&q=80",
      "https://images.unsplash.com/photo-1599305090598-fe179d501227?w=800&q=80",
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80",
      "https://images.unsplash.com/photo-1516975080661-4602f3066a24?w=800&q=80"
    ] }, 
    team: { title: "The Team", members: [
      { name: "Oliver Hayes", role: "Master" },
      { name: "Sophia Bennett", role: "Master Barber" },
      { name: "Marcus Steele", role: "Senior Barber" },
    ] },
    numbers: { title: "The Numbers", years: "Years of experience", clients: "Happy clients", rating: "Client rating" },
    footerSection: { tagline: "At Avdar, every appointment is built around precision, craftsmanship, and personal style.", visit: "Visit", openingHours: "Opening Hours", monToSat: "Monday – Saturday", sunday: "Sunday", closed: "Closed", allRightsReserved: "All rights reserved." },
    products: { title: "Store & Products", subtitle: "Professional care for home" }, 
    contact: { title: "Contact Us", subtitle: "Visit us", addressLabel: "Address", address: "Obere Str. 30, 97421 Schweinfurt", phoneLabel: "Phone", phone: "01523 2163823", hoursLabel: "Opening Hours", hours: [ { days: "Monday - Saturday", time: "9:00 AM - 6:00 PM" }, { days: "Sunday", time: "Closed" } ], socialLabel: "Social Media" }, 
    auth: { loginTitle: "Login", loginSub: "Please log in to book an appointment.", email: "Email Address", pass: "Password", loginBtn: "Sign In", register: "Or create an account", social: "Continue with Social", noAccount: "Don't have an account?", haveAccount: "Already have an account?", registerTitle: "Create Account", resetPassBtn: "Forgot Password?", passStrength: "Password Strength:", weak: "Weak", medium: "Medium", strong: "Strong", ruleLength: "At least 8 characters", ruleUpper: "One uppercase letter", ruleLower: "One lowercase letter", ruleNum: "One number", ruleSpec: "One special character", continueGoogle: "Continue with Google", continueFacebook: "Continue with Facebook", or: "or", cancel: "Cancel", pleaseWait: "Please wait…", fullName: "Full Name" }, 
    booking: { title: "Book Appointment", subtitle: "Select your stylist.", quote: "Your perfect look begins here.", name: "Full Name", phone: "Phone", service: "Service", stylist: "Select Stylist", stylistAny: "Any (First Available)", stylistOptions: ["Any", "Oliver Hayes", "Sophia Bennett", "Marcus Steele"], requestsLabel: "Special Requests / Notes (Optional)", date: "Date", time: "Time", dsgvoNote: "By submitting, you agree to GDPR processing.", smsNote: "Receive SMS reminder 24h before appointment.", reward: "Loyalty Bonus", rewardDesc: "You reached 10 haircuts! Want to apply a 50% discount to this booking?", submit: "Confirm Booking", success: "Request sent! We have emailed you a confirmation receipt.", refImage: "Reference Image (Optional)", totalDuration: "Total Duration:", pickDateFirst: "Please select a date first.", bookNew: "Request new appointment", waitlistLabel: "No suitable time?", joinWaitlistBtn: "Join Waitlist", chooseService: "Choose a service", chooseMaster: "Choose your master", noServicesYet: "No services published yet — check back soon.", loginPrompt: "Please log in to request an appointment.", confirmBooking: "Confirm Booking", walkinWaitLive: "Walk-in wait right now" }, 
    profile: { title: "My Profile", pointsTitle: "Your Loyalty Points", pointsDesc: "Collect 10 points for 50% off your next cut!", historyTitle: "Your Visit History", upcomingTitle: "Upcoming Appointments", notesLabel: "Stylist Notes:", noHistory: "No appointments yet.", saveNote: "Save Note", welcome: "Welcome back", overview: "Overview", settings: "Settings", editProfile: "Edit Profile", contactData: "Contact Data", noPhone: "No phone number saved. Please add in settings.", acceptTime: "Accept Time", cancel: "Cancel", pending: "Pending", completed: "Completed", newProposal: "New appointment proposal from salon:", myAccount: "My Account", close: "Close", dataPrivacyTitle: "Your Data & Privacy", dataPrivacyDesc: "Under GDPR you can download a copy of everything we hold on you, or permanently delete your account." }, 
    notifications: { title: "Notifications", empty: "No notifications.", clearAll: "Clear All" },
    security: { title: "Security Update", desc: "We updated our security standards. Please change your password to continue.", currentPass: "Current Password", newPass: "New Password", confirmPass: "Confirm New Password", sendCode: "Send code via E-Mail", enterCode: "E-Mail verification code", cancel: "Cancel", confirmBtn: "Confirm & Change", secTitle: "Password & Security", oauthMsg: "You are logged in via a third party (Google/Facebook). Password changes are not available here.", sendOtpBtn: "Send OTP via E-Mail" },
    admin: { title: "Admin Control Panel", workspace: "Workspace", backToWebsite: "Back to Website", backToAdmin: "Back to Admin", logoutBtn: "Logout", dashboardTabs: { dashboard: "Dashboard", appointments: "Appointments", clients: "Clients", team: "Team", waitlist: "Waitlist", services: "Services", settings: "Settings" },
    dash: {
      welcomeBack: "Welcome back", overviewToday: "Here is today's overview.",
      todaysAppts: "Today's Appointments", confirmedSuffix: "confirmed", pendingRequests: "Pending Requests", needsReview: "Needs review",
      newClients: "New Clients", noVisitsYet: "No visits yet", todaysAppointments: "Today's Appointments", viewAll: "View All",
      time: "Time", client: "Client", service: "Service", master: "Master", status: "Status", noAppointmentsToday: "No appointments today.",
      apptsTitle: "Appointments", apptsSubtitle: "Manage all bookings across the salon.", newBooking: "+ New Booking",
      walkinFormTitle: "Walk-In / Manual Booking", clientNamePh: "Client name", phonePh: "Phone",
      selectServicePh: "Select service…", anyMasterPh: "Any master", save: "Save", cancel: "Cancel",
      searchPh: "Search client or ID...", allMasters: "All Masters", id: "ID", dateTime: "Date & Time", actions: "Actions",
      noApptsFound: "No appointments found.", confirm: "Confirm",
      clientsTitle: "Clients", clientsSubtitle: "Client database and history.", noClientsYet: "No client accounts yet.",
      noPhoneOnFile: "No phone on file", tier: "Tier", loyalty: "Loyalty", cuts: "cuts", lastVisitLbl: "Last Visit",
      staffNotesLabel: "Staff Notes (private — never visible to client)", staffNotesPh: "e.g. preferred fade length, allergies, regular chair...",
      saveNote: "Save Note", tierPlatinum: "Platinum", tierGold: "Gold", tierSilver: "Silver", tierBronze: "Bronze",
      servicesTitle: "Services", servicesSubtitle: "Manage service offerings and pricing.", serviceNameLbl: "Service Name",
      priceLbl: "Price", durationMinLbl: "Duration (min)", addServiceBtn: "Add Service", noServicesYet: "No services yet — add one above.",
      durationCol: "Duration", priceCol: "Price", actionsCol: "Actions", deleteBtn: "Delete",
      teamTitle: "Team", teamSubtitle: "Masters and barbers who take appointments.", nameLbl: "Name", specialtiesLbl: "Specialties (comma-separated)",
      specialtiesPh: "Skin Fade, Beard Trim", saveMasterBtn: "Save Master", noTeamYet: "No team members yet — add one above.",
      noSpecialties: "No specialties listed", removeBtn: "Remove",
      waitlistTitle: "Waitlist", waitlistSubtitle: "Clients waiting for a slot to free up.", requestedDate: "Requested Date",
      waitlistEmpty: "Waitlist is empty.", notifyBtn: "Notify",
      settingsTitle: "Settings", settingsSubtitle: "System configurations and business details.",
      walkinWaitTitle: "Walk-In Wait Time", walkinWaitDesc: "Shown live to visitors on the public booking page.",
      currentWaitLbl: "Current Wait", currentWaitPh: "e.g. 15 minutes, Fully Booked...", updateBtn: "Update",
      businessProfileTitle: "Business Profile", businessProfileDesc: "Business name, contact email, and address are set in the site template itself (in the code) rather than here — let me know if you'd like these editable from this panel too.",
    },
    analytics: { revenue: "Today's Revenue", completed: "Confirmed (Today)", upcoming: "Pending (Today)" }, tabs: { requests: "Requests", calendar: "Calendar", services: "Services", products: "Products", clients: "Clients", waitlist: "Waitlist", team: "Team", settings: "Settings" }, team: { title: "Team & Stylists", name: "Stylist Name", services: "Specialties (Services)", saveBtn: "Save Stylist", deleteBtn: "Delete" }, settings: { title: "General Settings", walkin: "Live Walk-in Wait Time", walkinPlaceholder: "e.g. 15 Minutes, Fully Booked...", saveWalkin: "Update Wait Time", holidays: "Closed Dates (Holidays)", holidayDate: "Select Date", addHoliday: "Block Date" }, calendar: { back: "Back", next: "Next", freeSlot: "Free Slot", allStylists: "All Stylists", blockBtn: "Block", unblockBtn: "Unblock" }, walkIn: { title: "Add Walk-In / Appointment", name: "Client Name", service: "Service / Info", duration: "Duration (Min)", saveBtn: "Save", cancel: "Cancel", btn: "+ Walk-In" }, clients: { search: "Search client by name or phone...", notes: "Stylist Notes (e.g. formula, allergies...)", saveNotes: "Save Notes" }, waitlist: { title: "Waitlist", empty: "Waitlist is empty.", notifyBtn: "Notify Client", removeBtn: "Remove" }, requests: { pending: "Pending Requests", noPending: "No new requests.", services: "Services:", refImage: "Reference Image:", confirmBtn: "Confirm", rejectBtn: "Reject", reschedule: "Reschedule (New Proposal)", proposeBtn: "Propose", confirmed: "Confirmed & History", notesPlaceholder: "Internal Notes (e.g. Skin fade #1...)", saveNote: "Save Note", cancelBtn: "Cancel", move: "Move:", proposeClientBtn: "Propose to Client", status: "Status", resendBtn: "Resend Confirm" }, services: { addTitle: "Add Service", nameDe: "Service Name (German)", nameEn: "Name (English Preview)", price: "Price (€)", duration: "Duration (Min)", saveBtn: "Save to Database", deleteBtn: "Delete", translateBtn: "✨ AI: Translate to English", translating: "Translating..." }, products: { addTitle: "Add Product", nameDe: "Product Name (German)", descDe: "Description (German)", nameEn: "Name (English Preview)", descEn: "Description (English Preview)", price: "Price (€)", initialStock: "Initial Stock", uploadImg: "Upload Product Image", saveBtn: "Save Product", stockLabel: "Stock" } },
    alertsMsg: { confirmed1: "Your appointment on", confirmed2: "has been confirmed!", cancelled1: "Your appointment on", cancelled2: "has been cancelled.", proposed1: "New appointment proposal:", proposed2: "Please confirm!" }
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('de'); 
  const [isTranslatingUI, setIsTranslatingUI] = useState(false);
  const [page, setPageState] = useState<Page>('home');
  const [translations, setTranslations] = useState<TranslationData>(fallbackTranslations);
  
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [usersDB, setUsersDB] = useState<UserProfile[]>([]);
  const [clientNotesDB, setClientNotesDB] = useState<Record<string, string>>({});
  
  const [servicesDB, setServicesDB] = useState<ServiceItem[]>([]);
  const [productsDB, setProductsDB] = useState<ProductItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>([]);
  
  // Phase 4 Dynamic State
  const [stylistsDB, setStylistsDB] = useState<StylistItem[]>([]);
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({ walkinWaitTime: 'ca. 30 Minuten', holidays: [] });

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@avdar.com';
  
  const getAuthHeaders = async () => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const addNotification = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000); 
  };

  const markAlertRead = async (id: string) => {
    await updateDoc(doc(db, 'alerts', id), { isRead: true });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  const clearAlerts = async () => {
    if (!currentUser) return;
    const userAlerts = alerts.filter(a => a.userId === currentUser.id);
    for (const a of userAlerts) {
      await deleteDoc(doc(db, 'alerts', a.id));
    }
    setAlerts(prev => prev.filter(a => a.userId !== currentUser.id));
  };

  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '') as Page;
      if (['home', 'services', 'gallery', 'products', 'contact', 'booking', 'admin', 'auth', 'profile'].includes(hash)) {
        setPageState(hash);
      } else {
        setPageState('home');
      }
    };
    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setPageRouter = (newPage: Page) => {
    if (newPage !== page) {
      if ((newPage === 'booking' || newPage === 'profile') && !currentUser) {
        window.history.pushState(null, '', '#auth');
        setPageState('auth');
        return;
      }
      if (newPage === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
        addNotification("Admin access required.", 'error');
        return;
      }
      const newUrl = newPage === 'home' ? window.location.pathname : `#${newPage}`;
      window.history.pushState(null, '', newUrl);
      setPageState(newPage);
      window.scrollTo(0, 0);
    }
  };

  useEffect(() => {
    if (currentUser && page === 'auth') {
      setPageRouter('profile');
    }
  }, [currentUser, page, setPageRouter]);

  // Auth state + own profile only. Appointments/alerts moved to their own
  // effect below, scoped by role, so a regular customer never subscribes to
  // the full collection (see firestore.rules — read is owner-or-admin only).
  useEffect(() => {
    let unsubUser: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            setCurrentUser(profile);
            setIsAdminAuth(profile.role === 'admin');
          } else {
            const newProfile: UserProfile = { id: user.uid, name: user.displayName || 'Client', email: user.email || '', phone: '', haircutCount: 0, role: 'user' };
            setDoc(doc(db, 'users', user.uid), newProfile);
            setCurrentUser(newProfile);
            setIsAdminAuth(false);
          }
        }, (error) => console.error("🚨 CRASH ON COLLECTION 'users' (Individual Doc):", error.message));
      } else {
        setCurrentUser(null);
        setIsAdminAuth(false);
        if (unsubUser) { unsubUser(); unsubUser = null; }
      }
    });

    const unsubTrans = onSnapshot(doc(db, 'settings', 'translations'), (snap) => {
      if (snap.exists()) setTranslations({ ...fallbackTranslations, ...(snap.data() as TranslationData) });
    }, (error) => console.error("🚨 CRASH ON 'settings/translations':", error.message));
    
    const unsubSrv = onSnapshot(collection(db, 'services'), (snap) => {
      setServicesDB(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceItem)));
    }, (error) => console.error("🚨 CRASH ON COLLECTION 'services':", error.message));
    
    const unsubProd = onSnapshot(collection(db, 'products'), (snap) => {
      setProductsDB(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductItem)));
    }, (error) => console.error("🚨 CRASH ON COLLECTION 'products':", error.message));
    
    const unsubStylists = onSnapshot(collection(db, 'stylists'), (snap) => {
      setStylistsDB(snap.docs.map(d => ({ id: d.id, ...d.data() } as StylistItem)));
    }, (error) => console.error("🚨 CRASH ON COLLECTION 'stylists':", error.message));
    
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) setGeneralSettings({ walkinWaitTime: 'ca. 30 Minuten', holidays: [], ...snap.data() });
    }, (error) => console.error("🚨 CRASH ON 'settings/general':", error.message));

    return () => { 
      unsubAuth(); unsubTrans(); unsubSrv(); unsubProd(); unsubStylists(); unsubSettings();
      if (unsubUser) unsubUser(); 
    };
  }, []);

  // Appointments & alerts, scoped by role: admins see everything (needed for
  // the dashboard), regular customers only ever query their OWN records —
  // matching the owner-or-admin read rule in firestore.rules. Re-subscribes
  // whenever the logged-in user or their admin status changes.
  useEffect(() => {
    let unsubAppts: (() => void) | null = null;
    let unsubAlerts: (() => void) | null = null;

    if (currentUser) {
      const apptsRef = isAdminAuth
        ? collection(db, 'appointments')
        : query(collection(db, 'appointments'), where('userId', '==', currentUser.id));
      unsubAppts = onSnapshot(apptsRef, (snap) => {
        setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
      }, (error) => console.error("🚨 CRASH ON COLLECTION 'appointments':", error.message));

      const alertsRef = isAdminAuth
        ? collection(db, 'alerts')
        : query(collection(db, 'alerts'), where('userId', '==', currentUser.id));
      unsubAlerts = onSnapshot(alertsRef, (snap) => {
        setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Alert)));
      }, (error) => console.error("🚨 CRASH ON COLLECTION 'alerts':", error.message));
    } else {
      setAppointments([]);
      setAlerts([]);
    }

    return () => {
      if (unsubAppts) unsubAppts();
      if (unsubAlerts) unsubAlerts();
    };
  }, [currentUser, isAdminAuth]);

  useEffect(() => {
    let unsubUsersDB: (() => void) | null = null;
    let unsubWaitlist: (() => void) | null = null;
    let unsubClientNotes: (() => void) | null = null;

    if (isAdminAuth) {
      unsubUsersDB = onSnapshot(collection(db, 'users'), (snap) => {
        setUsersDB(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
      }, (error) => console.error("🚨 CRASH ON COLLECTION 'users' (Admin List):", error.message));
      
      unsubWaitlist = onSnapshot(collection(db, 'waitlist'), (snap) => {
        setWaitlist(snap.docs.map(d => ({ id: d.id, ...d.data() } as WaitlistItem)));
      }, (error) => console.error("🚨 CRASH ON COLLECTION 'waitlist':", error.message));
      
      unsubClientNotes = onSnapshot(collection(db, 'clientNotes'), (snap) => {
        const notesMap: Record<string, string> = {};
        snap.docs.forEach(d => { notesMap[d.id] = (d.data() as any).notes || ''; });
        setClientNotesDB(notesMap);
      }, (error) => console.error("🚨 CRASH ON COLLECTION 'clientNotes':", error.message));
    } else {
      setUsersDB([]);
      setWaitlist([]);
      setClientNotesDB({});
    }
    
    return () => { 
      if (unsubUsersDB) unsubUsersDB(); 
      if (unsubWaitlist) unsubWaitlist();
      if (unsubClientNotes) unsubClientNotes();
    };
  }, [isAdminAuth]);

  const changeLanguage = async (newLang: string) => {
    if (newLang === lang) return;
    if (newLang === 'de' || translations[newLang]) {
      setLang(newLang);
      return;
    }

    setIsTranslatingUI(true);
    try {
      const res = await fetch('/api/translate-ui', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ targetLang: newLang, sourceDict: fallbackTranslations.de })
      });
      const data = await res.json();
      if (data.translatedDict) {
        setTranslations(prev => ({ ...prev, [newLang]: data.translatedDict }));
        setLang(newLang);
        addNotification(`Interface in neuer Sprache geladen!`, 'success');
      } else {
        addNotification(data.error || 'Übersetzung fehlgeschlagen.', 'error');
        setLang('de');
      }
    } catch (e) {
      addNotification('Übersetzung fehlgeschlagen.', 'error');
      setLang('de');
    } finally {
      setIsTranslatingUI(false);
    }
  };

  const timeToMins = (t: string) => { 
    const [h, m] = t.split(':').map(Number); 
    return h * 60 + m; 
  };

  const getAvailableSlots = (date: string, stylist: string, requiredDuration: number = 60) => {
    if (!date) return initialSlots.map(s => ({ ...s, isBooked: false }));
    
    // Phase 4: Block Global Holidays Automatically
    if (generalSettings.holidays && generalSettings.holidays.includes(date)) {
        return initialSlots.map(s => ({ ...s, isBooked: true }));
    }

    const realStylists = stylistsDB.length > 0 ? stylistsDB.map(s => s.name) : ["Oliver Hayes", "Sophia Bennett", "Marcus Steele"];

    return initialSlots.map(slot => {
      const slotMins = timeToMins(slot.time);
      
      let isBooked = false;
      if (stylist && stylist !== 'Egal (Wer frei ist)' && stylist !== 'Any' && stylist !== translations[lang]?.booking?.stylistAny) {
        isBooked = appointments.some(a => {
          if (a.date !== date || (a.status !== 'confirmed' && a.status !== 'pending' && a.status !== 'proposed' && a.status !== 'blocked')) return false;
          if (a.stylist !== stylist && a.stylist !== 'Egal (Wer frei ist)' && a.stylist !== 'Any' && a.stylist !== translations[lang]?.booking?.stylistAny) return false;
          
          const aStart = (a.status === 'proposed' && a.proposedTime) ? timeToMins(a.proposedTime) : timeToMins(a.time);
          const aEnd = aStart + (a.totalDurationMins || 60);
          
          const newStart = slotMins;
          const newEnd = slotMins + requiredDuration;
          
          return newStart < aEnd && newEnd > aStart;
        });
      } else {
        let overlaps = 0;
        realStylists.forEach(sName => {
          const sBooked = appointments.some(a => {
            if (a.date !== date || (a.status !== 'confirmed' && a.status !== 'pending' && a.status !== 'proposed' && a.status !== 'blocked')) return false;
            if (a.stylist !== sName && a.stylist !== 'Egal (Wer frei ist)' && a.stylist !== 'Any' && a.stylist !== translations[lang]?.booking?.stylistAny) return false;
            
            const aStart = (a.status === 'proposed' && a.proposedTime) ? timeToMins(a.proposedTime) : timeToMins(a.time);
            const aEnd = aStart + (a.totalDurationMins || 60);
            return slotMins < aEnd && (slotMins + requiredDuration) > aStart;
          });
          if (sBooked) overlaps++;
        });
        isBooked = overlaps >= realStylists.length;
      }

      return { ...slot, isBooked };
    });
  };

  const loginOAuth = async (providerName: 'Google' | 'Facebook') => {
    try {
      const provider = providerName === 'Google' ? getGoogleProvider() : getFacebookProvider();
      await signInWithPopup(auth, provider);
      setPageRouter('profile');
      addNotification(`Logged in with ${providerName}`, 'success');
    } catch (error: any) { 
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') return; 
      addNotification(error.message, 'error'); 
    }
  };

  const loginEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setPageRouter('profile');
      addNotification("Login successful", 'success');
    } catch (error: any) { addNotification(error.message, 'error'); }
  };

  const registerEmail = async (email: string, pass: string, name: string, phone?: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const cleanPhone = phone ? phone.replace(/\s+/g, '') : '';
      await setDoc(doc(db, 'users', cred.user.uid), { 
        id: cred.user.uid, name, email, phone: cleanPhone, haircutCount: 0, role: 'user' 
      });
      setPageRouter('profile');
      addNotification("Account created and verified successfully!", 'success');
    } catch (error: any) { 
      addNotification(error.message, 'error'); 
    }
  };

  const resetPassword = async (email: string) => {
    if (!email) return addNotification("Please enter your email address first.", 'error');
    try {
      await sendPasswordResetEmail(auth, email);
      addNotification("Password reset email sent! Check your inbox.", 'success');
    } catch (error: any) { addNotification(error.message, 'error'); }
  };

  const logout = () => { signOut(auth); setPageRouter('home'); };

  const updateUserPassword = async (oldPass: string, newPass: string) => {
    if (!auth.currentUser || !currentUser) throw new Error("Nicht angemeldet.");
    const credential = EmailAuthProvider.credential(currentUser.email, oldPass);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPass);
    await updateDoc(doc(db, 'users', currentUser.id), { hasUpdatedPassword: true });
    addNotification("Passwort erfolgreich aktualisiert!", "success");
  };

  const updateUserNotes = async (id: string, notes: string) => {
    if (!isAdminAuth) return;
    await setDoc(doc(db, 'clientNotes', id), { notes, updatedAt: Date.now() }, { merge: true });
    addNotification("Stylisten-Notizen gespeichert!", "success");
  };

  const updateTranslation = async (l: Language, section: string, key: string, val: string) => {
    if (!isAdminAuth) return;
    await updateDoc(doc(db, 'settings', 'translations'), { [`${l}.${section}.${key}`]: val });
    addNotification("Translation saved via Cloud!", 'success');
  };

  const sendDualEmail = async (uEmail: string | null, uSubj: string, uMsg: string, aSubj: string, aMsg: string) => {
    try {
      const headers = await getAuthHeaders();
      if (uEmail) {
        fetch('/api/email', { method: 'POST', headers, body: JSON.stringify({ email: uEmail, subject: uSubj, message: uMsg }) }).catch(()=>{});
      }
      if (aSubj && aMsg) {
        fetch('/api/email', { method: 'POST', headers, body: JSON.stringify({ email: adminEmail, subject: aSubj, message: aMsg }) }).catch(()=>{});
      }
    } catch (e) {
      console.error("Dual Email Execution Failed", e);
    }
  };

  const addToWaitlist = async (item: Omit<WaitlistItem, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'waitlist'), { ...item, createdAt: Date.now() });
    addNotification("Auf die Warteliste gesetzt!", 'success');
  };

  const removeFromWaitlist = async (id: string) => {
    await deleteDoc(doc(db, 'waitlist', id));
    addNotification("Von Warteliste entfernt.", 'info');
  };

  const notifyWaitlist = async (item: WaitlistItem) => {
    if (item.phone) {
      const cleanPhone = item.phone.replace(/\s+/g, '');
      fetch('/api/sms', { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ phone: cleanPhone, message: `Avdar: Ein Termin am ${item.date} bei ${item.stylist} ist freigeworden! Buche jetzt online.` }) }).catch(()=>{});
    }
    const userDoc = await getDoc(doc(db, 'users', item.userId));
    const userEmail = userDoc.exists() ? userDoc.data().email : null;
    if (userEmail) {
      await sendDualEmail(
        userEmail,
        "Avdar: Warteliste Update - Freier Termin!",
        `Hallo ${item.name},\n\nGute Neuigkeiten! Ein Termin am ${item.date} bei ${item.stylist} ist gerade freigeworden.\n\nBitte besuche unsere Webseite, um ihn direkt zu buchen, bevor er weg ist!\n\nDein Avdar Team`,
        "", ""
      );
    }
    addNotification("Kunde benachrichtigt!", 'success');
  };

  const resendConfirmation = async (id: string) => {
    const appt = appointments.find(a => a.id === id);
    if (!appt || appt.status !== 'confirmed') return;
    const userDoc = await getDoc(doc(db, 'users', appt.userId));
    const userEmail = userDoc.exists() ? userDoc.data().email : null;
    
    if (appt.sendsms && appt.phone) {
      const cleanPhone = appt.phone.replace(/\s+/g, '');
      fetch('/api/sms', { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ phone: cleanPhone, message: `Avdar (Erinnerung): Dein Termin am ${appt.date} um ${appt.time} Uhr ist bestätigt!` }) }).catch(()=>{});
    }
    
    await sendDualEmail(
      userEmail,
      "Avdar: Terminbestätigung (Erneut gesendet)",
      `Hallo ${appt.name},\n\nDies ist eine Erinnerung an deinen bestätigten Termin am ${appt.date} um ${appt.time} Uhr bei ${appt.stylist}.\n\nWir freuen uns auf dich.\nAvdar`,
      "", ""
    );
    addNotification("Bestätigung erfolgreich erneut gesendet!", 'success');
  };

  const addAdminAppointment = async (appt: Omit<Appointment, 'id'>) => {
    if (!isAdminAuth) return;
    await addDoc(collection(db, 'appointments'), appt);
    addNotification("Gespeichert!", 'success');
  };

  const addAppointment = async (appt: Omit<Appointment, 'id'>): Promise<DocumentReference | undefined> => {
    if (!currentUser) return;
    
    const docRef = await addDoc(collection(db, 'appointments'), appt);
    const userRef = doc(db, 'users', currentUser.id);
    
    if (appt.usedReward) await updateDoc(userRef, { haircutCount: Math.max(0, currentUser.haircutCount - 10) });
    else await updateDoc(userRef, { haircutCount: currentUser.haircutCount + 1 });
    
    await sendDualEmail(
      currentUser.email,
      "Avdar: Buchungsanfrage erhalten",
      `Hallo ${appt.name},\n\nDeine Anfrage für ${appt.services.join(', ')} am ${appt.date} um ${appt.time} Uhr wurde an den Salon übermittelt.\n\nWir prüfen derzeit die Verfügbarkeit und werden deinen Termin in Kürze bestätigen.\n\nDein Avdar Team`,
      "🚨 Neuer Termin eingegangen!",
      `Hallo Admin,\n\nEs gibt eine neue Buchung:\nKunde: ${appt.name} (${appt.phone})\nLeistungen: ${appt.services.join(', ')} (${appt.totalDurationMins} Min)\nDatum: ${appt.date} um ${appt.time} Uhr\nStylist: ${appt.stylist}\nWünsche: ${appt.specialRequests || '-'}\n\nBitte logge dich im Admin-Panel ein, um den Termin zu bestätigen, abzulehnen oder zu verschieben.`
    );

    addNotification("Appointment request sent!", 'success');
    return docRef;
  };

  const updateAppointmentStatus = async (id: string, status: Appointment['status'], sendsms: boolean, notes?: string, proposedDate?: string, proposedTime?: string) => {
    const appt = appointments.find(a => a.id === id);
    if (!appt) return;

    const updates: any = { status };
    if (notes !== undefined) updates.notes = notes;

    if (status === 'confirmed' && proposedDate && proposedTime) {
      updates.date = proposedDate;
      updates.time = proposedTime;
      updates.proposedDate = null;
      updates.proposedTime = null;
    } else {
      if (proposedDate) updates.proposedDate = proposedDate;
      if (proposedTime) updates.proposedTime = proposedTime;
    }
    
    await updateDoc(doc(db, 'appointments', id), updates);

    if (appt.status === 'blocked' || status === 'blocked' || appt.userId === 'walk-in' || appt.userId === 'block') {
      addNotification("Status aktualisiert (Gesperrt/Walk-In).", 'success');
      return;
    }

    if (status === 'cancelled' && appt.status !== 'cancelled') {
      const userRef = doc(db, 'users', appt.userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const uData = userDoc.data();
        if (appt.usedReward) await updateDoc(userRef, { haircutCount: uData.haircutCount + 10 }); 
        else await updateDoc(userRef, { haircutCount: Math.max(0, uData.haircutCount - 1) }); 
      }
    }

    const userDoc = await getDoc(doc(db, 'users', appt.userId));
    const userEmail = userDoc.exists() ? userDoc.data().email : null;
    
    const finalDate = (status === 'confirmed' && proposedDate) ? proposedDate : (proposedDate || appt.date);
    const finalTime = (status === 'confirmed' && proposedTime) ? proposedTime : (proposedTime || appt.time);

    const tAlert = translations[lang]?.alertsMsg || fallbackTranslations[lang]?.alertsMsg || fallbackTranslations.de.alertsMsg;
    const tCommon = translations[lang]?.common || fallbackTranslations[lang]?.common || fallbackTranslations.de.common;

    if (status === 'confirmed' && appt.status !== 'confirmed') {
        if (sendsms && appt.phone) {
          const cleanPhone = appt.phone.replace(/\s+/g, '');
          fetch('/api/sms', { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ phone: cleanPhone, message: `Avdar: Dein Termin am ${finalDate} um ${finalTime} Uhr ist bestätigt!` }) }).catch(()=>{});
        }
        
        await addDoc(collection(db, 'alerts'), { userId: appt.userId, message: `${tAlert.confirmed1} ${finalDate} ${tCommon.at} ${finalTime} ${tAlert.confirmed2}`, isRead: false, link: 'profile', createdAt: Date.now() });
        await sendDualEmail(
          userEmail,
          "Avdar: Terminbestätigung",
          `Hallo ${appt.name},\n\nDein Termin am ${finalDate} um ${finalTime} Uhr bei ${appt.stylist} ist offiziell bestätigt!\n\nWir freuen uns auf dich.\nAvdar`,
          "Admin Info: Termin Bestätigt",
          `Der Termin für ${appt.name} am ${finalDate} um ${finalTime} Uhr wurde erfolgreich bestätigt.`
        );
        addNotification("Status aktualisiert & Bestätigungs-E-Mails gesendet!", 'success');
        
    } else if (status === 'cancelled' && appt.status !== 'cancelled') {
        await addDoc(collection(db, 'alerts'), { userId: appt.userId, message: `${tAlert.cancelled1} ${appt.date} ${tAlert.cancelled2}`, isRead: false, link: 'profile', createdAt: Date.now() });
        await sendDualEmail(
          userEmail,
          "Avdar: Terminabsage",
          `Hallo ${appt.name},\n\nLeider mussten wir deine Terminanfrage für den ${appt.date} um ${appt.time} Uhr stornieren (z.B. aufgrund von Überbuchungen oder Überschneidungen).\n\nBitte buche einen neuen Termin auf unserer Webseite.\n\nDein Avdar Team`,
          "Admin Info: Termin Storniert",
          `Der Termin für ${appt.name} am ${appt.date} um ${appt.time} Uhr wurde storniert.`
        );
        addNotification("Termin abgelehnt & Absage-E-Mail gesendet!", 'info');

    } else if (status === 'proposed' && appt.status !== 'proposed') {
        await addDoc(collection(db, 'alerts'), { userId: appt.userId, message: `${tAlert.proposed1} ${proposedDate} ${tCommon.at} ${proposedTime}. ${tAlert.proposed2}`, isRead: false, link: 'profile', createdAt: Date.now() });
        await sendDualEmail(
          userEmail,
          "Avdar: Terminvorschlag / Bitte bestätigen",
          `Hallo ${appt.name},\n\nWir mussten deinen Termin am ${appt.date} um ${appt.time} leider verschieben.\n\nWir schlagen stattdessen vor:\nNeues Datum: ${proposedDate}\nNeue Uhrzeit: ${proposedTime}\n\nBitte logge dich auf unserer Webseite in dein Profil ein, um diesen neuen Termin zu akzeptieren oder abzulehnen.\n\nDein Avdar Team`,
          "Admin Info: Termin verschoben (Kunde muss bestätigen)",
          `Du hast einen neuen Terminvorschlag an ${appt.name} gesendet. Neues Datum: ${proposedDate} um ${proposedTime} Uhr. Wartet auf Kundenbestätigung.`
        );
        addNotification("Neuer Termin vorgeschlagen & E-Mail an Kunden gesendet!", 'info');
        
    } else if (notes !== undefined) { 
      addNotification("Notizen gespeichert.", 'success'); 
    }
  };

  const addService = async (s: Omit<ServiceItem, 'id'>) => { await addDoc(collection(db, 'services'), s); addNotification("Added!", 'success'); };
  const deleteService = async (id: string) => { await deleteDoc(doc(db, 'services', id)); addNotification("Deleted.", 'info'); };
  
  const addProduct = async (p: Omit<ProductItem, 'id'>) => { await addDoc(collection(db, 'products'), p); addNotification("Added!", 'success'); };
  const deleteProduct = async (id: string) => { await deleteDoc(doc(db, 'products', id)); addNotification("Deleted.", 'info'); };
  
  const updateProductStock = async (id: string, newStock: number) => {
    if (!isAdminAuth) return;
    await updateDoc(doc(db, 'products', id), { stockCount: newStock });
  };

  // Phase 4 Stylist & Settings Updates
  const addStylist = async (s: Omit<StylistItem, 'id'>) => { await addDoc(collection(db, 'stylists'), s); addNotification("Stylist gespeichert!", 'success'); };
  const deleteStylist = async (id: string) => { await deleteDoc(doc(db, 'stylists', id)); addNotification("Stylist entfernt.", 'info'); };
  const updateGeneralSettings = async (settings: Partial<GeneralSettings>) => {
    if (!isAdminAuth) return;
    await updateDoc(doc(db, 'settings', 'general'), settings);
    addNotification("Einstellungen gespeichert!", 'success');
  };

  const t = translations[lang] || fallbackTranslations[lang] || fallbackTranslations.de;

  return (
    <AppContext.Provider value={{ 
      lang, setLang, changeLanguage, isTranslatingUI, page, setPage: setPageRouter, t, updateTranslation,
      isAdminAuth, currentUser, usersDB, clientNotesDB, updateUserNotes, loginOAuth, loginEmail, registerEmail, resetPassword, updateUserPassword, logout,
      servicesDB, addService, deleteService, productsDB, addProduct, deleteProduct, updateProductStock,
      appointments, addAppointment, addAdminAppointment, updateAppointmentStatus, notifications, addNotification, getAvailableSlots,
      waitlist, addToWaitlist, removeFromWaitlist, notifyWaitlist, resendConfirmation,
      stylistsDB, addStylist, deleteStylist, generalSettings, updateGeneralSettings,
      alerts, markAlertRead, clearAlerts
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}