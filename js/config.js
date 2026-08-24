/* =========================================================
   KONFIGURASI
   =========================================================
   1. Deploy file apps-script/Code.gs sebagai Web App
      (lihat README.md untuk langkah lengkapnya).
   2. Tempel URL Web App yang kamu dapat ke bawah ini.
   3. Kosongkan ('') kalau mau lihat dulu tampilannya pakai
      data contoh (mock data) tanpa Google Sheet.
========================================================= */
const CONFIG = {
  // Contoh: "https://script.google.com/macros/s/AKfycb.../exec"
  ENDPOINT_URL:
    "https://script.google.com/macros/s/AKfycbwTqH6M7fKVECGZpLGGb2VNnoG5B8dS6CLRRq4qU4aGsOh-14NkouUFWHIWqjFh8x0Lnw/exec",

  PROFILE: {
    name: "Pathum",
    bio: "Mengejar PR, satu langkah di satu waktu 🏃",
    photo: "https://api.dicebear.com/7.x/notionists/svg?seed=Pathum",
  },

  // Berapa detik jeda antar bubble semangat muncul
  BUBBLE_INTERVAL_MS: 3500,

  // Berapa lama animasi 1 bubble melayang dari bawah ke atas (detik)
  BUBBLE_DURATION_S: 12,
};

/* Data contoh — dipakai otomatis kalau ENDPOINT_URL masih kosong */
const MOCK_DATA = {
  events: [
    {
      id: 1,
      icon: "🏃",
      color: "#4c3ae3",
      title: "Morning Run 5K",
      description: "Latihan rutin sekitar komplek",
      time: "07:30 AM",
      status: "done",
    },
    {
      id: 2,
      icon: "🎽",
      color: "#f5a524",
      title: "On-Air Radio App Design",
      description: "Desain UI untuk halaman event lari",
      time: "08:00 AM",
      status: "active",
    },
    {
      id: 3,
      icon: "📩",
      color: "#22c55e",
      title: "Balas Email Panitia",
      description: "Konfirmasi race pack half marathon",
      time: "10:30 AM",
      status: "pending",
    },
    {
      id: 4,
      icon: "💧",
      color: "#3b82f6",
      title: "Bayar Tagihan Registrasi",
      description: "Lunasi biaya pendaftaran lomba",
      time: "11:30 AM",
      status: "pending",
    },
    {
      id: 5,
      icon: "🎨",
      color: "#f5a524",
      title: "Desain 'Daily UI'",
      description: "Ubah rute run map minggu ini",
      time: "03:00 PM",
      status: "pending",
    },
    {
      id: 6,
      icon: "📦",
      color: "#ec4899",
      title: "Kirim File Proyek",
      description: "Upload hasil recap lari ke tim",
      time: "05:00 PM",
      status: "pending",
    },
  ],
  semangat: [
    { name: "Dinda", message: "Semangat lari nya kak! 🔥" },
    { name: "@anonim", message: "Sedikit lagi finish line, gaskeun!" },
    { name: "Bagas", message: "PR minggu ini pasti pecah 💪" },
  ],
};
