/*
Composant PDF pour exporter les résultats d'un concours
Utilise @react-pdf/renderer
*/
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatCurrency, formatDate } from '@/lib/formatters';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottom: '2 solid #000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
    borderBottom: '1 solid #ccc',
    paddingBottom: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  statBox: {
    width: '48%',
    marginRight: '2%',
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  statLabel: {
    fontSize: 9,
    color: '#666',
    marginBottom: 3,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  table: {
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #ddd',
    paddingVertical: 8,
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    paddingVertical: 10,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 5,
    fontSize: 9,
  },
  winnerRow: {
    backgroundColor: '#fff9e6',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
    borderTop: '1 solid #ddd',
    paddingTop: 10,
  },
});

interface ContestResultsPDFProps {
  contest: {
    title: string;
    start_at: string;
    end_at: string;
    prize_pool_cents: number;
    currency: string;
    brand_name?: string;
  };
  metrics: {
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    approved_submissions: number;
    total_submissions: number;
  };
  leaderboard: Array<{
    rank: number;
    creator_name: string;
    total_views: number;
    total_likes: number;
    estimated_payout_cents: number;
  }>;
  dailyViews: Array<{ date: string; views: number }>;
  cpv: number;
}

export function ContestResultsPDF({
  contest,
  metrics,
  leaderboard,
  dailyViews,
  cpv,
}: ContestResultsPDFProps) {
  const generatedAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.title}>Rapport de Concours</Text>
          <Text style={styles.subtitle}>{contest.title}</Text>
          <Text style={styles.subtitle}>
            {formatDate(contest.start_at)} → {formatDate(contest.end_at)}
          </Text>
          {contest.brand_name && (
            <Text style={styles.subtitle}>Marque: {contest.brand_name}</Text>
          )}
        </View>

        {/* Statistiques globales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiques Globales</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Vues totales</Text>
              <Text style={styles.statValue}>{metrics.total_views.toLocaleString()}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Engagement</Text>
              <Text style={styles.statValue}>{metrics.total_likes.toLocaleString()} likes</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Soumissions approuvées</Text>
              <Text style={styles.statValue}>{metrics.approved_submissions}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Coût pour 1000 vues (CPV)</Text>
              <Text style={styles.statValue}>
                {cpv > 0 ? formatCurrency(cpv, contest.currency) : '—'}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Commentaires</Text>
              <Text style={styles.statValue}>{metrics.total_comments.toLocaleString()}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Partages</Text>
              <Text style={styles.statValue}>{metrics.total_shares.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Classement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Classement Final</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { flex: 0.5 }]}>Rang</Text>
              <Text style={styles.tableCell}>Créateur</Text>
              <Text style={styles.tableCell}>Vues</Text>
              <Text style={styles.tableCell}>Likes</Text>
              <Text style={styles.tableCell}>Gain estimé</Text>
            </View>
            {leaderboard.slice(0, 20).map((entry) => (
              <View
                key={entry.creator_name}
                style={[styles.tableRow, entry.rank <= 3 ? styles.winnerRow : {}]}
              >
                <Text style={[styles.tableCell, { flex: 0.5 }]}>{entry.rank}</Text>
                <Text style={styles.tableCell}>{entry.creator_name || 'Anonyme'}</Text>
                <Text style={styles.tableCell}>{entry.total_views.toLocaleString()}</Text>
                <Text style={styles.tableCell}>{entry.total_likes.toLocaleString()}</Text>
                <Text style={styles.tableCell}>
                  {formatCurrency(entry.estimated_payout_cents, contest.currency)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Évolution des vues (7 derniers jours) */}
        {dailyViews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Évolution des Vues (7 derniers jours)</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={styles.tableCell}>Date</Text>
                <Text style={styles.tableCell}>Vues</Text>
              </View>
              {dailyViews.map((day) => (
                <View key={day.date} style={styles.tableRow}>
                  <Text style={styles.tableCell}>
                    {new Date(day.date).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                  <Text style={styles.tableCell}>{day.views.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Rapport généré le {generatedAt} par ClipRace</Text>
          <Text>Prize pool: {formatCurrency(contest.prize_pool_cents, contest.currency)}</Text>
        </View>
      </Page>
    </Document>
  );
}

