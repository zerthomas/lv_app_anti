# 🔧 Antigravity Prompt: LV-Monteur-App
## Kompletter Prompt für Google Antigravity + Firebase

---

## SCHRITT 1: Firebase initialisieren

Sage in Antigravity:

```
Initialisiere Firebase in meinem aktuellen Projekt. 
Ich brauche:
- Firestore Database
- Firebase Authentication (Email/Passwort)
- Firebase Hosting
```

---

## SCHRITT 2: LV-Daten importieren

Nachdem Firebase eingerichtet ist, sage:

```
Importiere die Datei "lv_positionen.json" in meine Firestore-Datenbank.
Collection Name: "lv_positionen"
Document ID: position_nr (Punkte durch Unterstriche ersetzen, z.B. "1_1_10")

Jedes Dokument hat diese Felder:
- position_nr (String): z.B. "1.1.10"
- hauptgruppe (String): z.B. "1. Sanitär"
- untergruppe (String): z.B. "1.1. WC-Anlagen"
- kurztext (String): Positionstitel
- beschreibung (String): Vollständige Beschreibung
- menge (Number)
- mengeneinheit (String): "Stk", "m", "psch", "h", "km"
- einheitspreis (Number): Preis in EUR
- gesamtbetrag (Number)
- seite (Number): Seitennummer im Original-PDF
- suchtext (String): Kombinierter Text lowercase für Suche
- aktiv (Boolean): true
- lv_name (String): "Heizung-Sanitär 2025/2026"

Erstelle auch ein Array-Feld "suchwoerter" mit den einzelnen Wörtern
aus suchtext (min. 3 Zeichen, lowercase, max 40 Wörter) für 
array-contains Queries.
```

---

## SCHRITT 3: Die App bauen (HAUPT-PROMPT)

Hier der große Prompt – kopiere ihn komplett in Antigravity:

```
Baue eine Web-App "LV-Assistent" für ein Facility-Management-Unternehmen.

## Kontext
Monteure fahren zu Liegenschaften und führen Heizungs-/Sanitär-Reparaturen durch.
Sie notieren, was sie gemacht haben (z.B. "Waschtisch erneuert, neuen Syphon montiert").
Die Büro-Mitarbeiterinnen müssen dann die passenden LV-Positionen (Leistungsverzeichnis) 
finden und die Rechnung erstellen.

Die App soll den Monteur-Text automatisch mit den 408 LV-Positionen in der 
Firestore-Datenbank abgleichen und passende Positionen vorschlagen.

## Tech-Stack
- React mit TypeScript
- Tailwind CSS für Styling
- Firebase Auth (Email/Passwort)
- Firestore als Datenbank
- Firebase Hosting für Deployment

## Nutzerrollen
1. **Monteur**: Kann Erfassungen erstellen
2. **Büro**: Kann Erfassungen sehen, LV-Zuordnungen bestätigen/korrigieren

## Datenmodell (Firestore Collections)

### Collection: lv_positionen (bereits vorhanden, 408 Dokumente)
- position_nr, hauptgruppe, untergruppe, kurztext, beschreibung
- einheitspreis, mengeneinheit, suchtext, suchwoerter[], aktiv

### Collection: monteur_erfassungen (neu erstellen)
- id: auto-generiert
- monteur_uid: String (Firebase Auth UID)
- monteur_name: String
- liegenschaft: String (Adresse/Name der Liegenschaft)
- wohneinheit: String (optional, z.B. "3. OG links")
- freitext: String (was der Monteur beschreibt)
- fotos: String[] (optional, URLs zu hochgeladenen Fotos)
- erfasst_am: Timestamp
- status: "neu" | "zugeordnet" | "abgerechnet"

### Collection: erfassung_positionen (neu erstellen)
- id: auto-generiert
- erfassung_id: String (Referenz auf monteur_erfassungen)
- lv_position_nr: String (z.B. "1.2.10")
- lv_kurztext: String
- lv_einheitspreis: Number
- lv_mengeneinheit: String
- menge: Number (wie oft/wie viel wurde gemacht)
- gesamtbetrag: Number (menge × einheitspreis)
- automatisch_zugeordnet: Boolean
- manuell_bestaetigt: Boolean (false bis Büro bestätigt)

## Screens / Views

### 1. Login-Screen
- Email/Passwort Login
- Einfach und sauber

### 2. Monteur-Erfassungs-Screen (Hauptscreen für Monteure)
- Header: "Neue Erfassung"
- Eingabefelder:
  - Liegenschaft (Text, Pflicht)
  - Wohneinheit (Text, optional)
  - Beschreibung der Arbeit (großes Textfeld, Pflicht)
    Placeholder: "z.B. Waschtisch 60cm erneuert, neuen Röhrensyphon montiert, 
    2x Eckventil getauscht"
- Button: "🔍 LV-Positionen suchen"
- Ergebnisbereich:
  - Zeigt vorgeschlagene LV-Positionen als Karten:
    - Positionsnummer (fett)
    - Kurztext
    - Einheitspreis + Mengeneinheit
    - Mengen-Eingabefeld (Standard: 1)
    - Toggle: "Übernehmen" (grün) / "Nicht relevant" (grau)
  - Gesamtbetrag unten anzeigen
- Button: "✅ Erfassung absenden"

### 3. Meine Erfassungen (Monteur-Übersicht)
- Liste aller eigenen Erfassungen
- Status-Badge: 🟡 Neu | 🟢 Zugeordnet | ✅ Abgerechnet
- Tap öffnet Detail-Ansicht

### 4. Büro-Dashboard (für Büro-Mitarbeiter)
- Übersicht aller offenen Erfassungen (Status: "neu")
- Filter nach: Liegenschaft, Monteur, Datum
- Jede Erfassung zeigt:
  - Monteur-Name, Liegenschaft, Datum
  - Freitext des Monteurs
  - Vorgeschlagene LV-Positionen
  - Für jede Position: Bestätigen ✅ oder Ablehnen ❌
  - Möglichkeit, manuell weitere LV-Positionen hinzuzufügen
    (mit Suchfeld über alle 408 Positionen)
  - Gesamtbetrag der bestätigten Positionen
- Button: "Als zugeordnet markieren"

### 5. LV-Übersicht (Nachschlagewerk)
- Durchsuchbare Liste aller 408 LV-Positionen
- Gruppiert nach Hauptgruppen (Sanitär, Heizung, Gas, etc.)
- Klappbare Untergruppen
- Suchfeld mit Echtzeit-Filter
- Jede Position zeigt: Nr, Kurztext, Preis, ME

## Such-Logik (WICHTIG!)

Die Suche über LV-Positionen soll so funktionieren:

1. Monteur-Text in einzelne Wörter aufteilen
2. Stoppwörter entfernen (der, die, das, und, in, etc.)
3. Jedes relevante Wort gegen die Firestore Collection "lv_positionen" suchen:
   - Zuerst: Exakte Treffer im Feld "suchwoerter" (array-contains-any)
   - Dann: Teilstring-Matching auf "suchtext" (client-seitig filtern)
4. Ergebnisse nach Relevanz sortieren (mehr Wort-Treffer = höher)
5. Top 10-15 Ergebnisse anzeigen

Beispiel:
Monteur schreibt: "Waschtisch 60cm erneuert, neuen Röhrensyphon chrom montiert, 
2 Eckventile getauscht"
→ App findet:
  - 1.2.10 Waschtischanlage 60-50 cm (211,21€)
  - 1.6.30 Röhren-Geruchsverschluss, chrom (46,45€)
  - 1.6.60 Eckventil 1/2" (36,30€) × Menge: 2

## Design
- Mobile-first (Monteure nutzen Handy!)
- Sauberes, modernes Design
- Farben: Weiß/Hellgrau Background, Türkis (#009B9B) als Akzentfarbe 
  (angelehnt an GWH Corporate Design)
- Große Touch-Targets für Monteure mit Handschuhen
- Klare Typografie, gute Lesbarkeit

## Firestore Security Rules
- LV-Positionen: Alle authentifizierten Nutzer können lesen
- Monteur-Erfassungen: Ersteller kann lesen/erstellen, Büro kann alles
- Erfassung-Positionen: Alle authentifizierten Nutzer können lesen/schreiben

## Sonstiges
- Deutsche Sprache überall in der UI
- Beträge in Euro-Format: 1.234,56 €
- Responsive: Funktioniert auf Handy UND Desktop
- Keine externen APIs nötig - alles läuft über Firestore
```

---

## SCHRITT 4: Testen und Deployen

```
Teste die App im Browser:
1. Erstelle 2 Test-Nutzer in Firebase Auth (monteur@test.de und buero@test.de)
2. Simuliere eine Monteur-Erfassung mit dem Text: 
   "WC-Anlage komplett erneuert, wandhängend, neuen Spülkasten Geberit montiert, 
   WC-Sitz weiß"
3. Prüfe ob die richtigen LV-Positionen vorgeschlagen werden
4. Deploye die App auf Firebase Hosting
```

---

## SCHRITT 5 (Optional): Verbesserungen

```
Füge folgende Features hinzu:
1. Push-Benachrichtigung an Büro wenn neue Erfassung eingeht
2. PDF-Export der abgerechneten Erfassungen
3. Foto-Upload für Monteure (Firebase Storage)
4. Offline-Fähigkeit (Monteure haben nicht immer Netz im Keller)
5. Statistik-Dashboard: Häufigste LV-Positionen, Umsatz pro Monteur/Liegenschaft
```

---

## Zusammenfassung der benötigten Dateien

| Datei | Zweck |
|-------|-------|
| `lv_positionen.json` | Die 408 extrahierten LV-Positionen |
| `import_to_firestore.js` | Import-Skript (oder Antigravity macht es direkt) |
| Antigravity Prompt oben | Baut die komplette App |

## Ablauf

```
1. Antigravity installieren (antigravity.google/download)
2. Firebase MCP Server in Antigravity installieren 
   (Agent Interface → MCP Servers → Firebase → Install)
3. "Initialisiere Firebase" sagen
4. lv_positionen.json importieren (manuell oder über Antigravity)
5. Haupt-Prompt einfügen → App wird gebaut
6. Testen → Deployen → Fertig! 🎉
```
