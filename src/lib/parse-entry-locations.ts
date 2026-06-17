/** Bekannte Orte im Einsatzgebiet – für KI-Prompt (phonetische Korrektur). */
export const LOCATION_CORRECTION_PROMPT = `
=== ORTSNAMEN (phonetische Korrektur) ===
Sitz: Filsum, Samtgemeinde Jümme, Landkreis Leer, Ostfriesland.
Korrigiere Ortsnamen in notes/reminders NUR bei klarer phonetischer Nähe zu einem dieser Orte.
Bei unklaren Fällen ohne erkennbare Nähe: unverändert übernehmen, NICHT raten.
Der Nutzer prüft im Bestätigungsschritt selbst.

Filsum (Sitz) und direkte Ortsteile:
Filsum, Ammersum, Brückenfehn, Busboomsfehn, Lammertsfehn, Stallbrüggerfeld

Samtgemeinde Jümme (direkte Nachbargemeinden von Filsum):
Detern, Nortmoor

Samtgemeinde Hesel (nördlich angrenzend):
Hesel, Holtland, Holtland-Nücke, Siebestock, Brinkum, Firrel, Neukamperfehn, Schwerinsdorf, Hasselt

Weitere Gemeinden Landkreis Leer:
Leer, Borkum, Weener, Bunde, Jemgum, Moormerland (Ortsteile: Warsingsfehn, Jheringsfehn, Veenhusen, Neermoor), Uplengen, Westoverledingen

Rhauderfehn / Ostrhauderfehn (Overledingerland, Ortsteile):
Rhauderfehn, Westrhauderfehn, Ostrhauderfehn, Backemoor, Holte, Burlage, Collinghorst, Klostermoor, Rhaude, Rhaudermoor, Schatteburg, Langholt, Idafehn, Potshausen, Ihrhove, Holterfehn, Holtermoor

Angrenzende Landkreise/größere Orte (Überführungen/Krematorium-Fahrten):
Aurich, Emden, Wittmund, Papenburg, Apen, Barßel

Beispiele klarer phonetischer Korrektur:
"Vilsheim" → "Filsum", "Molmerland"/"Moermland" → "Moormerland", "Reuderfehn"/"Reuther Fehn" → "Rhauderfehn", "Osterhauderfehn" → "Ostrhauderfehn".
Bei Unsicherheit: Original aus Transkript beibehalten.
`.trim();
