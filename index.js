let fs = require('fs');
let path = require('path');
let program = require('commander');
let sizeOf = require('image-size');
let justifiedLayout = require('justified-layout');
let fetch = require('node-fetch');
let mkdirp = require('mkdirp');
let uniq = require('lodash.uniq');
let puppeteer = require('puppeteer');

program
  .option('--output [dir]', 'Directory to download pictures and files to')
  .option('--url [url]', 'Pinterest board URL')
  .parse(process.argv);

if (
  !program.output ||
  !program.url
) {
  console.error('No --output or --url');
  process.exit(1);
}

async function ssr(url) {
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  await page.goto(url, {waitUntil: 'networkidle0'});
  const html = await page.content(); // serialized HTML of page DOM.
  await browser.close();
  return html;
}

async function generatePDF(url) {
  const browser = await puppeteer.launch({
    headless: true
  }); // Puppeteer can only generate pdf in headless mode.
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2'}); // Adjust network idle as required.
  const pdfConfig = {
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0.54cm',
      bottom: '0.54cm',
      left: '0.54cm',
      right: '0.54cm'
    }
  };
  await page.emulateMedia('screen');
  const pdf = await page.pdf(pdfConfig); // Return the pdf buffer. Useful for saving the file not to disk.

  await browser.close();

  return pdf;
}

(async () => {
  let baseDir = path.join(process.cwd(), program.output);

  mkdirp.sync(baseDir);

  let files = [];

  process.stderr.write('Downloading page\n');

  let pageText = await ssr(program.url);

  let rawFile = path.join(baseDir, 'raw.html');
  fs.writeFileSync(rawFile, pageText);

  let targetContent = pageText.split('class="Grid__Container"')[1];
  let urls = uniq(targetContent.match(/https:\/\/i.pinimg.com\/236x\/[^"\s]+/g));

  urls = urls.map((url) => {
    return url.replace('236x', 'originals');
  });

  process.stderr.write('Downloading ' + urls.length + ' images');

  let errors = [];
  for (let url of urls) {
    let fetched = await fetch(url);

    if (!fetched.ok) {
      fetched = await fetch(url.replace('originals', '236x'));
      if (!fetched.ok) {
        errors.push(url);
        process.stderr.write('x');
      } else {
        process.stderr.write('!');
      }
      continue;
    }

    let buffer = await fetched.buffer();

    let fileName = url.split('?')[0].match(/[^/]+$/)[0];
    fs.writeFileSync(path.join(baseDir, fileName), buffer);

    let dimensions = sizeOf(buffer);

    files.push({
      fileUrl: fileName,
      width: dimensions.width,
      height: dimensions.height
    });

    process.stderr.write('.');
  }

  process.stderr.write('\n');

  if (errors.length) {
    process.stderr.write('Errors ' + JSON.stringify(errors, null, 2) + '\n');
  }

  let result = '';

  result += (
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <title>' + program.url + '</title>\n' +
    '</head>\n' +
    '<body>\n'
  );

  let containerWidth = 1080;
  let layout = justifiedLayout(files, {
    containerWidth,
    targetRowHeight: 450
  });

  result += (
    `  <div style="position: relative; width: ${containerWidth}px; height: ${layout.containerHeight}px">\n`
  );

  layout.boxes.forEach((box, index) => {
    result += (
      `    <img src="${files[index].fileUrl}" style="page-break-before: auto; page-break-after: auto; page-break-inside: avoid; position: static; margin-left: 10px; margin-bottom: 10px; float: left; display: block; width: ${box.width}px; height: ${box.height}px;"/>\n`
    );
  });

  result += (
    `  </div>\n`
  );

  result += (
    '</body>\n' +
    '</html>\n'
  );

  let outputFile = path.join(baseDir, 'index.html');
  fs.writeFileSync(outputFile, result);

  let pdfBuffer = await generatePDF('file://' + outputFile);

  let outputPdfFile = path.join(baseDir, path.basename(baseDir) + '.pdf');
  fs.writeFileSync(outputPdfFile, pdfBuffer);
  console.error('Exported to ' + outputPdfFile);
  process.exit(0);
})();
