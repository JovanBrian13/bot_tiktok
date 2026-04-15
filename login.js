const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

(async () => {
  const browser = await chromium.launch({ 
    headless: false, 
    args: ['--disable-blink-features=AutomationControlled'] 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.tiktok.com/login');

  console.log("---------------------------------------------------");
  console.log("INSTRUKSI:");
  console.log("1. Silakan login manual di browser Chrome yang muncul.");
  console.log("2. Selesaikan Captcha jika muncul.");
  console.log("3. Setelah masuk ke beranda/inbox, kembali ke terminal ini.");
  console.log("4. JANGAN TUTUP BROWSER SECARA MANUAL.");
  console.log("---------------------------------------------------");

  // Tunggu hingga elemen avatar profil muncul (menandakan login sukses)
  try {
    // Selector ini mencari foto profil di pojok kanan atas
    await page.waitForSelector('[data-e2e="profile-icon"]', { timeout: 300000 }); // Waktu tunggu 5 menit
    
    console.log("Login terdeteksi! Menyimpan sesi...");
    
    // Beri jeda 5 detik untuk memastikan semua cookies terisi
    await page.waitForTimeout(5000);
    
    await context.storageState({ path: 'auth_state.json' });
    console.log("Sesi BERHASIL disimpan ke auth_state.json.");
  } catch (error) {
    console.log("Waktu login habis atau terjadi kesalahan.");
  }

  await browser.close();
  process.exit();
})();