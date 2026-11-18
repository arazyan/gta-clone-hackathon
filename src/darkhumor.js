// Dark comedy layer: satire as pressure valve.
// Institutions get roasted, mortality gets defanged, shared suffering builds solidarity.
import { S, say } from './state.js';
import { hud } from './hud.js';

// --- Disarming fear: death & tragedy reduced to paperwork & punchlines ---
export const HOSPITAL_BILLS = [
  'American Healthcare System: treated 47 gunshot wounds and a tank explosion for $100. You keep your rocket launcher.',
  'St. Fiacre Hospital: "You died on the operating table. We revived you. That\'s a separate charge."',
  'Medical bill itemized: bullet removal $40, existential dread $800, parking $12.',
  'Hospital: "Good news: you\'re alive. Bad news: your insurance considers resurrection a pre-existing condition."',
  'Discharge note: "Patient reports being run over by a train. Diagnosis: Monday."',
  'Hospital gift shop: "Get Well Soon" balloons, $35. The "Soon" is doing a lot of work.',
];

// --- Exposing hypocrisy: institutions say the quiet part loud ---
export const DISPATCH_LINES = [
  'Dispatch: "All units, suspect is dangerous. Remember: protect and serve... the revenue stream."',
  'Dispatch: "Use of force authorized. Paperwork optional. Bodycams are a premium subscription."',
  'Dispatch: "Be advised, suspect has rights. Technically. In theory. Somewhere in the fine print."',
  'Dispatch: "Units in pursuit, remember the motto: To Protect, To Serve, To Bill."',
  'Dispatch: "Suspect fled into a hospital. Do not pursue — that\'s a different jurisdiction and a bigger lawsuit."',
  'Dispatch: "Reminder: qualified immunity covers everything except feelings."',
];

export const COP_BARKS = [
  'Cop: "Stop resisting! ...You\'re not resisting? Stop doing that too!"',
  'Cop: "I became a cop to help people. Then I saw the pension plan."',
  'Cop: "Sir, do you know why I pulled you over? Honestly, neither do I. Quotas."',
  'Cop: "Freeze! ...Unless you\'re a donor. Then, mild freeze."',
];

// --- Solidarity: shared hardship, gallows humor between the crew ---
export const SOLIDARITY_BANTER = [
  ['Trevor', 'You know what bonds two men, Michael? Surviving the same Tuesday.'],
  ['Michael', 'I pay a therapist $300 an hour to say what you say for free, Trevor.'],
  ['Trevor', 'That\'s because I\'m not licensed. Neither is the therapist, probably.'],
  ['Franklin', 'Man, this city tries to kill us every week and still charges us rent.'],
  ['Lamar', 'That\'s the hustle, fool. Death is just a late fee.'],
  ['Smoke', 'CJ, when the bullets fly, I eat. When the eating stops, THEN I worry.'],
  ['CJ', 'Smoke, that\'s the most terrifying life philosophy I ever heard.'],
  ['Smoke', 'It\'s called coping, homie. Pass the dip.'],
  ['Michael', 'Nine years in witness protection and the first thing I see is a tank. Some things never change.'],
  ['Trevor', 'That\'s the beauty of it, Mikey. The chaos is the only honest thing left.'],
];

// --- Challenging taboos: the absurdity nobody says out loud ---
export const BILLBOARDS = [
  'LIFEINVADER\n"We mourn your data. Premium tier mourns harder."',
  'ST. FIACRE HOSPITAL\n"Because dying is free. Everything else isn\'t."',
  'BOBCAT SECURITY\n"Our guards look away so you don\'t have to."',
  'PAY \'N\' SPRAY\n"New paint. New identity. Same warrants."',
  'PREMIUM DELUXE\n"28% APR. Reading the contract is racist."',
  'CLUCKIN\' BELL\n"14,500 kcal. Your cardiologist\'s job security."',
  'LSPD RECRUITING\n"Serve your community. Some assembly required."',
  'iFRUIT\n"Planned obsolescence, unplanned explosions."',
];

// --- Catharsis popups during chaos ---
export const CHAOS_NOTIFS = [
  'Therapist unavailable. Ramming a hydrant is now your coping mechanism. ($0, unlike therapy)',
  'Achievement: Emotional Catharsis — processed 3 repressed feelings via vehicular manslaughter of a lamppost.',
  'Your grief has been monetized. Lifeinvader sold your sadness to 14 advertisers.',
  'Solidarity +1: every pedestrian you scared is also just trying to survive the shift.',
  'The news will call this "a tragedy". The group chat will call it "content". Both are coping.',
];

let banterIdx = 0, chaosIdx = 0, dispatchIdx = 0;

export function randomHospitalBill() {
  return HOSPITAL_BILLS[Math.floor(Math.random() * HOSPITAL_BILLS.length)];
}
export function dispatchBark() {
  if (S.wanted > 0 && Math.random() < 0.5) {
    say('Dispatch', DISPATCH_LINES[dispatchIdx++ % DISPATCH_LINES.length], 4);
  }
}
export function solidarityBanter() {
  const [who, line] = SOLIDARITY_BANTER[banterIdx++ % SOLIDARITY_BANTER.length];
  say(who, line, 4.2);
}
export function chaosNotif() {
  hud.notify(CHAOS_NOTIFS[chaosIdx++ % CHAOS_NOTIFS.length]);
}

// periodic ambient satire while playing
let ambientT = 25;
export function updateDarkHumor(dt) {
  ambientT -= dt;
  if (ambientT <= 0) {
    ambientT = 30 + Math.random() * 25;
    const roll = Math.random();
    if (S.wanted > 0 && roll < 0.45) dispatchBark();
    else if (roll < 0.75) solidarityBanter();
    else chaosNotif();
  }
}