const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai');

// ====================================================================
// =================== PENTING: ISI BAGIAN INI ======================
// ====================================================================

// Masukkan Token Bot Telegram Anda di sini.
// CONTOH: '1234567890:AAH-xxxxxxxxxxxxxxxxxxxxxxxxx'
// GANTI DENGAN TOKEN ASLI DARI @BotFather
const TELEGRAM_BOT_TOKEN = "8031839553:AAFSea2kkZGj_AvZ9Rs3bK5ZKEzxI_liWXA"; 

// Masukkan API Key Gemini Anda di sini.
// CONTOH: 'AIzaSyCxxxxxxxxxxxxxxxxxxxxxx'
// GANTI DENGAN API KEY ASLI DARI Google AI Studio
const GEMINI_API_KEY = "AIzaSyCY8ip7HbD_HYl8z9uQvy4SM97bkS015wU"; 

// ====================================================================
// ====================================================================


// --- Pemeriksaan Awal untuk Memastikan Variabel Penting Terisi ---
if (TELEGRAM_BOT_TOKEN === "MASUKKAN_TOKEN_BOT_TELEGRAM_ANDA_DI_SINI" || 
    GEMINI_API_KEY === "MASUKKAN_API_KEY_GEMINI_ANDA_DI_SINI") {
    console.error("Kesalahan: Token bot Telegram atau API Key Gemini belum diisi. Mohon lengkapi bagian 'PENTING' di awal file index.js.");
    process.exit(1); // Hentikan proses jika belum lengkap
}


// --- Inisialisasi Bot Telegram (Mode Polling) ---
// Ini akan membuat bot secara aktif memeriksa pesan baru dari server Telegram.
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true }); 

// --- Inisialisasi Google Gemini API ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Menggunakan model Gemini 2.0 Flash
// Pastikan API Key Anda memiliki akses ke model ini.
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- System Instructions (Identitas Bot & Aturan Dasar) ---
// Ini akan membentuk 'kepribadian' dan perilaku dasar bot Anda.
const SYSTEM_INSTRUCTIONS = `
Anda adalah Bot Riset Cerdas bernama 'Penjelajah Informasi'.
Tugas utama Anda adalah membantu pengguna menemukan informasi akurat dan terkini dari internet.
Gunakan kemampuan riset Anda dengan Google Search saat menjawab pertanyaan yang membutuhkan data terbaru atau fakta spesifik.
Selalu berikan respons yang informatif, ringkas, dan mudah dimengerti.
Jika diminta tentang opini pribadi, Anda harus menjawab bahwa Anda adalah AI dan tidak memiliki opini pribadi.
Jangan pernah memberikan saran medis, hukum, atau keuangan.
Sapa pengguna dengan ramah di awal percakapan dan tanyakan apa yang ingin mereka ketahui.
`;

// --- Manajemen Konteks/Memori Percakapan ---
// Objek ini menyimpan objek 'chat' Gemini untuk setiap pengguna berdasarkan ID chat Telegram mereka.
// Penting: Dalam produksi (jika bot di-deploy permanen), ini harus disimpan di database persisten
// agar memori percakapan tidak hilang saat server restart.
const userChats = {};

/**
 * Mendapatkan atau membuat objek chat Gemini untuk ID chat Telegram tertentu.
 * Jika objek chat belum ada, ia akan diinisialisasi dengan system instructions sebagai history awal.
 * @param {number} chatId - ID chat Telegram pengguna.
 * @returns {object} Objek chat Gemini.
 */
function getUserChat(chatId) {
    if (!userChats[chatId]) {
        userChats[chatId] = model.startChat({
            history: [
                { role: "user", parts: [{ text: SYSTEM_INSTRUCTIONS }] },
                { role: "model", parts: [{ text: "Baik, saya mengerti. Saya siap membantu Anda." }] }
            ],
            // Konfigurasi keamanan tambahan (opsional, bisa disesuaikan)
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ],
        });
        console.log(`[${chatId}] Sesi chat Gemini baru dibuat.`);
    }
    return userChats[chatId];
}

// --- Handler Perintah Telegram ---

// Handler untuk perintah /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    getUserChat(chatId); // Pastikan sesi chat Gemini diinisialisasi

    // Ekstrak nama bot dari system instructions untuk perkenalan yang dinamis
    const botNameMatch = SYSTEM_INSTRUCTIONS.match(/bernama '([^']+)'/);
    const botName = botNameMatch ? botNameMatch[1] : 'Asisten AI'; // Default jika nama tidak ditemukan
    
    bot.sendMessage(chatId, `Halo! Saya adalah ${botName}. Bagaimana saya bisa membantu Anda hari ini dalam menemukan informasi?`);
    console.log(`[${chatId}] Perintah /start diterima.`);
});

// Handler untuk perintah /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Kirimkan pertanyaan apa pun kepada saya. Saya akan menggunakan kemampuan riset saya untuk menemukan informasinya.");
    console.log(`[${chatId}] Perintah /help diterima.`);
});

// Handler untuk perintah /reset (menghapus memori percakapan bot untuk pengguna tertentu)
bot.onText(/\/reset/, (msg) => {
    const chatId = msg.chat.id;
    if (userChats[chatId]) {
        delete userChats[chatId]; // Hapus objek chat dari penyimpanan sementara
        bot.sendMessage(chatId, "Memori percakapan Anda telah direset. Silakan mulai percakapan baru atau kirimkan pertanyaan pertama Anda.");
        console.log(`[${chatId}] Sesi chat Gemini direset.`);
    } else {
        bot.sendMessage(chatId, "Tidak ada sesi percakapan aktif yang perlu direset untuk Anda.");
        console.log(`[${chatId}] Percobaan reset, tapi tidak ada sesi aktif.`);
    }
});


// --- Handler Pesan Teks Umum ---
// Bot akan merespons setiap pesan teks yang bukan merupakan perintah
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    // Abaikan pesan jika itu adalah perintah (dimulai dengan '/')
    if (userMessage && userMessage.startsWith('/')) {
        return;
    }
    
    // Abaikan pesan kosong atau non-teks
    if (!userMessage) {
        console.log(`[${chatId}] Menerima pesan non-teks atau kosong, diabaikan.`);
        return;
    }

    console.log(`[${chatId}] Pesan dari pengguna: "${userMessage}"`);

    const chat = getUserChat(chatId); // Dapatkan atau buat objek chat Gemini untuk pengguna ini

    try {
        // Kirim pesan ke Gemini melalui objek chat.
        // Aktifkan 'Google Search_retrieval' tool untuk kemampuan riset/grounding.
        const result = await chat.sendMessage(userMessage, {
            tools: [
                {
                    "functionDeclarations": [
                        {
                            "name": "Google Search_retrieval", // Nama fungsi harus persis seperti ini
                            "description": "Performs a Google search and returns results.",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "query": {
                                        "type": "string",
                                        "description": "The search query.",
                                    },
                                },
                                "required": ["query"],
                            },
                        },
                    ],
                },
            ],
        });

        // Dapatkan respons teks dari Gemini
        const response = result.response;
        let geminiResponse = response.text();

        // Ekstrak dan format sumber/referensi (citations) jika Gemini menggunakannya
        let sources = "";
        const citationMetadata = response.citationMetadata;
        if (citationMetadata && citationMetadata.citationSources.length > 0) {
            sources = "\n\n**Sumber:**\n";
            citationMetadata.citationSources.forEach((citation, index) => {
                if (citation.uri) {
                    sources += `${index + 1}. [${citation.uri}](${citation.uri})\n`;
                }
                // Anda bisa menambahkan informasi lain dari citation jika tersedia (misalnya, title)
            });
        }
        
        // Kirim respons Gemini kembali ke Telegram. Gunakan Markdown untuk format link sumber.
        await bot.sendMessage(chatId, geminiResponse + sources, { parse_mode: 'Markdown' });
        console.log(`[${chatId}] Respons Gemini: "${geminiResponse.substring(0, 100)}..."`); // Log respons sebagian

    } catch (error) {
        // Tangani kesalahan saat memanggil API Gemini atau Telegram
        console.error(`[${chatId}] Terjadi kesalahan saat memproses pesan:`, error);
        await bot.sendMessage(chatId, "Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.");
    }
});

console.log('Bot Telegram sedang berjalan dan mendengarkan pesan...');
console.log('Pastikan API Key Gemini dan Token Bot Telegram sudah benar di file index.js.');
