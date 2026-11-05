/**
 * QPay invoice hook.
 * TODO(qpay): when QPAY_USERNAME, QPAY_PASSWORD and QPAY_INVOICE_CODE are set,
 * create a real invoice (merchant.qpay.mn). Do not invent credentials.
 * Until that call is wired, every payment is an explicit demo stub.
 */
export function qpayConfigured(): boolean {
  return Boolean(
    process.env.QPAY_USERNAME &&
      process.env.QPAY_PASSWORD &&
      process.env.QPAY_INVOICE_CODE,
  );
}

export type QpayInvoice = {
  stub: true;
  configured: boolean;
  invoice_id: string;
  amount: number;
  message: string;
};

export async function createQpayInvoice(input: {
  amount: number;
  rideId: string;
}): Promise<QpayInvoice> {
  const configured = qpayConfigured();
  // TODO(qpay): POST the invoice with the env credentials above and return the QR payload.
  return {
    stub: true,
    configured,
    invoice_id: `stub-${input.rideId.slice(0, 8)}`,
    amount: input.amount,
    message: configured
      ? "QPay түлхүүр байна, гэхдээ нэхэмжлэх хараахан холбогдоогүй — туршилтын төлбөр."
      : "QPay түлхүүр тохируулаагүй — туршилтын төлбөр.",
  };
}
