import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class PromoCodesService {
    static async validateCode(code: string, taskPriceFils: number) {
        const promo = await prisma.promoCode.findUnique({ where: { code }});

        if (!promo) return { valid: false, reason: 'Invalid promo code' };
        
        if (promo.expiresAt && promo.expiresAt < new Date()) {
            return { valid: false, reason: 'Promo code expired' };
        }

        if (promo.maxUses && promo.usesCount >= promo.maxUses) {
            return { valid: false, reason: 'Promo code reached max uses' };
        }

        let discountFils = 0;
        if (promo.discountType === 'FIXED_AMOUNT') {
            discountFils = promo.discountValue;
        } else if (promo.discountType === 'PERCENTAGE') {
            discountFils = Math.floor(taskPriceFils * (promo.discountValue / 100));
        }

        // Cannot discount more than the task price
        discountFils = Math.min(discountFils, taskPriceFils);

        return {
            valid: true,
            discount_fils: discountFils,
            final_amount_fils: taskPriceFils - discountFils
        };
    }
}
