import { Injectable } from '@nestjs/common';
import type { PaymentMethodKind } from '@engie/shared';

export interface ChargeResult {
  confirmationNo: string;
  provider: 'IDEAL_MOCK';
}

/**
 * Payment boundary. Production would redirect to an iDEAL checkout from ENGIE's payment provider;
 * the demo never sees or stores bank details.
 */
export abstract class PaymentProvider {
  abstract charge(input: { amount: number; method: PaymentMethodKind; reference: string }): Promise<ChargeResult>;
}

@Injectable()
export class MockIdealProvider extends PaymentProvider {
  async charge(): Promise<ChargeResult> {
    const n = Math.floor(10_000_000 + Math.random() * 89_999_999);
    return { confirmationNo: `ID-${n}`, provider: 'IDEAL_MOCK' };
  }
}
