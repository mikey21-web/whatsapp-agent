// Queue token constants. Kept in their own file (not queue.module.ts) so that
// processors.service.ts can import them without creating a circular import
// with queue.module.ts (which itself imports Processors). The previous cycle
// caused the constants to evaluate to `undefined` at decorator-evaluation
// time, so @Inject(Q_OUTBOUND) became @Inject(undefined) and Nest could not
// resolve the dependency.
export const Q_INBOUND = 'inbound-messages';
export const Q_OUTBOUND = 'outbound-messages';
export const Q_CAMPAIGN = 'campaign-broadcasts';
