import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Entry } from "@/lib/types";
import { formatGermanDateShort } from "@/lib/time";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 12 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, paddingBottom: 6, marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd", paddingVertical: 4 },
  cellDate: { width: "14%" },
  cellTime: { width: "10%" },
  cellType: { width: "16%" },
  cellName: { width: "18%" },
  cellNotes: { width: "32%" },
  footer: { marginTop: 12, fontSize: 12 },
  bold: { fontWeight: "bold" },
});

function formatHoursDE(h: number) {
  const n = Number.isFinite(h) ? h : 0;
  return n.toFixed(2).replace(".", ",");
}

export function EntriesPdfDoc({
  monthLabel,
  entries,
  totalHours,
  showNotes = true,
}: {
  monthLabel: string;
  entries: Entry[];
  totalHours: number;
  showNotes?: boolean;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Zeiterfassung – Export {monthLabel}</Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.cellDate, styles.bold]}>Datum</Text>
          <Text style={[styles.cellTime, styles.bold]}>Von</Text>
          <Text style={[styles.cellTime, styles.bold]}>Bis</Text>
          <Text style={[styles.cellType, styles.bold]}>Art</Text>
          <Text style={[styles.cellName, styles.bold]}>Name</Text>
          {showNotes ? <Text style={[styles.cellNotes, styles.bold]}>Notizen</Text> : null}
        </View>

        {entries.map((e) => (
          <View key={e.id} style={styles.row}>
            <Text style={styles.cellDate}>{formatGermanDateShort(e.date)}</Text>
            <Text style={styles.cellTime}>{e.startTime}</Text>
            <Text style={styles.cellTime}>{e.endTime}</Text>
            <Text style={styles.cellType}>{(e.categories ?? []).join(", ")}</Text>
            <Text style={styles.cellName}>{String(e.name ?? "")}</Text>
            {showNotes ? <Text style={styles.cellNotes}>{String(e.notes ?? "")}</Text> : null}
          </View>
        ))}

        <Text style={styles.footer}>
          Summe Stunden: <Text style={styles.bold}>{formatHoursDE(totalHours)}</Text>
        </Text>
      </Page>
    </Document>
  );
}

