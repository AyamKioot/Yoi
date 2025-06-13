const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai');

// ====================================================================
// =================== PENTING: ISI BAGIAN INI ======================
// ====================================================================

// Masukkan Token Bot Telegram Anda di sini.
// INI ADALAH TOKEN TELEGRAM: 8031839553:AAFSea2kkZGj_AvZ9Rs3bK5ZKEzxI_liWXA
const TELEGRAM_BOT_TOKEN = "8031839553:AAFSea2kkZGj_AvZ9Rs3bK5ZKEzxI_liWXA"; 

// Masukkan API Key Gemini Anda di sini.
// INI ADALAH API KEY GEMINI: AIzaSyCY8ip7HbD_HYl8z9uQvy4SM97bkS015wU
const GEMINI_API_KEY = "AIzaSyCY8ip7HbD_HYl8z9uQvy4SM97bkS015wU"; 

// ====================================================================
// ====================================================================


// Baris pemeriksaan ini sekarang bisa dihapus atau diubah jika Anda sudah mengisinya langsung.
// Jika Anda sudah mengisi nilai di atas, blok if ini tidak perlu lagi.
// Jika Anda ingin mempertahankan pemeriksaan untuk placeholder, pastikan nilai yang dibandingkan adalah placeholder, bukan nilai Anda.
/*
if (TELEGRAM_BOT_TOKEN === "MASUKKAN_TOKEN_BOT_TELEGRAM_ANDA_DI_SINI" || GEMINI_API_KEY === "MASUKKAN_API_KEY_GEMINI_ANDA_DI_SINI") {
    console.error("Kesalahan: Token bot Telegram atau API Key Gemini belum diisi. Mohon lengkapi bagian 'PENTING' di awal file index.js.");
    process.exit(1); 
}
*/
// Saya akan menghilangkan blok if di bawah untuk versi ini, karena Anda sudah mengisi langsung.


const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Menggunakan model Gemini 2.0 Flash
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- System Instructions (Identitas Bot & Aturan Dasar) ---
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
const userChats = {};

function getUserChat(chatId) {
    if (!userChats[chatId]) {
        userChats[chatId] = model.startChat({
            history: [
                { role: "user", parts: [{ text: SYSTEM_INSTRUCTIONS }] },
                { role: "model", parts: [{ text: "Baik, saya mengerti. Saya siap membantu Anda." }] }
            ],
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
            ],
        });
        console.log(`[${chatId}] Sesi chat Gemini baru dibuat.`);
    }
    return userChats[chatId];
}

// --- Handler Perintah Telegram ---

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    getUserChat(chatId); 

    const botNameMatch = SYSTEM_INSTRUCTIONS.match(/bernama '([^']+)'/);
    const botName = botNameMatch ? botNameMatch[1] : 'Asisten AI'; 
    
    bot.sendMessage(chatId, `Halo! Saya adalah ${botName}. Bagaimana saya bisa membantu Anda hari ini dalam menemukan informasi?`);
    console.log(`[${chatId}] Perintah /start diterima.`);
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Kirimkan pertanyaan apa pun kepada saya. Saya akan menggunakan kemampuan riset saya untuk menemukan informasinya.");
    console.log(`[${chatId}] Perintah /help diterima.`);
});

bot.onText(/\/reset/, (msg) => {
    const chatId = msg.chat.id;
    if (userChats[chatId]) {
        delete userChats[chatId]; 
        bot.sendMessage(chatId, "Memori percakapan Anda telah direset. Silakan mulai percakapan baru atau kirimkan pertanyaan pertama Anda.");
        console.log(`[${chatId}] Sesi chat Gemini direset.`);
    } else {
        bot.sendMessage(chatId, "Tidak ada sesi percakapan aktif yang perlu direset untuk Anda.");
        console.log(`[${chatId}] Percobaan reset, tapi tidak ada sesi aktif.`);
    }
});


// --- Handler Pesan Teks Umum ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    if (userMessage && userMessage.startsWith('/')) {
        return;
    }
    
    if (!userMessage) {
        console.log(`[${chatId}] Menerima pesan non-teks atau kosong, diabaikan.`);
        return;
    }

    console.log(`[${chatId}] Pesan dari pengguna: "${userMessage}"`);

    const chat = getUserChat(chatId);

    try {
        const result = await chat.sendMessage(userMessage, {
            tools: [
                {
                    "functionDeclarations": [
                        {
                            "name": "Google Search_retrieval", // INI SUDAH DIKOREKSI
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

        const response = result.response;
        let geminiResponse = response.text();

        let sources = "";
        const citationMetadata = response.citationMetadata;
        if (citationMetadata && citationMetadata.citationSources.length > 0) {
            sources = "\n\n**Sumber:**\n";
            citationMetadata.citationSources.forEach((citation, index) => {
                if (citation.uri) {
                    sources += `${index + 1}. [${citation.uri}](${citation.uri})\n`;
                } else if (citation.startIndex !== undefined && citation.endIndex !== undefined) {
                    const citedText = geminiResponse.substring(citation.startIndex, citation.endIndex);
                    sources += `${index + 1}. "...${citedText}..." (bagian dari respons)\n`;
                }
            });
        }
        
        await bot.sendMessage(chatId, geminiResponse + sources, { parse_mode: 'Markdown' });
        console.log(`[${chatId}] Respons Gemini: "${geminiResponse.substring(0, 100)}..."`); 

    } catch (error) {
        console.error(`[${chatId}] Terjadi kesalahan saat memproses pesan:`, error);
        await bot.sendMessage(chatId, "Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi nanti.");
    }
});

console.log('Bot Telegram sedang berjalan dan mendengarkan pesan...');
console.log('Pastikan API Key Gemini dan Token Bot Telegram sudah benar di file index.js.');
