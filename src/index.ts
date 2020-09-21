const playwright = require('playwright');
const fs = require('fs');

require('dotenv').config();

import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

const smtpTransportOptions: SMTPTransport.Options = {
  host: process.env.SMTP_HOSTNAME,
  port: parseInt(process.env.SMTP_PORT || '25'),
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD
  }
}

const mailer = nodemailer.createTransport(smtpTransportOptions);

function sendMail(subject: string, body: string) {
  const message: Mail.Options = {
    subject,
    html: body,
    from: process.env.MAIL_FROM,
    to: process.env.MAIL_TO
  }

  mailer.sendMail(message, (err: any, suc: any) => {
    if (err) {
      console.log("Error occured while sending mail: " + err)
    }
  });
}

const MAX_ERROR_COUNT = 5;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readState(): any {
  if (fs.existsSync('./state.json')) {
    const state = fs.readFileSync('state.json');
    console.log("Resuming serialized state file");
    return JSON.parse(state);
  } else {
    console.log("No state file, returning initial configuration");
    return null;
  }
}

function writeState(state: any) {
  fs.writeFileSync('state.json', JSON.stringify(state));
  console.log("Wrote state file");
}

(async () => {

  // website, selector, text
  const checks = readState() || [
    {
      'name': "Elgiganten",
      "website": "https://www.elgiganten.dk/product/gaming/konsoller/playstation-4-ps4-konsol/220276/playstation-5",
      "selector": ".product-price-text",
      "value": "",
      "errorCount": 0
    },
    {
      'name': "Dustin",
      "website": "https://www.dustinhome.dk/product/5011155750/playstation-5",
      "selector": "#buyForm span.ladda-label",
      "value": "",
      "errorCount": 0
    },
    {
      'name': "Bilka",
      "website": "https://www.bilka.dk/produkter/sony-playstation-5/100532624/",
      "selector": "button.purchase-button .v-btn__content",
      "value": "",
      "errorCount": 0
    },
    {
      'name': "BR",
      "website": "https://www.br.dk/produkter/sony-playstation-5/100532624/",
      "selector": "button.purchase-button .v-btn__content",
      "value": "",
      "errorCount": 0
    },
    {
      'name': "Føtex",
      "website": "https://www.foetex.dk/produkter/sony-playstation-5/100532624",
      "selector": "button.purchase-button .v-btn__content",
      "value": "",
      "errorCount": 0
    },
    {
      'name': "Power",
      "website": "https://www.power.dk/gaming-og-underholdning/konsol/konsol/playstation-5/p-1077687/",
      "selector": "div.buy-area button.btn .ng-star-inserted",
      "value": "",
      "errorCount": 0
    },
    {
      'name': "Expert",
      "website": "https://www.expert.dk/spil-og-underholdning/konsoller/konsoller/playstation-5/p-1077687",
      "selector": "div.buy-area button.btn .ng-star-inserted",
      "value": "",
      "errorCount": 0
    },
    {
      'name': "Komplett",
      "website": "https://www.komplett.dk/product/1111557/gaming/playstation/playstation-5",
      "selector": ".monitor-button button.btn-large",
      "value": "",
      "errorCount": 0
    }
  ]

  // fire up browser
  const browser = await playwright['chromium'].launch();
  const context = await browser.newContext();

  const page = await context.newPage();

  const cb = Math.floor(new Date().getTime() / 1000);

  for (const check of checks) {
    try {
      const originalValue = check.value;
      const originalErrorCount = check.errorCount;

      console.log(`Checking ${check.name}... (errorCount: ${originalErrorCount})`)

      const url = `${check.website}?cb=${cb}`;
      await page.goto(url);
      console.log(`Navigated to ${url}`);

      const selectorValue = await page.evaluate((el: { innerText: any; }) => el.innerText, await page.$(check.selector));
      console.log("Value of selector: " + selectorValue);

      // check for change, but ignore initial empty value
      if (selectorValue != originalValue && originalValue != "") {
        console.log(`A value changed! ${check.website} has changed value from ${originalValue} to ${selectorValue}`);
        sendMail("Website-checker: Change detected", `<h1>A value changed!</h1><p>${check.website} has changed value from ${originalValue} to ${selectorValue}</p>`);
      }
      check.value = selectorValue;
      check.errorCount = 0;

      if (originalErrorCount >= MAX_ERROR_COUNT) {
        console.log(`Checks for ${check.website} are working again`);
        sendMail(`Website-checker: Back to normal`, `<p>Checks for ${check.website} are working again</p>`);
      }

    } catch (Error) {
      console.log(`Error occured while performing a check on ${check.name}: ${Error}`);
      check.errorCount++;

      if (check.errorCount == MAX_ERROR_COUNT) {
        sendMail(`Website-checker: Error occured ${MAX_ERROR_COUNT} times`, `<p>Error count for ${check.website} reached ${MAX_ERROR_COUNT}</p>`);
      }
    }
  }

  writeState(checks);

  await page.close();
  await context.close();
  await browser.close();
})();
