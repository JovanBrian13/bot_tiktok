const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function startBot() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: 'auth_state.json' });
  const page = await context.newPage();
  
  await page.goto('https://www.tiktok.com/messages', { waitUntil: 'networkidle' });
  console.log("-----------------------------------------");
  console.log("SISTEM DIAGNOSTIK AKTIF");

  setInterval(async () => {
    try {
      // 1. Cari semua elemen yang mungkin merupakan kotak chat (fleksibel)
      const allItems = await page.$$('div[role="link"], div[class*="Item"], li');

      for (const item of allItems) {
        const textContent = (await item.innerText()).toLowerCase();
        
        // Hanya cek jika ada kata 'api' di dalam kotak chat tersebut
        if (textContent.includes('api')) {
          
          // 2. CARI NOTIFIKASI (Angka 1, 2, dst)
          // Kita cari elemen span/div kecil di dalam kotak ini yang isinya HANYA angka
          const badge = await item.evaluate((node) => {
            const spans = node.querySelectorAll('span, div, i');
            for (let s of spans) {
              // Jika isinya angka saja (1-99) dan ukurannya kecil (notifikasi)
              if (/^\d+$/.test(s.innerText.trim()) && s.innerText.length <= 2) {
                return true; 
              }
            }
            return false;
          });

          if (badge) {
            console.log(`[NOTIFIKASI!] Ada pesan baru 'api'. Membuka chat...`);
            
            await item.click({ force: true });
            await page.waitForTimeout(2000);

            // 3. EKSEKUSI BALASAN
            await sendReply(page);
            
            // Setelah membalas, kita tunggu notifikasi angka tersebut hilang di sistem
            await page.waitForTimeout(3000);
            break; 
          }
        }
      }
    } catch (e) {
      // Diamkan error DOM
    }
  }, 2000);
}

async function sendReply(page) {
  try {
    // Mencari area ketik dengan cara paling kasar (contenteditable)
    const input = page.locator('div[contenteditable="true"]').first();
    await input.click({ force: true });
    
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');

    const msg = "STREAKNYA BOS";
    console.log(`Mengetik: ${msg}`);
    
    for (const char of msg) {
      await page.keyboard.type(char, { delay: 100 });
    }
    
    await page.keyboard.press('Enter');
    console.log(">>> [SUKSES] Pesan terkirim.");
  } catch (err) {
    console.log(">>> [GAGAL] Tidak bisa mengetik balasan.");
  }
}

startBot().catch(err => console.error(err));