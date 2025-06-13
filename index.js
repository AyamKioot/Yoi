const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai');

// ====================================================================
// =================== PENTING: ISI BAGIAN INI ======================
// ====================================================================

// Masukkan Token Bot Telegram Anda di sini (contoh: '123456:ABC-DEF1234ghIkl-7890')
const TELEGRAM_BOT_TOKEN = "AIzaSyCY8ip7HbD_HYl8z9uQvy4SM97bkS015wU"; 

// Masukkan API Key Gemini Anda di sini (contoh: 'AIzaSyCxxxxxxxxxxxxxxxxxxxxxx')
const GEMINI_API_KEY = "7921871932:AAHxgsDygopmOfTE3m5VqxhuY4MznGtHk0s";

// ====================================================================
// ====================================================================


// Pastikan token dan kunci tersedia sebelum melanjutkan
if (TELEGRAM_BOT_TOKEN === "MASUKKAN_TOKEN_BOT_TELEGRAM_ANDA_DI_SINI" || GEMINI_API_KEY === "MASUKKAN_API_KEY_GEMINI_ANDA_DI_SINI") {
    console.error("Kesalahan: Token bot Telegram atau API Key Gemini belum diisi. Mohon lengkapi bagian 'PENTING' di awal file.");
    process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Menggunakan model Gemini 2.0 Flash
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- System Instructions (Identitas Bot) ---
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

    const botName = SYSTEM_INSTRUCTIONS.split('\n')[1].split("'")[1]; 
    bot.sendMessage(chatId, `Halo! Saya adalah ${botName}. Bagaimana saya bisa membantu Anda hari ini dalam menemukan informasi?`);
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Kirimkan pertanyaan apa pun kepada saya. Saya akan menggunakan kemampuan riset saya untuk menemukan informasinya.");
});

bot.onText(/\/reset/, (msg) => {
    const chatId = msg.chat.id;
    if (userChats[chatId]) {
        delete userChats[chatId];
        bot.sendMessage(chatId, "Memori percakapan Anda telah direset. Silakan mulai percakapan baru.");
        console.log(`[${chatId}] Sesi chat Gemini direset.`);
    } else {
        bot.sendMessage(chatId, "Tidak ada sesi percakapan aktif yang perlu direset.");
    }
});

// --- Handler Pesan Teks Umum ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    if (userMessage.startsWith('/')) {
        return;
    }

    console.log(`[${chatId}] Pesan dari pengguna: ${userMessage}`);

    const chat = getUserChat(chatId);

    try {
        const result = await chat.sendMessage(userMessage, {
            tools: [
                {
                    "functionDeclarations": [
                        {
                            "name": "Google Search_retrieval",
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
                                // Note: For actual tool use, you might define more complex parameters
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
                }
            });
        }
        
        bot.sendMessage(chatId, geminiResponse + sources, { parse_mode: 'Markdown' });
        console.log(`[${chatId}] Respons Gemini: ${geminiResponse}`);

    } catch (error) {
        console.error(`[${chatId}] Terjadi kesalahan saat memanggil Gemini API:`, error);
        bot.sendMessage(chatId, "Maaf, terjadi kesalahan saat memproses permintaan Anda.");
    }
});

console.log('Bot Telegram sedang berjalan...');