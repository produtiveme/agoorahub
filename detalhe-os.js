document.addEventListener('DOMContentLoaded', () => {

    // --- DADOS GLOBAIS (do cache) ---
    let dataOS = [];
    let dataAtivos = [];
    let dataHistoricos = [];
    let dataCRM = [];

    // --- ESTADO LOCAL DA PÁGINA ---
    let currentOSId = null;
    let currentOS = null;
    let selectedAtivoId = null;
    let currentBillingType = 'hora';
    let historicoEditContext = null;

    // "Staging" para alterações
    let historicosParaCriar = [];
    let historicosParaApagar = [];
    let historicosParaAtualizar = [];

    // --- ELEMENTOS DO DOM ---
    const mainView = document.getElementById('details-view');
    const backBtn = document.getElementById('back-to-dashboard-btn');
    const osDetailsTitle = document.getElementById('os-details-title');
    const editOSDetailsBtn = document.getElementById('edit-os-details-btn');

    // Painel CRM
    const crmPanel = document.getElementById('crm-details-panel');
    const crmInfoContainer = document.getElementById('crm-info-container');

    // Form Adicionar Ativo
    const addAtivoBtn = document.getElementById('add-ativo-btn');
    const searchInput = document.getElementById('ativo-search-input');
    const suggestionsContainer = document.getElementById('ativo-suggestions');
    const errorMessage = document.getElementById('error-message');
    const billingTypeRadios = document.querySelectorAll('input[name="billing-type"]');

    // Lista de Alocados
    const alocadosList = document.getElementById('alocados-list');

    // Resumo Financeiro
    const osGrossValueEl = document.getElementById('os-gross-value');
    const osDiscountValueEl = document.getElementById('os-discount-value');
    const osFinalTotalValueEl = document.getElementById('os-final-total-value');

    // Rodapé de Ações
    const saveOSBtn = document.getElementById('save-os-btn');
    const saveStatus = document.getElementById('save-status');
    const generatePdfBtn = document.getElementById('generate-pdf-btn');

    // Modais
    const osModal = document.getElementById('os-modal');
    const osModalCloseBtn = document.getElementById('os-modal-close-btn');
    const osModalCancelBtn = document.getElementById('os-modal-cancel-btn');
    const osModalDiscountInput = document.getElementById('os-modal-discount-input');

    const historicoEditModal = document.getElementById('historico-edit-modal');
    const historicoModalCloseBtn = document.getElementById('historico-modal-close-btn');
    const historicoModalCancelBtn = document.getElementById('historico-modal-cancel-btn');
    const historicoModalSaveBtn = document.getElementById('historico-modal-save-btn');


    // --- RENDERIZAÇÃO ---

    /**
     * Atualiza o estado visual do botão "Salvar" (amarelo, desabilitado)
     */
    function updateSaveButtonState() {
        const hasPendingChanges = historicosParaCriar.length > 0 || historicosParaApagar.length > 0 || historicosParaAtualizar.length > 0;
        saveOSBtn.disabled = !hasPendingChanges;
        saveOSBtn.classList.toggle('pending-changes', hasPendingChanges);
        if (!hasPendingChanges) { saveStatus.textContent = ''; }
    }

    /**
     * Atualiza o card de Resumo Financeiro (Bruto, Desconto, Total)
     */
    function updateFinancialSummary() {
        if (!currentOS) return;

        // CORREÇÃO: Agora chama a função de `common.js` passando o estado pendente
        const grossValue = calculateGrossValue(currentOSId, dataHistoricos, historicosParaCriar, historicosParaApagar, historicosParaAtualizar);

        const discountValue = currentOS.Desconto_OS || 0;
        const finalTotal = grossValue - discountValue;

        osGrossValueEl.textContent = formatCurrency(grossValue);
        osDiscountValueEl.textContent = formatCurrency(discountValue);
        osFinalTotalValueEl.textContent = formatCurrency(finalTotal);
    }

    /**
     * Renderiza a lista de ativos alocados, agrupados por classificação
     */
    function renderAlocadosList() {
        if (!currentOSId) return;
        alocadosList.innerHTML = '';

        const idsApagados = historicosParaApagar.map(h => h.ID_Historico_Web);
        const idsAtualizados = historicosParaAtualizar.map(h => h.ID_Historico_Web);

        // 1. Históricos do cache que não estão em "apagar" ou "atualizar"
        const historicosBase = dataHistoricos.filter(h =>
            h.ID_OS_Vinculada === currentOSId && // Filtra pela OS aqui
            !idsApagados.includes(h.ID_Historico_Web) &&
            !idsAtualizados.includes(h.ID_Historico_Web)
        );

        // 2. Todos os históricos visíveis para esta OS
        const historicosVisiveis = [
            ...historicosBase,
            ...historicosParaCriar.filter(h => h.ID_OS_Vinculada === currentOSId),
            ...historicosParaAtualizar.filter(h => h.ID_OS_Vinculada === currentOSId)
        ];

        if (historicosVisiveis.length === 0) {
            alocadosList.innerHTML = '<p>Nenhum ativo alocado nesta OS.</p>';
            return;
        }

        // Agrupa por classificação
        const groupedByClassification = historicosVisiveis.reduce((acc, historico) => {
            const ativo = dataAtivos.find(a => a.ID_Ativo === historico.ID_Ativo);
            const classification = (ativo && ativo.Classificacao) ? ativo.Classificacao : 'Sem Classificação';
            if (!acc[classification]) acc[classification] = [];
            acc[classification].push(historico);
            return acc;
        }, {});

        // Ordena (Local, Profissional, Outros)
        const sortedClassifications = Object.keys(groupedByClassification).sort((a, b) => {
            const order = { 'Local Físico': 1, 'Profissional': 2 };
            const aOrder = order[a] || 3, bOrder = order[b] || 3;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.localeCompare(b);
        });

        // Renderiza os grupos
        sortedClassifications.forEach(classification => {
            const groupTitle = document.createElement('h4');
            groupTitle.className = 'classification-group-title';
            groupTitle.textContent = classification;
            alocadosList.appendChild(groupTitle);

            const historicosDoGrupo = groupedByClassification[classification];
            historicosDoGrupo.forEach((historico, index) => {
                const ativo = dataAtivos.find(a => a.ID_Ativo === historico.ID_Ativo);
                if (!ativo) return;

                const start = new Date(historico.Inicio_Historico), end = new Date(historico.Fim_Historico);
                let periodoHtml = (historico.Tipo_Faturamento === 'hora')
                    ? `De: ${formatDate(start)} até ${formatDate(end)} (${historico.Duracao_Faturada.toFixed(1)} horas)`
                    : `De: ${formatDateOnly(start)} até ${formatDateOnly(end)} (${historico.Duracao_Faturada} diárias)`;

                const item = document.createElement('div');
                item.className = 'alocado-item';
                if (index === historicosDoGrupo.length - 1) item.classList.add('last-in-group');
                item.innerHTML = `
                    <div class="info">
                        <p class="ativo-name">${ativo.Nome_Ativo}</p>
                        <p class="periodo">${periodoHtml}</p>
                        <p>Custo: ${formatCurrency(historico.Valor_Calculado)}</p>
                    </div>
                    <div class="alocado-item-actions">
                        <button class="edit-btn" data-historico-id="${historico.ID_Historico_Web}">Editar</button>
                        <button class="remove-btn" data-historico-id="${historico.ID_Historico_Web}">Remover</button>
                    </div>`;
                alocadosList.appendChild(item);
            });
        });

        // Adiciona listeners aos botões
        alocadosList.querySelectorAll('.remove-btn').forEach(button => button.addEventListener('click', handleRemoveHistorico));
        alocadosList.querySelectorAll('.edit-btn').forEach(button => button.addEventListener('click', (e) => showHistoricoEditModal(e.target.dataset.historicoId)));
    }

    /**
     * Renderiza o painel de CRM (se houver)
     */
    function renderCrmPanel() {
        crmInfoContainer.innerHTML = '';
        if (currentOS && currentOS.ID_CRM && currentOS.ID_CRM !== 'SEM CRM') {
            const crm = dataCRM.find(c => c.ID_CRM_Notion === currentOS.ID_CRM);
            if (crm) {
                crmInfoContainer.innerHTML = `
                    <div class="detail-item"><strong>Nome</strong> ${crm.Nome_CRM || 'N/D'}</div>
                    <div class="detail-item"><strong>Telefone</strong> ${crm.Telefone || 'N/D'}</div>
                    <div class="detail-item"><strong>E-mail</strong> ${crm.Email || 'N/D'}</div>
                    <div class="detail-item"><strong>CPF/CNPJ</strong> ${crm['CPF-CNPJ'] || 'N/D'}</div>
                    <div class="detail-item"><strong>Site</strong> ${crm.Site || 'N/D'}</div>
                    <div class="detail-item" style="grid-column: 1 / -1;"><strong>Endereço</strong> ${crm.Endereco_Completo || 'Nenhum endereço fornecido.'}</div>
                `;
                crmPanel.classList.remove('is-hidden');
            } else {
                crmPanel.classList.add('is-hidden');
            }
        } else {
            crmPanel.classList.add('is-hidden');
        }
    }

    /**
     * Renderiza toda a página de detalhes
     */
    function renderDetails() {
        if (!currentOS) return;
        osDetailsTitle.textContent = `Detalhes da ${currentOS.Nome_OS}`;

        renderCrmPanel();
        renderAlocadosList();
        updateFinancialSummary();
        updateSaveButtonState();
    }


    // --- LÓGICA DE EVENTOS ---

    // Adicionar Ativo
    addAtivoBtn.addEventListener('click', () => {
        errorMessage.textContent = '';
        if (!selectedAtivoId) { errorMessage.textContent = "Por favor, selecione um ativo."; return; }

        const ativo = dataAtivos.find(a => a.ID_Ativo === selectedAtivoId);
        let start, end, duracao, valor, valorCalculado, inicioISO, fimISO;

        try {
            if (currentBillingType === 'hora') {
                start = document.getElementById('start-time-input').value;
                end = document.getElementById('end-time-input').value;
                if (!start || !end) { throw new Error("Preencha as datas e horas de início e fim."); }

                const startDate = new Date(start); const endDate = new Date(end);
                if (startDate >= endDate) { throw new Error("A data de fim deve ser posterior à de início."); }

                valor = ativo['Valor Hora'];
                if (valor === null || valor === undefined) { throw new Error("Este ativo não possui 'Valor Hora' definido."); }

                duracao = ((endDate - startDate) / 36e5);
                valorCalculado = duracao * valor;
                inicioISO = startDate.toISOString();
                fimISO = endDate.toISOString();

            } else { // Diária
                start = document.getElementById('start-date-input').value;
                end = document.getElementById('end-date-input').value;
                if (!start || !end) { throw new Error("Preencha as datas de início e fim."); }

                // Trata as datas como T00:00 no fuso local para evitar problemas
                const startDate = new Date(start + 'T00:00:00');
                const endDate = new Date(end + 'T00:00:00');

                if (startDate > endDate) { throw new Error("A data de fim deve ser igual ou posterior à de início."); }

                valor = ativo['Valor Diária'];
                if (valor === null || valor === undefined) { throw new Error("Este ativo não possui 'Valor Diária' definido."); }

                // Cálculo de diárias (ex: 13/10 a 16/10 = 4 dias)
                // Math.round para evitar problemas com horário de verão
                duracao = Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;

                valorCalculado = duracao * valor;
                inicioISO = startDate.toISOString();

                // Salva o fim do dia
                const endDateFim = new Date(end + 'T23:59:59');
                fimISO = endDateFim.toISOString();
            }

            // Unifica os dados de histórico (cache + pendentes) para checagem
            const todosHistoricos = [...dataHistoricos, ...historicosParaCriar, ...historicosParaAtualizar];

            if (!checkAvailability(todosHistoricos, selectedAtivoId, inicioISO, fimISO)) {
                throw new Error("Erro: Ativo já alocado neste período.");
            }

            // Adiciona à lista de "pendentes para criar"
            historicosParaCriar.push({
                ID_Historico_Web: 'hist-' + Date.now(),
                ID_Ativo: selectedAtivoId,
                ID_OS_Vinculada: currentOSId,
                Inicio_Historico: inicioISO,
                Fim_Historico: fimISO,
                Tipo_Faturamento: currentBillingType,
                Valor_Calculado: valorCalculado,
                Duracao_Faturada: duracao
            });

            // Limpa o formulário
            searchInput.value = '';
            selectedAtivoId = null;
            document.getElementById('start-time-input').value = '';
            document.getElementById('end-time-input').value = '';
            document.getElementById('start-date-input').value = '';
            document.getElementById('end-date-input').value = '';
            suggestionsContainer.innerHTML = '';

            // Re-renderiza tudo
            renderDetails();

        } catch (error) {
            errorMessage.textContent = error.message;
        }
    });

    // Remover Histórico
    function handleRemoveHistorico(event) {
        const historicoId = event.target.dataset.historicoId;

        // 1. Se estava na lista "Para Criar", apenas remova de lá
        let index = historicosParaCriar.findIndex(h => h.ID_Historico_Web === historicoId);
        if (index > -1) {
            historicosParaCriar.splice(index, 1);
        } else {
            // 2. Se estava na lista "Para Atualizar", remova de lá
            index = historicosParaAtualizar.findIndex(h => h.ID_Historico_Web === historicoId);
            if (index > -1) {
                historicosParaAtualizar.splice(index, 1);
            }

            // 3. Adiciona na lista "Para Apagar" (se for um item original)
            const historicoOriginal = dataHistoricos.find(h => h.ID_Historico_Web === historicoId);
            if (historicoOriginal && !historicosParaApagar.find(h => h.ID_Historico_Web === historicoId)) {
                historicosParaApagar.push(historicoOriginal);
            }
        }

        renderDetails();
    }

    // Salvar Lote de Históricos no Notion
    saveOSBtn.addEventListener('click', async () => {
        saveStatus.textContent = 'A salvar alterações...';
        saveStatus.className = '';
        saveOSBtn.disabled = true;

        const mapToPayload = (h) => ({
            ID_Notion_Registro: h.ID_Notion_Registro || null,
            ID_Historico_Web: h.ID_Historico_Web,
            ID_Ativo_Texto: h.ID_Ativo,
            ID_OS_Texto: h.ID_OS_Vinculada,
            Periodo_Alocacao: { start: h.Inicio_Historico, end: h.Fim_Historico },
            Tipo_Faturamento: h.Tipo_Faturamento,
            Valor_Calculado: h.Valor_Calculado,
            Duracao_Faturada: h.Duracao_Faturada
        });

        const payload = [
            ...historicosParaCriar.map(h => ({ acao: "create", ...mapToPayload(h) })),
            ...historicosParaApagar.map(h => ({ acao: "delete", ...mapToPayload(h) })),
            ...historicosParaAtualizar.map(h => ({ acao: "update", ...mapToPayload(h) }))
        ];

        const success = await handleSaveHistoricos(payload); // De common.js

        if (success) {
            saveStatus.textContent = 'Alterações salvas com sucesso!';
            saveStatus.className = 'success';

            // Limpa o "staging" local
            historicosParaCriar = [];
            historicosParaApagar = [];
            historicosParaAtualizar = [];

            // Recarrega os dados (o cache foi atualizado por handleSaveHistoricos)
            const data = await fetchAllData();
            dataHistoricos = data.dataHistoricos;

            renderDetails();

        } else { // 'success' é false
            saveStatus.textContent = 'Falha ao salvar. Tente novamente.';
            saveStatus.className = 'error';
            saveOSBtn.disabled = false; // Permite tentar de novo
        }
    });

    // --- LÓGICA DE MODAIS ---

    // Editar OS (Modal)
    editOSDetailsBtn.addEventListener('click', () => {
        showOSModal('update', currentOS, handleSaveOSEditClick); // de common.js
    });

    async function handleSaveOSEditClick(payload) {
        const osModalSaveBtn = document.getElementById('os-modal-save-btn');
        const osModalError = document.getElementById('os-modal-error');

        osModalSaveBtn.disabled = true;
        osModalSaveBtn.textContent = 'A salvar...';
        osModalError.textContent = '';

        const success = await handleSaveOS(payload); // de common.js

        if (success) {
            hideOSModal();
            // Recarrega os dados (cache foi atualizado)
            const { dataOS: newDataOS } = await fetchAllData();
            dataOS = newDataOS;
            currentOS = dataOS.find(o => o.ID_OS === currentOSId);
            renderDetails();
        } else {
            osModalError.textContent = "Não foi possível salvar. Tente novamente.";
        }

        osModalSaveBtn.disabled = false;
        osModalSaveBtn.textContent = 'Salvar';
    }

    osModalCloseBtn.addEventListener('click', hideOSModal);
    osModalCancelBtn.addEventListener('click', hideOSModal);
    osModal.addEventListener('click', (e) => { if (e.target === osModal) hideOSModal(); });
    osModalDiscountInput.addEventListener('input', (e) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        e.target.value = formatCurrency(Number(rawValue) / 100);
    });

    // Editar Histórico (Modal)
    function showHistoricoEditModal(historicoId) {
        // Busca em todos os locais (cache, criar, atualizar)
        const historico = [...dataHistoricos, ...historicosParaCriar, ...historicosParaAtualizar].find(h => h.ID_Historico_Web === historicoId);
        if (!historico) return;

        historicoEditContext = historico;

        const ativo = dataAtivos.find(a => a.ID_Ativo === historico.ID_Ativo);
        document.getElementById('historico-modal-ativo-name').textContent = ativo ? ativo.Nome_Ativo : 'Desconhecido';

        const radios = document.querySelectorAll('input[name="edit-billing-type"]');
        radios.forEach(r => r.checked = r.value === historico.Tipo_Faturamento);

        const inputsHora = document.getElementById('edit-date-inputs-hora');
        const inputsDiaria = document.getElementById('edit-date-inputs-diaria');
        inputsHora.classList.toggle('is-hidden', historico.Tipo_Faturamento !== 'hora');
        inputsDiaria.classList.toggle('is-hidden', historico.Tipo_Faturamento !== 'diaria');

        if (historico.Tipo_Faturamento === 'hora') {
            document.getElementById('edit-start-time-input').value = toLocalISOString(new Date(historico.Inicio_Historico)).substring(0, 16);
            document.getElementById('edit-end-time-input').value = toLocalISOString(new Date(historico.Fim_Historico)).substring(0, 16);
        } else {
            document.getElementById('edit-start-date-input').value = new Date(historico.Inicio_Historico).toISOString().substring(0, 10);
            document.getElementById('edit-end-date-input').value = new Date(historico.Fim_Historico).toISOString().substring(0, 10);
        }

        document.getElementById('historico-modal-error').textContent = '';
        historicoEditModal.classList.remove('is-hidden');
    }

    function hideHistoricoEditModal() {
        historicoEditContext = null;
        historicoEditModal.classList.add('is-hidden');
    }

    historicoModalCloseBtn.addEventListener('click', hideHistoricoEditModal);
    historicoModalCancelBtn.addEventListener('click', hideHistoricoEditModal);

    // Salvar Edição de Histórico
    historicoModalSaveBtn.addEventListener('click', () => {
        const errorEl = document.getElementById('historico-modal-error');
        errorEl.textContent = '';
        const billingType = document.querySelector('input[name="edit-billing-type"]:checked').value;
        const ativo = dataAtivos.find(a => a.ID_Ativo === historicoEditContext.ID_Ativo);
        let start, end, duracao, valor, valorCalculado, inicioISO, fimISO;

        try {
            if (billingType === 'hora') {
                start = document.getElementById('edit-start-time-input').value;
                end = document.getElementById('edit-end-time-input').value;
                if (!start || !end) { throw new Error("Preencha início e fim."); }

                const startDate = new Date(start); const endDate = new Date(end);
                if (startDate >= endDate) { throw new Error("Fim deve ser posterior ao início."); }

                valor = ativo['Valor Hora'];
                if (valor === null || valor === undefined) { throw new Error("Este ativo não possui 'Valor Hora'."); }

                duracao = (endDate - startDate) / 36e5;
                valorCalculado = duracao * valor;
                inicioISO = startDate.toISOString();
                fimISO = endDate.toISOString();

            } else {
                start = document.getElementById('edit-start-date-input').value;
                end = document.getElementById('edit-end-date-input').value;
                if (!start || !end) { throw new Error("Preencha as datas de início e fim."); }

                const startDate = new Date(start + 'T00:00:00');
                const endDate = new Date(end + 'T00:00:00');
                if (startDate > endDate) { throw new Error("Fim deve ser igual ou posterior ao início."); }

                valor = ativo['Valor Diária'];
                if (valor === null || valor === undefined) { throw new Error("Este ativo não possui 'Valor Diária'."); }

                duracao = Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
                valorCalculado = duracao * valor;
                inicioISO = startDate.toISOString();

                const endDateFim = new Date(end + 'T23:59:59');
                fimISO = endDateFim.toISOString();
            }

            const todosHistoricos = [...dataHistoricos, ...historicosParaCriar, ...historicosParaAtualizar];
            if (!checkAvailability(todosHistoricos, ativo.ID_Ativo, inicioISO, fimISO, historicoEditContext.ID_Historico_Web)) {
                throw new Error("Conflito de agendamento detectado.");
            }

            // Histórico atualizado
            const updatedHistorico = {
                ...historicoEditContext,
                Inicio_Historico: inicioISO,
                Fim_Historico: fimISO,
                Tipo_Faturamento: billingType,
                Valor_Calculado: valorCalculado,
                Duracao_Faturada: duracao
            };

            // Atualiza o "staging"
            // 1. Se estava em "Para Criar", apenas atualize lá
            const indexCriar = historicosParaCriar.findIndex(h => h.ID_Historico_Web === updatedHistorico.ID_Historico_Web);
            if (indexCriar > -1) {
                historicosParaCriar[indexCriar] = updatedHistorico;
            } else {
                // 2. Se estava em "Para Atualizar", atualize lá
                const indexAtualizar = historicosParaAtualizar.findIndex(h => h.ID_Historico_Web === updatedHistorico.ID_Historico_Web);
                if (indexAtualizar > -1) {
                    historicosParaAtualizar[indexAtualizar] = updatedHistorico;
                } else {
                    // 3. Senão, adicione em "Para Atualizar"
                    historicosParaAtualizar.push(updatedHistorico);
                }
            }

            hideHistoricoEditModal();
            renderDetails();

        } catch (error) {
            errorEl.textContent = error.message;
        }
    });


    // --- LÓGICA DE PDF ---
    // --- LÓGICA DE PRÉ-IMPRESSÃO ---
    function openPrintModal() {
        renderPrintPreview();
        document.getElementById('print-modal').classList.remove('is-hidden');
    }

    function closePrintModal() {
        document.getElementById('print-modal').classList.add('is-hidden');
    }

    // Listener do botão principal
    generatePdfBtn.addEventListener('click', openPrintModal);

    // Listeners do Modal
    document.getElementById('print-modal-close-btn').addEventListener('click', closePrintModal);
    document.getElementById('do-print-btn').addEventListener('click', () => { window.print(); });

    // Listeners dos Checkboxes
    document.getElementById('print-check-company').addEventListener('change', renderPrintPreview);
    document.getElementById('print-check-client').addEventListener('change', renderPrintPreview);
    document.getElementById('print-check-values').addEventListener('change', renderPrintPreview);

    function renderPrintPreview() {
        const showCompany = document.getElementById('print-check-company').checked;
        const showClient = document.getElementById('print-check-client').checked;
        const showValues = document.getElementById('print-check-values').checked;

        const previewArea = document.getElementById('print-preview-area');
        if (!currentOS) return;

        // Dados
        const crm = currentOS.ID_CRM && currentOS.ID_CRM !== 'SEM CRM' ? dataCRM.find(c => c.ID_CRM_Notion === currentOS.ID_CRM) : null;

        // Unifica históricos
        const idsApagados = historicosParaApagar.map(h => h.ID_Historico_Web);
        const idsAtualizados = historicosParaAtualizar.map(h => h.ID_Historico_Web);
        const historicosBase = dataHistoricos.filter(h => h.ID_OS_Vinculada === currentOSId && !idsApagados.includes(h.ID_Historico_Web) && !idsAtualizados.includes(h.ID_Historico_Web));
        const historicosVisiveis = [...historicosBase, ...historicosParaCriar.filter(h => h.ID_OS_Vinculada === currentOSId), ...historicosParaAtualizar.filter(h => h.ID_OS_Vinculada === currentOSId)];

        // Cálculos
        const grossValue = calculateGrossValue(currentOSId, dataHistoricos, historicosParaCriar, historicosParaApagar, historicosParaAtualizar);
        const discountValue = currentOS.Desconto_OS || 0;
        const finalTotal = grossValue - discountValue;

        // --- CONSTRUÇÃO DO HTML DO DOCUMENTO ---
        let html = '';

        // 1. Cabeçalho da Empresa
        if (showCompany) {
            html += `
                <div class="print-doc-header">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <img src="https://pps.whatsapp.net/v/t61.24694-24/430476646_2182562082088507_1595908026160426676_n.jpg?ccb=11-4&oh=01_Q5Aa3gHuz6gWD0UDlEX6WxvUywwkB01s3dkrkLPQrkow0KvGAw&oe=697B9FF2&_nc_sid=5e03e0&_nc_cat=108" alt="Logo" style="height: 60px; width: auto; border-radius: 50%;">
                        <div>
                            <h1 style="font-size: 16pt; margin: 0;">AGOORA HUB SERVICOS CULTURAIS LTDA</h1>
                            <p style="margin: 2px 0 0; font-size: 9pt; color: #555;">
                                CNPJ: 57.888.407/0001-14<br>
                                R ENG JORGE OLIVA, 173, VILA MASCOTE<br>
                                SÃO PAULO - SP, CEP: 04.362-060
                            </p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="font-size: 18pt;">Ordem de Serviço</h2>
                        <p style="margin: 5px 0 0; font-size: 10pt;">#${currentOS.Nome_OS}<br>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="print-doc-header">
                    <div></div>
                    <div style="text-align: right;">
                        <h2 style="font-size: 18pt;">Ordem de Serviço</h2>
                        <p style="margin: 5px 0 0; font-size: 10pt;">#${currentOS.Nome_OS}<br>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
            `;
        }

        // 2. Dados do Cliente
        if (showClient && crm) {
            html += `
                <div class="print-section">
                    <h3>Dados do Cliente</h3>
                    <div class="print-grid-2">
                        <div class="print-field"><strong>Nome:</strong> ${crm.Nome_CRM || 'N/D'}</div>
                        <div class="print-field"><strong>Telefone:</strong> ${crm.Telefone || 'N/D'}</div>
                        <div class="print-field"><strong>E-mail:</strong> ${crm.Email || 'N/D'}</div>
                        <div class="print-field"><strong>Endereço:</strong> ${crm.Endereco_Completo || 'N/D'}</div>
                    </div>
                </div>
            `;
        }

        // 3. Tabela de Itens
        const groupedByClassification = historicosVisiveis.reduce((acc, historico) => {
            const ativo = dataAtivos.find(a => a.ID_Ativo === historico.ID_Ativo);
            const classification = (ativo && ativo.Classificacao) ? ativo.Classificacao : 'Sem Classificação';
            if (!acc[classification]) acc[classification] = [];
            acc[classification].push(historico);
            return acc;
        }, {});

        const sortedClassifications = Object.keys(groupedByClassification).sort();

        sortedClassifications.forEach(classification => {
            html += `<h4 style="margin-bottom: 5px; font-size: 10pt; color: #000; border-bottom: 2px solid #ccc; padding-bottom: 3px;">${classification}</h4>`;
            html += `
                <table class="print-table">
                    <thead>
                        <tr>
                            <th style="width: 40%;">Ativo</th>
                            <th style="width: 40%;">Período</th>
                            ${showValues ? '<th style="text-align: right;">Subtotal</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
            `;

            const historicosDoGrupo = groupedByClassification[classification];
            historicosDoGrupo.forEach(historico => {
                const ativo = dataAtivos.find(a => a.ID_Ativo === historico.ID_Ativo);
                if (!ativo) return;

                const start = new Date(historico.Inicio_Historico), end = new Date(historico.Fim_Historico);
                let periodoHtml = (historico.Tipo_Faturamento === 'hora')
                    ? `${formatDate(start)} - ${formatDate(end)}`
                    : `${formatDateOnly(start)} - ${formatDateOnly(end)}`;

                html += `
                    <tr>
                        <td>${ativo.Nome_Ativo}</td>
                        <td>${periodoHtml}</td>
                        ${showValues ? `<td style="text-align: right;">${formatCurrency(historico.Valor_Calculado)}</td>` : ''}
                    </tr>
                `;
            });

            html += `</tbody></table>`;
        });

        // 4. Totais
        if (showValues) {
            html += `
                <div class="print-totals">
                    <table>
                        <tr>
                            <td>Valor Bruto:</td>
                            <td>${formatCurrency(grossValue)}</td>
                        </tr>
                        <tr>
                            <td>Desconto:</td>
                            <td>${formatCurrency(discountValue)}</td>
                        </tr>
                        <tr class="total-row">
                            <td>Total:</td>
                            <td>${formatCurrency(finalTotal)}</td>
                        </tr>
                    </table>
                </div>
            `;
        }

        previewArea.innerHTML = html;
    }


    // --- INICIALIZAÇÃO DA PÁGINA ---

    backBtn.addEventListener('click', () => {
        window.location.href = 'os.html';
    });

    // Filtro de Ativos
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        suggestionsContainer.innerHTML = '';
        if (!query) {
            selectedAtivoId = null;
            return;
        }
        dataAtivos
            .filter(a => a.Nome_Ativo.toLowerCase().includes(query) && a.Situação === '01 - Ativo')
            .forEach(a => {
                const div = document.createElement('div');
                div.textContent = a.Nome_Ativo;
                div.addEventListener('click', () => {
                    searchInput.value = a.Nome_Ativo;
                    selectedAtivoId = a.ID_Ativo;
                    suggestionsContainer.innerHTML = '';
                });
                suggestionsContainer.appendChild(div);
            });
    });

    // Toggle de Faturamento
    billingTypeRadios.forEach(radio => radio.addEventListener('change', (e) => {
        currentBillingType = e.target.value;
        document.getElementById('date-inputs-hora').classList.toggle('is-hidden', currentBillingType !== 'hora');
        document.getElementById('date-inputs-diaria').classList.toggle('is-hidden', currentBillingType !== 'diaria');
    }));

    /**
     * Ponto de entrada da página
     */
    async function initializePage() {
        try {
            currentOSId = getIdFromUrl(); // de common.js
            if (!currentOSId) {
                alert("ID da Ordem de Serviço não encontrado.");
                window.location.href = 'os.html';
                return;
            }

            const data = await fetchAllData(); // de common.js
            dataOS = data.dataOS;
            dataAtivos = data.dataAtivos;
            dataHistoricos = data.dataHistoricos;
            dataCRM = data.dataCRM;

            currentOS = dataOS.find(o => o.ID_OS === currentOSId);
            if (!currentOS) {
                alert("Ordem de Serviço não encontrada.");
                window.location.href = 'os.html';
                return;
            }

            // Agora que os dados estão carregados, renderiza tudo
            renderDetails();

        } catch (error) {
            console.error(error);
            mainView.innerHTML = `<p class="error-message">Não foi possível carregar os dados. Verifique a sua ligação ou os endpoints dos webhooks.</p>`;
        }
    }

    initializePage();
});