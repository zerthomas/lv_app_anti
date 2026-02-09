/**
 * ============================================================
 * Firebase Firestore Import-Skript für LV-Positionen
 * GWH Heizung/Sanitär 2025/2026
 * ============================================================
 * 
 * ANLEITUNG:
 * 1. Firebase-Projekt erstellen: https://console.firebase.google.com
 * 2. Firestore-Datenbank erstellen (Production Mode)
 * 3. Service Account Key herunterladen:
 *    Firebase Console → Projekteinstellungen → Dienstkonten → Neuen privaten Schlüssel generieren
 * 4. Die JSON-Datei als "serviceAccountKey.json" im selben Ordner speichern
 * 5. npm install firebase-admin
 * 6. node import_to_firestore.js
 * 
 * ALTERNATIV in Antigravity:
 * Einfach sagen: "Importiere die lv_positionen.json in meine Firestore-Datenbank"
 * Der Agent macht den Rest!
 */

const admin = require('firebase-admin');
const fs = require('fs');

// ============================================================
// KONFIGURATION - Hier anpassen!
// ============================================================
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';
const LV_JSON_PATH = './lv_positionen.json';
const COLLECTION_NAME = 'lv_positionen';
const BATCH_SIZE = 500; // Firestore erlaubt max 500 pro Batch

// ============================================================
// INITIALISIERUNG
// ============================================================
const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ============================================================
// IMPORT-FUNKTION
// ============================================================
async function importLVPositionen() {
  console.log('🔧 LV-Import nach Firestore');
  console.log('='.repeat(60));

  // JSON laden
  const rawData = fs.readFileSync(LV_JSON_PATH, 'utf8');
  const positionen = JSON.parse(rawData);
  console.log(`📖 ${positionen.length} Positionen geladen`);

  // In Batches aufteilen
  const batches = [];
  let currentBatch = db.batch();
  let batchCount = 0;
  let totalCount = 0;

  for (const pos of positionen) {
    // Document ID = Positionsnummer (z.B. "1.1.10")
    const docId = pos.position_nr.replace(/\./g, '_'); // Firestore mag keine Punkte in IDs
    const docRef = db.collection(COLLECTION_NAME).doc(docId);

    // Daten für Firestore aufbereiten
    const firestoreData = {
      position_nr: pos.position_nr,
      hauptgruppe: pos.hauptgruppe || '',
      untergruppe: pos.untergruppe || '',
      kurztext: pos.kurztext || '',
      beschreibung: pos.beschreibung || '',
      menge: pos.menge || 0,
      mengeneinheit: pos.mengeneinheit || '',
      einheitspreis: pos.einheitspreis || 0,
      gesamtbetrag: pos.gesamtbetrag || 0,
      seite: pos.seite || 0,
      // Suchfelder (lowercase für Suche)
      suchtext: pos.suchtext || '',
      suchwoerter: generateSuchwoerter(pos), // Array für array-contains Queries
      // Metadata
      lv_name: 'Heizung-Sanitär 2025/2026',
      aktiv: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    currentBatch.set(docRef, firestoreData, { merge: true });
    batchCount++;
    totalCount++;

    if (batchCount >= BATCH_SIZE) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      batchCount = 0;
    }
  }

  // Letzten Batch hinzufügen
  if (batchCount > 0) {
    batches.push(currentBatch);
  }

  // Alle Batches ausführen
  console.log(`\n💾 Schreibe ${totalCount} Dokumente in ${batches.length} Batches...`);
  
  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`   ✅ Batch ${i + 1}/${batches.length} geschrieben`);
  }

  console.log(`\n✅ Import abgeschlossen: ${totalCount} Positionen in Firestore!`);

  // Zusammenfassung
  console.log('\n📊 Zusammenfassung:');
  const gruppen = {};
  for (const pos of positionen) {
    const hg = pos.hauptgruppe || 'Unbekannt';
    gruppen[hg] = (gruppen[hg] || 0) + 1;
  }
  for (const [name, count] of Object.entries(gruppen)) {
    console.log(`   ${name}: ${count} Positionen`);
  }
}

/**
 * Erzeugt ein Array von Suchwörtern für Firestore array-contains Queries.
 * Ermöglicht schnelle Textsuche ohne externe Suchengine.
 */
function generateSuchwoerter(pos) {
  const text = [
    pos.position_nr,
    pos.kurztext,
    pos.beschreibung,
    pos.hauptgruppe,
    pos.untergruppe,
    pos.mengeneinheit
  ].join(' ').toLowerCase();

  // Wörter extrahieren, Duplikate entfernen, kurze Wörter filtern
  const woerter = [...new Set(
    text
      .replace(/[^a-zäöüß0-9\s\/\-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3)
  )];

  // Max 40 Wörter (Firestore-Limit für array-contains)
  return woerter.slice(0, 40);
}

// ============================================================
// FIRESTORE SECURITY RULES (zum Kopieren in Firebase Console)
// ============================================================
const SECURITY_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // LV-Positionen: Jeder authentifizierte Nutzer kann lesen
    match /lv_positionen/{positionId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
        && request.auth.token.admin == true;
    }
    
    // Monteur-Erfassungen: Monteure können erstellen, Büro kann alles
    match /monteur_erfassungen/{erfassungId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null 
        && (request.auth.uid == resource.data.monteur_uid 
            || request.auth.token.buero == true);
    }
    
    // Zugeordnete Positionen
    match /erfassung_positionen/{zuordnungId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
`;

// ============================================================
// FIRESTORE INDEXES (für die Composite Queries)
// ============================================================
const INDEXES_JSON = {
  "indexes": [
    {
      "collectionGroup": "lv_positionen",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "aktiv", "order": "ASCENDING" },
        { "fieldPath": "hauptgruppe", "order": "ASCENDING" },
        { "fieldPath": "position_nr", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "lv_positionen",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "aktiv", "order": "ASCENDING" },
        { "fieldPath": "untergruppe", "order": "ASCENDING" },
        { "fieldPath": "einheitspreis", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "monteur_erfassungen",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "erfasst_am", "order": "DESCENDING" }
      ]
    }
  ]
};

// Export für Antigravity-Nutzung
module.exports = { importLVPositionen, generateSuchwoerter, SECURITY_RULES, INDEXES_JSON };

// Ausführen
importLVPositionen().catch(console.error);
