// --- CONSTANTES DE API ---
const API_URLS = {
    OS: 'https://work.produ-cloud.com/webhook/agoora-hub-carrega-os',
    ATIVOS: 'https://work.produ-cloud.com/webhook/agoora-hub-carrega_ativos',
    HISTORICOS: 'https://work.produ-cloud.com/webhook/agoora-hub_carrega_historico_web',
    CRM: 'https://work.produ-cloud.com/webhook/agoora-hub-carrega_crm',
    ALTERA_OS: 'https://work.produ-cloud.com/webhook/agora-hub-altera_os',
    ALTERA_HISTORICO: 'https://work.produ-cloud.com/webhook/agoora-hub-atualiza_historico'
};

// --- ESTADO GLOBAL (CACHE) ---
// Usamos sessionStorage para manter os dados vivos durante a sessão,
// mas recarregar se o usuário fechar a aba.
const CACHE_KEYS = {
    OS: 'dataOS',
    ATIVOS: 'dataAtivos',
    HISTORICOS: 'dataHistoricos',
    CRM: 'dataCRM',
    TIPO_CORES: 'tipoCores',
    CLASS_CORES: 'classificacaoCores'
};

// --- FUNÇÕES UTILITÁRIAS ---
const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (date) => date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const formatDateOnly = (date) => date.toLocaleDateString('pt-BR', { dateStyle: 'short' });
const formatTime = (date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const generateRandomColor = () => { const h = Math.floor(Math.random() * 360); return `hsl(${h}, 70%, 50%)`; };
const toLocalISOString = (date) => { const tzoffset = (new Date()).getTimezoneOffset() * 60000; return (new Date(date - tzoffset)).toISOString().slice(0, -1); };
const parseCurrency = (value) => Number(value.replace(/\D/g, '')) / 100;
const MS_PER_DAY = 1000 * 60 * 60 * 24; // Milissegundos em um dia

// --- LÓGICA DE DADOS (CACHE & API) ---

/**
 * Salva dados no sessionStorage.
 * @param {string} key - A chave para o sessionStorage (usar CACHE_KEYS).
 * @param {any} data - Os dados a serem salvos.
 */
function setCache(key, data) {
    sessionStorage.setItem(key, JSON.stringify(data));
}

/**
 * Obtém dados do sessionStorage.
 * @param {string} key - A chave do sessionStorage (usar CACHE_KEYS).
 * @returns {any} Os dados parseados ou null se não existirem.
 */
function getCache(key) {
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

/**
 * Limpa todo o cache de dados da sessão.
 */
function clearCache() {
    Object.values(CACHE_KEYS).forEach(key => sessionStorage.removeItem(key));
    console.log("Cache da sessão limpo.");
}

/**
 * Busca todos os dados da API (se não estiverem no cache) e os armazena.
 * @param {boolean} forceRefresh - Força a busca da API ignorando o cache.
 * @returns {Promise<Object>} Um objeto com { dataOS, dataAtivos, dataHistoricos, dataCRM }
 */
async function fetchAllData(forceRefresh = false) {
    let dataOS = getCache(CACHE_KEYS.OS);
    let dataAtivos = getCache(CACHE_KEYS.ATIVOS);
    let dataHistoricos = getCache(CACHE_KEYS.HISTORICOS);
    let dataCRM = getCache(CACHE_KEYS.CRM);

    if (forceRefresh || !dataOS || !dataAtivos || !dataHistoricos || !dataCRM) {
        console.log("Cache não encontrado ou 'forceRefresh' ativado. Buscando dados da API...");
        try {
            // Alterado de Promise.all para Promise.allSettled para depuração
            const results = await Promise.allSettled([
                fetch(API_URLS.OS).then(res => res.json()),
                fetch(API_URLS.ATIVOS).then(res => res.json()),
                fetch(API_URLS.HISTORICOS).then(res => res.json()),
                fetch(API_URLS.CRM).then(res => res.json())
            ]);

            // Verificar os resultados
            const [osResult, ativosResult, historicosResult, crmResult] = results;

            // Log de erros detalhado para depuração
            if (osResult.status === 'rejected') {
                console.error('Falha ao carregar OS:', osResult.reason);
            }
            if (ativosResult.status === 'rejected') {
                console.error('Falha ao carregar ATIVOS:', ativosResult.reason);
            }
            if (historicosResult.status === 'rejected') {
                console.error('Falha ao carregar HISTORICOS:', historicosResult.reason);
            }
            if (crmResult.status === 'rejected') {
                console.error('Falha ao carregar CRM:', crmResult.reason);
            }

            // Se qualquer um falhar, lançar o erro genérico para a UI
            if (results.some(r => r.status === 'rejected')) {
                throw new Error('Uma ou mais requisições à API falharam. Verifique o console para detalhes.');
            }
            
            // Extrair dados se tudo deu certo
            const osData = osResult.value;
            const ativosData = ativosResult.value;
            const historicosData = historicosResult.value;
            const crmData = crmResult.value;
            
            // Ordenar os dados
            dataOS = osData.sort((a, b) => a.Nome_OS.localeCompare(b.Nome_OS));
            dataAtivos = ativosData.sort((a, b) => a.Nome_Ativo.localeCompare(b.Nome_Ativo));
            dataCRM = crmData.sort((a, b) => a.Nome_CRM.localeCompare(b.Nome_CRM));
            dataHistoricos = historicosData; // Não precisa ordenar

            // Salvar no cache
            setCache(CACHE_KEYS.OS, dataOS);
            setCache(CACHE_KEYS.ATIVOS, dataAtivos);
            setCache(CACHE_KEYS.HISTORICOS, dataHistoricos);
            setCache(CACHE_KEYS.CRM, dataCRM);

        } catch (error) {
            console.error('Falha ao carregar dados (catch principal):', error);
            throw error; // Propaga o erro para quem chamou
        }
    } else {
        console.log("Dados carregados do cache da sessão.");
    }

    // Gerar cores (isso pode ser cacheado também)
    let tipoCores = getCache(CACHE_KEYS.TIPO_CORES) || {};
    dataAtivos.forEach(a => {
        if (a.Tipo && !tipoCores[a.Tipo]) tipoCores[a.Tipo] = generateRandomColor();
    });
    setCache(CACHE_KEYS.TIPO_CORES, tipoCores);

    let classificacaoCores = getCache(CACHE_KEYS.CLASS_CORES) || {};
    dataCRM.forEach(c => {
        if (c.Classificacao && !classificacaoCores[c.Classificacao]) classificacaoCores[c.Classificacao] = generateRandomColor();
    });
    setCache(CACHE_KEYS.CLASS_CORES, classificacaoCores);


    return { dataOS, dataAtivos, dataHistoricos, dataCRM, tipoCores, classificacaoCores };
}

/**
 * Obtém o ID da URL (ex: ?id=...).
 * @returns {string | null} O ID encontrado ou null.
 */
function getIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}


// --- LÓGICA DE NEGÓCIO COMPARTILHADA ---

/**
 * Calcula o valor bruto de uma OS, considerando as alterações pendentes.
 * @param {string} osId - O ID da OS.
 * @param {Array} dataHistoricos - Array original de históricos.
 * @param {Array} [historicosParaCriar=[]] - Array de novos históricos.
 * @param {Array} [historicosParaApagar=[]] - Array de históricos para deletar.
 * @param {Array} [historicosParaAtualizar=[]] - Array de históricos atualizados.
 * @returns {number} O valor bruto calculado.
 */
function calculateGrossValue(osId, dataHistoricos, historicosParaCriar = [], historicosParaApagar = [], historicosParaAtualizar = []) {
    const idsApagados = historicosParaApagar.map(h => h.ID_Historico_Web);
    const idsAtualizados = historicosParaAtualizar.map(h => h.ID_Historico_Web);

    // 1. Históricos originais que NÃO foram apagados NEM atualizados
    const historicosBase = dataHistoricos.filter(h => 
        h.ID_OS_Vinculada === osId &&
        !idsApagados.includes(h.ID_Historico_Web) && 
        !idsAtualizados.includes(h.ID_Historico_Web)
    );

    // 2. Novos históricos E históricos atualizados (que são para esta OS)
    const historicosNovosEAtualizados = [
        ...historicosParaCriar, 
        ...historicosParaAtualizar
    ].filter(h => h.ID_OS_Vinculada === osId);

    // Soma tudo
    return [...historicosBase, ...historicosNovosEAtualizados]
        .reduce((total, h) => total + (h.Valor_Calculado || 0), 0);
}

/**
 * Verifica se um ativo está disponível em um determinado período.
 * @param {Array} dataHistoricos - A lista completa de históricos.
 * @param {string} ativoId - O ID do ativo a verificar.
 * @param {string} startTime - Data/hora de início (ISO String).
 * @param {string} endTime - Data/hora de fim (ISO String).
 * @param {string | null} excludeHistoricoId - ID de um histórico a ignorar (para edição).
 * @returns {boolean} True se disponível, false se houver conflito.
 */
function checkAvailability(dataHistoricos, ativoId, startTime, endTime, excludeHistoricoId = null) {
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);
    for (const historico of dataHistoricos) {
        if (historico.ID_Historico_Web === excludeHistoricoId) continue;
        if (historico.ID_Ativo === ativoId) {
            const existingStart = new Date(historico.Inicio_Historico);
            const existingEnd = new Date(historico.Fim_Historico);
            if (newStart < existingEnd && newEnd > existingStart) return false;
        }
    }
    return true;
}

/**
 * Salva alterações (criação/update) em uma OS.
 * @param {object} payload - O payload da ação (ex: [{ acao: "create", ... }]).
 * @returns {Promise<boolean>} True se sucesso, false se falha.
 */
async function handleSaveOS(payload) {
    try {
        const response = await fetch(API_URLS.ALTERA_OS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Falha ao salvar a OS.');
        await fetchAllData(true); // Força a atualização do cache
        return true;
    } catch (error) {
        console.error("Erro ao salvar OS:", error);
        return false;
    }
}

/**
 * Salva um lote de alterações de históricos (create, update, delete).
 * @param {Array} payload - O array de ações.
 * @returns {Promise<boolean>} True se sucesso, false se falha.
 */
async function handleSaveHistoricos(payload) {
    if (payload.length === 0) return true;
    try {
        const response = await fetch(API_URLS.ALTERA_HISTORICO, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) { throw new Error(`Erro do servidor: ${response.statusText}`); }
        await fetchAllData(true); // Força a atualização do cache
        return true;
    } catch (error) {
        console.error("Erro ao salvar históricos:", error);
        return false;
    }
}

// --- FUNÇÕES DE MODAL COMPARTILHADAS ---

/**
 * Exibe o modal para criar ou editar uma OS.
 * @param {'create' | 'update'} mode - O modo do modal.
 * @param {object | null} os - O objeto OS (necessário para 'update').
 * @param {Function} onSaveCallback - Função a ser chamada ao salvar.
 */
function showOSModal(mode, os, onSaveCallback) {
    const osModal = document.getElementById('os-modal');
    if (!osModal) return;

    const osModalTitle = document.getElementById('os-modal-title');
    const osNameInput = document.getElementById('os-name-input');
    const osModalDiscountInput = document.getElementById('os-modal-discount-input');
    const osModalError = document.getElementById('os-modal-error');
    const osModalSaveBtn = document.getElementById('os-modal-save-btn');

    osModalTitle.textContent = mode === 'create' ? 'Criar Nova Ordem de Serviço' : 'Editar Ordem de Serviço';
    osNameInput.value = os ? os.Nome_OS : '';
    const discountValue = os ? (os.Desconto_OS || 0) : 0;
    osModalDiscountInput.value = discountValue > 0 ? formatCurrency(discountValue) : '';
    osModalError.textContent = '';
    
    // Remove listeners antigos para evitar duplicatas
    const newSaveBtn = osModalSaveBtn.cloneNode(true);
    osModalSaveBtn.parentNode.replaceChild(newSaveBtn, osModalSaveBtn);

    newSaveBtn.addEventListener('click', () => {
        const newName = osNameInput.value.trim();
        const newDiscount = parseCurrency(osModalDiscountInput.value);
        if (!newName) {
            osModalError.textContent = "O nome não pode estar em branco.";
            return;
        }

        let payload;
        if (mode === 'create') {
            payload = [{ acao: "create", Nome_OS: newName, Valor_Desconto: newDiscount }];
        } else {
            if (newName === os.Nome_OS && newDiscount === (os.Desconto_OS || 0)) {
                hideOSModal(); // Nenhuma mudança
                return;
            }
            payload = [{ acao: "update", ID_OS: os.ID_OS, Nome_OS: newName, Valor_Desconto: newDiscount }];
        }
        
        onSaveCallback(payload);
    });

    osModal.classList.remove('is-hidden');
    osNameInput.focus();
}

function hideOSModal() {
    const osModal = document.getElementById('os-modal');
    if(osModal) osModal.classList.add('is-hidden');
}

// Funções para os outros modais (day-details, historico-edit)
// Elas serão movidas para os JS específicos (detalhe-ativo.js, detalhe-os.js)
// quando essas páginas forem criadas, pois são usadas apenas lá.