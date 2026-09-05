const GROQ_API_KEY = (window.GROQ_API_KEY || "").trim();
const PROXY_URL = ""; // 👈 COLOQUE AQUI A URL DO SEU CLOUDFLARE WORKER QUANDO CRIAR
const WHATSAPP_NUMBER = "5534996547968";

let currentChatState = 'IDLE'; // 'IDLE', 'AWAITING_NAME', 'AWAITING_CPF', 'AWAITING_REQUEST', 'CONVERSING'
let currentConversationId = null;
let collectedData = {
    name: '',
    cpf: '',
    reason: ''
};

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
        'UAI Centro': { base: 120, status: 'Moderado' },
        'UAI São Jorge': { base: 150, status: 'Lotado' },
        'UAI Pampulha': { base: 100, status: 'Estável' },
        'UAI Morumbi': { base: 180, status: 'Crítico' },
        'UAI Planalto': { base: 130, status: 'Moderado' },
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
        keywords: ['tempo', 'espera', 'fila', 'demora', 'uai', 'centro', 'são jorge', 'pampulha', 'morumbi', 'planalto', 'quanto tempo', 'está cheio'],
        response: () => {
            let res = `⏳ *Estimativa de Espera - UAIs Uberlândia:*\n\n`;
            for (const [uai, data] of Object.entries(healthData.uai)) {
                if (uai === 'docs') continue;
                const wait = PredictionEngine.calculateWait(data.base);
                res += `🔹 ${uai}: aprox. ${wait} (${data.status})\n`;
            }
            res += `\nLembrando que esses valores flutuam conforme a chegada de novos pacientes. Deseja agendar seu horário?`;
            return res;
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
                        3. DISTINÇÃO IMPORTANTE:
                           - Se o usuário perguntar sobre DOCUMENTOS (RG, CNH, etc.), forneça a informação DIRETAMENTE da base de dados. NÃO encaminhe para atendimento humano apenas para informar documentos.
                           - Somente se o usuário explicitamente quiser FALAR COM UM HUMANO, SUPORTE ou AGENDAR um serviço, incentive-o a usar o botão de atendimento/solicitações.
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

    if (currentChatState === 'CONVERSING') {
        const solicitations = JSON.parse(localStorage.getItem('fz_solicitations') || '[]');
        const index = solicitations.findIndex(s => s.id === currentConversationId);
        if (index !== -1) {
            solicitations[index].messages.push({
                sender: 'user',
                text: text,
                date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            });
            localStorage.setItem('fz_solicitations', JSON.stringify(solicitations));
        }
        return;
    }

    if (currentChatState === 'AWAITING_NAME') {
        collectedData.name = text;
        currentChatState = 'AWAITING_CPF';
        appendMessage(`Obrigado, ${text}! Agora, por favor, informe o seu CPF para que possamos prosseguir.`, 'bot');
        return;
    }

    if (currentChatState === 'AWAITING_CPF') {
        collectedData.cpf = text;
        currentChatState = 'AWAITING_REQUEST';
        appendMessage(`Certo. Para agilizarmos seu atendimento, poderia descrever brevemente qual é a sua solicitação?`, 'bot');
        return;
    }

    if (currentChatState === 'AWAITING_REQUEST') {
        collectedData.reason = text;

        // Create solicitation with messages array
        const newSolicitation = {
            id: Date.now(),
            name: collectedData.name,
            cpf: collectedData.cpf,
            reason: collectedData.reason,
            date: new Date().toLocaleString('pt-BR'),
            status: 'Pendente',
            messages: [
                { sender: 'user', text: collectedData.reason, date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
            ]
        };

        const solicitations = JSON.parse(localStorage.getItem('fz_solicitations') || '[]');
        solicitations.push(newSolicitation);
        localStorage.setItem('fz_solicitations', JSON.stringify(solicitations));

        currentConversationId = newSolicitation.id;
        currentChatState = 'CONVERSING';

        appendMessage("Perfeito! Recebemos seus dados. Agora você está conectado com nossa central. Pode aguardar que um atendente humano assumirá a conversa por aqui mesmo!", 'bot');
        updateSolicitacoesBadge();

        // Start polling for admin replies
        startChatPolling();
        return;
    }

    if (text.toLowerCase().includes('whatsapp') || text.toLowerCase().includes('atendente') || text.toLowerCase().includes('humano')) {
        collectedData.reason = ''; // Reset reason to be filled at the end
        currentChatState = 'AWAITING_NAME';
        appendMessage("Com certeza! Para que possamos encaminhar seu pedido ao atendente correto, preciso de algumas informações. Qual o seu Nome Completo?", 'bot');
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
                collectedData.reason = text;
                currentChatState = 'AWAITING_NAME';
                appendMessage("Com certeza! Para que possamos encaminhar seu pedido ao atendente correto, preciso de algumas informações. Qual o seu Nome Completo?", 'bot');
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

function startChatPolling() {
    setInterval(() => {
        if (currentChatState !== 'CONVERSING' || !currentConversationId) return;

        const solicitations = JSON.parse(localStorage.getItem('fz_solicitations') || '[]');
        const s = solicitations.find(sol => sol.id === currentConversationId);

        if (s && s.messages) {
            const lastMsg = s.messages[s.messages.length - 1];
            // We only want to append messages that are not yet in the UI
            // For simplicity in this demo, we'll track how many messages we've rendered
            const currentUImsgs = document.querySelectorAll('.chat-bubble-bot, .chat-bubble-user').length;
            // This is a naive check, better to store the last rendered index
            // but since it's a demo, let's use a simple "last msg text" check or store index
        }
    }, 2000);
}

// Refined polling with index tracking
let lastRenderedMsgIndex = 0;
function startChatPolling() {
    lastRenderedMsgIndex = 1; // First message (reason) is already there
    setInterval(() => {
        if (currentChatState !== 'CONVERSING' || !currentConversationId) return;

        const solicitations = JSON.parse(localStorage.getItem('fz_solicitations') || '[]');
        const s = solicitations.find(sol => sol.id === currentConversationId);

        if (!s || s.status === 'Finalizado') {
            if (s && s.status === 'Finalizado') {
                currentChatState = 'IDLE';
                currentConversationId = null;
                appendMessage("O atendimento humano foi encerrado. Agora você pode voltar a tirar dúvidas comigo!", 'bot');
            }
            return;
        }

        if (s && s.messages && s.messages.length > lastRenderedMsgIndex) {
            for (let i = lastRenderedMsgIndex; i < s.messages.length; i++) {
                const msg = s.messages[i];
                if (msg.sender === 'admin') {
                    appendMessage(msg.text, 'bot');
                }
            }
            lastRenderedMsgIndex = s.messages.length;
        }
    }, 1000);
}

function updateSolicitacoesBadge() {
    const solicitations = JSON.parse(localStorage.getItem('fz_solicitations') || '[]');
    const badge = document.getElementById('solicitacoes-badge');
    if (badge) {
        if (solicitations.length > 0) {
            badge.innerText = solicitations.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function toggleSolicitacoesView() {
    const modal = document.getElementById('solicitacoes-modal');
    const isHidden = modal.classList.contains('hidden');

    if (isHidden) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        renderSolicitacoes();
        // Clear badge when viewing
        const badge = document.getElementById('solicitacoes-badge');
        if (badge) badge.classList.add('hidden');
    } else {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function renderSolicitacoes() {
    const list = document.getElementById('solicitacoes-list');
    const solicitations = JSON.parse(localStorage.getItem('fz_solicitations') || '[]');

    if (solicitations.length === 0) {
        list.innerHTML = '<p class="text-center text-slate-500 py-10">Nenhuma solicitação pendente.</p>';
        return;
    }

    list.innerHTML = solicitations.map(s => `
        <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-2 hover:border-blue-300 transition">
            <div class="flex justify-between items-start">
                <span class="font-bold text-slate-800">${s.name}</span>
                <div class="flex gap-2">
                    <span class="text-[10px] ${s.status === 'Pendente' ? 'bg-blue-100 text-blue-600' : s.status === 'Respondido' ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-600'} px-2 py-0.5 rounded-full font-bold uppercase">${s.status}</span>
                    ${s.status === 'Pendente' ? `<button onclick="attendSolicitation(${s.id})" class="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold uppercase hover:bg-blue-700 transition">Atender</button>` : ''}
                </div>
            </div>
            <div class="text-sm text-slate-600 flex justify-between">
                <span>CPF: ${s.cpf}</span>
                <span class="text-slate-400">${s.date}</span>
            </div>
            <p class="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-100 italic">"${s.reason}"</p>
            ${s.response ? `<div class="text-sm text-slate-600 bg-green-50 p-3 rounded-lg border border-green-100"><b class="text-green-700">Resposta do Atendente:</b> ${s.response}</div>` : ''}
        </div>
    `).join('');
}

function attendSolicitation(id) {
    openConversation(id);
}

function openConversation(id) {
    const solicitations = JSON.parse(localStorage.getItem('fz_solicitations') || '[]');
    const s = solicitations.find(sol => sol.id === id);
    if (!s) return;

    currentConversationId = id;

    // Update Header
    document.getElementById('conv-user-name').innerText = s.name;

    // Render Messages
    const convMessages = document.getElementById('conv-messages');
    convMessages.innerHTML = '';

    if (s.messages && s.messages.length > 0) {
        s.messages.forEach(msg => {
            appendConvMessage(msg.text, msg.sender === 'user' ? 'user' : 'admin');
        });
    }

    // Show Modal
    const modal = document.getElementById('conversation-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Start admin polling
    startAdminPolling();
}

function startAdminPolling() {
    clearInterval(adminPollInterval);
    adminPollInterval = setInterval(() => {
        if (!currentConversationId) return;

        const solicitations = JSON.parse(localStorage.getItem('fz_solicitations') || '[]');
        const s = solicitations.find(sol => sol.id === currentConversationId);

        if (s && s.messages) {
            const lastMsg = s.messages[s.messages.length - 1];
            const convMessages = document.getElementById('conv-messages');
            const currentUImsgsCount = convMessages.children.length;

            if (s.messages.length > currentUImsgsCount) {
                for (let i = currentUImsgsCount; i < s.messages.length; i++) {
                    const msg = s.messages[i];
                    appendConvMessage(msg.text, msg.sender === 'user' ? 'user' : 'admin');
                }
            }
        }
    }, 1000);
}

let adminPollInterval = null;

function appendConvMessage(text, sender) {
    const convMessages = document.getElementById('conv-messages');
    const div = document.createElement('div');
    div.className = sender === 'user' ? 'chat-bubble-user p-3 max-w-[80%] ml-auto fade-in' : 'chat-bubble-bot p-3 max-w-[80%] fade-in';
    div.innerText = text;
    convMessages.appendChild(div);
    convMessages.scrollTop = convMessages.scrollHeight;
}

function sendAdminMessage() {
    const input = document.getElementById('conv-input');
    const text = input.value.trim();
    if (!text || !currentConversationId) return;

    appendConvMessage(text, 'admin');
    input.value = '';

    const solicitations = JSON.parse(localStorage.getItem('fz_solicitations') || '[]');
    const index = solicitations.findIndex(s => s.id === currentConversationId);
    if (index !== -1) {
        solicitations[index].status = 'Respondido';
        solicitations[index].messages.push({
            sender: 'admin',
            text: text,
            date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        });
        localStorage.setItem('fz_solicitations', JSON.stringify(solicitations));
    }
}

function closeConversation() {
    if (currentConversationId) {
        const solicitations = JSON.parse(localStorage.getItem('fz_solicitations') || '[]');
        const index = solicitations.findIndex(s => s.id === currentConversationId);
        if (index !== -1) {
            solicitations[index].status = 'Atendido';
            localStorage.setItem('fz_solicitations', JSON.stringify(solicitations));
        }
    }
    currentConversationId = null;
    clearInterval(adminPollInterval);
    const modal = document.getElementById('conversation-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function clearSolicitacoes() {
    if (confirm('Deseja realmente limpar todas as solicitações?')) {
        localStorage.removeItem('fz_solicitations');
        renderSolicitacoes();
        updateSolicitacoesBadge();
    }
}

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
});

document.getElementById('conv-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendAdminMessage();
});

// Initialize badge on load
document.addEventListener('DOMContentLoaded', () => {
    updateSolicitacoesBadge();
    seedInitialSolicitations();
});

function seedInitialSolicitations() {
    const existing = JSON.parse(localStorage.getItem('fz_solicitations') || '[]');
    if (existing.length > 0) return; // Don't overwrite if already has data

    const demoData = [
        {
            id: 101,
            name: "Maria Oliveira",
            cpf: "123.456.789-00",
            reason: "Gostaria de agendar a renovação do meu RG, mas não sei se preciso de foto nova.",
            date: "04/09/2026, 08:30",
            status: "Respondido",
            messages: [
                { sender: 'user', text: "Gostaria de agendar a renovação do meu RG, mas não sei se preciso de foto nova.", date: "08:30" },
                { sender: 'admin', text: "Olá Maria! Para o RG, a foto é tirada na hora na unidade. Não precisa levar foto.", date: "08:45" }
            ],
            response: "A foto é tirada na hora na unidade. Não precisa levar foto."
        },
        {
            id: 102,
            name: "João Pereira",
            cpf: "234.567.890-11",
            reason: "Preciso de informação sobre a fila do Pronto Socorro Municipal, está muito grande?",
            date: "04/09/2026, 09:15",
            status: "Pendente",
            messages: [
                { sender: 'user', text: "Preciso de informação sobre a fila do Pronto Socorro Municipal, está muito grande?", date: "09:15" }
            ]
        },
        {
            id: 103,
            name: "Ana Costa",
            cpf: "345.678.901-22",
            reason: "Meu pai é idoso e tem dificuldade de locomoção. Existe prioridade para agendamento?",
            date: "04/09/2026, 10:00",
            status: "Respondido",
            messages: [
                { sender: 'user', text: "Meu pai é idoso e tem dificuldade de locomoção. Existe prioridade para agendamento?", date: "10:00" },
                { sender: 'admin', text: "Olá Ana! Sim, idosos e pessoas com mobilidade reduzida têm prioridade legal. Podemos agendar um horário especial.", date: "10:20" }
            ],
            response: "Sim, idosos e pessoas com mobilidade reduzida têm prioridade legal."
        },
        {
            id: 104,
            name: "Carlos Eduardo",
            cpf: "456.789.012-33",
            reason: "Tentei agendar pelo portal, mas deu erro no meu CPF. Pode me ajudar?",
            date: "04/09/2026, 11:20",
            status: "Pendente",
            messages: [
                { sender: 'user', text: "Tentei agendar pelo portal, mas deu erro no meu CPF. Pode me ajudar?", date: "11:20" }
            ]
        },
        {
            id: 105,
            name: "Beatriz Souza",
            cpf: "567.890.123-44",
            reason: "Quais os documentos necessários para a primeira habilitação na UAI Morumbi?",
            date: "04/09/2026, 13:00",
            status: "Respondido",
            messages: [
                { sender: 'user', text: "Quais os documentos necessários para a primeira habilitação na UAI Morumbi?", date: "13:00" },
                { sender: 'admin', text: "Olá Beatriz! Você precisará de RG, CPF, comprovante de residência e o atestado médico.", date: "13:15" }
            ],
            response: "Você precisará de RG, CPF, comprovante de residência e o atestado médico."
        },
        {
            id: 106,
            name: "Ricardo Lima",
            cpf: "678.901.234-55",
            reason: "Gostaria de saber se a UAI Planalto está funcionando amanhã.",
            date: "04/09/2026, 14:10",
            status: "Pendente",
            messages: [
                { sender: 'user', text: "Gostaria de saber se a UAI Planalto está funcionando amanhã.", date: "14:10" }
            ]
        },
        {
            id: 107,
            name: "Fernanda Alves",
            cpf: "789.012.345-66",
            reason: "Preciso de um espelho do meu prontuário do Hospital Municipal. Como faço?",
            date: "04/09/2026, 15:30",
            status: "Respondido",
            messages: [
                { sender: 'user', text: "Preciso de um espelho do meu prontuário do Hospital Municipal. Como faço?", date: "15:30" },
                { sender: 'admin', text: "Olá Fernanda! O pedido de prontuário deve ser feito presencialmente no setor de arquivos do hospital com documento original.", date: "16:00" }
            ],
            response: "O pedido de prontuário deve ser feito presencialmente no setor de arquivos."
        },
        {
            id: 108,
            name: "Marcos Vinícius",
            cpf: "890.123.456-77",
            reason: "O tempo de espera na UAI Centro está muito alto hoje? Tenho pressa.",
            date: "04/09/2026, 16:45",
            status: "Pendente",
            messages: [
                { sender: 'user', text: "O tempo de espera na UAI Centro está muito alto hoje? Tenho pressa.", date: "16:45" }
            ]
        },
        {
            id: 109,
            name: "Juliana Paes",
            cpf: "901.234.567-88",
            reason: "Meu filho tem 5 anos, preciso de documento especial para levar na UAI?",
            date: "04/09/2026, 17:20",
            status: "Respondido",
            messages: [
                { sender: 'user', text: "Meu filho tem 5 anos, preciso de documento especial para levar na UAI?", date: "17:20" },
                { sender: 'admin', text: "Olá Juliana! Sim, para menores de idade é indispensável a certidão de nascimento e o documento do responsável.", date: "17:40" }
            ],
            response: "Para menores de idade é indispensável a certidão de nascimento e documento do responsável."
        },
        {
            id: 110,
            name: "Sérgio Moro",
            cpf: "012.345.678-99",
            reason: "Quero trocar meu agendamento da UAI Centro para a UAI São Jorge. É possível?",
            date: "04/09/2026, 18:00",
            status: "Pendente",
            messages: [
                { sender: 'user', text: "Quero trocar meu agendamento da UAI Centro para a UAI São Jorge. É possível?", date: "18:00" }
            ]
        },
        {
            id: 111,
            name: "Patrícia Amorim",
            cpf: "111.222.333-44",
            reason: "Existe alguma vacina disponível agora no Hospital Municipal?",
            date: "04/09/2026, 19:10",
            status: "Respondido",
            messages: [
                { sender: 'user', text: "Existe alguma vacina disponível agora no Hospital Municipal?", date: "19:10" },
                { sender: 'admin', text: "Olá Patrícia! As vacinas de Influenza e COVID estão disponíveis. Recomendamos levar a carteirinha.", date: "19:30" }
            ],
            response: "Vacinas de Influenza e COVID disponíveis. Levar a carteirinha."
        },
        {
            id: 112,
            name: "Roberto Carlos",
            cpf: "222.333.444-55",
            reason: "Perdi meu comprovante de agendamento, como faço para recuperar?",
            date: "04/09/2026, 20:00",
            status: "Pendente",
            messages: [
                { sender: 'user', text: "Perdi meu comprovante de agendamento, como faço para recuperar?", date: "20:00" }
            ]
        },
        {
            id: 113,
            name: "Luciana Gimenez",
            cpf: "333.444.555-66",
            reason: "Quais os horários de atendimento da UAI Pampulha aos sábados?",
            date: "04/09/2026, 20:30",
            status: "Respondido",
            messages: [
                { sender: 'user', text: "Quais os horários de atendimento da UAI Pampulha aos sábados?", date: "20:30" },
                { sender: 'admin', text: "Olá Luciana! A UAI Pampulha funciona aos sábados das 08h às 12h.", date: "20:50" }
            ],
            response: "A UAI Pampulha funciona aos sábados das 08h às 12h."
        },
        {
            id: 114,
            name: "André Marques",
            cpf: "444.555.666-77",
            reason: "Preciso de um agendamento urgente para a UAI Morumbi, meu passaporte venceu.",
            date: "04/09/2026, 21:15",
            status: "Pendente",
            messages: [
                { sender: 'user', text: "Preciso de um agendamento urgente para a UAI Morumbi, meu passaporte venceu.", date: "21:15" }
            ]
        },
        {
            id: 115,
            name: "Sandra Bullock",
            cpf: "555.666.777-88",
            reason: "O site de agendamentos está fora do ar? Não consigo acessar.",
            date: "04/09/2026, 22:00",
            status: "Respondido",
            messages: [
                { sender: 'user', text: "O site de agendamentos está fora do ar? Não consigo acessar.", date: "22:00" },
                { sender: 'admin', text: "Olá Sandra! Tivemos uma instabilidade momentânea. Por favor, tente limpar o cache do navegador ou use a aba anônima.", date: "22:15" }
            ],
            response: "Tivemos uma instabilidade. Tente limpar o cache ou usar aba anônima."
        }
    ];

    localStorage.setItem('fz_solicitations', JSON.stringify(demoData));
    updateSolicitacoesBadge();
}
