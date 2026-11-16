// @ts-check
/** Shared domain contracts. Dates in persisted records remain ISO strings; FSRS uses Date only in memory.
 * @typedef {'shaky'|'unknown'|'mastered'} MarkState
 * @typedef {{state: MarkState, at: number}} Mark
 * @typedef {{text: string, at: number}} Note
 * @typedef {{id: number, at: number, state: MarkState|null}} HistoryEntry
 * @typedef {Omit<import('ts-fsrs').Card, 'due'|'last_review'|'learning_steps'> & {due: string, last_review?: string, learning_steps?: number}} Card
 * @typedef {{id: string, review: string, rating?: number, mark?: MarkState, state?: number, due?: string, stability?: number, difficulty?: number, scheduled_days?: number}} ReviewLog
 * @typedef {{card: Card, logs: ReviewLog[]}} SrsEntry
 * @typedef {'single'|'multiple'} ViewMode
 * @typedef {85|100|115|130} FontScale
 * @typedef {'read'|'review'|'records'|'sync'|'offline'|'about'} SettingSection
 * @typedef {{favorites: number[], marks: Record<string, Mark>, srs: Record<string, SrsEntry>, retention: number, retentionAt: number, updated: Record<string, number>, history: HistoryEntry[], notes: Record<string, Note>}} Progress
 * @typedef {Omit<Progress, 'retention'> & {retention?: number}} MergedProgress
 * @typedef {Progress & {mode: ViewMode, fontScale: FontScale, collapsed: boolean, setSec: SettingSection, open: Record<string, boolean>}} Rec
 * @typedef {{id: number, year: number, number: number, score: number|null, source: string, categories: string[], tags: string[], hasFigure: boolean, stem: string, pdfPage: number|string|null, contributor?: string, search: string}} Question
 * @typedef {{answer: string, explanation: string, notes: string, originalImages: {src: string, w: number}[], answerPdfPages: string|number|null, errataLevel?: string}} QuestionDetail
 * @typedef {{id: string, name: string, questionIds: number[], categoryByQuestion: Record<string, string[]>}} QuestionList
 * @typedef {{subject: string, source: string, topicOrder: string[], years: number[], lists: QuestionList[], questions: Question[]}} Library
 */
export {};
