# Juristische Gliederung für RemNote

Persönliche RemNote-Erweiterung für die Ebenen **A. → I. → 1. → a) → aa) → (1)**.

## Funktionen

- Je Dokument oder Ordner einschalten; Dokumente in aktivierten Ordnern übernehmen die Gliederung.
- Nummern werden aus der gespeicherten Hierarchie berechnet, unabhängig von sichtbaren Bildschirmzeilen.
- Absätze lassen sich als unnummerierter Fließtext markieren.
- Punkte unter leeren Zeilen oder Fließtext-Absätzen führen die Zählung der umgebenden Ebene fort, sodass keine Gliederungsnummer doppelt erscheint.
- Die Originaltexte bleiben unverändert. Die Nummern sind eine Anzeige-Ergänzung und werden beim Kopieren oder Textexport nicht automatisch zu Text.

## Bedienung

Öffne in RemNote ein Dokument oder einen Ordner. Suche in der Befehlssuche nach **Gutachten: hier einschalten**.

Weitere Befehle:

- **Gutachten: hier ausschalten** entfernt die Aktivierung am geöffneten Dokument oder Ordner.
- **Gutachten: Fließtext ein/aus** schaltet die Nummerierung für den Absatz mit Textcursor um.
- **Gutachten: Nummerierung aktualisieren** berechnet die Anzeige erneut.

Enter erstellt weitere Punkte. Tab und Shift+Tab wechseln die Einrückungsebene. Jeder neue Zweig beginnt mit seiner eigenen Zählung.

## Unterstützte Umgebungen

Die lokale Version wurde in der RemNote-Desktop-App mit einer Testgliederung verwendet. Mobile Unterstützung ist noch nicht aktiviert oder direkt getestet. Eigenschaften und Codeblöcke werden ausgelassen. Für unnummerierten Text den eigenen Fließtext-Befehl verwenden; die Bedeutung von RemNotes `/no bullet` wird nicht über die SDK-Daten ausgelesen. Unterhalb der sechsten Gliederungsebene bleiben die normalen Aufzählungszeichen erhalten.

## Datenschutz und Berechtigungen

Die Erweiterung benötigt Leserechte, um die Notizhierarchie zu berechnen. Aktivierungen und Fließtext-Markierungen werden im synchronisierten Plugin-Speicher abgelegt. Notiztexte werden nicht verändert. Der eigene Erweiterungscode sendet keine Notizen an externe Dienste. React und das offizielle RemNote-SDK sind enthalten.

Dieses Repository enthält ausschließlich Programmdateien, keine persönlichen RemNote-Notizen, Exporte oder Zugangsdaten.

## Paketstruktur

`plugin.js` enthält die SDK-Anbindung; `numbering.js` die Berechnung und Darstellung. `index.js` und `index-sandbox.js` enthalten die zusammengestellten Laufzeitdateien. Die HTML-Datei startet die Sandbox-Version. Die enthaltenen Bibliotheken sind React/ReactDOM 17.0.2 und @remnote/plugin-sdk 0.0.46; siehe THIRD-PARTY-LICENSES.txt.

## Einreichungsstatus

Die Erweiterung ist für eine Einreichung als nicht öffentlich gelistetes RemNote-Plugin vorbereitet. Sie wurde noch nicht von RemNote geprüft oder freigegeben. Die lokale Testversion ist funktionsfähig; eine Installation aus dem RemNote-Marktplatz setzt die Freigabe voraus.

Nach Freigabe durch RemNote kann die Erweiterung ohne lokalen Helfer installiert werden. `unlisted: true` verhindert die Auflistung im Marktplatz. Das Repository enthält den für die Prüfung benötigten Quellcode.

## Technische Prüfung

`node test-plugin.cjs` prüft die Nummerierung, Zähler-Neustarts, Umordnen, Ordnervererbung, leere Absätze, Fließtext, Hineinzoomen, Verschieben, Abschalten und die Manifest-Validierung. Die Prüfung lädt ausschließlich die mitgelieferten Bibliotheken und arbeitet mit synthetischen Daten.

Die gebündelten Dateien lassen sich mit `python3 build.py` aus den enthaltenen Laufzeitbibliotheken und Quelldateien neu erstellen. Das resultierende `RemNote-Plugin.zip` enthält die zur Einreichung nötigen Dateien.

Dokumentation: https://plugins.remnote.com/advanced/unlisted_plugins
