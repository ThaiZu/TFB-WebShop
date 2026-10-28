// Always serve static assets and fake Google/Stripe/API responses.
const path = require('node:path');
process.env.STRIPE_STATIC_BUILD = path.resolve(__dirname, '../dist');
process.env.GA4_TEST_ID = 'G-TEST123';
require('./ui-stripe-embedded.cjs');
