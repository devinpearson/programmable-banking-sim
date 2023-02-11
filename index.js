require('dotenv').config()
const express = require('express')
const cors = require('cors')
const dayjs = require('dayjs')
const db = require('better-sqlite3')('foobar.db')

db.pragma('journal_mode = WAL')

const prepareDB = () => {
  // Create the accounts table
  db.exec('CREATE TABLE IF NOT EXISTS accounts (accountId TEXT, accountNumber TEXT, accountName TEXT, referenceName TEXT, productName TEXT)')
  // Create the transactions table
  db.exec('CREATE TABLE IF NOT EXISTS transactions (accountId TEXT, type TEXT, transactiontype TEXT, status TEXT, description TEXT, cardNumber Number, postedOrder Number, postingDate TEXT, valueDate TEXT, actionDate TEXT, transactionDate TEXT, amount Number, runningBalance Number)')
  // Create the countries table
  db.exec('CREATE TABLE IF NOT EXISTS countries (code TEXT,name TEXT)')
  // Create the currencies table
  db.exec('CREATE TABLE IF NOT EXISTS currencies (code TEXT,name TEXT)')
  // Create the merchants table
  db.exec('CREATE TABLE IF NOT EXISTS merchants (code TEXT,name TEXT)')
}

const prepareCountries = () => {
  const insertCountry = db.prepare('INSERT INTO countries (code,name) VALUES (@code, @name)')

  const insertManyCountries = db.transaction((countryArr) => {
    for (const country of countryArr) insertCountry.run(country)
  })

  insertManyCountries([
    { code: 'ZA', name: 'South Africa' },
    { code: 'GB', name: 'United Kingdom of Great Britain and Northern Ireland (the)' },
    { code: 'AF', name: 'Afghanistan' },
    { code: 'AL', name: 'Albania' },
    { code: 'DZ', name: 'Algeria' },
    { code: 'AS', name: 'American Samoa' },
    { code: 'AD', name: 'Andorra' },
    { code: 'AO', name: 'Angola' },
    { code: 'AI', name: 'Anguilla' },
    { code: 'AQ', name: 'Antarctica' },
    { code: 'AG', name: 'Antigua and Barbuda' },
    { code: 'AR', name: 'Argentina' },
    { code: 'AM', name: 'Armenia' },
    { code: 'AW', name: 'Aruba' },
    { code: 'AU', name: 'Australia' },
    { code: 'AT', name: 'Austria' },
    { code: 'AZ', name: 'Azerbaijan' },
    { code: 'BS', name: 'Bahamas (the)' },
    { code: 'BH', name: 'Bahrain' },
    { code: 'BD', name: 'Bangladesh' },
    { code: 'BB', name: 'Barbados' },
    { code: 'BY', name: 'Belarus' },
    { code: 'BE', name: 'Belgium' },
    { code: 'BZ', name: 'Belize' },
    { code: 'BJ', name: 'Benin' },
    { code: 'BM', name: 'Bermuda' },
    { code: 'BT', name: 'Bhutan' },
    { code: 'BO', name: 'Bolivia (Plurinational State of)' },
    { code: 'BQ', name: 'Bonaire, Sint Eustatius and Saba' },
    { code: 'BA', name: 'Bosnia and Herzegovina' },
    { code: 'BW', name: 'Botswana' },
    { code: 'BV', name: 'Bouvet Island' },
    { code: 'BR', name: 'Brazil' },
    { code: 'IO', name: 'British Indian Ocean Territory (the)' },
    { code: 'BN', name: 'Brunei Darussalam' },
    { code: 'BG', name: 'Bulgaria' },
    { code: 'BF', name: 'Burkina Faso' },
    { code: 'BI', name: 'Burundi' },
    { code: 'CV', name: 'Cabo Verde' },
    { code: 'KH', name: 'Cambodia' },
    { code: 'CM', name: 'Cameroon' },
    { code: 'CA', name: 'Canada' },
    { code: 'KY', name: 'Cayman Islands (the)' },
    { code: 'CF', name: 'Central African Republic (the)' },
    { code: 'TD', name: 'Chad' },
    { code: 'CL', name: 'Chile' },
    { code: 'CN', name: 'China' },
    { code: 'CX', name: 'Christmas Island' },
    { code: 'CC', name: 'Cocos (Keeling) Islands (the)' },
    { code: 'CO', name: 'Colombia' },
    { code: 'KM', name: 'Comoros (the)' },
    { code: 'CD', name: 'Congo (the Democratic Republic of the)' },
    { code: 'CG', name: 'Congo (the)' },
    { code: 'CK', name: 'Cook Islands (the)' },
    { code: 'CR', name: 'Costa Rica' },
    { code: 'HR', name: 'Croatia' },
    { code: 'CU', name: 'Cuba' },
    { code: 'CW', name: 'Curaçao' },
    { code: 'CY', name: 'Cyprus' },
    { code: 'CZ', name: 'Czechia' },
    { code: 'CI', name: "Côte d'Ivoire" },
    { code: 'DK', name: 'Denmark' },
    { code: 'DJ', name: 'Djibouti' },
    { code: 'DM', name: 'Dominica' },
    { code: 'DO', name: 'Dominican Republic (the)' },
    { code: 'EC', name: 'Ecuador' },
    { code: 'EG', name: 'Egypt' },
    { code: 'SV', name: 'El Salvador' },
    { code: 'GQ', name: 'Equatorial Guinea' },
    { code: 'ER', name: 'Eritrea' },
    { code: 'EE', name: 'Estonia' },
    { code: 'SZ', name: 'Eswatini' },
    { code: 'ET', name: 'Ethiopia' },
    { code: 'FK', name: 'Falkland Islands (the) [Malvinas]' },
    { code: 'FO', name: 'Faroe Islands (the)' },
    { code: 'FJ', name: 'Fiji' },
    { code: 'FI', name: 'Finland' },
    { code: 'FR', name: 'France' },
    { code: 'GF', name: 'French Guiana' },
    { code: 'PF', name: 'French Polynesia' },
    { code: 'TF', name: 'French Southern Territories (the)' },
    { code: 'GA', name: 'Gabon' },
    { code: 'GM', name: 'Gambia (the)' },
    { code: 'GE', name: 'Georgia' },
    { code: 'DE', name: 'Germany' },
    { code: 'GH', name: 'Ghana' },
    { code: 'GI', name: 'Gibraltar' },
    { code: 'GR', name: 'Greece' },
    { code: 'GL', name: 'Greenland' },
    { code: 'GD', name: 'Grenada' },
    { code: 'GP', name: 'Guadeloupe' },
    { code: 'GU', name: 'Guam' },
    { code: 'GT', name: 'Guatemala' },
    { code: 'GG', name: 'Guernsey' },
    { code: 'GN', name: 'Guinea' },
    { code: 'GW', name: 'Guinea-Bissau' },
    { code: 'GY', name: 'Guyana' },
    { code: 'HT', name: 'Haiti' },
    { code: 'HM', name: 'Heard Island and McDonald Islands' },
    { code: 'VA', name: 'Holy See (the)' },
    { code: 'HN', name: 'Honduras' },
    { code: 'HK', name: 'Hong Kong' },
    { code: 'HU', name: 'Hungary' },
    { code: 'IS', name: 'Iceland' },
    { code: 'IN', name: 'India' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'IR', name: 'Iran (Islamic Republic of)' },
    { code: 'IQ', name: 'Iraq' },
    { code: 'IE', name: 'Ireland' },
    { code: 'IM', name: 'Isle of Man' },
    { code: 'IL', name: 'Israel' },
    { code: 'IT', name: 'Italy' },
    { code: 'JM', name: 'Jamaica' },
    { code: 'JP', name: 'Japan' },
    { code: 'JE', name: 'Jersey' },
    { code: 'JO', name: 'Jordan' },
    { code: 'KZ', name: 'Kazakhstan' },
    { code: 'KE', name: 'Kenya' },
    { code: 'KI', name: 'Kiribati' },
    { code: 'KP', name: "Korea (the Democratic People's Republic of)" },
    { code: 'KR', name: 'Korea (the Republic of)' },
    { code: 'KW', name: 'Kuwait' },
    { code: 'KG', name: 'Kyrgyzstan' },
    { code: 'LA', name: "Lao People's Democratic Republic (the)" },
    { code: 'LV', name: 'Latvia' },
    { code: 'LB', name: 'Lebanon' },
    { code: 'LS', name: 'Lesotho' },
    { code: 'LR', name: 'Liberia' },
    { code: 'LY', name: 'Libya' },
    { code: 'LI', name: 'Liechtenstein' },
    { code: 'LT', name: 'Lithuania' },
    { code: 'LU', name: 'Luxembourg' },
    { code: 'MO', name: 'Macao' },
    { code: 'MK', name: 'Macedonia (the former Yugoslav Republic of)' },
    { code: 'MG', name: 'Madagascar' },
    { code: 'MW', name: 'Malawi' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'MV', name: 'Maldives' },
    { code: 'ML', name: 'Mali' },
    { code: 'MT', name: 'Malta' },
    { code: 'MH', name: 'Marshall Islands (the)' },
    { code: 'MQ', name: 'Martinique' },
    { code: 'MR', name: 'Mauritania' },
    { code: 'MU', name: 'Mauritius' },
    { code: 'YT', name: 'Mayotte' },
    { code: 'MX', name: 'Mexico' },
    { code: 'FM', name: 'Micronesia (Federated States of)' },
    { code: 'MD', name: 'Moldova (the Republic of)' },
    { code: 'MC', name: 'Monaco' },
    { code: 'MN', name: 'Mongolia' },
    { code: 'ME', name: 'Montenegro' },
    { code: 'MS', name: 'Montserrat' },
    { code: 'MA', name: 'Morocco' },
    { code: 'MZ', name: 'Mozambique' },
    { code: 'MM', name: 'Myanmar' },
    { code: 'NA', name: 'Namibia' },
    { code: 'NR', name: 'Nauru' },
    { code: 'NP', name: 'Nepal' },
    { code: 'NL', name: 'Netherlands (the)' },
    { code: 'NC', name: 'New Caledonia' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'NI', name: 'Nicaragua' },
    { code: 'NE', name: 'Niger (the)' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'NU', name: 'Niue' },
    { code: 'NF', name: 'Norfolk Island' },
    { code: 'MP', name: 'Northern Mariana Islands (the)' },
    { code: 'NO', name: 'Norway' },
    { code: 'OM', name: 'Oman' },
    { code: 'PK', name: 'Pakistan' },
    { code: 'PW', name: 'Palau' },
    { code: 'PS', name: 'Palestine, State of' },
    { code: 'PA', name: 'Panama' },
    { code: 'PG', name: 'Papua New Guinea' },
    { code: 'PY', name: 'Paraguay' },
    { code: 'PE', name: 'Peru' },
    { code: 'PH', name: 'Philippines (the)' },
    { code: 'PN', name: 'Pitcairn' },
    { code: 'PL', name: 'Poland' },
    { code: 'PT', name: 'Portugal' },
    { code: 'PR', name: 'Puerto Rico' },
    { code: 'QA', name: 'Qatar' },
    { code: 'RO', name: 'Romania' },
    { code: 'RU', name: 'Russian Federation (the)' },
    { code: 'RW', name: 'Rwanda' },
    { code: 'RE', name: 'Réunion' },
    { code: 'BL', name: 'Saint Barthélemy' },
    { code: 'SH', name: 'Saint Helena, Ascension and Tristan da Cunha' },
    { code: 'KN', name: 'Saint Kitts and Nevis' },
    { code: 'LC', name: 'Saint Lucia' },
    { code: 'MF', name: 'Saint Martin (French part)' },
    { code: 'PM', name: 'Saint Pierre and Miquelon' },
    { code: 'VC', name: 'Saint Vincent and the Grenadines' },
    { code: 'WS', name: 'Samoa' },
    { code: 'SM', name: 'San Marino' },
    { code: 'ST', name: 'Sao Tome and Principe' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'SN', name: 'Senegal' },
    { code: 'RS', name: 'Serbia' },
    { code: 'SC', name: 'Seychelles' },
    { code: 'SL', name: 'Sierra Leone' },
    { code: 'SG', name: 'Singapore' },
    { code: 'SX', name: 'Sint Maarten (Dutch part)' },
    { code: 'SK', name: 'Slovakia' },
    { code: 'SI', name: 'Slovenia' },
    { code: 'SB', name: 'Solomon Islands' },
    { code: 'SO', name: 'Somalia' },
    { code: 'GS', name: 'South Georgia and the South Sandwich Islands' },
    { code: 'SS', name: 'South Sudan' },
    { code: 'ES', name: 'Spain' },
    { code: 'LK', name: 'Sri Lanka' },
    { code: 'SD', name: 'Sudan (the)' },
    { code: 'SR', name: 'Suriname' },
    { code: 'SJ', name: 'Svalbard and Jan Mayen' },
    { code: 'SE', name: 'Sweden' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'SY', name: 'Syrian Arab Republic' },
    { code: 'TW', name: 'Taiwan (Province of China)' },
    { code: 'TJ', name: 'Tajikistan' },
    { code: 'TZ', name: 'Tanzania, United Republic of' },
    { code: 'TH', name: 'Thailand' },
    { code: 'TL', name: 'Timor-Leste' },
    { code: 'TG', name: 'Togo' },
    { code: 'TK', name: 'Tokelau' },
    { code: 'TO', name: 'Tonga' },
    { code: 'TT', name: 'Trinidad and Tobago' },
    { code: 'TN', name: 'Tunisia' },
    { code: 'TR', name: 'Turkey' },
    { code: 'TM', name: 'Turkmenistan' },
    { code: 'TC', name: 'Turks and Caicos Islands (the)' },
    { code: 'TV', name: 'Tuvalu' },
    { code: 'UG', name: 'Uganda' },
    { code: 'UA', name: 'Ukraine' },
    { code: 'AE', name: 'United Arab Emirates (the)' },
    { code: 'UM', name: 'United States Minor Outlying Islands (the)' },
    { code: 'US', name: 'United States of America (the)' },
    { code: 'UY', name: 'Uruguay' },
    { code: 'UZ', name: 'Uzbekistan' },
    { code: 'VU', name: 'Vanuatu' },
    { code: 'VE', name: 'Venezuela (Bolivarian Republic of)' },
    { code: 'VN', name: 'Viet Nam' },
    { code: 'VG', name: 'Virgin Islands (British)' },
    { code: 'VI', name: 'Virgin Islands (U.S.)' },
    { code: 'WF', name: 'Wallis and Futuna' },
    { code: 'EH', name: 'Western Sahara' },
    { code: 'YE', name: 'Yemen' },
    { code: 'ZM', name: 'Zambia' },
    { code: 'ZW', name: 'Zimbabwe' },
    { code: 'AX', name: 'Åland Islands' },
    { code: 'undefined', name: 'undefined' }
  ])
}

const prepareCurrencies = () => {
  const insertCurrency = db.prepare('INSERT INTO currencies (code,name) VALUES (@code, @name)')

  const insertManyCurrencies = db.transaction((currencyArr) => {
    for (const currency of currencyArr) insertCurrency.run(currency)
  })

  insertManyCurrencies([
    { code: 'ZAR', name: 'South African Rand' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'USD', name: 'United States Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'CHF', name: 'Swiss Franc' },
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'DKK', name: 'Danish Krone' },
    { code: 'HKD', name: 'Hong Kong Dollar' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'MUR', name: 'Mauritius Rupee' },
    { code: 'NZD', name: 'New Zealand Dollar' },
    { code: 'NOK', name: 'Norwegian Krone' },
    { code: 'SGD', name: 'Singapore Dollar' },
    { code: 'SEK', name: 'Swedish Krona' },
    { code: 'AED', name: 'Emirati Dirham' },
    { code: 'BWP', name: 'Botswana Pula' },
    { code: 'INR', name: 'Indian Rupee' },
    { code: 'KES', name: 'Kenyan Shilling' },
    { code: 'NGN', name: 'Nigerian Naira' },
    { code: 'RUB', name: 'Russian Ruble' },
    { code: 'TRY', name: 'Turkish Lira' }
  ])
}

const prepareMerchants = () => {
  const insertMerchant = db.prepare('INSERT INTO merchants (code,name) VALUES (@code, @name)')

  const insertManyMerchants = db.transaction((merchantArr) => {
    for (const merchant of merchantArr) insertMerchant.run(merchant)
  })

  insertManyMerchants([
    { code: '7623', name: 'A/C, Refrigeration Repair' },
    { code: '8931', name: 'Accounting/Bookkeeping Services' },
    { code: '7311', name: 'Advertising Services' },
    { code: '763', name: 'Agricultural Cooperative' },
    { code: '4511', name: 'Airlines, Air Carriers' },
    { code: '4582', name: 'Airports, Flying Fields' },
    { code: '4119', name: 'Ambulance Services' },
    { code: '7996', name: 'Amusement Parks/Carnivals' },
    { code: '5937', name: 'Antique Reproductions' },
    { code: '5932', name: 'Antique Shops' },
    { code: '7998', name: 'Aquariums' },
    { code: '8911', name: 'Architectural/Surveying Services' },
    { code: '5971', name: 'Art Dealers and Galleries' },
    { code: '5970', name: 'Artists Supply and Craft Shops' },
    { code: '7531', name: 'Auto Body Repair Shops' },
    { code: '7535', name: 'Auto Paint Shops' },
    { code: '7538', name: 'Auto Service Shops' },
    { code: '5531', name: 'Auto and Home Supply Stores' },
    { code: '6011', name: 'Automated Cash Disburse' },
    { code: '5542', name: 'Automated Fuel Dispensers' },
    { code: '8675', name: 'Automobile Associations' },
    { code: '5533', name: 'Automotive Parts and Accessories Stores' },
    { code: '5532', name: 'Automotive Tire Stores' },
    { code: '9223', name: 'Bail and Bond Payments (payment to the surety for the bond, not the actual bond paid to the government agency)' },
    { code: '5462', name: 'Bakeries' },
    { code: '7929', name: 'Bands, Orchestras' },
    { code: '7230', name: 'Barber and Beauty Shops' },
    { code: '7995', name: 'Betting/Casino Gambling' },
    { code: '5940', name: 'Bicycle Shops' },
    { code: '7932', name: 'Billiard/Pool Establishments' },
    { code: '5551', name: 'Boat Dealers' },
    { code: '4457', name: 'Boat Rentals and Leases' },
    { code: '5942', name: 'Book Stores' },
    { code: '5192', name: 'Books, Periodicals, and Newspapers' },
    { code: '7933', name: 'Bowling Alleys' },
    { code: '4131', name: 'Bus Lines' },
    { code: '8244', name: 'Business/Secretarial Schools' },
    { code: '7278', name: 'Buying/Shopping Services' },
    { code: '4899', name: 'Cable, Satellite, and Other Pay Television and Radio' },
    { code: '5946', name: 'Camera and Photographic Supply Stores' },
    { code: '5441', name: 'Candy, Nut, and Confectionery Stores' },
    { code: '7512', name: 'Car Rental Agencies' },
    { code: '7542', name: 'Car Washes' },
    { code: '5511', name: 'Car and Truck Dealers (New & Used) Sales, Service, Repairs Parts and Leasing' },
    { code: '5521', name: 'Car and Truck Dealers (Used Only) Sales, Service, Repairs Parts and Leasing' },
    { code: '1750', name: 'Carpentry Services' },
    { code: '7217', name: 'Carpet/Upholstery Cleaning' },
    { code: '5811', name: 'Caterers' },
    { code: '8398', name: 'Charitable and Social Service Organizations - Fundraising' },
    { code: '5169', name: 'Chemicals and Allied Products (Not Elsewhere Classified)' },
    { code: '5641', name: 'Chidrens and Infants Wear Stores' },
    { code: '8351', name: 'Child Care Services' },
    { code: '8049', name: 'Chiropodists, Podiatrists' },
    { code: '8041', name: 'Chiropractors' },
    { code: '5993', name: 'Cigar Stores and Stands' },
    { code: '8641', name: 'Civic, Social, Fraternal Associations' },
    { code: '7349', name: 'Cleaning and Maintenance' },
    { code: '7296', name: 'Clothing Rental' },
    { code: '8220', name: 'Colleges, Universities' },
    { code: '5046', name: 'Commercial Equipment (Not Elsewhere Classified)' },
    { code: '5139', name: 'Commercial Footwear' },
    { code: '7333', name: 'Commercial Photography, Art and Graphics' },
    { code: '4111', name: 'Commuter Transport, Ferries' },
    { code: '4816', name: 'Computer Network Services' },
    { code: '7372', name: 'Computer Programming' },
    { code: '7379', name: 'Computer Repair' },
    { code: '5734', name: 'Computer Software Stores' },
    { code: '5045', name: 'Computers, Peripherals, and Software' },
    { code: '1771', name: 'Concrete Work Services' },
    { code: '5039', name: 'Construction Materials (Not Elsewhere Classified)' },
    { code: '7392', name: 'Consulting, Public Relations' },
    { code: '8241', name: 'Correspondence Schools' },
    { code: '5977', name: 'Cosmetic Stores' },
    { code: '7277', name: 'Counseling Services' },
    { code: '7997', name: 'Country Clubs' },
    { code: '4215', name: 'Courier Services' },
    { code: '9211', name: 'Court Costs, Including Alimony and Child Support - Courts of Law' },
    { code: '7321', name: 'Credit Reporting Agencies' },
    { code: '4411', name: 'Cruise Lines' },
    { code: '5451', name: 'Dairy Products Stores' },
    { code: '7911', name: 'Dance Hall, Studios, Schools' },
    { code: '7273', name: 'Dating/Escort Services' },
    { code: '8021', name: 'Dentists, Orthodontists' },
    { code: '5311', name: 'Department Stores' },
    { code: '7393', name: 'Detective Agencies' },
    { code: '5964', name: 'Direct Marketing - Catalog Merchant' },
    { code: '5965', name: 'Direct Marketing - Combination Catalog and Retail Merchant' },
    { code: '5967', name: 'Direct Marketing - Inbound Telemarketing' },
    { code: '5960', name: 'Direct Marketing - Insurance Services' },
    { code: '5969', name: 'Direct Marketing - Other' },
    { code: '5966', name: 'Direct Marketing - Outbound Telemarketing' },
    { code: '5968', name: 'Direct Marketing - Subscription' },
    { code: '5962', name: 'Direct Marketing - Travel' },
    { code: '5310', name: 'Discount Stores' },
    { code: '8011', name: 'Doctors' },
    { code: '5963', name: 'Door-To-Door Sales' },
    { code: '5714', name: 'Drapery, Window Covering, and Upholstery Stores' },
    { code: '5813', name: 'Drinking Places' },
    { code: '5912', name: 'Drug Stores and Pharmacies' },
    { code: '5122', name: 'Drugs, Drug Proprietaries, and Druggist Sundries' },
    { code: '7216', name: 'Dry Cleaners' },
    { code: '5099', name: 'Durable Goods (Not Elsewhere Classified)' },
    { code: '5309', name: 'Duty Free Stores' },
    { code: '5812', name: 'Eating Places, Restaurants' },
    { code: '8299', name: 'Educational Services' },
    { code: '5997', name: 'Electric Razor Stores' },
    { code: '5065', name: 'Electrical Parts and Equipment' },
    { code: '1731', name: 'Electrical Services' },
    { code: '7622', name: 'Electronics Repair Shops' },
    { code: '5732', name: 'Electronics Stores' },
    { code: '8211', name: 'Elementary, Secondary Schools' },
    { code: '7361', name: 'Employment/Temp Agencies' },
    { code: '7394', name: 'Equipment Rental' },
    { code: '7342', name: 'Exterminating Services' },
    { code: '5651', name: 'Family Clothing Stores' },
    { code: '5814', name: 'Fast Food Restaurants' },
    { code: '6012', name: 'Financial Institutions' },
    { code: '9222', name: 'Fines - Government Administrative Entities' },
    { code: '5718', name: 'Fireplace, Fireplace Screens, and Accessories Stores' },
    { code: '5713', name: 'Floor Covering Stores' },
    { code: '5992', name: 'Florists' },
    { code: '5193', name: 'Florists Supplies, Nursery Stock, and Flowers' },
    { code: '5422', name: 'Freezer and Locker Meat Provisioners' },
    { code: '5983', name: 'Fuel Dealers (Non Automotive)' },
    { code: '7261', name: 'Funeral Services, Crematories' },
    { code: '7641', name: 'Furniture Repair, Refinishing' },
    { code: '5712', name: 'Furniture, Home Furnishings, and Equipment Stores, Except Appliances' },
    { code: '5681', name: 'Furriers and Fur Shops' },
    { code: '1520', name: 'General Services' },
    { code: '5947', name: 'Gift, Card, Novelty, and Souvenir Shops' },
    { code: '5231', name: 'Glass, Paint, and Wallpaper Stores' },
    { code: '5950', name: 'Glassware, Crystal Stores' },
    { code: '7992', name: 'Golf Courses - Public' },
    { code: '9399', name: 'Government Services (Not Elsewhere Classified)' },
    { code: '5411', name: 'Grocery Stores, Supermarkets' },
    { code: '5251', name: 'Hardware Stores' },
    { code: '5072', name: 'Hardware, Equipment, and Supplies' },
    { code: '7298', name: 'Health and Beauty Spas' },
    { code: '5975', name: 'Hearing Aids Sales and Supplies' },
    { code: '1711', name: 'Heating, Plumbing, A/C' },
    { code: '5945', name: 'Hobby, Toy, and Game Shops' },
    { code: '5200', name: 'Home Supply Warehouse Stores' },
    { code: '8062', name: 'Hospitals' },
    { code: '7011', name: 'Hotels, Motels, and Resorts' },
    { code: '5722', name: 'Household Appliance Stores' },
    { code: '5085', name: 'Industrial Supplies (Not Elsewhere Classified)' },
    { code: '7375', name: 'Information Retrieval Services' },
    { code: '6399', name: 'Insurance - Default' },
    { code: '6300', name: 'Insurance Underwriting, Premiums' },
    { code: '9950', name: 'Intra-Company Purchases' },
    { code: '5944', name: 'Jewelry Stores, Watches, Clocks, and Silverware Stores' },
    { code: '780', name: 'Landscaping Services' },
    { code: '7211', name: 'Laundries' },
    { code: '7210', name: 'Laundry, Cleaning Services' },
    { code: '8111', name: 'Legal Services, Attorneys' },
    { code: '5948', name: 'Luggage and Leather Goods Stores' },
    { code: '5211', name: 'Lumber, Building Materials Stores' },
    { code: '6010', name: 'Manual Cash Disburse' },
    { code: '4468', name: 'Marinas, Service and Supplies' },
    { code: '1740', name: 'Masonry, Stonework, and Plaster' },
    { code: '7297', name: 'Massage Parlors' },
    { code: '8099', name: 'Medical Services' },
    { code: '8071', name: 'Medical and Dental Labs' },
    { code: '5047', name: 'Medical, Dental, Ophthalmic, and Hospital Equipment and Supplies' },
    { code: '8699', name: 'Membership Organizations' },
    { code: '5611', name: 'Mens and Boys Clothing and Accessories Stores' },
    { code: '5691', name: 'Mens, Womens Clothing Stores' },
    { code: '5051', name: 'Metal Service Centers' },
    { code: '5699', name: 'Miscellaneous Apparel and Accessory Shops' },
    { code: '5599', name: 'Miscellaneous Auto Dealers' },
    { code: '7399', name: 'Miscellaneous Business Services' },
    { code: '5499', name: 'Miscellaneous Food Stores - Convenience Stores and Specialty Markets' },
    { code: '5399', name: 'Miscellaneous General Merchandise' },
    { code: '7299', name: 'Miscellaneous General Services' },
    { code: '5719', name: 'Miscellaneous Home Furnishing Specialty Stores' },
    { code: '2741', name: 'Miscellaneous Publishing and Printing' },
    { code: '7999', name: 'Miscellaneous Recreation Services' },
    { code: '7699', name: 'Miscellaneous Repair Shops' },
    { code: '5999', name: 'Miscellaneous Specialty Retail' },
    { code: '5271', name: 'Mobile Home Dealers' },
    { code: '7832', name: 'Motion Picture Theaters' },
    { code: '4214', name: 'Motor Freight Carriers and Trucking - Local and Long Distance, Moving and Storage Companies, and Local Delivery Services' },
    { code: '5592', name: 'Motor Homes Dealers' },
    { code: '5013', name: 'Motor Vehicle Supplies and New Parts' },
    { code: '5571', name: 'Motorcycle Shops and Dealers' },
    { code: '5561', name: 'Motorcycle Shops, Dealers' },
    { code: '5733', name: 'Music Stores-Musical Instruments, Pianos, and Sheet Music' },
    { code: '5994', name: 'News Dealers and Newsstands' },
    { code: '6051', name: 'Non-FI, Money Orders' },
    { code: '6540', name: 'Non-FI, Stored Value Card Purchase/Load' },
    { code: '5199', name: 'Nondurable Goods (Not Elsewhere Classified)' },
    { code: '5261', name: 'Nurseries, Lawn and Garden Supply Stores' },
    { code: '8050', name: 'Nursing/Personal Care' },
    { code: '5021', name: 'Office and Commercial Furniture' },
    { code: '8043', name: 'Opticians, Eyeglasses' },
    { code: '8042', name: 'Optometrists, Ophthalmologist' },
    { code: '5976', name: 'Orthopedic Goods - Prosthetic Devices' },
    { code: '8031', name: 'Osteopaths' },
    { code: '5921', name: 'Package Stores-Beer, Wine, and Liquor' },
    { code: '5198', name: 'Paints, Varnishes, and Supplies' },
    { code: '7523', name: 'Parking Lots, Garages' },
    { code: '4112', name: 'Passenger Railways' },
    { code: '5933', name: 'Pawn Shops' },
    { code: '5995', name: 'Pet Shops, Pet Food, and Supplies' },
    { code: '5172', name: 'Petroleum and Petroleum Products' },
    { code: '7395', name: 'Photo Developing' },
    { code: '7221', name: 'Photographic Studios' },
    { code: '5044', name: 'Photographic, Photocopy, Microfilm Equipment, and Supplies' },
    { code: '7829', name: 'Picture/Video Production' },
    { code: '5131', name: 'Piece Goods, Notions, and Other Dry Goods' },
    { code: '5074', name: 'Plumbing, Heating Equipment, and Supplies' },
    { code: '8651', name: 'Political Organizations' },
    { code: '9402', name: 'Postal Services - Government Only' },
    { code: '5094', name: 'Precious Stones and Metals, Watches and Jewelry' },
    { code: '8999', name: 'Professional Services' },
    { code: '4225', name: 'Public Warehousing and Storage - Farm Products, Refrigerated Goods, Household Goods, and Storage' },
    { code: '7338', name: 'Quick Copy, Repro, and Blueprint' },
    { code: '4011', name: 'Railroads' },
    { code: '6513', name: 'Real Estate Agents and Managers - Rentals' },
    { code: '5735', name: 'Record Stores' },
    { code: '7519', name: 'Recreational Vehicle Rentals' },
    { code: '5973', name: 'Religious Goods Stores' },
    { code: '8661', name: 'Religious Organizations' },
    { code: '1761', name: 'Roofing/Siding, Sheet Metal' },
    { code: '7339', name: 'Secretarial Support Services' },
    { code: '6211', name: 'Security Brokers/Dealers' },
    { code: '5541', name: 'Service Stations' },
    { code: '5949', name: 'Sewing, Needlework, Fabric, and Piece Goods Stores' },
    { code: '7251', name: 'Shoe Repair/Hat Cleaning' },
    { code: '5661', name: 'Shoe Stores' },
    { code: '7629', name: 'Small Appliance Repair' },
    { code: '5598', name: 'Snowmobile Dealers' },
    { code: '1799', name: 'Special Trade Services' },
    { code: '2842', name: 'Specialty Cleaning' },
    { code: '5941', name: 'Sporting Goods Stores' },
    { code: '7032', name: 'Sporting/Recreation Camps' },
    { code: '7941', name: 'Sports Clubs/Fields' },
    { code: '5655', name: 'Sports and Riding Apparel Stores' },
    { code: '5972', name: 'Stamp and Coin Stores' },
    { code: '5111', name: 'Stationary, Office Supplies, Printing and Writing Paper' },
    { code: '5943', name: 'Stationery Stores, Office, and School Supply Stores' },
    { code: '5996', name: 'Swimming Pools Sales' },
    { code: '4723', name: 'TUI Travel - Germany' },
    { code: '5697', name: 'Tailors, Alterations' },
    { code: '9311', name: 'Tax Payments - Government Agencies' },
    { code: '7276', name: 'Tax Preparation Services' },
    { code: '4121', name: 'Taxicabs/Limousines' },
    { code: '4812', name: 'Telecommunication Equipment and Telephone Sales' },
    { code: '4814', name: 'Telecommunication Services' },
    { code: '4821', name: 'Telegraph Services' },
    { code: '5998', name: 'Tent and Awning Shops' },
    { code: '8734', name: 'Testing Laboratories' },
    { code: '7922', name: 'Theatrical Ticket Agencies' },
    { code: '7012', name: 'Timeshares' },
    { code: '7534', name: 'Tire Retreading and Repair' },
    { code: '4784', name: 'Tolls/Bridge Fees' },
    { code: '7991', name: 'Tourist Attractions and Exhibits' },
    { code: '7549', name: 'Towing Services' },
    { code: '7033', name: 'Trailer Parks, Campgrounds' },
    { code: '4789', name: 'Transportation Services (Not Elsewhere Classified)' },
    { code: '4722', name: 'Travel Agencies, Tour Operators' },
    { code: '7511', name: 'Truck StopIteration' },
    { code: '7513', name: 'Truck/Utility Trailer Rentals' },
    { code: '2791', name: 'Typesetting, Plate Making, and Related Services' },
    { code: '5978', name: 'Typewriter Stores' },
    { code: '9405', name: 'U.S. Federal Government Agencies or Departments' },
    { code: '5137', name: 'Uniforms, Commercial Clothing' },
    { code: '5931', name: 'Used Merchandise and Secondhand Stores' },
    { code: '4900', name: 'Utilities' },
    { code: '5331', name: 'Variety Stores' },
    { code: '742', name: 'Veterinary Services' },
    { code: '7993', name: 'Video Amusement Game Supplies' },
    { code: '7994', name: 'Video Game Arcades' },
    { code: '7841', name: 'Video Tape Rental Stores' },
    { code: '8249', name: 'Vocational/Trade Schools' },
    { code: '7631', name: 'Watch/Jewelry Repair' },
    { code: '7692', name: 'Welding Repair' },
    { code: '5300', name: 'Wholesale Clubs' },
    { code: '5698', name: 'Wig and Toupee Stores' },
    { code: '4829', name: 'Wires, Money Orders' },
    { code: '5631', name: 'Womens Accessory and Specialty Shops' },
    { code: '5621', name: 'Womens Ready-To-Wear Stores' },
    { code: '5935', name: 'Wrecking and Salvage Yards' }
  ])
}

const prepareAccounts = () => {
  const insertAccount = db.prepare('INSERT INTO accounts (accountId, accountNumber, accountName, referenceName, productName) VALUES (@accountId, @accountNumber, @accountName, @referenceName, @productName)')

  const insertManyAccounts = db.transaction((accounts2) => {
    for (const account of accounts2) insertAccount.run(account)
  })

  insertManyAccounts([
    { accountId: '4675778129910189600000003', accountNumber: '10012420003', accountName: 'My Account', referenceName: 'My Account', productName: 'My Account' },
    { accountId: '4675778129910189600000004', accountNumber: '10012420004', accountName: 'My Account', referenceName: 'My Account', productName: 'My Account' },
    { accountId: '4675778129910189600000005', accountNumber: '10012420005', accountName: 'My Account', referenceName: 'My Account', productName: 'My Account' }
  ])
}

const prepareTransactions = () => {
  const insertTransaction = db.prepare('INSERT INTO transactions (accountId, type, transactionType, status, description, cardNumber, postedOrder, postingDate, valueDate, actionDate, transactionDate, amount, runningBalance) VALUES (@accountId, @type, @transactionType, @status, @description, @cardNumber, @postedOrder, @postingDate, @valueDate, @actionDate, @transactionDate, @amount, @runningBalance)')

  const insertManyTransactions = db.transaction((transactions2) => {
    for (const transaction of transactions2) insertTransaction.run(transaction)
  })

  const accountId = '4675778129910189600000003'
  insertManyTransactions([
    { accountId, type: 'DEBIT', transactionType: 'CardPurchases', status: 'POSTED', description: 'HTTP://WWW.UBEREATS.CO PARKTOWN NOR ZA', cardNumber: '402167xxxxxx9999', postedOrder: 0, postingDate: '2023-01-22', valueDate: '2022-05-15', actionDate: '2022-04-24', transactionDate: '2022-04-21', amount: '40.99', runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'CardPurchases', status: 'POSTED', description: 'HTTP://WWW.UBEREATS.CO PARKTOWN NOR ZA', cardNumber: '402167xxxxxx9999', postedOrder: 0, postingDate: '2023-01-22', valueDate: '2022-05-15', actionDate: '2022-04-24', transactionDate: '2022-04-21', amount: 406.9, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'FeesAndInterest', status: 'POSTED', description: 'MONTHLY SERVICE CHARGE', cardNumber: '', postedOrder: 0, postingDate: '2023-01-16', valueDate: '2023-01-15', actionDate: '2022-04-24', transactionDate: '2022-04-15', amount: 555, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'FeesAndInterest', status: 'POSTED', description: 'DEBIT INTEREST', cardNumber: '', postedOrder: 0, postingDate: '2023-01-16', valueDate: '2023-01-15', actionDate: '2022-04-24', transactionDate: '2022-04-15', amount: 0.61, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'FasterPay', status: 'POSTED', description: 'FASTER PAYMENT FEE', cardNumber: '', postedOrder: 0, postingDate: '2023-01-07', valueDate: '2023-01-15', actionDate: '2022-04-24', transactionDate: '2022-04-07', amount: 40, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'FasterPay', status: 'POSTED', description: 'BIZ', cardNumber: '', postedOrder: 0, postingDate: '2023-01-07', valueDate: '2022-04-07', actionDate: '2022-04-24', transactionDate: '2022-04-07', amount: 5000, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'OnlineBankingPayments', status: 'POSTED', description: 'Apple Sauce', cardNumber: '', postedOrder: 0, postingDate: '2023-01-04', valueDate: '2022-04-04', actionDate: '2022-04-24', transactionDate: '2022-04-04', amount: 10000, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'DebitOrders', status: 'POSTED', description: 'INVESTECPB 40756003 09375003', cardNumber: '', postedOrder: 0, postingDate: '2023-01-01', valueDate: '2022-04-01', actionDate: '2022-04-24', transactionDate: '2022-04-01', amount: '7338.37', runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'DebitOrders', status: 'POSTED', description: 'VIRGIN ACT400396003 178003', cardNumber: '', postedOrder: 0, postingDate: '2023-01-01', valueDate: '2022-04-01', actionDate: '2022-04-24', transactionDate: '2022-04-01', amount: '232.5', runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'FasterPay', status: 'POSTED', description: 'FASTER PAYMENT FEE', cardNumber: '', postedOrder: 0, postingDate: '2022-12-30', valueDate: '2022-04-15', actionDate: '2022-04-24', transactionDate: '2022-03-30', amount: 40, runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'FasterPay', status: 'POSTED', description: 'BIZ', cardNumber: '', postedOrder: 0, postingDate: '2022-12-30', valueDate: '2022-12-30', actionDate: '2022-04-24', transactionDate: '2022-03-30', amount: '25000', runningBalance: 0 },
    { accountId, type: 'DEBIT', transactionType: 'OnlineBankingPayments', status: 'POSTED', description: 'LEVIES', cardNumber: '', postedOrder: 0, postingDate: '2022-12-30', valueDate: '2022-03-30', actionDate: '2022-04-24', transactionDate: '2022-03-30', amount: '4593.63', runningBalance: 0 },
    { accountId, type: 'CREDIT', transactionType: 'Deposits', status: 'POSTED', description: 'SALARY', cardNumber: '', postedOrder: 0, postingDate: '2022-12-25', valueDate: '2022-03-25', actionDate: '2022-04-24', transactionDate: '2022-03-25', amount: '17551.96', runningBalance: 0 }
  ])
}

const insertTransaction = (accountId, type, transactionType, status, description, cardNumber, postingDate, valueDate, actionDate, transactionDate, amount) => {
  const insertTransaction = db.prepare('INSERT INTO transactions (accountId, type, transactionType, status, description, cardNumber, postedOrder, postingDate, valueDate, actionDate, transactionDate, amount, runningBalance) VALUES (@accountId, @type, @transactionType, @status, @description, @cardNumber, @postedOrder, @postingDate, @valueDate, @actionDate, @transactionDate, @amount, @runningBalance)')
  db.transaction(() => {
    insertTransaction.run({ accountId, type, transactionType, status, description, cardNumber, postedOrder: 0, postingDate, valueDate, actionDate, transactionDate, amount, runningBalance: 0 })
  })
}

const isValidAccount = (accountId) => {
  const accountsArr = db.prepare('SELECT * FROM accounts WHERE accountId = ?').get(accountId)
  if (accountsArr === undefined) {
    return false // no account was found
  }
  return true
}

prepareDB()
prepareAccounts()
prepareTransactions()
prepareCountries()
prepareCurrencies()
prepareMerchants()

const app = express()
const port = process.env.PORT || 3000
// const datafile = process.env.DATAFILE || 'data/accounts.json'

app.use(cors())

// Configuring body parser middleware
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

const accessTokens = {}

app.post('/identity/v2/oauth2/token', (req, res) => {
  const authStr = Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString()
  const [clientId, clientSecret] = authStr.split(':')

  if (process.env.CLIENT_ID !== '' && process.env.CLIENT_SECRET !== '') {
    if (clientId !== process.env.CLIENT_ID || clientSecret !== process.env.CLIENT_SECRET) {
      return res.status(401).json()
    }
  }
  // Generate a token string
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  const expiryDate = dayjs().add(process.env.TOKEN_EXPIRY, 'seconds').format()
  accessTokens[token] = { expires_at: expiryDate, scope: 'accounts' }
  return res.json({ access_token: token, token_type: 'Bearer', expires_in: process.env.TOKEN_EXPIRY, scope: 'accounts' })
})

const isValidToken = (req) => {
  if (process.env.AUTH !== 'true') {
    return true
  }
  const authorization = req.get('authorization').split(' ')[1]
  if (accessTokens[authorization] && dayjs().isBefore(accessTokens[authorization].expires_at)) {
    return true
  }

  return false
}

app.get('/za/pb/v1/accounts', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const accountsArr = db.prepare('SELECT * FROM accounts').all()
  const data = { accounts: accountsArr }
  return formatResponse(data, req, res)
})

app.get('/za/pb/v1/accounts/:accountId/balance', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }

  const accountId = req.params.accountId

  if (isValidAccount(accountId)) {
    return res.status(404).json() // no account was found
  }

  // fetch the currentBalance and availableBalance from the transactions table
  const data = {
    accountId,
    currentBalance: 0,
    availableBalance: 0,
    currency: 'ZAR'
  }
  return formatResponse(data, req, res)
})

app.get('/za/pb/v1/accounts/:accountId/transactions', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const accountId = req.params.accountId
  // check that the account exists
  if (isValidAccount(accountId)) {
    return res.status(404).json() // no account was found
  }

  const transactionsArr = db.prepare('SELECT * FROM transactions WHERE accountId = ? ORDER BY postingDate ASC').all(accountId)
  // console.log(transactionsArr)
  const toDate = req.query.toDate ?? dayjs().format('YYYY-MM-DD') // set to today
  const fromDate = req.query.fromDate ?? dayjs().subtract(180, 'day').format('YYYY-MM-DD') // set to 180 in the passed
  const transactionType = req.query.transactionType ?? null

  let postedOrder = 0
  let runningBalance = 0
  const transactions = []
  for (let j = 0; j < transactionsArr.length; j++) {
    postedOrder++
    if (transactionsArr[j].type === 'CREDIT') {
      runningBalance += transactionsArr[j].amount
    } else {
      runningBalance -= transactionsArr[j].amount
    }
    if (transactionType !== null && transactionsArr[j].transactionType !== transactionType) {
      continue
    }
    const transactionDate = dayjs(transactionsArr[j].postingDate)
    // compare both dates together
    if (transactionDate.isBefore(fromDate, 'day')) {
      continue
    }
    if (transactionDate.isAfter(toDate, 'day')) {
      continue
    }
    transactionsArr[j].postedOrder = postedOrder
    transactionsArr[j].runningBalance = +runningBalance.toFixed(2)
    transactions.push(transactionsArr[j])
  }
  const data = { transactions }
  return formatResponse(data, req, res)
})

// function to create transactions for an account
app.post('/za/pb/v1/accounts/:accountId/transactions', (req, res) => {
  const accountId = req.params.accountId
  const type = req.body.type || 'DEBIT'
  const transactionType = req.body.transactionType || 'CardPurchases'
  const status = req.body.status || 'POSTED'
  const description = req.body.description || 'HTTP://WWW.UBEREATS.CO PARKTOWN NOR ZA'
  const cardNumber = req.body.cardNumber || '402167xxxxxx9999'
  const postingDate = req.body.postingDate || dayjs().format('YYYY-MM-DD')
  const valueDate = req.body.valueDate || dayjs().format('YYYY-MM-DD')
  const actionDate = req.body.actionDate || dayjs().add(180, 'day').format('YYYY-MM-DD')
  const transactionDate = req.body.transactionDate || dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  const amount = req.body.amount || '40.99'
  // check that the account exists
  if (isValidAccount(accountId)) {
    return res.status(404).json() // no account was found
  }
  // insert the transaction
  insertTransaction(accountId, type, transactionType, status, description, cardNumber, postingDate, valueDate, actionDate, transactionDate, amount)
  return res.status(201).json()
})

app.get('/za/v1/cards/countries', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const result = db.prepare('SELECT * FROM countries').all()
  const data = { result }
  return formatResponse(data, req, res)
})

app.get('/za/v1/cards/currencies', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const result = db.prepare('SELECT * FROM currencies').all()
  const data = { result }
  return formatResponse(data, req, res)
})

app.get('/za/v1/cards/merchants', (req, res) => {
  if (!isValidToken(req)) {
    return res.status(401).json()
  }
  const result = db.prepare('SELECT * FROM merchants').all()
  const data = { result }
  return formatResponse(data, req, res)
})

const formatResponse = (data, req, res) => {
  return res.json({
    data,
    links: {
      self: req.protocol + '://' + req.get('host') + req.originalUrl
    },
    meta: {
      totalPages: 1
    }
  })
}

app.listen(port, () => console.log(`Programmable banking sim listening on port ${port}!`))
