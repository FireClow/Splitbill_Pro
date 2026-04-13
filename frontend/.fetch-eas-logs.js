const fs = require('fs');
const t = fs.readFileSync('.eas_build_view.json', 'utf8').replace(/^\uFEFF/, '');
const obj = JSON.parse(t);
const urls = obj.logFiles || [];
(async () => {
  for (let i = 0; i < urls.length; i++) {
    const res = await fetch(urls[i]);
    const txt = await res.text();
    fs.writeFileSync(`.eas_log_${i + 1}.txt`, txt);
  }
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
