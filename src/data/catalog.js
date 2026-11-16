export const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';

export const SOURCES = [
  {
    name: 'EthioJobs',
    url: 'https://ethiojobs.net/jobs',
    pattern: String.raw`^https://ethiojobs\.net/jobs?/[^/]+`,
  },
  {
    name: 'GeezJobs',
    url: 'https://geezjobs.com/jobs-in-ethiopia',
    pattern: String.raw`^https://geezjobs\.com/job-detail/[^/]+`,
  },
  { name: 'HaHu Jobs', url: 'https://www.hahu.jobs/', pattern: null },
  { name: 'Ezega', url: 'https://www.ezega.com/Jobs', pattern: null },
  { name: 'EmployEthiopia', url: 'https://employethiopia.com/', pattern: null },
  { name: 'Ethiopian Reporter Jobs', url: 'https://www.ethiopianreporterjobs.com/', pattern: null },
];

export const LANGS = {
  am: { flag: '🇪🇹', name: 'አማርኛ' },
  en: { flag: '🇬🇧', name: 'English' },
  om: { flag: '🇪🇹', name: 'Afaan Oromoo' },
  ar: { flag: '🇸🇦', name: 'العربية' },
  so: { flag: '🇸🇴', name: 'Soomaali' },
  ti: { flag: '🇪🇹', name: 'ትግርኛ' },
};

export const CHOOSE_TEXT = [
  '👋 Choose your language to get job alerts',
  'ቋንቋዎን ይምረጡ',
  'Afaan kee filadhu',
  'اختر لغتك',
  'Dooro luqaddaada',
  'ቋንቋኻ ምረጽ',
].join('\n');

export const MODES = {
  std: { emoji: '🙂', label: 'Standard' },
  blind: { emoji: '👁️', label: 'Blind / low vision: plain text + voice message' },
  deaf: { emoji: '👂', label: 'Deaf / hard of hearing: visual cards, short text, no audio' },
};

const CATEGORY_ROWS = {
  it: ['💻', 'IT & Software', [
    String.raw`\bsoftware`, String.raw`\bdeveloper`, String.raw`\bprogrammer`, String.raw`\bit\b`,
    String.raw`\bict\b`, String.raw`\bnetwork`, String.raw`system admin`, String.raw`\bdatabase`,
    String.raw`\bdata (analyst|scientist|engineer)`, String.raw`cyber`, String.raw`\bweb\b`,
    String.raw`devops`, String.raw`help ?desk`, String.raw`\bui/?ux`, String.raw`\bqa\b`,
    String.raw`\btester`, String.raw`\bdigital`, String.raw`full ?stack`, String.raw`front ?end`,
    String.raw`back ?end`, String.raw`mobile app`,
  ]],
  acc: ['📊', 'Accounting & Finance', [
    String.raw`account`, String.raw`financ`, String.raw`audit`, String.raw`book ?keep`,
    String.raw`cashier`, String.raw`\bcasher`, String.raw`\btax\b`, String.raw`budget`,
    String.raw`treasury`, String.raw`payroll`, String.raw`\bcredit`,
  ]],
  eng: ['🏗️', 'Engineering & Construction', [
    String.raw`engineer`, String.raw`architect`, String.raw`surveyor`, String.raw`construction`,
    String.raw`site supervisor`, String.raw`quantity`, String.raw`foreman`, String.raw`technician`,
  ]],
  health: ['🏥', 'Health & Medical', [
    String.raw`nurs`, String.raw`doctor`, String.raw`physician`, String.raw`pharmac`,
    String.raw`clinic`, String.raw`laborator`, String.raw`midwi`, String.raw`health`,
    String.raw`medical`, String.raw`nutrition`, String.raw`surgeon`, String.raw`dental`,
    String.raw`radiolog`,
  ]],
  bank: ['🏦', 'Banking & Insurance', [
    String.raw`\bbank`, String.raw`branch`, String.raw`customer service`, String.raw`\bteller`,
    String.raw`insurance`, String.raw`\bloan`, String.raw`relationship manager`, String.raw`microfinance`,
  ]],
  sales: ['📈', 'Sales & Marketing', [
    String.raw`\bsales`, String.raw`marketing`, String.raw`\bbrand`, String.raw`business development`,
    String.raw`merchandis`, String.raw`promoter`, String.raw`social media`, String.raw`\bcontent`,
  ]],
  hr: ['👥', 'HR & Admin', [
    String.raw`human resource`, String.raw`\bhr\b`, String.raw`\badmin`, String.raw`secretar`,
    String.raw`receptionist`, String.raw`recruit`, String.raw`\boffice\b`,
  ]],
  ngo: ['🌍', 'NGO & Programs', [
    String.raw`\bprogram`, String.raw`\bproject`, String.raw`monitoring`, String.raw`\bmel\b`,
    String.raw`m&e`, String.raw`coordinator`, String.raw`humanitarian`, String.raw`protection`,
    String.raw`\bgrant`, String.raw`consultant`,
  ]],
  edu: ['🎓', 'Education', [
    String.raw`teacher`, String.raw`lecturer`, String.raw`instructor`, String.raw`professor`,
    String.raw`tutor`, String.raw`\bschool`, String.raw`trainer`,
  ]],
  logi: ['🚚', 'Logistics & Driving', [
    String.raw`\bdriver`, String.raw`logistic`, String.raw`procurement`, String.raw`supply chain`,
    String.raw`warehouse`, String.raw`store ?keeper`, String.raw`\bfleet`, String.raw`transport`,
  ]],
  legal: ['⚖️', 'Legal', [
    String.raw`\blegal`, String.raw`lawyer`, String.raw`attorney`, String.raw`\blaw\b`, String.raw`paralegal`,
  ]],
  design: ['🎨', 'Design & Media', [
    String.raw`designer`, String.raw`graphic`, String.raw`\bvideo`, String.raw`\beditor`,
    String.raw`photograph`, String.raw`animator`, String.raw`journalist`, String.raw`content creator`,
  ]],
  disab: ['♿', 'Disability-inclusive jobs', [
    String.raw`disabilit`, String.raw`\bpwd\b`, String.raw`inclusive`, String.raw`accessib`,
  ]],
};

export const CATEGORIES = Object.fromEntries(
  Object.entries(CATEGORY_ROWS).map(([key, [emoji, label]]) => [key, { emoji, label }]),
);

export const CATEGORY_MATCHERS = Object.fromEntries(
  Object.entries(CATEGORY_ROWS).map(([key, row]) => [key, new RegExp(row[2].join('|'), 'i')]),
);

export const LINKEDIN_KW = {
  it: 'software developer',
  acc: 'accountant',
  eng: 'engineer',
  health: 'nurse',
  bank: 'bank officer',
  sales: 'sales',
  hr: 'human resources',
  ngo: 'program officer',
  edu: 'teacher',
  logi: 'driver logistics',
  legal: 'legal officer',
  design: 'graphic designer',
  disab: 'disability inclusion',
};

export const NLLB_CODES = {
  am: 'amh_Ethi',
  om: 'gaz_Latn',
  ar: 'arb_Arab',
  so: 'som_Latn',
  ti: 'tir_Ethi',
};

export const ADDIS_LANGS = new Set(['am', 'om', 'ti', 'so']);
export const ADDIS_VOICES = { am: 'am-hamen', om: 'om-bikila', ti: 'ti-berhane' };
export const EDGE_VOICES = {
  en: 'en-US-AriaNeural',
  ar: 'ar-SA-ZariyahNeural',
  am: 'am-ET-MekdesNeural',
  so: 'so-SO-UbaxNeural',
};

export const P_MODE = 'How should I send you jobs? Pick the option that works best for you.';
export const P_CATS = 'Choose the job types you want (tap to select), then press Done. If you choose nothing, you get all jobs.';
export const P_DONE = 'All set! New jobs will arrive about every 2 hours. Type /help to see all commands.';

export const HELP = [
  ['/start', 'Set up the bot'],
  ['/language', 'Change language'],
  ['/categories', 'Choose job types'],
  ['/mode', 'Accessibility: blind / deaf support'],
  ['/jobs', 'Show the latest jobs now'],
  ['/linkedin', 'LinkedIn search links'],
  ['/stop', 'Unsubscribe'],
];

export const GENERIC = /^(new|featured|hot|urgent|apply( now)?|view details?.*|read more|more|details?|share|save|top featured opportunity|priority hiring|see all|view all.*)$/i;
export const NAV_BLOCK = /(login|signin|sign-in|signup|sign-up|register|about|contact|privacy|terms|categor|compan|employer|blog|news|tag\/|\/tags?\/|salary|service|faq|help|cv-|resume|pricing|page\/\d|feed|\.(jpg|png|pdf|webp|css|js)$)/i;
export const JOBISH = /(job|vacanc|career|position|detail|opening|apply|post)/i;
