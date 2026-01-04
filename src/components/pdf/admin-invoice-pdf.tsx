import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatCurrency, formatDate } from '@/lib/formatters';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 18,
  },
  label: {
    fontSize: 9,
    color: '#555',
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #ddd',
    paddingVertical: 6,
  },
  tableHeader: {
    fontWeight: 'bold',
    backgroundColor: '#f2f2f2',
  },
  cell: {
    flex: 1,
    paddingHorizontal: 4,
    fontSize: 9,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 6,
  },
  footer: {
    marginTop: 20,
    fontSize: 8,
    color: '#666',
  },
});

interface AdminInvoicePDFProps {
  invoice: {
    number: string;
    status: string;
    issued_at: string;
  };
  org: {
    name: string;
    billing_email?: string;
    vat_number?: string;
    country_code?: string;
  };
  payment: {
    amount_cents: number;
    currency: string;
    stripe_invoice_id?: string;
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

export function AdminInvoicePDF({
  invoice,
  org,
  payment,
  items,
  subtotal_cents,
  vat_rate,
  vat_amount_cents,
  total_cents,
}: AdminInvoicePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Invoice</Text>
            <Text style={styles.label}>Invoice number</Text>
            <Text>{invoice.number}</Text>
          </View>
          <View>
            <Text style={styles.label}>Issued</Text>
            <Text>{formatDate(invoice.issued_at)}</Text>
            <Text style={[styles.label, { marginTop: 6 }]}>Status</Text>
            <Text>{invoice.status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Bill to</Text>
          <Text>{org.name}</Text>
          {org.billing_email && <Text>{org.billing_email}</Text>}
          {org.vat_number && (
            <Text>
              VAT: {org.vat_number}
              {org.country_code ? ` (${org.country_code})` : ''}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Items</Text>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.cell, { flex: 2 }]}>Description</Text>
            <Text style={[styles.cell, { flex: 0.4 }]}>Qty</Text>
            <Text style={[styles.cell, { flex: 0.6 }]}>Unit</Text>
            <Text style={[styles.cell, { flex: 0.6 }]}>Total</Text>
          </View>
          {items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.cell, { flex: 2 }]}>{item.description}</Text>
              <Text style={[styles.cell, { flex: 0.4 }]}>{item.quantity}</Text>
              <Text style={[styles.cell, { flex: 0.6 }]}>
                {formatCurrency(item.unit_price_cents, payment.currency)}
              </Text>
              <Text style={[styles.cell, { flex: 0.6 }]}>
                {formatCurrency(item.total_cents, payment.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.totalsRow}>
            <Text style={[styles.cell, { flex: 2 }]}>Subtotal</Text>
            <Text style={[styles.cell, { flex: 0.6 }]}>
              {formatCurrency(subtotal_cents, payment.currency)}
            </Text>
          </View>
          {vat_rate !== undefined && vat_amount_cents !== undefined && (
            <View style={styles.totalsRow}>
              <Text style={[styles.cell, { flex: 2 }]}>VAT ({vat_rate}%)</Text>
              <Text style={[styles.cell, { flex: 0.6 }]}>
                {formatCurrency(vat_amount_cents, payment.currency)}
              </Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={[styles.cell, { flex: 2, fontSize: 11 }]}>Total</Text>
            <Text style={[styles.cell, { flex: 0.6, fontSize: 11 }]}>
              {formatCurrency(total_cents, payment.currency)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Payment</Text>
          <Text>
            Amount: {formatCurrency(payment.amount_cents, payment.currency)}
          </Text>
          {payment.stripe_invoice_id && <Text>Stripe invoice: {payment.stripe_invoice_id}</Text>}
        </View>

        <View style={styles.footer}>
          <Text>Generated by ClipRace admin.</Text>
        </View>
      </Page>
    </Document>
  );
}
