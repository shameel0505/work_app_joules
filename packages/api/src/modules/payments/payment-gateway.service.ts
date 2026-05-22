// When PAYMENT_SIMULATION=true (always in dev)
export class PaymentGatewayService {
    static async createPaymentIntent(amount_fils: number, ref_id: string) {
        // Simulate slight delay
        await new Promise(resolve => setTimeout(resolve, 50));
        return { gateway_ref: `SIM_${Date.now()}`, status: "pending", payment_url: null };
    }

    static async capturePayment(gateway_ref: string) {
        // Always succeeds in simulation
        await new Promise(resolve => setTimeout(resolve, 50));
        return { status: "completed", captured_at: new Date() };
    }

    static async refundPayment(gateway_ref: string, amount_fils: number) {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { status: "refunded" };
    }
}
