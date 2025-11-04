document.addEventListener('DOMContentLoaded', () => {

    // --- DADOS GLOBAIS (do cache) ---
    let dataOS = [];
    let dataAtivos = [];
    let dataHistoricos = [];
    let dataCRM = [];

    // --- ELEMENTOS DO DOM ---
    const osListContainer = document.getElementById('os-list');
    const createOSBtn = document.getElementById('create-new-os-btn');
    const osModal = document.getElementById('os-modal');
    const osModalCloseBtn = document.getElementById('os-modal-close-btn');
    const osModalCancelBtn = document.getElementById('os-modal-cancel-btn');
    const osModalDiscountInput = document.getElementById('os-modal-discount-input');

    /**
     * Renderiza o painel principal de Ordens de Serviço
     */
    function renderDashboard() {
        osListContainer.innerHTML = ''; // Limpa os skeletons
        
        if (dataOS.length === 0) {
            osListContainer.innerHTML = '<p>Nenhuma Ordem de Serviço encontrada.</p>';
            return;
        }

        dataOS.forEach(os => {
            // Calcula o valor bruto baseado nos históricos carregados
            // ATUALIZADO: Agora usa a função de `common.js`.
            // Note que não passamos os arrays de "pendentes", pois este painel
            // só deve mostrar o que já está salvo (dataHistoricos).
            const totalValue = calculateGrossValue(os.ID_OS, dataHistoricos);
            
            // Encontra o cliente (CRM)
            let crmInfoHtml = '<p><em>Nenhum CRM foi vinculado</em></p>';
            if (os.ID_CRM && os.ID_CRM !== 'SEM CRM') {
                const crm = dataCRM.find(c => c.ID_CRM_Notion === os.ID_CRM);
                if (crm) {
                    crmInfoHtml = `<p><strong>Cliente:</strong> ${crm.Nome_CRM}</p>`;
                }
            }

            // Cria o card da OS
            const osCard = document.createElement('div');
            osCard.className = 'os-card';
            osCard.innerHTML = `
                <div class="os-card-header">
                    <div>
                        <h3>${os.Nome_OS}</h3>
                        ${crmInfoHtml}
                        <p><strong>Valor Bruto: ${formatCurrency(totalValue)}</strong></p>
                    </div>
                    <div class="os-card-actions">
                        <button class="edit-os-btn" data-os-id="${os.ID_OS}">Editar</button>
                        <button class="view-details-btn" data-os-id="${os.ID_OS}">Ver Detalhes</button>
                    </div>
                </div>`;
            osListContainer.appendChild(osCard);
        });

        // Adiciona Event Listeners aos botões criados
        osListContainer.querySelectorAll('.view-details-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const osId = e.target.dataset.osId;
                window.location.href = `detalhe-os.html?id=${osId}`;
            });
        });
        
        osListContainer.querySelectorAll('.edit-os-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const osId = e.target.dataset.osId;
                const os = dataOS.find(o => o.ID_OS === osId);
                showOSModal('update', os, handleSaveOSClick);
            });
        });
    }

    /**
     * Callback para quando o modal de OS é salvo
     */
    async function handleSaveOSClick(payload) {
        const osModalSaveBtn = document.getElementById('os-modal-save-btn');
        const osModalError = document.getElementById('os-modal-error');
        
        osModalSaveBtn.disabled = true;
        osModalSaveBtn.textContent = 'A salvar...';
        osModalError.textContent = '';

        const success = await handleSaveOS(payload); // Função de common.js

        if (success) {
            hideOSModal();
            // Recarrega os dados (o cache foi atualizado)
            const { dataOS: newDataOS, dataCRM: newDataCRM } = await fetchAllData();
            dataOS = newDataOS;
            dataCRM = newDataCRM;
            renderDashboard(); // Re-renderiza o painel
        } else {
            osModalError.textContent = "Não foi possível salvar. Tente novamente.";
        }

        osModalSaveBtn.disabled = false;
        osModalSaveBtn.textContent = 'Salvar';
    }

    /**
     * Inicializa a página
     */
    async function initializePage() {
        try {
            const data = await fetchAllData();
            dataOS = data.dataOS;
            dataAtivos = data.dataAtivos;
            dataHistoricos = data.dataHistoricos;
            dataCRM = data.dataCRM;
            renderDashboard();
        } catch (error) {
            console.error(error);
            osListContainer.innerHTML = `<p class="error-message">Não foi possível carregar os dados. Verifique a sua ligação ou os endpoints dos webhooks.</p>`;
        }
    }

    // --- INICIALIZAÇÃO E EVENTOS GERAIS DO MODAL ---
    createOSBtn.addEventListener('click', () => {
        showOSModal('create', null, handleSaveOSClick);
    });

    osModalCloseBtn.addEventListener('click', hideOSModal);
    osModalCancelBtn.addEventListener('click', hideOSModal);
    osModal.addEventListener('click', (e) => { if (e.target === osModal) hideOSModal(); });
    osModalDiscountInput.addEventListener('input', (e) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        e.target.value = formatCurrency(Number(rawValue) / 100);
    });

    initializePage();
});