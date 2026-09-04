const GROQ_API_KEY = (window.GROQ_API_KEY || "").trim();
const PROXY_URL = ""; // 👈 COLOQUE AQUI A URL DO SEU CLOUDFLARE WORKER QUANDO CRIAR
const WHATSAPP_NUMBER = "5534996547968";
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');

const revealElements = document.querySelectorAll('[data-reveal]');
const scrollProgress = document.getElementById('scroll-progress');
const navigation = document.querySelector('nav');

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealElements.forEach(element => element.classList.add('is-visible'));
} else if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px' });

    revealElements.forEach(element => revealObserver.observe(element));
} else {
    revealElements.forEach(element => element.classList.add('is-visible'));
}

function updateScrollState() {
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollableHeight > 0 ? (window.scrollY / scrollableHeight) * 100 : 0;
    scrollProgress.style.width = `${Math.min(progress, 100)}%`;
    navigation.classList.toggle('is-scrolled', window.scrollY > 12);
}

window.addEventListener('scroll', updateScrollState, { passive: true });
updateScrollState();

function toggleChat() {
    const box = document.getElementById('chat-box');
    const btn = document.getElementById('chat-btn');
    const isHidden = box.style.display === 'none' || box.style.display === '';

    if (!isHidden) {
        box.style.display = 'none';
        btn.style.display = 'flex';
    } else {
        box.style.display = 'flex';
        btn.style.display = 'none';
    }
}

function openChatAndSend(text) {
    toggleChat();
    setTimeout(() => {
        chatInput.value = text;
        handleSendMessage();
    }, 300);
}

const PredictionEngine = {
    getMultipliers() {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();
        let multiplier = 1.0;
        if (day === 1 || day === 5) multiplier *= 1.4;
        if (day === 0 || day === 6) multiplier *= 1.2;
        if (hour >= 7 && hour <= 10) multiplier *= 1.5;
        if (hour >= 18 && hour <= 21) multiplier *= 1.3;
        const month = now.getMonth();
        if (month === 11) multiplier *= 1.6;
        return multiplier;
    },
    calculateWait(baseMinutes) {
        const mult = this.getMultipliers();
        const variance = 0.85 + (Math.random() * 0.3);
        const finalTime = Math.round(baseMinutes * mult * variance);
        const h = Math.floor(finalTime / 60);
        const m = finalTime % 60;
        let timeStr = "";
        if (h > 0) timeStr += `${h}h `;
        if (m > 0) timeStr += `${m}min`;
        if (h === 0 && m === 0) timeStr = "Menos de 15min";
        return timeStr;
    }
};

const healthData = {
    uai: {
        baseWait: 120,
        docs: {
            geral: 'Documento original com foto, CPF e comprovante de residência. Para menores, leve também a certidão de nascimento e, quando necessário, o documento do responsável.',
            rg: 'Certidão de nascimento ou casamento, CPF e comprovante de residência. Leve os documentos originais e confirme a necessidade de agendamento para o serviço solicitado.',
            cnh: 'CNH ou documento oficial com foto, CPF, comprovante de residência e os exames exigidos para o serviço. A exigência pode mudar conforme renovação, primeira habilitação ou outra solicitação.'
        }
    },
    hospitals: {
        'HC-UFU': { base: 240, status: 'Lotado' },
        'Santa Casa': { base: 120, status: 'Moderado' },
        'Pronto Socorro Municipal': { base: 360, status: 'Crítico' },
        'Hospital Municipal': { base: 90, status: 'Estável' }
    }
};

const botResponses = {
    'hospitais': {
        keywords: ['hospital', 'hospitais', 'pronto socorro', 'emergencia', 'hc', 'santa casa', 'hospital municipal', 'onde ir', 'saude'],
        response: () => {
            let res = `🏥 *Estimativa de Espera - Hospitais Uberlândia:*\n\n`;
            for (const [hosp, data] of Object.entries(healthData.hospitals)) {
                const wait = PredictionEngine.calculateWait(data.base);
                res += `🔹 ${hosp}: aprox. ${wait} (${data.status})\n`;
            }
            res += `\n⚠️ *Importante:* Em casos de emergência grave, procure a unidade mais próxima imediatamente. Estes tempos são estimativas baseadas em fluxo médio.`;
            return res;
        }
    },
    'fila': {
        keywords: ['tempo', 'espera', 'fila', 'demora', 'uai', 'centro', 'quanto tempo', 'está cheio'],
        response: () => {
            const wait = PredictionEngine.calculateWait(healthData.uai.baseWait);
            return `⏳ *UAI Uberlândia - Estimativa para agora:*\n\n🔹 Tempo médio de espera: aproximadamente ${wait}\n\nLembrando que esse valor flutua conforme a chegada de novos pacientes. Deseja agendar seu horário?`;
        }
    },
    'documentação': {
        keywords: ['documento', 'documentos', 'levar', 'papel', 'rg', 'cnh', 'identidade', 'habilitação', 'carteira de motorista', 'preciso de que', 'requisitos'],
        response: (text = '') => {
            const lowerText = text.toLowerCase();
            const asksForCnh = ['cnh', 'habilitação', 'carteira de motorista', 'renovar a carteira', 'renovação'].some(keyword => lowerText.includes(keyword));
            const asksForRg = ['rg', 'identidade', 'registro geral', 'segunda via'].some(keyword => lowerText.includes(keyword));

            if (asksForCnh) {
                return `📄 *Documentos para CNH:*\n\n${healthData.uai.docs.cnh}\n\n💡 Leve os documentos originais e confirme a lista final e o agendamento no canal oficial do serviço.`;
            }

            if (asksForRg) {
                return `📄 *Documentos para RG:*\n\n${healthData.uai.docs.rg}\n\n💡 Leve os documentos originais e confirme a lista final e o agendamento no canal oficial do serviço.`;
            }

            return `📄 *Documentos para atendimento:*\n\n${healthData.uai.docs.geral}\n\n💡 A exigência muda conforme o serviço. Qual atendimento você precisa: *RG*, *CNH* ou outro?`;
        },
    },
    'agendamento': {
        keywords: ['agendar', 'marcar', 'horario', 'appointment', 'querer agendar'],
        response: 'Para realizar o agendamento, você pode utilizar o portal oficial do governo ou, para maior agilidade, falar com nosso atendente via WhatsApp agora mesmo!',
        action: 'redirect_whatsapp'
    },
    'whatsapp': {
        keywords: ['whatsapp', 'humano', 'atendente', 'pessoa', 'falar com alguém', 'ajuda humana', 'suporte'],
        response: 'Estou redirecionando você para o nosso atendimento via WhatsApp. Vou enviar o resumo da sua triagem para o atendente!',
        action: 'redirect_whatsapp'
    },
    'urgencia': {
        keywords: ['dor', 'sangue', 'acidente', 'infarto', 'grave', 'morrendo', 'urgente', 'emergência'],
        response: '🚨 *ATENÇÃO:* Se você está em uma situação de emergência grave, por favor, ligue imediatamente para o **SAMU (192)** ou dirija-se ao Pronto Socorro mais próximo. Não utilize o chat para emergências críticas!',
    },
    'default': {
        response: 'Sinto muito, não consegui identificar sua dúvida com precisão. Tente perguntar por "Tempo de espera", "Documentos para RG" ou "Falar com atendente".'
    }
};

async function callGroqAPI(userMessage, context) {
    if (!GROQ_API_KEY) {
        console.warn("Groq API key ausente. Usando resposta local para demonstração.");
        return null;
    }

    const targetUrl = "https://api.groq.com/openai/v1/chat/completions";
    const requestUrl = PROXY_URL.trim() || targetUrl;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(requestUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "qwen/qwen3.6-27b",
                messages: [
                    {
                        role: "system",
                        content: `Você é a IA do "Fila Zero Saúde", um assistente para Uberlândia, MG.
                        Seu objetivo é ser empático, profissional e direto.
                        REGRAS CRÍTICAS:
                        1. NUNCA realize diagnósticos médicos ou prescreva tratamentos.
                        2. Use a seguinte base de dados para responder sobre esperas (SÃO ESTIMATIVAS):
                        ${JSON.stringify(context)}
                        3. Se o usuário quiser falar com humano ou agendar, incentive-o a usar o botão de WhatsApp.
                        4. Seja acolhedor e mantenha o tom de assistência em saúde.`
                    },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.7
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`Groq HTTP ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim() || null;
    } catch (error) {
        console.warn("Groq indisponível. Ativando respostas locais...", error);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

function appendMessage(text, sender) {
    const div = document.createElement('div');
    div.className = sender === 'user' ? 'chat-bubble-user p-3 max-w-[80%] ml-auto fade-in' : 'chat-bubble-bot p-3 max-w-[80%] fade-in';
    div.innerText = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
    const div = document.createElement('div');
    div.id = 'typing-indicator';
    div.className = 'chat-bubble-bot p-3 max-w-[80%] fade-in';
    div.innerHTML = `<div class="flex gap-1 p-1"><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0.2s"></span><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0.4s"></span></div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTyping() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

async function handleSendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    appendMessage(text, 'user');
    chatInput.value = '';

    if (text.toLowerCase().includes('whatsapp') || text.toLowerCase().includes('atendente') || text.toLowerCase().includes('humano')) {
        appendMessage("Claro! Estou te redirecionando para o nosso atendimento via WhatsApp agora mesmo.", 'bot');
        setTimeout(() => redirectToWhatsApp(text), 1500);
        return;
    }

    showTyping();

    const context = {
        uai_espera: PredictionEngine.calculateWait(healthData.uai.baseWait),
        hospitais_espera: {},
        docs: healthData.uai.docs
    };
    for (const [hosp, data] of Object.entries(healthData.hospitals)) {
        context.hospitais_espera[hosp] = `${PredictionEngine.calculateWait(data.base)} (${data.status})`;
    }

    const aiResponse = await callGroqAPI(text, context);
    removeTyping();

    if (aiResponse) {
        appendMessage(aiResponse, 'bot');
    } else {
        processResponse(text);
    }
}

function sendQuickReply(text) {
    chatInput.value = text;
    handleSendMessage();
}

function processResponse(text) {
    const lowerText = text.toLowerCase();
    let found = false;
    const matchesKeyword = keyword => {
        if (keyword.length > 3) return lowerText.includes(keyword);
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^a-záàâãéêíóôõúç])${escapedKeyword}(?=$|[^a-záàâãéêíóôõúç])`, 'i').test(lowerText);
    };

    for (const key in botResponses) {
        if (key === 'default') continue;
        const category = botResponses[key];
        if (category.keywords && category.keywords.some(matchesKeyword)) {
            let msg = typeof category.response === 'function' ? category.response(text) : category.response;

            const intros = ["Com certeza! ", "Entendo. ", "Aqui estão as informações: ", "Deixe-me verificar... ", "Claro! "];
            msg = intros[Math.floor(Math.random() * intros.length)] + msg;

            appendMessage(msg, 'bot');
            if (category.action === 'redirect_whatsapp') {
                setTimeout(() => redirectToWhatsApp(text), 2000);
            }
            found = true;
            break;
        }
    }
    if (!found) {
        const defaults = [
            botResponses.default.response,
            "Não consegui processar isso agora, mas posso te ajudar com tempos de espera na UAI ou Hospitais. O que prefere?",
            "Desculpe, ainda estou aprendendo. Tente perguntar sobre 'documentos' ou 'espera na UAI'.",
            "Hum, não entendi bem. Você gostaria de falar com um atendente via WhatsApp?"
        ];
        appendMessage(defaults[Math.floor(Math.random() * defaults.length)], 'bot');
    }
}

function redirectToWhatsApp(lastUserMessage) {
    const summary = `*Olá! Gostaria de atendimento na UAI/Saúde Uberlândia.*\n\n*Triagem Digital:*\n- Motivo: ${lastUserMessage}\n- Origem: Portal Fila Zero`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(summary)}`, '_blank');
}

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
});