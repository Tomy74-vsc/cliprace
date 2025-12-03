/*
Composant PDF pour générer une facture
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
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flex: 1,
    textAlign: 'right',
  },
  logo: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#666',
    marginTop: 10,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  billingInfo: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  billingBox: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f5f5f5',
    marginRight: 10,
    borderRadius: 4,
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
  totalRow: {
    backgroundColor: '#f9f9f9',
    fontWeight: 'bold',
    paddingVertical: 12,
    marginTop: 10,
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
  notes: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    fontSize: 9,
  },
});

interface InvoicePDFProps {
  invoice: {
    number: string;
    issued_at: string;
    due_date?: string;
  };
  brand: {
    company_name: string;
    address?: string;
    vat_number?: string;
  };
  contest: {
    title: string;
    id: string;
  };
  payment: {
    amount_cents: number;
    currency: string;
    stripe_payment_intent_id?: string;
    created_at: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unit_price_cents: number;
    total_cents: number;
  }>;
  subtotal_cents: number;
  vat_rate?: number;
  vat_amount_cents?: number;
  total_cents: number;
}

export function InvoicePDF({
  invoice,
  brand,
  contest,
  payment,
  items,
  subtotal_cents,
  vat_rate,
  vat_amount_cents,
  total_cents,
}: InvoicePDFProps) {
  const generatedAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>ClipRace</Text>
            <Text style={styles.sectionTitle}>Facture</Text>
            <Text style={styles.invoiceNumber}>N° {invoice.number}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.sectionTitle}>Date d'émission</Text>
            <Text>{formatDate(invoice.issued_at)}</Text>
            {invoice.due_date && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Date d'échéance</Text>
                <Text>{formatDate(invoice.due_date)}</Text>
              </>
            )}
          </View>
        </View>

        {/* Informations de facturation */}
        <View style={styles.billingInfo}>
          <View style={styles.billingBox}>
            <Text style={styles.sectionTitle}>Facturer à</Text>
            <Text>{brand.company_name}</Text>
            {brand.address && <Text>{brand.address}</Text>}
            {brand.vat_number && <Text>TVA: {brand.vat_number}</Text>}
          </View>
          <View style={styles.billingBox}>
            <Text style={styles.sectionTitle}>Émetteur</Text>
            <Text>ClipRace</Text>
            <Text>Plateforme UGC</Text>
            <Text>contact@cliprace.com</Text>
          </View>
        </View>

        {/* Détails de la facture */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détails</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>Description</Text>
              <Text style={[styles.tableCell, { flex: 0.3 }]}>Quantité</Text>
              <Text style={[styles.tableCell, { flex: 0.4 }]}>Prix unitaire</Text>
              <Text style={[styles.tableCell, { flex: 0.4 }]}>Total</Text>
            </View>
            {items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{item.description}</Text>
                <Text style={[styles.tableCell, { flex: 0.3 }]}>{item.quantity}</Text>
                <Text style={[styles.tableCell, { flex: 0.4 }]}>
                  {formatCurrency(item.unit_price_cents, payment.currency)}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.4 }]}>
                  {formatCurrency(item.total_cents, payment.currency)}
                </Text>
              </View>
            ))}
          </View>

          {/* Totaux */}
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>Sous-total HT</Text>
              <Text style={[styles.tableCell, { flex: 0.4 }]}>
                {formatCurrency(subtotal_cents, payment.currency)}
              </Text>
            </View>
            {vat_rate && vat_amount_cents && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>TVA ({vat_rate}%)</Text>
                <Text style={[styles.tableCell, { flex: 0.4 }]}>
                  {formatCurrency(vat_amount_cents, payment.currency)}
                </Text>
              </View>
            )}
            <View style={[styles.tableRow, styles.totalRow]}>
              <Text style={[styles.tableCell, { flex: 2, fontSize: 12 }]}>Total TTC</Text>
              <Text style={[styles.tableCell, { flex: 0.4, fontSize: 12 }]}>
                {formatCurrency(total_cents, payment.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Informations de paiement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de paiement</Text>
          <View style={styles.notes}>
            <Text>Concours: {contest.title}</Text>
            <Text>Date de paiement: {formatDate(payment.created_at)}</Text>
            {payment.stripe_payment_intent_id && (
              <Text>Référence Stripe: {payment.stripe_payment_intent_id}</Text>
            )}
            <Text>Statut: Payé</Text>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.notes}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text>
            Cette facture a été générée automatiquement suite au paiement du concours "{contest.title}".
          </Text>
          <Text style={{ marginTop: 5 }}>
            Pour toute question, contactez-nous à contact@cliprace.com
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Facture générée le {generatedAt} par ClipRace</Text>
          <Text>Merci pour votre confiance !</Text>
        </View>
      </Page>
    </Document>
  );
}

