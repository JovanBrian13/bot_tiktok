const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function startBot() {
  const browser = await chromium.launch({ 
    headless: false, 
    args: ['--disable-blink-features=AutomationControlled'] 
  });

  const context = await browser.newContext({ storageState: 'auth_state.json' });
  const page = await context.newPage();
  
  await page.goto('https://www.tiktok.com/messages', { waitUntil: 'networkidle' });
  console.log("-----------------------------------------");
  console.log("MODE STRICT: Hanya memonitor perubahan pada pesan TERAKHIR.");

  let lastSeenBottomMessage = "";

  // Fungsi khusus untuk mengambil pesan paling bawah saja
  const getBottomMessage = async () => {
    const messages = await page.$$('div[class*="DivText"], div[class*="DivMessageText"]');
    if (messages.length === 0) return null;
    
    const bottomMsg = messages[messages.length - 1];
    const text = await bottomMsg.innerText();
    const box = await bottomMsg.boundingBox();
    return { text: text.trim(), box: box };
  };

  // 1. INISIALISASI: Kunci pesan terakhir saat ini untuk mengabaikan masa lalu
  await page.waitForTimeout(5000); // Beri waktu chat termuat sempurna
  const initialMsg = await getBottomMessage();
  if (initialMsg) {
    lastSeenBottomMessage = initialMsg.text;
    console.log(`[MEMORI AWAL] Mengabaikan semua pesan lama. Posisi terakhir saat ini: "${lastSeenBottomMessage}"`);
  }

  // 2. MONITORING LOOP
  setInterval(async () => {
    try {
      const currentBottomMsg = await getBottomMessage();
      if (!currentBottomMsg) return;

      // LOGIKA KRUSIAL: Apakah teks pada posisi paling bawah berubah dari memori kita?
      if (currentBottomMsg.text !== lastSeenBottomMessage) {
        
        // Memori langsung diupdate agar tidak terjadi pemrosesan ganda
        lastSeenBottomMessage = currentBottomMsg.text;

        // Validasi: Apakah perubahan ini mengandung 'api' dan berasal dari orang lain (x < 500)?
        if (currentBottomMsg.text.toLowerCase().includes('api') && 
            currentBottomMsg.box && 
            currentBottomMsg.box.x < 500) {
          
          console.log(`[TRIGGER BARU] Pesan masuk: "${currentBottomMsg.text}"`);
          await sendFinalReply(page, "STREAKNYA BOS");
        }
      }
    } catch (e) {
      // Abaikan jika elemen sedang re-render
    }
  }, 1500); // Pemindaian lebih agresif (1.5 detik)
}

async function sendFinalReply(page, baseText) {
  try {
const inputArea = page.locator('div[contenteditable="true"]').first();
    await inputArea.click({ force: true });
    
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');

    // 1. SISTEM SPINTAX (Variasi Kalimat Fundamental)
    // Kita memecah kalimat menjadi 3 bagian: Sapaan, Inti, dan Penutup
    const greetings = ["Oke", "Siap", "Mantap", "Aman", "Yoi", "Lanjut"];
    const cores = ["streaknya bos", "streak aman bos", "lanjut streak", "streak bossku", "streak lancar"];
    const suffixes = ["🔥", "⚡", "👍", "🙏", ""];

    // Pilih secara acak dari masing-masing kategori
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    const randomCore = cores[Math.floor(Math.random() * cores.length)];
    const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];

    // Gabungkan menjadi satu kalimat (huruf kecil semua lebih natural untuk chat cepat)
    const finalText = `${randomGreeting} ${randomCore} ${randomSuffix}`.trim();

    console.log(`[ANTI-SPAM] Mengetik pesan unik: "${finalText}"`);

    // 2. SIMULASI HUMAN ERROR (Typo & Backspace)
    for (const char of finalText) {
      // 5% kemungkinan bot sengaja melakukan 'typo'
      if (Math.random() < 0.05 && char !== " ") {
        // Ketik karakter salah (misal 'x')
        await page.keyboard.type("x", { delay: 50 });
        await page.waitForTimeout(150); // Sadar ada yang salah
        await page.keyboard.press('Backspace'); // Hapus
        await page.waitForTimeout(100);
      }

      // Ketik karakter yang benar
      await page.keyboard.type(char, { delay: Math.random() * 150 + 50 });
    }

    // Jeda sejenak sebelum menekan Enter (simulasi ragu/membaca ulang)
    await page.waitForTimeout(Math.random() * 800 + 400);
    await page.keyboard.press('Enter');
    console.log(">>> [BERHASIL] Pesan terkirim dengan kamuflase manusiawi.");

  } catch (err) {
    console.log(">>> [GAGAL] Area input chat tidak merespons.");
  }
}

startBot().catch(err => console.error(err));