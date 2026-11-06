# Juristische Gliederung für RemNote

Normale Stichpunkte sind der Standard. Nur dort, wo du **Gutachten: ab hier einschalten** verwendest, beginnt die juristische Gliederung **A. → I. → 1. → a) → aa) → (1)**. **Gutachten: ab hier ausschalten** beendet den Stil ab dem aktuellen Punkt; der Gutachtenteil davor bleibt erhalten.

## Bedienung ab Version 0.2.0

1. Setze den Textcursor in den ersten Stichpunkt, der zum Gutachten gehören soll. Das darf auch eine neue, noch leere Zeile sein.
2. Öffne die RemNote-Befehlssuche und wähle **Gutachten: ab hier einschalten**. Dieser Punkt ist der Start. Alles darüber bleibt unverändert.
3. Schreibe weiter. Enter fügt weitere Punkte hinzu; Tab und Shift+Tab wechseln die Gliederungsebene. Auch neue Punkte innerhalb des Abschnitts werden automatisch nummeriert.
4. Wenn du fertig bist, erstelle die erste Zeile für normale Notizen. Wähle dort **Gutachten: ab hier ausschalten**. Schon diese Zeile und die folgenden Punkte bleiben normal. Der bisherige Gutachtenteil bleibt formatiert.

Beispiel:

```text
• Normale Notiz
A. Erster Prüfungspunkt        ← hier einschalten
   I. Unterpunkt
      1. Weiterer Unterpunkt
B. Zweiter Prüfungspunkt
• Wieder normale Notizen      ← hier ausschalten
```

Du kannst in einem Dokument mehrere Gutachtenteile anlegen. Jeder neue Start beginnt wieder bei A. Ohne Stopp gilt der Stil bis zum Ende dieses Dokuments. Die Grenzen sind an die jeweiligen Stichpunkte gebunden und folgen deren Position. Wird ein Start- oder Stopp-Punkt gelöscht oder verschoben, verändert sich entsprechend der Bereich. Verschachtelte Dokumente sind eigenständig: Sie übernehmen den Modus nicht.

## Weitere Befehle

- **Gutachten: Grenze hier entfernen** entfernt einen versehentlich gesetzten Start oder Stopp am Punkt mit Textcursor.
- **Gutachten: Fließtext ein/aus** schaltet innerhalb eines Gutachtens die Nummer des aktuellen Absatzes aus oder wieder ein. Seine Unterpunkte führen die umgebende Zählung fort.
- **Gutachten: Nummerierung aktualisieren** berechnet die Anzeige neu.

Die Befehle arbeiten am Punkt mit Textcursor. Es wird kein gesamtes Dokument oder ein Ordner als Standardeinstellung eingeschaltet. Zum Beenden immer den ersten Punkt verwenden, der wieder ein normaler Stichpunkt sein soll.

## Wechsel von Version 0.1.x

Die früheren Aktivierungen ganzer Dokumente oder Ordner werden nicht automatisch übernommen. Nach dem Update sind zunächst normale Stichpunkte sichtbar; lege die gewünschten Gutachtenteile mit Start und Stopp neu fest. Alte Plugin-Einstellungen bleiben in ihrem bisherigen Speicher erhalten. Fließtext-Markierungen werden übernommen. Notiztexte werden nicht verändert.

## Darstellung und Grenzen

Die Nummerierung wird aus der gespeicherten Hierarchie berechnet und bleibt damit unabhängig vom Ein- und Ausklappen oder Scrollen. Leere Zeilen und Fließtext sind für die Zählung transparent. Eigenschaften und Codeblöcke werden ausgelassen. Unterhalb der sechsten Gliederungsebene bleiben die normalen Aufzählungszeichen erhalten.

Die zusätzlichen Nummern sind reine Anzeige-Präfixe; beim Kopieren oder Textexport werden sie nicht automatisch Teil des Textes. Verwende den eigenen Fließtext-Befehl, wenn ein Gutachtenabsatz keine Nummer erhalten soll; RemNotes `/no bullet` wird vom SDK nicht als Ausnahme ausgelesen.

## Datenschutz und Berechtigungen

Die Erweiterung benötigt Leserechte zur Berechnung der Hierarchie. Start-/Stopp-Grenzen und Fließtext-Markierungen liegen im synchronisierten Plugin-Speicher. Der eigene Code sendet keine Notizen an externe Dienste und schreibt keine Notiztexte um. Dieses Repository enthält nur Programmdateien, keine persönlichen Notizen oder Zugangsdaten.

## Version und Prüfung

Version 0.1.2 wurde von RemNote freigegeben. Version 0.2.0 ändert die Bedienung auf abschnittsweise Start-/Stopp-Grenzen und muss als neues Paket eingereicht werden. Die neue Bedienung wurde mit dem SDK in automatisierten Tests geprüft; ein direkter Test in der RemNote-App steht für diese Version noch aus. Mobile Unterstützung ist weiterhin deaktiviert und ungetestet.

`node test-plugin.cjs` prüft die bisherigen Gliederungsfälle, Start und Stopp, unveränderte Punkte oberhalb und unterhalb, neue Punkte innerhalb eines Abschnitts, mehrere Abschnitte, verschachtelte Dokumente, Fließtext, Hineinzoomen, alte Konfigurationen, Befehle ohne gültigen Punkt und Neustart. Es werden synthetische Testdaten verwendet.

`python3 build.py` erstellt die Bundles aus den enthaltenen Bibliotheken und Quelldateien und erzeugt `RemNote-Plugin.zip` für RemNote.

## Paketstruktur

`plugin.js`: Befehle und RemNote-SDK-Anbindung. `numbering.js`: Berechnung und CSS. `index.js` und `index-sandbox.js`: erzeugte Laufzeitdateien. Enthaltene Bibliotheken: React/ReactDOM 17.0.2 und @remnote/plugin-sdk 0.0.46. Siehe THIRD-PARTY-LICENSES.txt.

Die Erweiterung wird als nicht öffentlich gelistetes Plugin bereitgestellt. Dokumentation: https://plugins.remnote.com/advanced/unlisted_plugins
