export function formatXOF(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  CARD: 'Carte',
  CREDIT: 'Crédit',
};
