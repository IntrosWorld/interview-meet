export function localPrompt(target: string) {
  return `You interview for ${target || 'a job'}. Reply with one brief follow-up question about the last answer, maximum 25 words. Be professional. No markdown.`;
}
export const localOptions = { num_ctx: 2048, num_predict: 60, temperature: .4 };
