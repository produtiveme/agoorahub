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
    
    // Arrays para gerenciar o "lote" de alterações
    let historicosParaCriar = [];
    let historicosParaApagar = [];
    let historicosParaAtualizar = [];

    // --- ELEMENTOS DO DOM ---
    const osDetailsTitle = document.getElementById('os-details-title');
    const crmPanel = document.getElementById('crm-details-panel');
    const crmInfoContainer = document.getElementById('crm-info-container');
    const alocadosList = document.getElementById('alocados-list');
    const saveOSBtn = document.getElementById('save-os-btn');
    const saveStatus = document.getElementById('save-status');
    const generatePdfBtn = document.getElementById('generate-pdf-btn');

    // Formulário de Adicionar Ativo
    const addAtivoBtn = document.getElementById('add-ativo-btn');
    const searchInput = document.getElementById('ativo-search-input');
    const suggestionsContainer = document.getElementById('ativo-suggestions');
    const errorMessage = document.getElementById('error-message');
    const billingTypeRadios = document.querySelectorAll('input[name="billing-type"]');
    
    // Botões de Navegação/Ação
    const backBtn = document.getElementById('back-to-dashboard-btn');
    const editOSDetailsBtn = document.getElementById('edit-os-details-btn');

    // --- Modal de OS (para edição) ---
    const osModal = document.getElementById('os-modal');
    const osModalCloseBtn = document.getElementById('os-modal-close-btn');
    const osModalCancelBtn = document.getElementById('os-modal-cancel-btn');
    const osModalDiscountInput = document.getElementById('os-modal-discount-input');

    // --- Modal de Histórico ---
    const historicoEditModal = document.getElementById('historico-edit-modal');
    const historicoModalCloseBtn = document.getElementById('historico-modal-close-btn');
    const historicoModalCancelBtn = document.getElementById('historico-modal-cancel-btn');
    const historicoModalSaveBtn = document.getElementById('historico-modal-save-btn');


    // --- LÓGICA DE ESTADO (Pending Changes) ---

    /**
     * Atualiza o estado do botão "Salvar no Notion" com base nas alterações pendentes.
     */
    function updateSaveButtonState() {
        const hasPendingChanges = historicosParaCriar.length > 0 || historicosParaApagar.length > 0 || historicosParaAtualizar.length > 0;
        saveOSBtn.disabled = !hasPendingChanges;
        saveOSBtn.classList.toggle('pending-changes', hasPendingChanges);
        if (!hasPendingChanges) {
            saveStatus.textContent = '';
        }
    }

    /**
     * Atualiza o card de Resumo Financeiro.
     */
    function updateFinancialSummary() {
        if (!currentOS) return;
        
        // Usa a função global `calculateGrossValue` de common.js
        const grossValue = calculateGrossValue(
            currentOSId,
            dataHistoricos,
            historicosParaCriar,
            historicosParaApagar,
            historicosParaAtualizar
        );
        
        const discountValue = currentOS ? (currentOS.Desconto_OS || 0) : 0;
        const finalTotal = grossValue - discountValue;

        document.getElementById('os-gross-value').textContent = formatCurrency(grossValue);
        document.getElementById('os-discount-value').textContent = formatCurrency(discountValue);
        document.getElementById('os-final-total-value').textContent = formatCurrency(finalTotal);
    }


    // --- RENDERIZAÇÃO ---

    /**
     * Renderiza todos os detalhes da página (Título, CRM, Alocados, Financeiro).
     */
    function renderDetails() {
        if (!currentOS) {
            osDetailsTitle.textContent = "Ordem de Serviço não encontrada.";
            return;
        }

        osDetailsTitle.textContent = `Detalhes da ${currentOS.Nome_OS}`;
        
        // Renderizar painel do CRM
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

        // Renderizar lista de Ativos Alocados
        alocadosList.innerHTML = '';
        const idsApagados = historicosParaApagar.map(h => h.ID_Historico_Web);
        const idsAtualizados = historicosParaAtualizar.map(h => h.ID_Historico_Web);
        
        const historicosBase = dataHistoricos.filter(h => 
            !idsApagados.includes(h.ID_Historico_Web) && 
            !idsAtualizados.includes(h.ID_Historico_Web)
        );
        
        const historicosVisiveis = [...historicosBase, ...historicosParaCriar, ...historicosParaAtualizar]
            .filter(h => h.ID_OS_Vinculada === currentOSId);
        
        if (historicosVisiveis.length === 0) {
            alocadosList.innerHTML = '<p>Nenhum ativo alocado nesta OS.</p>';
        } else {
            // Agrupa por classificação
            const groupedByClassification = historicosVisiveis.reduce((acc, historico) => {
                const ativo = dataAtivos.find(a => a.ID_Ativo === historico.ID_Ativo);
                const classification = (ativo && ativo.Classificacao) ? ativo.Classificacao : 'Sem Classificação';
                if (!acc[classification]) acc[classification] = [];
                acc[classification].push(historico);
                return acc;
            }, {});

            // Ordena as classificações (Local, Profissional, Outros)
            const sortedClassifications = Object.keys(groupedByClassification).sort((a, b) => {
                const order = { 'Local': 1, 'Profissional': 2 };
                const aOrder = order[a] || 3, bOrder = order[b] || 3;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return a.localeCompare(b);
            });

            // Cria o HTML
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
        }
        
        // Adiciona listeners aos botões de remover/editar recém-criados
        alocadosList.querySelectorAll('.remove-btn').forEach(button => button.addEventListener('click', handleRemoveHistorico));
        alocadosList.querySelectorAll('.edit-btn').forEach(button => button.addEventListener('click', (e) => showHistoricoEditModal(e.target.dataset.historicoId)));
        
        // Atualiza o botão de salvar e o resumo financeiro
        updateSaveButtonState();
        updateFinancialSummary(); 
    }


    // --- LÓGICA DOS MODAIS (Específicos desta página) ---

    /**
     * Mostra o modal para editar um histórico de alocação.
     * @param {string} historicoId - O ID (web ou temp) do histórico.
     */
    function showHistoricoEditModal(historicoId) {
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
            document.getElementById('edit-start-date-input').value = historico.Inicio_Historico.substring(0, 10);
            document.getElementById('edit-end-date-input').value = historico.Fim_Historico.substring(0, 10);
        }
        
        document.getElementById('historico-modal-error').textContent = '';
        historicoEditModal.classList.remove('is-hidden');
    }

    function hideHistoricoEditModal() {
        historicoEditContext = null;
        historicoEditModal.classList.add('is-hidden');
    }

    /**
     * Valida e salva a edição de um histórico (localmente).
     */
    function handleHistoricoEditSave() {
        const errorEl = document.getElementById('historico-modal-error');
        errorEl.textContent = '';
        const billingType = document.querySelector('input[name="edit-billing-type"]:checked').value;
        const ativo = dataAtivos.find(a => a.ID_Ativo === historicoEditContext.ID_Ativo);
        let start, end, duracao, valor, valorCalculado, inicioISO, fimISO;

        if (billingType === 'hora') {
            start = document.getElementById('edit-start-time-input').value; end = document.getElementById('edit-end-time-input').value;
            if (!start || !end) { errorEl.textContent = "Preencha início e fim."; return; }
            const startDate = new Date(start); const endDate = new Date(end);
            if (startDate >= endDate) { errorEl.textContent = "Fim deve ser posterior ao início."; return; }
            valor = ativo['Valor Hora'];
            if (valor === null || valor === undefined) { errorEl.textContent = "Este ativo não possui 'Valor Hora'."; return; }
            duracao = (endDate - startDate) / 36e5; valorCalculado = duracao * valor; inicioISO = startDate.toISOString(); fimISO = endDate.toISOString();
        } else {
            start = document.getElementById('edit-start-date-input').value; end = document.getElementById('edit-end-date-input').value;
            if (!start || !end) { errorEl.textContent = "Preencha as datas de início e fim."; return; }
            const startDate = new Date(start + 'T00:00:00-03:00'); 
            const endDate = new Date(end + 'T23:59:59-03:00');
            if (startDate > endDate) { errorEl.textContent = "Fim deve ser igual ou posterior ao início."; return; }
            valor = ativo['Valor Diária'];
            if (valor === null || valor === undefined) { errorEl.textContent = "Este ativo não possui 'Valor Diária'."; return; }
            duracao = Math.round((endDate - startDate) / MS_PER_DAY);
            valorCalculado = duracao * valor; inicioISO = startDate.toISOString(); fimISO = endDate.toISOString();
        }
        
        if (!checkAvailability(dataHistoricos, ativo.ID_Ativo, inicioISO, fimISO, historicoEditContext.ID_Historico_Web)) { 
            errorEl.textContent = "Conflito de agendamento detectado."; 
            return; 
        }
        
        const updatedHistorico = { ...historicoEditContext, Inicio_Historico: inicioISO, Fim_Historico: fimISO, Tipo_Faturamento: billingType, Valor_Calculado: valorCalculado, Duracao_Faturada: duracao };

        // Atualiza o histórico no array apropriado (criar ou atualizar)
        const indexCriar = historicosParaCriar.findIndex(h => h.ID_Historico_Web === updatedHistorico.ID_Historico_Web);
        if(indexCriar > -1) {
            historicosParaCriar[indexCriar] = updatedHistorico;
        } else {
            const indexAtualizar = historicosParaAtualizar.findIndex(h => h.ID_Historico_Web === updatedHistorico.ID_Historico_Web);
            if (indexAtualizar > -1) {
                historicosParaAtualizar[indexAtualizar] = updatedHistorico;
            } else {
                historicosParaAtualizar.push(updatedHistorico);
            }
        }
        
        hideHistoricoEditModal();
        renderDetails();
    }


    // --- EVENT LISTENERS ---

    // Navegação
    backBtn.addEventListener('click', () => {
        window.location.href = 'os.html';
    });

    // Mudar tipo de faturamento (Hora/Diária)
    billingTypeRadios.forEach(radio => radio.addEventListener('change', (e) => {
        currentBillingType = e.target.value;
        document.getElementById('date-inputs-hora').classList.toggle('is-hidden', currentBillingType !== 'hora');
        document.getElementById('date-inputs-diaria').classList.toggle('is-hidden', currentBillingType !== 'diaria');
    }));

    // Autocomplete da busca de ativos
    searchInput.addEventListener('input', () => { 
        const query = searchInput.value.toLowerCase(); 
        suggestionsContainer.innerHTML = ''; 
        if (!query) { 
            selectedAtivoId = null; 
            return; 
        } 
        dataAtivos
            .filter(a => a.Nome_Ativo.toLowerCase().includes(query) && a.Situação === '01 - Ativo')
            .slice(0, 10) // Limita a 10 sugestões
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

    /**
     * Adiciona um ativo à lista local (historicosParaCriar).
     */
    addAtivoBtn.addEventListener('click', () => {
        errorMessage.textContent = '';
        if (!selectedAtivoId) { errorMessage.textContent = "Por favor, selecione um ativo."; return; }
        const ativo = dataAtivos.find(a => a.ID_Ativo === selectedAtivoId);
        let start, end, duracao, valor, valorCalculado, inicioISO, fimISO;

        if (currentBillingType === 'hora') {
            start = document.getElementById('start-time-input').value; end = document.getElementById('end-time-input').value;
            if (!start || !end) { errorMessage.textContent = "Preencha as datas e horas de início e fim."; return; }
            const startDate = new Date(start); const endDate = new Date(end);
            if (startDate >= endDate) { errorMessage.textContent = "A data de fim deve ser posterior à de início."; return; }
            valor = ativo['Valor Hora'];
            if (valor === null || valor === undefined) { errorMessage.textContent = "Este ativo não possui 'Valor Hora' definido."; return; }
            duracao = ((endDate - startDate) / 36e5); valorCalculado = duracao * valor; inicioISO = startDate.toISOString(); fimISO = endDate.toISOString();
        } else { 
            start = document.getElementById('start-date-input').value; end = document.getElementById('end-date-input').value;
            if (!start || !end) { errorMessage.textContent = "Preencha as datas de início e fim."; return; }
            const startDate = new Date(start + 'T00:00:00-03:00'); 
            const endDate = new Date(end + 'T23:59:59-03:00');
            if (startDate > endDate) { errorMessage.textContent = "A data de fim deve ser igual ou posterior à de início."; return; }
            valor = ativo['Valor Diária'];
            if (valor === null || valor === undefined) { errorMessage.textContent = "Este ativo não possui 'Valor Diária' definido."; return; }
            duracao = Math.round((endDate - startDate) / MS_PER_DAY);
            valorCalculado = duracao * valor; inicioISO = startDate.toISOString(); fimISO = endDate.toISOString();
        }

        if (!checkAvailability(dataHistoricos, selectedAtivoId, inicioISO, fimISO)) { 
            errorMessage.textContent = "Erro: Ativo já alocado neste período."; 
            return; 
        }

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
        searchInput.value = ''; selectedAtivoId = null; 
        document.getElementById('start-time-input').value = ''; 
        document.getElementById('end-time-input').value = ''; 
        document.getElementById('start-date-input').value = ''; 
        document.getElementById('end-date-input').value = ''; 
        suggestionsContainer.innerHTML = '';
        
        renderDetails();
    });

    /**
     * Remove um histórico da lista local (ou adiciona à lista de apagar).
     */
    function handleRemoveHistorico(event) {
        const historicoId = event.target.dataset.historicoId;
        
        // Se estava na lista de "criar", apenas remove dela
        let index = historicosParaCriar.findIndex(h => h.ID_Historico_Web === historicoId);
        if (index > -1) {
            historicosParaCriar.splice(index, 1);
        } else {
            // Se estava na lista de "atualizar", remove dela
            index = historicosParaAtualizar.findIndex(h => h.ID_Historico_Web === historicoId);
            if (index > -1) {
                historicosParaAtualizar.splice(index, 1);
            }
            // Se era um item original, adiciona na lista para apagar
            const historicoOriginal = dataHistoricos.find(h => h.ID_Historico_Web === historicoId);
            if (historicoOriginal) {
                historicosParaApagar.push(historicoOriginal);
            }
        }
        renderDetails();
    }

    // Botão "Salvar Históricos no Notion"
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

        const success = await handleSaveHistoricos(payload);

        if (success) {
            saveStatus.textContent = 'Alterações salvas com sucesso!';
            saveStatus.className = 'success';
            // Reseta o estado local
            historicosParaCriar = [];
            historicosParaApagar = [];
            historicosParaAtualizar = [];
            // Recarrega os dados (do cache atualizado)
            const data = await fetchAllData();
            dataHistoricos = data.dataHistoricos;
        } else {
            saveStatus.textContent = 'Falha ao salvar. Tente novamente.';
            saveStatus.className = 'error';
        }
        
        renderDetails();
    });

    // --- Listeners dos Modais ---
    
    // Modal de Edição de OS
    editOSDetailsBtn.addEventListener('click', () => {
        showOSModal('update', currentOS, handleEditOSSaveClick);
    });
    osModalCloseBtn.addEventListener('click', hideOSModal);
    osModalCancelBtn.addEventListener('click', hideOSModal);
    osModal.addEventListener('click', (e) => { if (e.target === osModal) hideOSModal(); });
    osModalDiscountInput.addEventListener('input', (e) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        e.target.value = formatCurrency(Number(rawValue) / 100);
    });

    /**
     * Callback para salvar a edição da OS (nome, desconto).
     */
    async function handleEditOSSaveClick(payload) {
        const osModalSaveBtn = document.getElementById('os-modal-save-btn');
        const osModalError = document.getElementById('os-modal-error');
        
        osModalSaveBtn.disabled = true;
        osModalSaveBtn.textContent = 'A salvar...';
        osModalError.textContent = '';

        const success = await handleSaveOS(payload);

        if (success) {
            hideOSModal();
            // Recarrega os dados e atualiza a página
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
    
    // Modal de Edição de Histórico
    historicoModalCloseBtn.addEventListener('click', hideHistoricoEditModal);
    historicoModalCancelBtn.addEventListener('click', hideHistoricoEditModal);
    historicoModalSaveBtn.addEventListener('click', handleHistoricoEditSave);


    // --- GERAÇÃO DE PDF ---
    async function generatePDF() {
        if (!currentOS) return;

        generatePdfBtn.textContent = 'Gerando...';
        generatePdfBtn.disabled = true;

        const printableContent = document.createElement('div');
        // ... (Estilização do 'printableContent' como no original)
        printableContent.style.position = 'absolute';
        printableContent.style.left = '-9999px';
        printableContent.style.width = '210mm';
        printableContent.style.padding = '15mm';
        printableContent.style.backgroundColor = 'white';
        printableContent.style.fontFamily = 'Arial, sans-serif';
        printableContent.style.fontSize = '12px';
        printableContent.style.color = '#333';
        printableContent.style.boxSizing = 'border-box';
        
        const crm = dataCRM.find(c => c.ID_CRM_Notion === currentOS.ID_CRM);
        const historicosVisiveis = [...dataHistoricos, ...historicosParaCriar, ...historicosParaAtualizar].filter(h => h.ID_OS_Vinculada === currentOSId && !historicosParaApagar.some(del => del.ID_Historico_Web === h.ID_Historico_Web));
        
        const grossValue = calculateGrossValue(currentOSId, dataHistoricos, historicosParaCriar, historicosParaApagar, historicosParaAtualizar);
        const discountValue = currentOS.Desconto_OS || 0;
        const finalTotal = grossValue - discountValue;

        // ... (Construção do `pdfHtml` exatamente como no original)
        let pdfHtml = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 10px;">
                <h1 style="margin: 0; color: #007bff; font-size: 24px;">Agoora Hub</h1>
                <div style="text-align: right;">
                    <h2 style="margin: 0; font-size: 20px;">Ordem de Serviço</h2>
                    <p style="margin: 5px 0 0;">Data: ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>
            <h3 style="margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; font-size: 16px;">${currentOS.Nome_OS}</h3>
        `;
        if (crm) {
            pdfHtml += `
                <div style="margin-top: 20px; background-color: #f9f9f9; padding: 15px; border-radius: 5px; border: 1px solid #eee;">
                    <h4 style="margin-top: 0; margin-bottom: 10px; font-size: 14px;">Dados do Cliente</h4>
                    <p style="margin: 4px 0;"><strong>Nome:</strong> ${crm.Nome_CRM || 'N/D'}</p>
                    <p style="margin: 4px 0;"><strong>Telefone:</strong> ${crm.Telefone || 'N/D'}</p>
                    <p style="margin: 4px 0;"><strong>E-mail:</strong> ${crm.Email || 'N/D'}</p>
                    <p style="margin: 4px 0;"><strong>Endereço:</strong> ${crm.Endereco_Completo || 'N/D'}</p>
                </div>
            `;
        }
        pdfHtml += `<h3 style="margin-top: 30px; font-size: 16px;">Itens da OS</h3>`;
        const groupedByClassification = historicosVisiveis.reduce((acc, historico) => {
            const ativo = dataAtivos.find(a => a.ID_Ativo === historico.ID_Ativo);
            const classification = (ativo && ativo.Classificacao) ? ativo.Classificacao : 'Sem Classificação';
            if (!acc[classification]) acc[classification] = [];
            acc[classification].push(historico);
            return acc;
        }, {});
        const sortedClassifications = Object.keys(groupedByClassification).sort((a, b) => {
            const order = { 'Local': 1, 'Profissional': 2 };
            const aOrder = order[a] || 3, bOrder = order[b] || 3;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.localeCompare(b);
        });
        sortedClassifications.forEach(classification => {
            pdfHtml += `<h4 style="margin-top: 20px; font-style: italic; color: #555; font-size: 14px;">${classification}</h4>`;
            pdfHtml += `<table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px;">
                        <thead>
                            <tr style="background-color: #eee;">
                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Ativo</th>
                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Período</th>
                                <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>`;
            const historicosDoGrupo = groupedByClassification[classification];
            historicosDoGrupo.forEach(historico => {
                const ativo = dataAtivos.find(a => a.ID_Ativo === historico.ID_Ativo);
                if (!ativo) return;
                const start = new Date(historico.Inicio_Historico), end = new Date(historico.Fim_Historico);
                let periodoHtml = (historico.Tipo_Faturamento === 'hora')
                    ? `${formatDate(start)} - ${formatDate(end)}`
                    : `${formatDateOnly(start)} - ${formatDateOnly(end)}`;
                pdfHtml += `<tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${ativo.Nome_Ativo}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${periodoHtml}</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${formatCurrency(historico.Valor_Calculado)}</td>
                            </tr>`;
            });
            pdfHtml += `</tbody></table>`;
        });
        pdfHtml += `
            <div style="margin-top: 40px; page-break-inside: avoid; text-align: right;">
                <table style="display: inline-block; border-top: 2px solid #333; padding-top: 10px; font-size: 12px;">
                    <tr><td style="padding: 5px 10px;">Valor Bruto:</td><td style="padding: 5px 10px; text-align: right;">${formatCurrency(grossValue)}</td></tr>
                    <tr><td style="padding: 5px 10px;">Desconto:</td><td style="padding: 5px 10px; text-align: right;">${formatCurrency(discountValue)}</td></tr>
                    <tr style="font-weight: bold; font-size: 1.2em;"><td style="padding: 10px;">Valor Total:</td><td style="padding: 10px; text-align: right;">${formatCurrency(finalTotal)}</td></tr>
                </table>
            </div>
        `;

        printableContent.innerHTML = pdfHtml;
        document.body.appendChild(printableContent);

        try {
            const canvas = await html2canvas(printableContent, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${currentOS.Nome_OS}.pdf`);

        } catch(e) {
            console.error("Erro ao gerar PDF:", e);
            // Não use alert, apenas log
        } finally {
            document.body.removeChild(printableContent);
            generatePdfBtn.textContent = 'Gerar PDF';
            generatePdfBtn.disabled = false;
        }
    }

    generatePdfBtn.addEventListener('click', generatePDF);


    // --- INICIALIZAÇÃO DA PÁGINA ---
    async function initializePage() {
        // Pega o ID da URL
        currentOSId = getIdFromUrl();
        if (!currentOSId) {
            alert("Nenhuma OS selecionada. Redirecionando para o painel.");
            window.location.href = 'os.html';
            return;
        }

        try {
            // Carrega todos os dados (do cache ou da API)
            const data = await fetchAllData();
            dataOS = data.dataOS;
            dataAtivos = data.dataAtivos;
            dataHistoricos = data.dataHistoricos;
            dataCRM = data.dataCRM;
            
            // Define a OS atual
            currentOS = dataOS.find(o => o.ID_OS === currentOSId);

            if (!currentOS) {
                 alert("OS não encontrada. Redirecionando para o painel.");
                window.location.href = 'os.html';
                return;
            }
            
            // Renderiza a página
            renderDetails();

        } catch (error) {
            document.getElementById('details-view').innerHTML = `<p class="error-message">Não foi possível carregar os dados. Verifique a sua ligação ou os endpoints dos webhooks. <a href="os.html">Voltar ao Painel</a></p>`;
        }
    }

    initializePage();
});