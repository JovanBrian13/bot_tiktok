Refaktor kode otomasi Playwright (Node.js) untuk bot chat TikTok agar lebih stabil, sulit terdeteksi sebagai spam, dan memiliki logika deteksi pesan yang lebih akurat.

Masalah yang Harus Diperbaiki:

Logika Deteksi Rapuh: Saat ini bot hanya mengecek teks "api" pada pratinjau (preview) chat di daftar pesan. Jika pesan tertutup oleh teks lain atau stiker, bot gagal merespon.

Double-Response/Stuck: Bot sering kali tidak merespon pesan terbaru jika sudah membalas dua kali pada orang yang sama atau gagal melacak status "sudah dibalas".

Deteksi Spam: Pesan sering terkena ban karena mengirimkan teks yang identik secara berulang.

DOM Errors: Penggunaan setInterval sering menyebabkan error "element is detached from the DOM" karena halaman TikTok sangat dinamis.

Spesifikasi Refaktor yang Diinginkan:

Alur Kerja Berbasis Notifikasi (Unread First):

Ubah logika agar bot mencari elemen chat yang memiliki indikator "pesan belum dibaca" (notifikasi angka/dot).

Bot harus mengklik chat tersebut untuk membukanya terlebih dahulu.

Validasi Pesan di Dalam Chat:

Setelah chat terbuka, bot harus memverifikasi pesan terakhir yang dikirim oleh lawan bicara.

Gunakan logika: Jika pesan terakhir mengandung keyword "api" DAN pengirimnya adalah lawan bicara (bukan bot sendiri), maka eksekusi balasan.

Fitur Anti-Spam (Spintax):

Implementasikan fungsi untuk memilih balasan secara acak dari sebuah array (contoh: "Streaknya bos", "Gas streak bosku", "Aman streaknya").

Gunakan human-like typing dengan delay acak antar karakter dan antar aksi.

Manajemen State (Memory):

Buat sistem pelacakan sederhana agar bot tidak memproses elemen chat yang sama secara berulang-ulang dalam satu siklus.

Ketahanan DOM:

Gunakan try-catch yang lebih spesifik dan pastikan ada pengecekan isVisible() sebelum melakukan interaksi (click, type).

Gunakan page.waitForSelector dengan timeout yang masuk akal daripada mengandalkan waitForTimeout statis.

Target Output:
Berikan kode Node.js lengkap yang menggunakan playwright-extra dan stealth-plugin, dengan komentar penjelasan untuk setiap fungsi baru yang ditambahkan.