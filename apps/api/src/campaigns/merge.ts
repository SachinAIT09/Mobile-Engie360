/** Values substituted into campaign copy for one recipient. */
export interface MergeContext {
  firstName: string;
  /** Incentive text for the campaign type (sign-up reward for offers, per-event reward for flex requests). */
  incentive: string;
  /** "5–8 PM" style label of the upcoming event window. */
  eventWindow: string;
  /** Slim Laden customers in the recipient's postcode district. */
  neighboursEnrolled: number;
  /** Current and advised monthly installment, formatted ("€ 185"). */
  installment?: string;
  advisedInstallment?: string;
}

export const MERGE_FIELDS = ['{first_name}', '{incentive}', '{event_window}', '{neighbours_enrolled}', '{installment}', '{advised_installment}'] as const;

/** Replace every merge field in `text` with the recipient's values. Unknown braces are left untouched. */
export function mergeFields(text: string, ctx: MergeContext): string {
  return text
    .replaceAll('{first_name}', ctx.firstName)
    .replaceAll('{incentive}', ctx.incentive)
    .replaceAll('{event_window}', ctx.eventWindow)
    .replaceAll('{neighbours_enrolled}', String(ctx.neighboursEnrolled))
    .replaceAll('{installment}', ctx.installment ?? '')
    .replaceAll('{advised_installment}', ctx.advisedInstallment ?? '');
}
