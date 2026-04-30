const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

// ============================================================
// STATE MEMORY: Melacak chat yang sudah diproses agar tidak
// double-response pada siklus yang sama.
// Key = identifier chat (nama/teks unik), Value = timestamp.
// ============================================================
const processedChats = new Map();
const COOLDOWN_MS = 60_000; // Cooldown 60 detik per chat

// ============================================================
// ANTI-SPAM (SPINTAX): Memilih balasan acak dari array variasi
// agar tidak mengirim teks identik berulang kali.
// ============================================================
const REPLY_VARIATIONS = [
  "Streaknya bos",
  "Gas streak bosku",
  "Aman streaknya",
  "Streak lanjut bos",
  "Done streak ya",
  "Streak dulu yuk",
  "Lanjut streak boss",
  "Streak aman bos",
  "Siap streaknya",
  "Mantap streaknya"
];

function getRandomReply() {
  return REPLY_VARIATIONS[Math.floor(Math.random() * REPLY_VARIATIONS.length)];
}

// ============================================================
// HUMAN-LIKE DELAY: Delay acak antar aksi untuk meniru
// perilaku manusia dan menghindari deteksi bot.
// ============================================================
function randomDelay(min = 500, max = 1500) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanWait(page, min = 500, max = 1500) {
  await page.waitForTimeout(randomDelay(min, max));
}

// ============================================================
// MAIN BOT: Alur kerja berbasis notifikasi (Unread First).
// Menggunakan loop rekursif alih-alih setInterval untuk
// menghindari error "element is detached from the DOM".
// ============================================================
async function startBot() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: 'auth_state.json' });
  const page = await context.newPage();

  await page.goto('https://www.tiktok.com/messages', { waitUntil: 'networkidle' });
  console.log("-----------------------------------------");
  console.log("🤖 BOT AKTIF — Menunggu pesan masuk...");
  console.log("-----------------------------------------");

  // Loop utama: menggunakan while + delay daripada setInterval
  // agar setiap siklus selesai sebelum memulai yang baru (no overlap).
  while (true) {
    try {
      await scanAndReply(page);
    } catch (err) {
      // Error global di-catch di sini agar loop tidak berhenti.
      console.log(`[ERROR LOOP] ${err.message}`);
    }
    // Jeda antar siklus scanning (3-5 detik, acak)
    await humanWait(page, 3000, 5000);
  }
}

// ============================================================
// SCAN & REPLY: Mencari chat dengan notifikasi unread,
// membukanya, lalu memvalidasi pesan terakhir sebelum membalas.
// ============================================================
async function scanAndReply(page) {
  // 1. CARI SEMUA ITEM CHAT DI SIDEBAR
  //    Menggunakan querySelectorAll yang fresh setiap siklus
  //    untuk menghindari referensi DOM yang stale.
  const chatItems = await page.$$('div[role="link"], div[class*="Item"], li');

  for (const item of chatItems) {
    try {
      // Pastikan elemen masih terhubung ke DOM dan terlihat
      const isVisible = await item.isVisible().catch(() => false);
      if (!isVisible) continue;

      // 2. CEK NOTIFIKASI UNREAD (badge angka atau dot)
      const hasUnread = await item.evaluate((node) => {
        const candidates = node.querySelectorAll('span, div, i, p');
        for (const el of candidates) {
          const text = el.innerText?.trim();
          // Badge angka (1, 2, ..., 99)
          if (/^\d{1,2}$/.test(text)) {
            const rect = el.getBoundingClientRect();
            // Pastikan ukurannya kecil (badge, bukan konten biasa)
            if (rect.width < 30 && rect.height < 30) return true;
          }
        }
        // Cek juga dot indicator (elemen kecil tanpa teks)
        const dots = node.querySelectorAll('[class*="badge"], [class*="dot"], [class*="unread"]');
        if (dots.length > 0) return true;
        return false;
      }).catch(() => false);

      if (!hasUnread) continue;

      // 3. AMBIL IDENTIFIER CHAT untuk state tracking
      const chatId = await item.evaluate((node) => {
        // Gunakan kombinasi teks + atribut unik sebagai identifier
        const name = node.querySelector('[class*="name"], [class*="Name"], [class*="title"]');
        return name?.innerText?.trim() || node.innerText?.trim()?.substring(0, 50) || 'unknown';
      }).catch(() => 'unknown');

      // 4. CEK COOLDOWN: Apakah chat ini sudah diproses baru-baru ini?
      if (processedChats.has(chatId)) {
        const lastProcessed = processedChats.get(chatId);
        if (Date.now() - lastProcessed < COOLDOWN_MS) {
          continue; // Skip, masih dalam cooldown
        }
      }

      console.log(`[📩 UNREAD] Ditemukan chat belum dibaca: "${chatId}"`);

      // 5. BUKA CHAT: Klik item chat tersebut
      await item.click({ force: true });
      // Tunggu navigasi selesai & area chat benar-benar siap
      await page.waitForSelector('div[contenteditable="true"]', { timeout: 8000 }).catch(() => null);
      
      // Beri jeda agar pesan-pesan baru sempat dimuat di layar
      await humanWait(page, 1500, 2500);

      // 6. VALIDASI PESAN TERAKHIR DI DALAM CHAT
      //    Cek apakah pesan terakhir dari lawan bicara mengandung keyword "api"
      const shouldReply = await validateLastMessage(page);

      if (shouldReply) {
        console.log(`[✅ VALID] Pesan terakhir mengandung keyword. Membalas...`);
        await sendReply(page);
        // Tandai chat sebagai sudah diproses
        processedChats.set(chatId, Date.now());
        // Jeda setelah membalas (2-4 detik)
        await humanWait(page, 2000, 4000);
      } else {
        console.log(`[⏭️ SKIP] Pesan terakhir tidak valid atau dari bot sendiri.`);
        // Tetap tandai agar tidak diproses ulang dalam cooldown
        processedChats.set(chatId, Date.now());
      }

      // KRUSIAL: Setelah klik & proses, hentikan loop ini.
      // Biarkan fungsi startBot() memulai siklus scanning baru 
      // agar referensi chatItems tidak error (destroyed).
      return;

    } catch (itemErr) {
      // Error pada item tertentu: skip ke item berikutnya
      // (biasanya karena elemen detached dari DOM)
      continue;
    }
  }

  // Bersihkan memory dari entri yang sudah expired (> 5 menit)
  cleanupMemory();
}

// ============================================================
// VALIDASI PESAN TERAKHIR: Membaca bubble chat terakhir dan
// memastikan itu dari lawan bicara (bukan bot sendiri)
// serta mengandung keyword "api".
// ============================================================
async function validateLastMessage(page) {
  try {
    // Gabungkan selektor lama dan baru agar lebih robust menangkap elemen pesan
    const messages = await page.$$('div[class*="message"], div[class*="Message"], div[class*="bubble"], div[class*="Bubble"]');
    
    if (messages.length === 0) {
      console.log(`[DEBUG] Tidak ada elemen pesan yang ditemukan.`);
      return false;
    }

    // Ambil 3 pesan terakhir untuk berjaga-jaga jika ada jeda loading
    const lastFewMessages = messages.slice(-3); 
    let foundKeyword = false;

    for (const [index, msg] of lastFewMessages.entries()) {
      const isVisible = await msg.isVisible().catch(() => false);
      if (!isVisible) continue;

      const result = await msg.evaluate((node) => {
        const text = node.innerText?.toLowerCase()?.trim() || '';
        
        // Cek apakah pesan ini dari "sisi kanan" (pesan sendiri)
        // TikTok biasanya memberi class atau style berbeda untuk pesan sendiri
        const isSelf = node.closest('[class*="self"]') !== null ||
                       node.closest('[class*="Self"]') !== null ||
                       node.closest('[class*="right"]') !== null ||
                       node.closest('[class*="Right"]') !== null ||
                       node.closest('[class*="own"]') !== null ||
                       node.closest('[class*="Own"]') !== null;
                       
        return { text, isSelf };
      }).catch(() => ({ text: '', isSelf: true }));

      if (result.text) {
        console.log(`[DEBUG] Pesan dicek: "${result.text.substring(0, 30)}" | isSelf: ${result.isSelf}`);
      }

      if (result.text.includes('api') && !result.isSelf) {
        foundKeyword = true;
      }
    }
    
    return foundKeyword;
  } catch (err) {
    console.log(`[VALIDASI ERROR] ${err.message}`);
    return false;
  }
}

// ============================================================
// SEND REPLY: Mengetik dan mengirim balasan dengan gaya
// human-like (delay acak antar karakter).
// ============================================================
async function sendReply(page) {
  try {
    // Cari area ketik menggunakan waitForSelector (lebih reliable)
    const inputSelector = 'div[contenteditable="true"]';
    await page.waitForSelector(inputSelector, { timeout: 5000 });

    const input = page.locator(inputSelector).first();

    // Pastikan input terlihat sebelum berinteraksi
    const isVisible = await input.isVisible().catch(() => false);
    if (!isVisible) {
      console.log(">>> [GAGAL] Area ketik tidak terlihat.");
      return;
    }

    await input.click({ force: true });
    await humanWait(page, 300, 600);

    // Bersihkan field input
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await humanWait(page, 200, 400);

    // Pilih balasan acak dari variasi (anti-spam)
    const msg = getRandomReply();
    console.log(`   Mengetik: "${msg}"`);

    // Ketik karakter per karakter dengan delay acak (human-like)
    for (const char of msg) {
      await page.keyboard.type(char, { delay: randomDelay(80, 180) });
    }

    // Jeda sebelum mengirim (seolah user membaca ulang)
    await humanWait(page, 500, 1200);

    await page.keyboard.press('Enter');
    console.log(">>> [✅ SUKSES] Pesan terkirim.");
  } catch (err) {
    console.log(`>>> [❌ GAGAL] Tidak bisa mengetik balasan: ${err.message}`);
  }
}

// ============================================================
// CLEANUP MEMORY: Hapus entri chat lama dari Map agar
// tidak membengkak seiring waktu.
// ============================================================
function cleanupMemory() {
  const EXPIRY_MS = 5 * 60 * 1000; // 5 menit
  const now = Date.now();
  for (const [chatId, timestamp] of processedChats.entries()) {
    if (now - timestamp > EXPIRY_MS) {
      processedChats.delete(chatId);
    }
  }
}

// ============================================================
// START
// ============================================================
startBot().catch(err => console.error("❌ Bot crash:", err));