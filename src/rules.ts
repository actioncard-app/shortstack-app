export const RULES = [
  { id: 'nudity', title: 'No nudity or sexual content', why: 'Keeps the app safe to open anywhere, and keeps minors from being exploited.' },
  { id: 'harassment', title: 'No harassment, bullying or hate', why: 'Attacks on people for who they are (race, religion, sex, disability, veteran status, where they come from) drive real people off the app.' },
  { id: 'violence', title: 'No threats or graphic violence', why: 'Threats can turn into real harm; gore traumatizes viewers who did not choose to see it.' },
  { id: 'dangerous', title: 'No dangerous stunts or challenges', why: 'People copy what they see. We do not want anyone hurt for views.' },
  { id: 'scams', title: 'No scams, spam or fake giveaways', why: 'Scams steal money from viewers, often older folks and veterans.' },
  { id: 'stolen', title: 'Post only what you made or have rights to', why: 'Reposting other people\'s work takes money and credit from the real creator.' },
  { id: 'privacy', title: 'No sharing private info', why: 'Addresses, phone numbers or IDs of other people can get them hurt.' },
  { id: 'minors', title: '18+ only, and no minors in unsafe content', why: 'This first version is adults-only. Children need extra protection we have not built yet.' },
] as const
export const ruleTitle = (id: string) => RULES.find(r => r.id === id)?.title ?? id
