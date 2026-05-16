import { customAlphabet } from 'nanoid';

const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);

export const newSessionId = () => `ses_${nano()}`;
export const newTurnId = () => `tur_${nano()}`;
export const newAnalysisId = () => `ana_${nano()}`;
export const newEventId = () => `evt_${nano()}`;
export const newNoteId = () => `nte_${nano()}`;
export const newEscalationId = () => `esc_${nano()}`;
export const newFeedbackId = () => `fbk_${nano()}`;