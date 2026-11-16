/**
 * Pak Tenders seed.
 *
 * Seeds ONLY:
 *  - reference data (provinces, cities, categories, departments, sources)
 *  - RBAC roles + permissions
 *  - subscription plans and AI usage limits
 *  - platform settings, integration placeholders, app configurations
 *  - knowledge base articles
 *  - one bootstrap Super Admin (credentials from env)
 *  - clearly flagged DEMO tenders (isDemo = true, verification = DEMO) and
 *    original resource articles.
 *
 * Demo tenders exist so the UI and API can be exercised end-to-end before real
 * source integrations are licensed. They are visibly badged and can be removed
 * with `pnpm db:purge-demo`. They are NOT real procurement notices.
 *
 * Idempotent: safe to re-run.
 */
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { hashPassword } from "@paktenders/passwords";
import { PrismaClient, type Prisma } from "@prisma/client";

loadDotenv({ path: resolve(__dirname, "../../.env") });
loadDotenv();

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@paktenders.pk";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!PakTenders2026";
const SEED_DEMO = (process.env.SEED_DEMO_DATA ?? "true") === "true";

/* -------------------------------------------------------------------------- */
/* Reference data                                                             */
/* -------------------------------------------------------------------------- */

const provinces = [
  { name: "Punjab", slug: "punjab", code: "PK-PB" },
  { name: "Sindh", slug: "sindh", code: "PK-SD" },
  { name: "Khyber Pakhtunkhwa", slug: "khyber-pakhtunkhwa", code: "PK-KP" },
  { name: "Balochistan", slug: "balochistan", code: "PK-BA" },
  { name: "Islamabad Capital Territory", slug: "islamabad", code: "PK-IS" },
  { name: "Azad Jammu & Kashmir", slug: "ajk", code: "PK-AK" },
  { name: "Gilgit-Baltistan", slug: "gilgit-baltistan", code: "PK-GB" },
];

const cities: Record<string, Array<{ name: string; slug: string; major?: boolean }>> = {
  punjab: [
    { name: "Lahore", slug: "lahore", major: true },
    { name: "Rawalpindi", slug: "rawalpindi", major: true },
    { name: "Faisalabad", slug: "faisalabad", major: true },
    { name: "Multan", slug: "multan", major: true },
    { name: "Gujranwala", slug: "gujranwala", major: true },
    { name: "Sialkot", slug: "sialkot", major: true },
    { name: "Bahawalpur", slug: "bahawalpur", major: true },
    { name: "Sargodha", slug: "sargodha" },
    { name: "Sheikhupura", slug: "sheikhupura" },
    { name: "Rahim Yar Khan", slug: "rahim-yar-khan" },
    { name: "Dera Ghazi Khan", slug: "dera-ghazi-khan" },
  ],
  sindh: [
    { name: "Karachi", slug: "karachi", major: true },
    { name: "Hyderabad", slug: "hyderabad", major: true },
    { name: "Sukkur", slug: "sukkur", major: true },
    { name: "Larkana", slug: "larkana" },
    { name: "Shaheed Benazirabad", slug: "shaheed-benazirabad" },
    { name: "Mirpur Khas", slug: "mirpur-khas" },
  ],
  "khyber-pakhtunkhwa": [
    { name: "Peshawar", slug: "peshawar", major: true },
    { name: "Abbottabad", slug: "abbottabad", major: true },
    { name: "Mardan", slug: "mardan", major: true },
    { name: "Mingora (Swat)", slug: "swat", major: true },
    { name: "Kohat", slug: "kohat" },
    { name: "Dera Ismail Khan", slug: "dera-ismail-khan" },
    { name: "Bannu", slug: "bannu" },
    { name: "Mansehra", slug: "mansehra" },
    { name: "Haripur", slug: "haripur" },
  ],
  balochistan: [
    { name: "Quetta", slug: "quetta", major: true },
    { name: "Gwadar", slug: "gwadar", major: true },
    { name: "Khuzdar", slug: "khuzdar" },
    { name: "Turbat", slug: "turbat" },
    { name: "Sibi", slug: "sibi" },
  ],
  islamabad: [{ name: "Islamabad", slug: "islamabad", major: true }],
  ajk: [
    { name: "Muzaffarabad", slug: "muzaffarabad", major: true },
    { name: "Mirpur", slug: "mirpur", major: true },
    { name: "Rawalakot", slug: "rawalakot" },
  ],
  "gilgit-baltistan": [
    { name: "Gilgit", slug: "gilgit", major: true },
    { name: "Skardu", slug: "skardu", major: true },
    { name: "Hunza", slug: "hunza" },
  ],
};

const categories = [
  { name: "Construction and Civil Engineering", slug: "construction-civil-engineering", icon: "HardHat", description: "Buildings, roads, bridges, irrigation and civil works contracts." },
  { name: "IT and Technology", slug: "it-technology", icon: "Cpu", description: "Software, hardware, networking, data and digital transformation projects." },
  { name: "Medical and Healthcare", slug: "medical-healthcare", icon: "Stethoscope", description: "Medical equipment, medicines, hospital supplies and health services." },
  { name: "Solar and Renewable Energy", slug: "solar-renewable-energy", icon: "Sun", description: "Solar systems, net metering, wind and other renewable energy procurements." },
  { name: "Electrical and Electronics", slug: "electrical-electronics", icon: "Zap", description: "Electrical works, switchgear, transformers, cabling and electronics." },
  { name: "Mechanical and Industrial Equipment", slug: "mechanical-industrial-equipment", icon: "Cog", description: "Machinery, plant, workshop equipment and industrial spares." },
  { name: "Office Supplies and Stationery", slug: "office-supplies-stationery", icon: "Paperclip", description: "Stationery, consumables, furniture and general office supplies." },
  { name: "Food and Catering", slug: "food-catering", icon: "UtensilsCrossed", description: "Food supply, catering, mess services and rations." },
  { name: "Transportation and Logistics", slug: "transportation-logistics", icon: "Truck", description: "Vehicle hire, freight, warehousing and logistics services." },
  { name: "Consultancy and Professional Services", slug: "consultancy-professional-services", icon: "Briefcase", description: "Design, supervision, audit, legal and management consultancy." },
  { name: "Education and Training", slug: "education-training", icon: "GraduationCap", description: "Teaching, training, books, labs and education services." },
  { name: "Agriculture and Livestock", slug: "agriculture-livestock", icon: "Sprout", description: "Seeds, fertiliser, farm machinery, livestock and irrigation." },
  { name: "Security and Safety", slug: "security-safety", icon: "ShieldCheck", description: "Security services, fire safety, CCTV and protective equipment." },
  { name: "Cleaning and Maintenance", slug: "cleaning-maintenance", icon: "Sparkles", description: "Janitorial services, facility maintenance and waste management." },
  { name: "Telecommunications", slug: "telecommunications", icon: "RadioTower", description: "Telecom equipment, fibre, bandwidth and communication services." },
  { name: "Water and Environment", slug: "water-environment", icon: "Droplets", description: "Water supply, sanitation, treatment plants and environmental works." },
  { name: "Printing and Publishing", slug: "printing-publishing", icon: "Printer", description: "Printing, binding, publishing and promotional material." },
  { name: "Insurance and Financial Services", slug: "insurance-financial-services", icon: "Landmark", description: "Insurance cover, banking, audit and financial advisory services." },
  { name: "Textile and Clothing", slug: "textile-clothing", icon: "Shirt", description: "Uniforms, fabrics, linen and textile supplies." },
  { name: "NGO and Development Projects", slug: "ngo-development-projects", icon: "HeartHandshake", description: "Development programmes, grants and non-profit procurement." },
  { name: "Real Estate and Property", slug: "real-estate-property", icon: "Building2", description: "Property rental, land, leasing and estate services." },
  { name: "Auctions and Disposal", slug: "auctions-disposal", icon: "Gavel", description: "Public auctions, surplus disposal and scrap sales." },
  { name: "Other Services and Supplies", slug: "other-services-supplies", icon: "Package", description: "Other goods, works and services not covered above." },
];

const authorities = [
  { name: "Public Procurement Regulatory Authority (PPRA)", slug: "ppra", website: "https://www.ppra.org.pk", province: null },
  { name: "Sindh Public Procurement Regulatory Authority (SPPRA)", slug: "sppra", website: "https://www.sppra.gos.pk", province: "sindh" },
  { name: "Khyber Pakhtunkhwa Public Procurement Regulatory Authority (KPPRA)", slug: "kppra", website: "https://kppra.gov.pk", province: "khyber-pakhtunkhwa" },
  { name: "Balochistan Public Procurement Regulatory Authority (BPPRA)", slug: "bppra", website: "https://bppra.gob.pk", province: "balochistan" },
  { name: "Punjab Procurement Regulatory Authority (PPRA Punjab)", slug: "ppra-punjab", website: "https://ppra.punjab.gov.pk", province: "punjab" },
  { name: "AJK Public Procurement Regulatory Authority (AJK PPRA)", slug: "ajk-ppra", website: "https://ajkppra.gov.pk", province: "ajk" },
  { name: "Gilgit-Baltistan Public Procurement Regulatory Authority (GB PPRA)", slug: "gb-ppra", website: "https://gbppra.gov.pk", province: "gilgit-baltistan" },
];

const newspapers = [
  { name: "Jang", slug: "jang", website: "https://jang.com.pk" },
  { name: "Dawn", slug: "dawn", website: "https://www.dawn.com" },
  { name: "The Express Tribune", slug: "express-tribune", website: "https://tribune.com.pk" },
  { name: "Business Recorder", slug: "business-recorder", website: "https://www.brecorder.com" },
  { name: "Nawa-i-Waqt", slug: "nawa-i-waqt", website: "https://www.nawaiwaqt.com.pk" },
];

const departments = [
  { name: "Pakistan Public Works Department", shortName: "Pak PWD", slug: "pakistan-public-works-department", type: "FEDERAL", province: "islamabad", city: "islamabad", website: "https://www.pakpwd.gov.pk" },
  { name: "Water and Power Development Authority", shortName: "WAPDA", slug: "wapda", type: "FEDERAL", province: "islamabad", city: "islamabad", website: "https://www.wapda.gov.pk" },
  { name: "National Highway Authority", shortName: "NHA", slug: "national-highway-authority", type: "FEDERAL", province: "islamabad", city: "islamabad", website: "https://nha.gov.pk" },
  { name: "Capital Development Authority", shortName: "CDA", slug: "capital-development-authority", type: "FEDERAL", province: "islamabad", city: "islamabad", website: "https://www.cda.gov.pk" },
  { name: "Pakistan Railways", shortName: "PR", slug: "pakistan-railways", type: "FEDERAL", province: "punjab", city: "lahore", website: "https://www.pakrail.gov.pk" },
  { name: "Pakistan Post", shortName: "Pakistan Post", slug: "pakistan-post", type: "FEDERAL", province: "islamabad", city: "islamabad", website: "https://www.pakpost.gov.pk" },
  { name: "National Database and Registration Authority", shortName: "NADRA", slug: "nadra", type: "FEDERAL", province: "islamabad", city: "islamabad", website: "https://www.nadra.gov.pk" },
  { name: "Higher Education Commission", shortName: "HEC", slug: "higher-education-commission", type: "FEDERAL", province: "islamabad", city: "islamabad", website: "https://www.hec.gov.pk" },
  { name: "Pakistan Institute of Medical Sciences", shortName: "PIMS", slug: "pims-islamabad", type: "FEDERAL", province: "islamabad", city: "islamabad", website: "https://www.pims.gov.pk" },
  { name: "Punjab Public Works Department", shortName: "Punjab PWD", slug: "punjab-pwd", type: "PROVINCIAL", province: "punjab", city: "lahore", website: "https://pwd.punjab.gov.pk" },
  { name: "Punjab Health Department", shortName: "PHD", slug: "punjab-health-department", type: "PROVINCIAL", province: "punjab", city: "lahore", website: "https://health.punjab.gov.pk" },
  { name: "Punjab School Education Department", shortName: "SED Punjab", slug: "punjab-school-education-department", type: "PROVINCIAL", province: "punjab", city: "lahore", website: "https://sed.punjab.gov.pk" },
  { name: "Punjab Information Technology Board", shortName: "PITB", slug: "pitb", type: "PUBLIC_SECTOR", province: "punjab", city: "lahore", website: "https://pitb.gov.pk" },
  { name: "Lahore Waste Management Company", shortName: "LWMC", slug: "lahore-waste-management-company", type: "PUBLIC_SECTOR", province: "punjab", city: "lahore", website: "https://lwmc.com.pk" },
  { name: "Sindh Works and Services Department", shortName: "SWSD", slug: "sindh-works-services", type: "PROVINCIAL", province: "sindh", city: "karachi", website: "https://works.sindh.gov.pk" },
  { name: "Sindh Health Department", shortName: "SHD", slug: "sindh-health-department", type: "PROVINCIAL", province: "sindh", city: "karachi", website: "https://health.sindh.gov.pk" },
  { name: "Sindh Information Technology Board", shortName: "SITB", slug: "sindh-it-board", type: "PUBLIC_SECTOR", province: "sindh", city: "karachi" },
  { name: "Karachi Water and Sewerage Board", shortName: "KW&SB", slug: "karachi-water-board", type: "PUBLIC_SECTOR", province: "sindh", city: "karachi", website: "https://www.kwsb.gos.pk" },
  { name: "Khyber Pakhtunkhwa Communication and Works Department", shortName: "C&W KP", slug: "kp-communication-works", type: "PROVINCIAL", province: "khyber-pakhtunkhwa", city: "peshawar", website: "https://cwd.kp.gov.pk" },
  { name: "Khyber Pakhtunkhwa Health Department", shortName: "KP Health", slug: "kp-health-department", type: "PROVINCIAL", province: "khyber-pakhtunkhwa", city: "peshawar", website: "https://health.kp.gov.pk" },
  { name: "Khyber Pakhtunkhwa Information Technology Board", shortName: "KPITB", slug: "kpitb", type: "PUBLIC_SECTOR", province: "khyber-pakhtunkhwa", city: "peshawar", website: "https://kpitb.gov.pk" },
  { name: "Balochistan Public Works Department", shortName: "BPWD", slug: "balochistan-pwd", type: "PROVINCIAL", province: "balochistan", city: "quetta", website: "https://pwd.balochistan.gov.pk" },
  { name: "Balochistan Health Department", shortName: "BHD", slug: "balochistan-health-department", type: "PROVINCIAL", province: "balochistan", city: "quetta" },
  { name: "Gwadar Development Authority", shortName: "GDA", slug: "gwadar-development-authority", type: "PROVINCIAL", province: "balochistan", city: "gwadar", website: "https://gda.gov.pk" },
  { name: "AJK Public Works Department", shortName: "AJK PWD", slug: "ajk-pwd", type: "PROVINCIAL", province: "ajk", city: "muzaffarabad" },
  { name: "Gilgit-Baltistan Public Works Department", shortName: "GB PWD", slug: "gb-pwd", type: "PROVINCIAL", province: "gilgit-baltistan", city: "gilgit" },
  { name: "Agha Khan Foundation Pakistan", shortName: "AKF", slug: "agha-khan-foundation", type: "NGO", province: "islamabad", city: "islamabad", website: "https://www.akdn.org" },
  { name: "National Rural Support Programme", shortName: "NRSP", slug: "nrsp", type: "NGO", province: "islamabad", city: "islamabad", website: "https://nrsp.org.pk" },
  { name: "Saylani Welfare International Trust", shortName: "Saylani", slug: "saylani-welfare", type: "NGO", province: "sindh", city: "karachi", website: "https://saylaniwelfare.com" },
  { name: "Engro Corporation", shortName: "Engro", slug: "engro-corporation", type: "PRIVATE", province: "sindh", city: "karachi", website: "https://www.engro.com" },
  { name: "Lucky Cement Limited", shortName: "Lucky Cement", slug: "lucky-cement", type: "PRIVATE", province: "sindh", city: "karachi", website: "https://www.lucky-cement.com" },
  { name: "Packages Limited", shortName: "Packages", slug: "packages-limited", type: "PRIVATE", province: "punjab", city: "lahore", website: "https://www.packages.com.pk" },
  { name: "Punjab Masstransit Authority", shortName: "PMA", slug: "punjab-masstransit-authority", type: "PUBLIC_SECTOR", province: "punjab", city: "lahore" },
];

type SeedSource = {
  name: string;
  slug: string;
  code: string;
  type: string;
  url?: string;
  baseUrl?: string;
  authority?: string;
  newspaper?: string;
  province?: string;
  isVerified: boolean;
  isEnabled?: boolean;
  category?: "FEDERAL" | "PROVINCIAL" | "AJK" | "GILGIT_BALTISTAN" | "DEPARTMENT" | "HOSPITAL" | "UNIVERSITY" | "DEVELOPMENT_AUTHORITY" | "PUBLIC_SECTOR" | "NEWSPAPER" | "PRIVATE";
  collectionMethod?: "OFFICIAL_API" | "AUTHORIZED_FEED" | "RSS" | "WEBSITE_MONITOR" | "DATASET" | "EMAIL_FEED" | "PDF_AD" | "OCR" | "MANUAL_IMPORT";
  connectorKey?: string;
  status?: "ACTIVE" | "PAUSED" | "DEGRADED" | "DISABLED" | "PENDING_REVIEW";
  priority?: number;
  scheduleMinutes?: number;
  rateLimitPerMinute?: number;
  maxPages?: number;
  respectRobots?: boolean;
  requiresAuth?: boolean;
  autoPublish?: boolean;
  minConfidence?: number;
  licenseNotes?: string;
  termsUrl?: string;
  accessNotes?: string;
  config?: Record<string, unknown>;
};

/**
 * Source registry.
 *
 * Only sources whose public listings were actually reachable and whose access
 * conditions permit automated reading are enabled for collection. Sources that
 * were unreachable, need licensed access, or publish only through channels we
 * are not authorised to scrape stay configured but disabled, with the reason
 * recorded in accessNotes. Nothing here pretends an integration exists.
 */
const sources: SeedSource[] = [
  {
    name: "PPRA EPMS Public Tenders",
    slug: "ppra-portal",
    code: "PPRA-EPMS",
    type: "OFFICIAL_WEBSITE",
    url: "https://epms.ppra.gov.pk/public/tenders/active-tenders",
    baseUrl: "https://epms.ppra.gov.pk",
    authority: "ppra",
    province: "islamabad",
    category: "FEDERAL",
    collectionMethod: "WEBSITE_MONITOR",
    connectorKey: "epms",
    isVerified: true,
    isEnabled: true,
    status: "ACTIVE",
    priority: 10,
    scheduleMinutes: 15,
    rateLimitPerMinute: 6,
    maxPages: 3,
    respectRobots: true,
    autoPublish: false,
    minConfidence: 0.8,
    accessNotes:
      "Public active-tender listing on PPRA's Electronic Procurement Management System. Read as an anonymous visitor; no login, CAPTCHA or restricted endpoint is used. Listing pages link to public detail pages and PDFs under /pdf?file=...",
    termsUrl: "https://www.ppra.org.pk",
    config: { listingUrl: "https://epms.ppra.gov.pk/public/tenders/active-tenders" },
  },
  {
    name: "KPPRA Active Tenders",
    slug: "kppra-portal",
    code: "KPPRA-ACTIVE",
    type: "OFFICIAL_WEBSITE",
    url: "http://kppra.gov.pk/kppra/activetenders",
    baseUrl: "http://kppra.gov.pk",
    authority: "kppra",
    province: "khyber-pakhtunkhwa",
    category: "PROVINCIAL",
    collectionMethod: "WEBSITE_MONITOR",
    connectorKey: "table",
    isVerified: true,
    isEnabled: false,
    status: "PAUSED",
    priority: 20,
    scheduleMinutes: 30,
    rateLimitPerMinute: 6,
    maxPages: 2,
    respectRobots: true,
    accessNotes:
      "Public active-tender table confirmed during source review, but kppra.gov.pk did not respond from the build network at the time of setup. The connector is configured and verified; enable it once the host is reachable from the server that runs collection.",
    config: {
      listingUrl: "http://kppra.gov.pk/kppra/activetenders",
      defaultOrganization: "Khyber Pakhtunkhwa Public Procurement Regulatory Authority",
    },
  },
  {
    name: "AJK PPRA Active Advertisements",
    slug: "ajk-ppra-portal",
    code: "AJKPPRA-ACTIVE",
    type: "OFFICIAL_WEBSITE",
    url: "https://ajkppra.gov.pk/",
    baseUrl: "https://ajkppra.gov.pk",
    authority: "ajk-ppra",
    province: "ajk",
    category: "AJK",
    collectionMethod: "WEBSITE_MONITOR",
    connectorKey: "table",
    isVerified: true,
    isEnabled: true,
    status: "ACTIVE",
    priority: 30,
    scheduleMinutes: 60,
    rateLimitPerMinute: 4,
    maxPages: 1,
    respectRobots: true,
    accessNotes:
      "Public active-procurement table on the AJK PPRA homepage. Rows link directly to tender PDFs under uploadfiles/tenderdocuments/. No login or CAPTCHA is involved.",
    config: {
      listingUrl: "https://ajkppra.gov.pk/",
      defaultOrganization: "AJK Public Procurement Regulatory Authority",
      columns: { title: 1, publishedAt: 2, closingAt: 3, department: 4, organization: 5 },
    },
  },
  {
    name: "GB PPRA Procurements",
    slug: "gb-ppra-portal",
    code: "GBPPRA-PROC",
    type: "OFFICIAL_WEBSITE",
    url: "https://gbppra.gov.pk/procurements/1",
    baseUrl: "https://gbppra.gov.pk",
    authority: "gb-ppra",
    province: "gilgit-baltistan",
    category: "GILGIT_BALTISTAN",
    collectionMethod: "WEBSITE_MONITOR",
    connectorKey: "table",
    isVerified: true,
    isEnabled: true,
    status: "ACTIVE",
    priority: 30,
    scheduleMinutes: 60,
    rateLimitPerMinute: 6,
    maxPages: 3,
    respectRobots: true,
    accessNotes:
      "Public procurement listing on GB PPRA. Table columns: S#, Title, Type, Department, Opening Date, Closing Date, Tender Document, Tender Notice, View. Detail pages under /procurementdetails/<id>; PDFs under /storage/proc_files/.",
    config: {
      listingUrl: "https://gbppra.gov.pk/procurements/1",
      pageUrlTemplate: "https://gbppra.gov.pk/procurements/{page}",
      columns: { title: 1, tenderType: 2, department: 3, openingAt: 4, closingAt: 5 },
      detailLinkSelector: 'a[href*="/procurementdetails/"]',
      defaultOrganization: "Gilgit-Baltistan Public Procurement Regulatory Authority",
      pagination: { start: 1, max: 3 },
    },
  },
  {
    name: "SPPRA Tender Portal",
    slug: "sppra-portal",
    code: "SPPRA-PORTAL",
    type: "OFFICIAL_WEBSITE",
    url: "https://www.sppra.gos.pk",
    authority: "sppra",
    province: "sindh",
    category: "PROVINCIAL",
    collectionMethod: "MANUAL_IMPORT",
    connectorKey: "manual",
    isVerified: false,
    isEnabled: false,
    status: "DISABLED",
    accessNotes:
      "sppra.gos.pk and sppra.sindh.gov.pk did not resolve from the build network at setup time, so no automated connector was implemented. SPPRA notices should be added through the manual import screen until a reachable, permitted endpoint is confirmed.",
  },
  {
    name: "BPPRA Tender Portal",
    slug: "bppra-portal",
    code: "BPPRA-PORTAL",
    type: "OFFICIAL_WEBSITE",
    url: "https://bppra.gob.pk",
    authority: "bppra",
    province: "balochistan",
    category: "PROVINCIAL",
    collectionMethod: "MANUAL_IMPORT",
    connectorKey: "manual",
    isVerified: false,
    isEnabled: false,
    status: "DISABLED",
    accessNotes:
      "The BPPRA /Tenders page returned HTTP 500 during source review. No automated connector was implemented; use manual import until the listing is reachable and its access terms are confirmed.",
  },
  {
    name: "PPRA Punjab",
    slug: "ppra-punjab-portal",
    code: "PPRAPB-PORTAL",
    type: "OFFICIAL_WEBSITE",
    url: "https://ppra.punjab.gov.pk",
    authority: "ppra-punjab",
    province: "punjab",
    category: "PROVINCIAL",
    collectionMethod: "MANUAL_IMPORT",
    connectorKey: "manual",
    isVerified: false,
    isEnabled: false,
    status: "DISABLED",
    accessNotes:
      "The Punjab e-procurement connection failed during source review, so no automated connector was implemented. Use manual import until a reachable, permitted endpoint is confirmed.",
  },
  {
    name: "Jang Newspaper Classifieds",
    slug: "jang-classifieds",
    code: "JANG-CLASSIFIEDS",
    type: "NEWSPAPER",
    newspaper: "jang",
    category: "NEWSPAPER",
    collectionMethod: "MANUAL_IMPORT",
    connectorKey: "manual",
    isVerified: false,
    isEnabled: false,
    status: "DISABLED",
    accessNotes:
      "Newspaper tender advertisements require a licensed feed or subscription. Only administrator-entered notices are supported until written permission or an authorised feed is available.",
  },
  {
    name: "Dawn Newspaper Classifieds",
    slug: "dawn-classifieds",
    code: "DAWN-CLASSIFIEDS",
    type: "NEWSPAPER",
    newspaper: "dawn",
    category: "NEWSPAPER",
    collectionMethod: "MANUAL_IMPORT",
    connectorKey: "manual",
    isVerified: false,
    isEnabled: false,
    status: "DISABLED",
    accessNotes:
      "Newspaper tender advertisements require a licensed feed or subscription. Only administrator-entered notices are supported until written permission or an authorised feed is available.",
  },
  {
    name: "Business Recorder Tenders",
    slug: "business-recorder-tenders",
    code: "BR-TENDERS",
    type: "NEWSPAPER",
    newspaper: "business-recorder",
    category: "NEWSPAPER",
    collectionMethod: "MANUAL_IMPORT",
    connectorKey: "manual",
    isVerified: false,
    isEnabled: false,
    status: "DISABLED",
    accessNotes:
      "Newspaper tender advertisements require a licensed feed or subscription. Only administrator-entered notices are supported until written permission or an authorised feed is available.",
  },
  {
    name: "Manual Editorial Entry",
    slug: "manual-entry",
    code: "MANUAL-ENTRY",
    type: "MANUAL",
    category: "FEDERAL",
    collectionMethod: "MANUAL_IMPORT",
    connectorKey: "manual",
    isVerified: true,
    isEnabled: true,
    status: "ACTIVE",
    priority: 90,
    scheduleMinutes: 1440,
    accessNotes:
      "Internal editorial entry from a verified notice copy. Every manual import must include a source URL or an uploaded document so the record can be traced to its origin.",
    licenseNotes: "Entered by Pak Tenders staff from a verified notice copy.",
  },
];

const permissions = [
  "tender.read", "tender.create", "tender.update", "tender.publish", "tender.verify", "tender.delete", "tender.import",
  "user.read", "user.update", "user.suspend", "company.manage",
  "subscription.manage", "payment.verify", "refund.process", "invoice.read",
  "notification.manage", "notification.send",
  "chatbot.manage", "chatbot.kb.manage",
  "seo.manage", "content.manage", "page.manage",
  "integration.manage", "system.settings", "system.health", "audit.read", "role.manage",
];

const roles: Array<{ code: string; name: string; description: string; permissions: string[] | "ALL" }> = [
  { code: "SUPER_ADMIN", name: "Super Admin", description: "Unrestricted access to the entire control center.", permissions: "ALL" },
  { code: "ADMIN", name: "Admin", description: "Full operational access except destructive system settings.", permissions: ["tender.read","tender.create","tender.update","tender.publish","tender.verify","tender.import","user.read","user.update","company.manage","subscription.manage","payment.verify","notification.manage","notification.send","chatbot.manage","seo.manage","content.manage","page.manage","audit.read","system.health"] },
  { code: "TENDER_MANAGER", name: "Tender Manager", description: "Creates, edits and publishes tender records.", permissions: ["tender.read","tender.create","tender.update","tender.publish","tender.import","audit.read"] },
  { code: "RESEARCHER", name: "Researcher", description: "Collects and drafts tender records for review.", permissions: ["tender.read","tender.create","tender.update","tender.import"] },
  { code: "VERIFICATION_OFFICER", name: "Verification Officer", description: "Verifies tender records against official sources.", permissions: ["tender.read","tender.verify","audit.read"] },
  { code: "CONTENT_MANAGER", name: "Content Manager", description: "Manages blog posts, pages, FAQs and resources.", permissions: ["content.manage","page.manage","seo.manage"] },
  { code: "SEO_MANAGER", name: "SEO Manager", description: "Manages metadata, redirects, sitemaps and structured data.", permissions: ["seo.manage","content.manage"] },
  { code: "CUSTOMER_SUPPORT", name: "Customer Support", description: "Handles user enquiries and support tickets.", permissions: ["user.read","tender.read","audit.read"] },
  { code: "FINANCE_MANAGER", name: "Finance Manager", description: "Manages plans, payments, invoices and refunds.", permissions: ["subscription.manage","payment.verify","refund.process","invoice.read","user.read","audit.read"] },
  { code: "NOTIFICATION_MANAGER", name: "Notification Manager", description: "Manages notification templates, campaigns and delivery.", permissions: ["notification.manage","notification.send","user.read"] },
  { code: "AI_MANAGER", name: "AI/Chatbot Manager", description: "Manages the AI assistant, knowledge base and usage limits.", permissions: ["chatbot.manage","chatbot.kb.manage","content.manage"] },
  { code: "TECHNICAL_ADMIN", name: "Technical Administrator", description: "Manages integrations, health checks and diagnostics.", permissions: ["integration.manage","system.health","audit.read","system.settings"] },
  { code: "USER", name: "Registered User", description: "Standard platform user.", permissions: [] },
];

const plans = [
  { code: "free", name: "Free", description: "Browse public tenders and try the AI assistant.", pricePkr: 0, isPopular: false, sortOrder: 1, chatbotQuota: 10, savedTenderLimit: 10, features: { tenderBrowsing: true, savedTenders: 10, alerts: 1, emailAlerts: false, pushAlerts: false, chatbotMessagesPerDay: 10, documentAssistant: false, advancedFilters: false, exportData: false, support: "community" } },
  { code: "basic", name: "Basic", description: "For individuals tracking a focused set of opportunities.", pricePkr: 999, isPopular: false, sortOrder: 2, chatbotQuota: 50, savedTenderLimit: 100, features: { tenderBrowsing: true, savedTenders: 100, alerts: 5, emailAlerts: true, pushAlerts: true, chatbotMessagesPerDay: 50, documentAssistant: false, advancedFilters: true, exportData: false, support: "email" } },
  { code: "professional", name: "Professional", description: "For active contractors and suppliers bidding regularly.", pricePkr: 1999, isPopular: true, sortOrder: 3, chatbotQuota: 150, savedTenderLimit: 500, features: { tenderBrowsing: true, savedTenders: 500, alerts: 20, emailAlerts: true, pushAlerts: true, chatbotMessagesPerDay: 150, documentAssistant: true, advancedFilters: true, exportData: true, support: "priority-email" } },
  { code: "business", name: "Business", description: "For companies with multiple team members and heavy usage.", pricePkr: 3999, isPopular: false, sortOrder: 4, chatbotQuota: 500, savedTenderLimit: null, features: { tenderBrowsing: true, savedTenders: "unlimited", alerts: 100, emailAlerts: true, pushAlerts: true, chatbotMessagesPerDay: 500, documentAssistant: true, advancedFilters: true, exportData: true, teamMembers: 5, support: "priority" } },
  { code: "enterprise", name: "Enterprise", description: "Custom limits, onboarding and integration support.", pricePkr: 0, isPopular: false, sortOrder: 5, chatbotQuota: 2000, savedTenderLimit: null, features: { custom: true, support: "dedicated" } },
];

const settings = [
  { key: "site.name", value: "Pak Tenders", isPublic: true, description: "Public site name." },
  { key: "site.tagline", value: "Discover. Analyze. Track. Win.", isPublic: true },
  { key: "site.supportEmail", value: "support@paktenders.pk", isPublic: true },
  { key: "site.supportPhone", value: "+92 300 0000000", isPublic: true },
  { key: "site.announcement", value: null, isPublic: true, description: "Announcement bar text. Null hides the bar." },
  { key: "site.maintenanceMode", value: false, isPublic: true },
  { key: "features.registration", value: true, isPublic: true },
  { key: "features.tenderPublishing", value: true, isPublic: true },
  { key: "features.subscriptions", value: true, isPublic: true },
  { key: "features.emailAlerts", value: false, isPublic: true, description: "Enabled once an email provider is configured." },
  { key: "features.pushNotifications", value: false, isPublic: true },
  { key: "chatbot.enabled", value: false, isPublic: true, description: "AI assistant is disabled until an AI provider is configured." },
  { key: "chatbot.welcomeMessage", value: "Assalam-o-Alaikum! I'm the Pak Tenders AI Assistant. Ask me to find tenders, explain a notice, or help you use the platform.", isPublic: true },
  { key: "seo.defaultTitle", value: "Pak Tenders – Latest Government & Private Tenders in Pakistan", isPublic: true },
  { key: "seo.defaultDescription", value: "Find the latest government and private tenders in Pakistan. Explore PPRA, construction, IT, medical, solar, NGO, consultancy and business procurement opportunities with tender updates and personalized alerts.", isPublic: true },
];

const integrations = [
  { key: "email", name: "Transactional Email", category: "EMAIL" },
  { key: "payments.jazzcash", name: "JazzCash", category: "PAYMENTS" },
  { key: "payments.easypaisa", name: "Easypaisa", category: "PAYMENTS" },
  { key: "payments.card", name: "Card Gateway", category: "PAYMENTS" },
  { key: "ai.provider", name: "AI Provider", category: "AI" },
  { key: "push.expo", name: "Expo Push", category: "PUSH" },
  { key: "storage.s3", name: "S3-compatible Storage", category: "STORAGE" },
  { key: "analytics.ga4", name: "Google Analytics 4", category: "ANALYTICS" },
  { key: "messaging.whatsapp", name: "WhatsApp Business API", category: "MESSAGING" },
  { key: "messaging.sms", name: "SMS Gateway", category: "MESSAGING" },
];

const knowledgeArticles = [
  { slug: "how-to-search-tenders", title: "How to search tenders on Pak Tenders", category: "HELP", content: "Use the search bar on the homepage or open All Tenders. You can filter by province, city, category, department, tender type and closing window. Combine a keyword such as 'solar' with a province filter to narrow results. Save the search to receive matching alerts later." },
  { slug: "how-to-save-a-tender", title: "How to save a tender", category: "HELP", content: "Open any tender detail page and select Save. Saved tenders appear on the Saved tab in the mobile app and in your website dashboard. Saved tenders are synced across all platforms using the same account." },
  { slug: "how-to-create-alerts", title: "How to create a tender alert", category: "HELP", content: "From your dashboard open Alerts and choose Create alert. Set the keyword, category, province and frequency. Email alerts require an email provider to be configured by the administrator; in-app alerts always work." },
  { slug: "subscription-and-billing", title: "Subscriptions and billing", category: "BILLING", content: "Subscription plans and prices are listed on the Pricing page. Payments made by bank transfer are verified manually by our finance team before access is activated. Card and mobile wallet payments are enabled only when the relevant gateway is configured. Pak Tenders never stores raw card numbers." },
  { slug: "account-security", title: "Keeping your account secure", category: "SECURITY", content: "Use a unique password of at least 10 characters with upper and lower case letters and a number. Never share your password. If you suspect unauthorised access, change your password and contact support. Administrators will never ask for your password." },
  { slug: "contact-support", title: "Contacting support", category: "SUPPORT", content: "Open Help and Support from the website footer or the mobile Profile tab to create a ticket. Include the tender reference number and a clear description of the issue. Support hours are Monday to Saturday, 9:00 to 18:00 PKT." },
];

/* -------------------------------------------------------------------------- */
/* Demo tenders (clearly flagged)                                             */
/* -------------------------------------------------------------------------- */

type DemoTender = {
  title: string;
  slug: string;
  category: string;
  department: string;
  province: string;
  city: string;
  type: "GOVERNMENT" | "PRIVATE" | "NGO" | "AUCTION" | "CONSULTANCY" | "NEWSPAPER";
  closesInDays: number;
  description: string;
  eligibility: string;
  bidSecurity: number;
  docs: string[];
  estimatedValue?: number;
  featured?: boolean;
  source?: string;
};

const demoTenders: DemoTender[] = [
  {
    title: "[Demo] Construction of a two-storey school block in Lahore",
    slug: "demo-construction-two-storey-school-block-lahore",
    category: "construction-civil-engineering",
    department: "punjab-pwd",
    province: "punjab",
    city: "lahore",
    type: "GOVERNMENT",
    closesInDays: 6,
    description: "Sample record for interface testing. The scope covers construction of a two-storey school block including earthworks, RCC frame, brick masonry, plaster, flooring, electrical and plumbing installations as per the provided drawings and bill of quantities.",
    eligibility: "Valid PEC registration in the relevant category and code, experience of at least two similar building projects, and a tax compliance certificate. Demo text only.",
    bidSecurity: 250000,
    docs: ["Bidding document (demo)", "Bill of quantities (demo)", "Drawings index (demo)"],
    estimatedValue: 48000000,
    featured: true,
    source: "ppra-punjab-portal",
  },
  {
    title: "[Demo] Supply of laptops and network equipment for a public university",
    slug: "demo-supply-laptops-network-equipment-university",
    category: "it-technology",
    department: "higher-education-commission",
    province: "islamabad",
    city: "islamabad",
    type: "GOVERNMENT",
    closesInDays: 11,
    description: "Sample record for interface testing. Supply, delivery, installation and commissioning of laptops, switches, structured cabling and associated accessories with a three-year warranty.",
    eligibility: "Authorised dealer or principal bidder with OEM authorisation, relevant supply experience and valid registration. Demo text only.",
    bidSecurity: 400000,
    docs: ["Technical specifications (demo)", "Price schedule (demo)"],
    estimatedValue: 92000000,
    featured: true,
    source: "ppra-portal",
  },
  {
    title: "[Demo] Provision of solar power systems for rural health centres",
    slug: "demo-solar-power-systems-rural-health-centres",
    category: "solar-renewable-energy",
    department: "kp-health-department",
    province: "khyber-pakhtunkhwa",
    city: "peshawar",
    type: "GOVERNMENT",
    closesInDays: 19,
    description: "Sample record for interface testing. Design, supply and installation of off-grid solar photovoltaic systems with battery backup for rural health centres, including five-year maintenance.",
    eligibility: "AEDB registration where applicable, demonstrated solar installation experience and certified technicians. Demo text only.",
    bidSecurity: 180000,
    docs: ["Scope of work (demo)", "Site list (demo)", "Technical compliance sheet (demo)"],
    estimatedValue: 35000000,
    source: "kppra-portal",
  },
  {
    title: "[Demo] Supply of medical consumables to a tertiary care hospital",
    slug: "demo-supply-medical-consumables-tertiary-hospital",
    category: "medical-healthcare",
    department: "sindh-health-department",
    province: "sindh",
    city: "karachi",
    type: "GOVERNMENT",
    closesInDays: 3,
    description: "Sample record for interface testing. Rate contract for the supply of medical consumables including syringes, gloves, dressings and IV fluids over twelve months.",
    eligibility: "DRAP-registered products, valid distribution authorisation and prior hospital supply experience. Demo text only.",
    bidSecurity: 150000,
    docs: ["Item schedule (demo)", "Sample requirements (demo)"],
    estimatedValue: 22000000,
    featured: true,
    source: "sppra-portal",
  },
  {
    title: "[Demo] Consultancy services for a city drainage master plan",
    slug: "demo-consultancy-city-drainage-master-plan",
    category: "consultancy-professional-services",
    department: "karachi-water-board",
    province: "sindh",
    city: "karachi",
    type: "CONSULTANCY",
    closesInDays: 24,
    description: "Sample record for interface testing. Expression of interest for consultancy services to prepare a city drainage master plan, including hydrological modelling, stakeholder consultation and an implementation roadmap.",
    eligibility: "Firms with relevant engineering consultancy experience and a multidisciplinary team. Demo text only.",
    bidSecurity: 0,
    docs: ["Terms of reference (demo)", "EOI forms (demo)"],
    source: "sppra-portal",
  },
  {
    title: "[Demo] Hiring of security services for government offices",
    slug: "demo-hiring-security-services-government-offices",
    category: "security-safety",
    department: "capital-development-authority",
    province: "islamabad",
    city: "islamabad",
    type: "GOVERNMENT",
    closesInDays: 8,
    description: "Sample record for interface testing. Provision of trained security guards, supervisors and control room operators for office premises over a twelve-month period.",
    eligibility: "Valid security agency licence, trained staff and relevant experience. Demo text only.",
    bidSecurity: 120000,
    docs: ["Manpower schedule (demo)", "Terms and conditions (demo)"],
    estimatedValue: 18000000,
    source: "ppra-portal",
  },
  {
    title: "[Demo] Supply of furniture and office equipment for district offices",
    slug: "demo-supply-furniture-office-equipment-district-offices",
    category: "office-supplies-stationery",
    department: "balochistan-pwd",
    province: "balochistan",
    city: "quetta",
    type: "GOVERNMENT",
    closesInDays: 14,
    description: "Sample record for interface testing. Supply and delivery of office furniture, filing cabinets and basic office equipment to district offices.",
    eligibility: "Registered supplier with manufacturing or authorised dealership evidence. Demo text only.",
    bidSecurity: 60000,
    docs: ["Item list (demo)", "Delivery schedule (demo)"],
    estimatedValue: 9500000,
    source: "bppra-portal",
  },
  {
    title: "[Demo] Auction of surplus vehicles and machinery",
    slug: "demo-auction-surplus-vehicles-machinery",
    category: "auctions-disposal",
    department: "pakistan-railways",
    province: "punjab",
    city: "lahore",
    type: "AUCTION",
    closesInDays: 5,
    description: "Sample record for interface testing. Public auction of surplus vehicles, workshop machinery and scrap material. Inspection dates and lot details are described in the auction catalogue.",
    eligibility: "Bidders must deposit the specified earnest money and register before the auction date. Demo text only.",
    bidSecurity: 100000,
    docs: ["Auction catalogue (demo)", "Lot list (demo)"],
    source: "manual-entry",
  },
  {
    title: "[Demo] Printing of textbooks for primary schools",
    slug: "demo-printing-textbooks-primary-schools",
    category: "printing-publishing",
    department: "punjab-school-education-department",
    province: "punjab",
    city: "lahore",
    type: "GOVERNMENT",
    closesInDays: 21,
    description: "Sample record for interface testing. Printing, binding and delivery of primary school textbooks in specified quantities and paper quality.",
    eligibility: "Registered printing press with demonstrated capacity and quality certification. Demo text only.",
    bidSecurity: 300000,
    docs: ["Printing specifications (demo)", "Quantity schedule (demo)"],
    estimatedValue: 64000000,
    source: "ppra-punjab-portal",
  },
  {
    title: "[Demo] Supply of uniforms and linen for hospital staff",
    slug: "demo-supply-uniforms-linen-hospital-staff",
    category: "textile-clothing",
    department: "pims-islamabad",
    province: "islamabad",
    city: "islamabad",
    type: "GOVERNMENT",
    closesInDays: 9,
    description: "Sample record for interface testing. Supply of staff uniforms, bed linen and patient gowns according to provided fabric and stitching specifications.",
    eligibility: "Textile manufacturer or authorised supplier with sample approval capability. Demo text only.",
    bidSecurity: 45000,
    docs: ["Fabric specifications (demo)", "Size matrix (demo)"],
    estimatedValue: 7800000,
    source: "ppra-portal",
  },
  {
    title: "[Demo] Private sector request for proposals: warehouse management system",
    slug: "demo-private-rfp-warehouse-management-system",
    category: "it-technology",
    department: "engro-corporation",
    province: "sindh",
    city: "karachi",
    type: "PRIVATE",
    closesInDays: 16,
    description: "Sample record for interface testing. A private company invites proposals for the implementation of a warehouse management system covering inventory, dispatch and integration with an existing ERP.",
    eligibility: "Software vendors with comparable deployments and local support capability. Demo text only.",
    bidSecurity: 0,
    docs: ["RFP document (demo)", "Requirements matrix (demo)"],
    source: "manual-entry",
  },
  {
    title: "[Demo] NGO request for quotation: hygiene kits for flood-affected families",
    slug: "demo-ngo-rfq-hygiene-kits-flood-affected-families",
    category: "ngo-development-projects",
    department: "nrsp",
    province: "sindh",
    city: "hyderabad",
    type: "NGO",
    closesInDays: 4,
    description: "Sample record for interface testing. Request for quotation for the supply and delivery of hygiene kits to distribution points in flood-affected districts.",
    eligibility: "Registered suppliers with prior humanitarian supply experience and ability to deliver within the stated timeframe. Demo text only.",
    bidSecurity: 0,
    docs: ["Kit composition (demo)", "Delivery plan (demo)"],
    estimatedValue: 12000000,
    source: "manual-entry",
  },
  {
    title: "[Demo] Water supply scheme for a rural union council",
    slug: "demo-water-supply-scheme-rural-union-council",
    category: "water-environment",
    department: "gb-pwd",
    province: "gilgit-baltistan",
    city: "gilgit",
    type: "GOVERNMENT",
    closesInDays: 28,
    description: "Sample record for interface testing. Construction of a water supply scheme including intake, filtration, storage tank and distribution network for a rural union council.",
    eligibility: "PEC-registered contractor with water supply scheme experience. Demo text only.",
    bidSecurity: 90000,
    docs: ["BOQ (demo)", "Design drawings index (demo)"],
    estimatedValue: 26000000,
    source: "manual-entry",
  },
  {
    title: "[Demo] Newspaper advertisement: supply of textbooks and stationery",
    slug: "demo-newspaper-supply-textbooks-stationery",
    category: "education-training",
    department: "ajk-pwd",
    province: "ajk",
    city: "muzaffarabad",
    type: "NEWSPAPER",
    closesInDays: 12,
    description: "Sample record for interface testing. Newspaper-published notice inviting sealed quotations for the supply of textbooks and stationery to public schools.",
    eligibility: "Registered booksellers and stationery suppliers. Demo text only.",
    bidSecurity: 25000,
    docs: ["Notice copy (demo)"],
    source: "jang-classifieds",
  },
];

/* -------------------------------------------------------------------------- */
/* Blog / resources                                                           */
/* -------------------------------------------------------------------------- */

const blogCategories = [
  { name: "Procurement Guides", slug: "procurement-guides" },
  { name: "Bidding Basics", slug: "bidding-basics" },
  { name: "Platform Help", slug: "platform-help" },
];

const blogPosts = [
  {
    slug: "how-to-find-government-tenders-in-pakistan",
    title: "How to Find Government Tenders in Pakistan",
    excerpt: "A practical starting point for contractors and suppliers: where public notices are published, how to read them, and how to build a repeatable search routine.",
    category: "procurement-guides",
    readingMinutes: 6,
    content: `## Start with the official channels\n\nPublic procurement notices in Pakistan are published through a mix of federal and provincial channels. The Public Procurement Regulatory Authority (PPRA) publishes rules and notices at the federal level, while provincial authorities such as SPPRA, KPPRA, BPPRA and PPRA Punjab operate their own portals. Many departments also advertise in national newspapers, particularly for works and large purchases.\n\n## Build a search routine\n\n1. Check the official portal for the departments you care about.\n2. Scan the newspapers that carry notices for your sector.\n3. Record the reference number, closing date and submission method for every notice you may bid on.\n4. Keep a calendar reminder at least three working days before the deadline.\n\n## Read the notice properly\n\nA tender notice is not only a title and a date. Check the eligibility conditions, the required registration (for example PEC registration for works), the bid security amount and form, the submission address, and whether a pre-bid meeting is scheduled. Missing a single procedural requirement can make a bid non-responsive.\n\n## Use Pak Tenders as a starting point, verify at the source\n\nPak Tenders aggregates published notices so you can search across departments and provinces in one place. Always confirm the details against the original notice before you prepare a bid. Pak Tenders is an independent information platform, not a procurement authority.`,
  },
  {
    slug: "what-is-ppra",
    title: "What Is PPRA and Why Does It Matter for Bidders?",
    excerpt: "An introduction to the Public Procurement Regulatory Authority, the rules it issues, and what those rules mean in practice when you submit a bid.",
    category: "bidding-basics",
    readingMinutes: 5,
    content: `## The short answer\n\nThe Public Procurement Regulatory Authority (PPRA) is the federal regulator for public procurement in Pakistan. It issues procurement rules, standard bidding documents and guidance that federal public bodies are expected to follow.\n\n## Why bidders should care\n\nProcurement rules define how notices must be advertised, how bids must be opened and evaluated, and what records must be kept. Understanding them helps you:\n\n- recognise a notice that does not follow the expected process;\n- prepare submissions that match the required format;\n- know what to ask when a clarification is needed.\n\n## Provincial regulators\n\nSindh, Khyber Pakhtunkhwa, Balochistan and Punjab each have their own procurement regulatory bodies and rules. A provincial department normally follows its provincial framework. When you bid outside the federal sphere, check the applicable provincial rules.\n\n## A note on advice\n\nThis article is general information, not legal or procurement advice. For a specific tender, follow the instructions in the bidding document and contact the issuing department for clarification.`,
  },
  {
    slug: "bid-security-vs-performance-guarantee",
    title: "Bid Security vs Performance Guarantee: A Practical Guide",
    excerpt: "Two instruments that are often confused. Here is what each one is for, when it is submitted, and what happens to it afterwards.",
    category: "bidding-basics",
    readingMinutes: 4,
    content: `## Bid security\n\nBid security (also called earnest money) is submitted with the bid. Its purpose is to discourage withdrawal or alteration of a bid during the validity period. It is usually a small percentage of the estimated cost, provided as a pay order, demand draft or bank guarantee in the form stated in the bidding document.\n\nIf you do not win, the bid security is returned. If you withdraw a bid during its validity period or fail to honour an obligation stated in the document, it may be forfeited.\n\n## Performance guarantee\n\nA performance guarantee is submitted by the successful bidder after award, before signing the contract. It protects the employer against failure to perform. It is normally a percentage of the contract value and remains valid for the contract period plus a maintenance period.\n\n## Practical checklist\n\n- Read the exact instrument and format required.\n- Check the validity period, not just the amount.\n- Keep proof of submission.\n- Diarise the return or release of each instrument.\n\nAmounts and percentages vary by tender. Always use the figures in the bidding document rather than a general rule of thumb.`,
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function main() {
  console.log("Seeding Pak Tenders reference data...");

  /* provinces + cities */
  const provinceIds = new Map<string, string>();
  for (const p of provinces) {
    const row = await prisma.province.upsert({
      where: { slug: p.slug },
      update: { name: p.name, code: p.code },
      create: { name: p.name, slug: p.slug, code: p.code },
    });
    provinceIds.set(p.slug, row.id);
  }

  const cityIds = new Map<string, string>();
  for (const [provinceSlug, list] of Object.entries(cities)) {
    const provinceId = provinceIds.get(provinceSlug);
    if (!provinceId) continue;
    for (const c of list) {
      const row = await prisma.city.upsert({
        where: { provinceId_slug: { provinceId, slug: c.slug } },
        update: { name: c.name, isMajor: c.major ?? false },
        create: { name: c.name, slug: c.slug, provinceId, isMajor: c.major ?? false },
      });
      cityIds.set(`${provinceSlug}:${c.slug}`, row.id);
    }
  }
  console.log(`  provinces: ${provinceIds.size}, cities: ${cityIds.size}`);

  /* categories */
  const categoryIds = new Map<string, string>();
  let order = 0;
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, icon: c.icon, sortOrder: order },
      create: { name: c.name, slug: c.slug, description: c.description, icon: c.icon, sortOrder: order },
    });
    categoryIds.set(c.slug, row.id);
    order += 1;
  }
  console.log(`  categories: ${categoryIds.size}`);

  /* authorities, newspapers, sources */
  const authorityIds = new Map<string, string>();
  for (const a of authorities) {
    const row = await prisma.procurementAuthority.upsert({
      where: { slug: a.slug },
      update: { name: a.name, website: a.website, provinceId: a.province ? provinceIds.get(a.province) : null },
      create: { name: a.name, slug: a.slug, website: a.website, provinceId: a.province ? provinceIds.get(a.province) : null },
    });
    authorityIds.set(a.slug, row.id);
  }

  const newspaperIds = new Map<string, string>();
  for (const n of newspapers) {
    const row = await prisma.newspaper.upsert({
      where: { slug: n.slug },
      update: { name: n.name, website: n.website },
      create: { name: n.name, slug: n.slug, website: n.website },
    });
    newspaperIds.set(n.slug, row.id);
  }

  const sourceIds = new Map<string, string>();
  for (const s of sources) {
    const collection = {
      code: s.code,
      category: s.category ?? "FEDERAL",
      collectionMethod: s.collectionMethod ?? "MANUAL_IMPORT",
      connectorKey: s.connectorKey ?? "manual",
      baseUrl: s.baseUrl ?? null,
      provinceId: s.province ? provinceIds.get(s.province) ?? null : null,
      isEnabled: s.isEnabled ?? false,
      status: s.status ?? (s.isEnabled ? "ACTIVE" : "PENDING_REVIEW"),
      priority: s.priority ?? 50,
      scheduleMinutes: s.scheduleMinutes ?? 60,
      rateLimitPerMinute: s.rateLimitPerMinute ?? 6,
      maxPages: s.maxPages ?? 3,
      respectRobots: s.respectRobots ?? true,
      requiresAuth: s.requiresAuth ?? false,
      autoPublish: s.autoPublish ?? false,
      minConfidence: s.minConfidence ?? 0.75,
      termsUrl: s.termsUrl ?? null,
      accessNotes: s.accessNotes ?? null,
      configJson: (s.config ?? undefined) as Prisma.InputJsonValue | undefined,
      nextRunAt: s.isEnabled && (s.connectorKey ?? "manual") !== "manual" ? new Date() : null,
    };

    const row = await prisma.tenderSource.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
        type: s.type,
        url: s.url ?? null,
        authorityId: s.authority ? authorityIds.get(s.authority) : null,
        newspaperId: s.newspaper ? newspaperIds.get(s.newspaper) : null,
        isVerified: s.isVerified,
        licenseNotes: s.licenseNotes ?? null,
        ...collection,
      },
      create: {
        name: s.name,
        slug: s.slug,
        type: s.type,
        url: s.url ?? null,
        authorityId: s.authority ? authorityIds.get(s.authority) : null,
        newspaperId: s.newspaper ? newspaperIds.get(s.newspaper) : null,
        isVerified: s.isVerified,
        licenseNotes: s.licenseNotes ?? null,
        ...collection,
      },
    });
    sourceIds.set(s.slug, row.id);
  }

  /* departments */
  const departmentIds = new Map<string, string>();
  for (const d of departments) {
    const row = await prisma.department.upsert({
      where: { slug: d.slug },
      update: {
        name: d.name,
        shortName: d.shortName,
        type: d.type,
        website: d.website ?? null,
        provinceId: provinceIds.get(d.province) ?? null,
        cityId: cityIds.get(`${d.province}:${d.city}`) ?? null,
      },
      create: {
        name: d.name,
        slug: d.slug,
        shortName: d.shortName,
        type: d.type,
        website: d.website ?? null,
        provinceId: provinceIds.get(d.province) ?? null,
        cityId: cityIds.get(`${d.province}:${d.city}`) ?? null,
      },
    });
    departmentIds.set(d.slug, row.id);
  }
  console.log(`  departments: ${departmentIds.size}, sources: ${sourceIds.size}`);

  /* roles + permissions */
  const permissionIds = new Map<string, string>();
  for (const code of permissions) {
    const row = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
    permissionIds.set(code, row.id);
  }

  const roleIds = new Map<string, string>();
  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: { code: r.code, name: r.name, description: r.description, isSystem: true },
    });
    roleIds.set(r.code, role.id);

    const codes = r.permissions === "ALL" ? permissions : r.permissions;
    for (const code of codes) {
      const permissionId = permissionIds.get(code);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  /* plans + AI limits */
  for (const p of plans) {
    const plan = await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        description: p.description,
        pricePkr: p.pricePkr,
        features: p.features as Prisma.InputJsonValue,
        chatbotQuota: p.chatbotQuota,
        savedTenderLimit: p.savedTenderLimit,
        isPopular: p.isPopular,
        sortOrder: p.sortOrder,
      },
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        pricePkr: p.pricePkr,
        features: p.features as Prisma.InputJsonValue,
        chatbotQuota: p.chatbotQuota,
        savedTenderLimit: p.savedTenderLimit,
        isPopular: p.isPopular,
        sortOrder: p.sortOrder,
      },
    });
    await prisma.aiUsageLimit.upsert({
      where: { planId: plan.id },
      update: { dailyMessages: p.chatbotQuota, monthlyMessages: p.chatbotQuota * 20, documentAssistance: p.code !== "free" && p.code !== "basic" },
      create: { planId: plan.id, dailyMessages: p.chatbotQuota, monthlyMessages: p.chatbotQuota * 20, documentAssistance: p.code !== "free" && p.code !== "basic" },
    });
  }

  /* settings */
  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { valueJson: s.value as Prisma.InputJsonValue, isPublic: s.isPublic ?? false, description: s.description ?? null },
      create: { key: s.key, valueJson: s.value as Prisma.InputJsonValue, isPublic: s.isPublic ?? false, description: s.description ?? null },
    });
  }

  /* integrations (all disabled / not configured until credentials exist) */
  for (const i of integrations) {
    await prisma.integration.upsert({
      where: { key: i.key },
      update: { name: i.name, category: i.category },
      create: { key: i.key, name: i.name, category: i.category, status: "NOT_CONFIGURED" },
    });
  }

  /* app configurations */
  for (const platform of ["ANDROID", "IOS", "WEB"] as const) {
    await prisma.appConfiguration.upsert({
      where: { platform },
      update: {},
      create: {
        platform,
        appName: "Pak Tenders",
        welcomeMessage: "Find, track and understand public procurement opportunities across Pakistan.",
        maintenanceMode: false,
        featuresJson: {
          chatbot: false,
          alerts: true,
          savedTenders: true,
          offlineCache: true,
          payments: false,
        },
        privacyUrl: "https://paktenders.pk/privacy-policy",
        termsUrl: "https://paktenders.pk/terms-and-conditions",
        supportUrl: "https://paktenders.pk/contact",
      },
    });
  }

  /* knowledge base */
  for (const a of knowledgeArticles) {
    await prisma.chatbotKnowledgeArticle.upsert({
      where: { slug: a.slug },
      update: { title: a.title, content: a.content, category: a.category, status: "PUBLISHED" },
      create: { slug: a.slug, title: a.title, content: a.content, category: a.category, status: "PUBLISHED" },
    });
  }

  /* bootstrap super admin */
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { fullName: "Platform Super Admin", status: "ACTIVE", emailVerifiedAt: new Date() },
    create: {
      email: ADMIN_EMAIL,
      fullName: "Platform Super Admin",
      passwordHash,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      profile: { create: { jobTitle: "Super Administrator" } },
      preference: { create: {} },
      notificationPref: { create: {} },
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roleIds.get("SUPER_ADMIN")! } },
    update: {},
    create: { userId: admin.id, roleId: roleIds.get("SUPER_ADMIN")! },
  });
  console.log(`  super admin: ${ADMIN_EMAIL}`);

  /* blog */
  const blogCategoryIds = new Map<string, string>();
  for (const c of blogCategories) {
    const row = await prisma.blogCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: { name: c.name, slug: c.slug },
    });
    blogCategoryIds.set(c.slug, row.id);
  }
  for (const post of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        readingMinutes: post.readingMinutes,
        categoryId: blogCategoryIds.get(post.category) ?? null,
        authorId: admin.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
        seoTitle: post.title,
        metaDescription: post.excerpt,
      },
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        readingMinutes: post.readingMinutes,
        categoryId: blogCategoryIds.get(post.category) ?? null,
        authorId: admin.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
        seoTitle: post.title,
        metaDescription: post.excerpt,
      },
    });
  }

  /* demo tenders */
  if (SEED_DEMO) {
    let created = 0;
    for (const t of demoTenders) {
      const categoryId = categoryIds.get(t.category);
      const departmentId = departmentIds.get(t.department);
      const provinceId = provinceIds.get(t.province);
      const cityId = cityIds.get(`${t.province}:${t.city}`);
      if (!categoryId || !departmentId || !provinceId) continue;

      const closingAt = new Date(Date.now() + t.closesInDays * 86_400_000);
      const publishedAt = new Date(Date.now() - (2 + (created % 5)) * 86_400_000);
      const sourceId = t.source ? sourceIds.get(t.source) : undefined;

      await prisma.tender.upsert({
        where: { slug: t.slug },
        update: {
          closingAt,
          status: closingAt > new Date() ? "PUBLISHED" : "CLOSED",
          isDemo: true,
          verificationStatus: "DEMO",
        },
        create: {
          slug: t.slug,
          title: t.title,
          referenceNumber: `DEMO-${String(created + 1).padStart(4, "0")}`,
          description: t.description,
          summary: t.description.slice(0, 240),
          categoryId,
          departmentId,
          provinceId,
          cityId: cityId ?? null,
          sourceId: sourceId ?? null,
          tenderType: t.type,
          status: "PUBLISHED",
          verificationStatus: "DEMO",
          publishedAt,
          closingAt,
          estimatedValue: t.estimatedValue ?? null,
          eligibility: t.eligibility,
          bidSecurityAmount: t.bidSecurity > 0 ? t.bidSecurity : null,
          bidSecurityDetails:
            t.bidSecurity > 0
              ? "Demo record: bid security is stated as a pay order or bank guarantee in favour of the issuing department."
              : "Demo record: no bid security is stated for this notice.",
          requiredDocuments: t.docs,
          contactName: "Procurement Section (demo)",
          contactEmail: "procurement@example.gov.pk",
          contactPhone: "+92 51 0000000",
          contactAddress: "Demo address — verify with the issuing department",
          sourceAttribution: "Demo record created for platform evaluation. Not a real notice.",
          isDemo: true,
          isFeatured: t.featured ?? false,
          createdById: admin.id,
        },
      });
      created += 1;
    }
    console.log(`  demo tenders: ${created} (flagged isDemo=true)`);
  } else {
    console.log("  demo tenders: skipped (SEED_DEMO_DATA=false)");
  }

  console.log("\nSeed complete.");
  console.log(`Admin login: ${ADMIN_EMAIL} (change the password immediately in production)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
